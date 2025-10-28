import express from 'express';
import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

import { NotificationType } from '@/api/entity/Notifications';
import { UserAuth } from '@/api/entity/UserAuth';
import { ResponseStatus, ServiceResponse } from '@/common/models/serviceResponse';
import AppleOAuthService, { AppleUserInfo } from '@/common/utils/appleOAuthService';
import { delayedEmailService } from '@/common/utils/delayedEmailService';
import { env } from '@/common/utils/envConfig';
import { handleServiceResponse } from '@/common/utils/httpHandlers';
import { sendEmailNotification } from '@/common/utils/mailService';
import { AppDataSource } from '@/server';

import { generateNotification } from '../../controllers/notification/NotificationController';

const Router = express.Router();

// Schema for Apple OAuth callback
const appleCallbackSchema = z.object({
  code: z.string(),
  state: z.string().optional(),
});

// Schema for Apple ID token verification
const appleIdTokenSchema = z.object({
  identityToken: z.string(),
  authorizationCode: z.string().optional(),
  user: z.string(),
  email: z.string().optional(),
  fullName: z
    .object({
      givenName: z.string().optional(),
      familyName: z.string().optional(),
    })
    .optional(),
});

/**
 * GET /api/v1/auth/apple/url
 * Get Apple OAuth authorization URL
 */
Router.get('/url', async (req: Request, res: Response) => {
  try {
    const appleOAuthService = AppleOAuthService.getInstance();
    const state = req.query.state as string;

    // Apple doesn't provide a direct URL generation like Google
    // This endpoint can be used to validate Apple Sign In configuration
    const authUrl = `https://appleid.apple.com/auth/authorize?client_id=${appleOAuthService['clientId']}&redirect_uri=https://nextdeal.in/auth/apple/callback&response_type=code&scope=name email&state=${state || ''}`;

    handleServiceResponse(
      new ServiceResponse(
        ResponseStatus.Success,
        'Apple OAuth URL generated successfully',
        { authUrl },
        StatusCodes.OK
      ),
      res
    );
  } catch (error) {
    console.error('Error generating Apple OAuth URL:', error);
    handleServiceResponse(
      new ServiceResponse(
        ResponseStatus.Failed,
        'Failed to generate Apple OAuth URL',
        null,
        StatusCodes.INTERNAL_SERVER_ERROR
      ),
      res
    );
  }
});

/**
 * POST /api/v1/auth/apple/callback
 * Handle Apple OAuth callback with authorization code
 */
Router.post('/callback', async (req: Request, res: Response) => {
  try {
    const validationResult = appleCallbackSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors.map((err) => err.message).join(', ');
      handleServiceResponse(
        new ServiceResponse(ResponseStatus.Failed, errorMessage, null, StatusCodes.BAD_REQUEST),
        res
      );
      return;
    }

    const { code, state } = validationResult.data;
    const appleOAuthService = AppleOAuthService.getInstance();

    // Complete OAuth flow
    const { userInfo, accessToken } = await appleOAuthService.completeOAuthFlow(code);

    // Find or create user
    const userRepo = AppDataSource.getRepository(UserAuth);
    let user = await userRepo.findOne({
      where: [{ appleId: userInfo.id }, { email: userInfo.email }],
    });

    if (!user) {
      // Create new user
      user = new UserAuth();
      user.appleId = userInfo.id;
      user.email = userInfo.email;
      user.fullName = userInfo.name || `${userInfo.given_name || ''} ${userInfo.family_name || ''}`.trim();
      user.profileImg = userInfo.picture;
      user.isEmailVerified = userInfo.verified_email || false;
      user.isMobileVerified = false;
      user.isSignedUp = false;

      user = await userRepo.save(user);

      if (user.email) {
        // Schedule welcome email to be sent after 2 hours instead of immediately
        const welcomeEmailSubject = `Great news! ${user.fullName} welcome to Nextdeal`;
        const welcomeEmailBody = `Great news! Your ${user.userType === 'Agent' ? '5' : '1'} property active on Nextdeal is absolutely FREE -list now and connect with serious buyers!`;

        delayedEmailService.scheduleEmail(
          user.email,
          welcomeEmailSubject,
          welcomeEmailBody,
          2 // Send after 2 hours
        );
      }
    } else {
      // Update existing user with Apple data if needed
      if (!user.appleId) {
        user.appleId = userInfo.id;
        user.isEmailVerified = userInfo.verified_email || user.isEmailVerified;
        await userRepo.save(user);
      }
    }

    // Generate JWT token if fully verified
    let token = null;
    if (user.isFullyVerified()) {
      token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          userType: user.userType,
        },
        env.ACCESS_SECRET_KEY,
        { expiresIn: '1d' }
      );
    }

    handleServiceResponse(
      new ServiceResponse(
        ResponseStatus.Success,
        'Apple OAuth authentication successful',
        {
          user: {
            id: user.id,
            fullName: user.fullName,
            email: user.email,
            mobileNumber: user.mobileNumber,
            userType: user.userType,
            isEmailVerified: user.isEmailVerified,
            isMobileVerified: user.isMobileVerified,
            profilePhoto: user.userProfileUrl,
            profileImg: user.profileImg,
            isSignedUp: !!user.userType,
            isFullyVerified: user.isFullyVerified(),
            isNewUser: !user.userType,
            userProfileUrl: user.userProfileUrl,
          },
          token,
          state,
        },
        StatusCodes.OK
      ),
      res
    );
  } catch (error) {
    console.error('Apple OAuth callback error:', error);
    handleServiceResponse(
      new ServiceResponse(
        ResponseStatus.Failed,
        'Apple OAuth authentication failed',
        null,
        StatusCodes.INTERNAL_SERVER_ERROR
      ),
      res
    );
  }
});

/**
 * POST /api/v1/auth/apple/verify-token
 * Verify Apple ID token and authenticate user
 */
Router.post('/verify-token', async (req: Request, res: Response) => {
  try {
    const validationResult = appleIdTokenSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors.map((err) => err.message).join(', ');
      handleServiceResponse(
        new ServiceResponse(ResponseStatus.Failed, errorMessage, null, StatusCodes.BAD_REQUEST),
        res
      );
      return;
    }

    const { identityToken, authorizationCode, user: appleUserId, email, fullName } = validationResult.data;
    const appleOAuthService = AppleOAuthService.getInstance();

    console.log('🍎 Verifying Apple ID token...');

    // Verify ID token
    const userInfo = await appleOAuthService.verifyIdToken(identityToken);

    console.log('✅ Apple ID token verified successfully for user:', userInfo.email);

    // Find or create user
    const userRepo = AppDataSource.getRepository(UserAuth);
    let user = await userRepo.findOne({
      where: [{ appleId: userInfo.id }, { email: userInfo.email || email }],
    });

    if (!user) {
      console.log('👤 Creating new user for Apple authentication:', userInfo.email || email);

      // Create new user
      user = new UserAuth();
      user.appleId = userInfo.id;
      user.email = userInfo.email || email;

      // Use provided fullName or construct from components
      if (fullName) {
        user.fullName = `${fullName.givenName || ''} ${fullName.familyName || ''}`.trim();
      } else if (userInfo.name) {
        user.fullName = userInfo.name;
      }

      user.profileImg = userInfo.picture;
      user.isEmailVerified = userInfo.verified_email || false;
      user.isMobileVerified = false;
      user.isSignedUp = false;

      user = await userRepo.save(user);

      if (user.email) {
        // Schedule welcome email to be sent after 2 hours instead of immediately
        const welcomeEmailSubject = `Great news! ${user.fullName} welcome to Nextdeal`;
        const welcomeEmailBody = `Great news! Your ${user.userType === 'Agent' ? '5' : '1'} property active on Nextdeal is absolutely FREE -list now and connect with serious buyers!`;

        delayedEmailService.scheduleEmail(
          user.email,
          welcomeEmailSubject,
          welcomeEmailBody,
          2 // Send after 2 hours
        );
      }
    } else {
      console.log('👤 Existing user found for Apple authentication:', user.email);

      // Update existing user with Apple data if needed
      if (!user.appleId) {
        user.appleId = userInfo.id;
        user.isEmailVerified = userInfo.verified_email || user.isEmailVerified;
        await userRepo.save(user);
      }
    }

    // Generate JWT token if fully verified
    let token = null;
    if (user.isFullyVerified()) {
      token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          userType: user.userType,
        },
        env.ACCESS_SECRET_KEY,
        { expiresIn: '1d' }
      );
    }

    console.log('🎉 Apple authentication successful for user:', user.email);

    handleServiceResponse(
      new ServiceResponse(
        ResponseStatus.Success,
        'Apple ID token verification successful',
        {
          user: {
            id: user.id,
            fullName: user.fullName,
            email: user.email,
            mobileNumber: user.mobileNumber,
            userType: user.userType,
            isEmailVerified: user.isEmailVerified,
            isMobileVerified: user.isMobileVerified,
            profilePhoto: user.userProfileUrl,
            profileImg: user.profileImg,
            isSignedUp: !!user.userType,
            isFullyVerified: user.isFullyVerified(),
            isNewUser: !user.userType,
            userProfileUrl: user.userProfileUrl,
          },
          token,
        },
        StatusCodes.OK
      ),
      res
    );
  } catch (error) {
    console.error('❌ Apple ID token verification error:', error);

    // Provide more specific error messages
    let errorMessage = 'Apple ID token verification failed';
    if (error instanceof Error) {
      if (error.message.includes('invalid_token')) {
        errorMessage = 'Invalid Apple ID token';
      } else if (error.message.includes('expired_token')) {
        errorMessage = 'Apple ID token has expired';
      } else if (error.message.includes('network')) {
        errorMessage = 'Network error while verifying Apple token';
      }
    }

    handleServiceResponse(
      new ServiceResponse(ResponseStatus.Failed, errorMessage, null, StatusCodes.INTERNAL_SERVER_ERROR),
      res
    );
  }
});

export default Router;
