import express from 'express';
import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

import { UserAuth } from '@/api/entity/UserAuth';
import { ResponseStatus, ServiceResponse } from '@/common/models/serviceResponse';
import { delayedEmailService } from '@/common/utils/delayedEmailService';
import { env } from '@/common/utils/envConfig';
import GoogleOAuthService from '@/common/utils/googleOAuthService';
import { handleServiceResponse } from '@/common/utils/httpHandlers';
import { AppDataSource } from '@/server';

// import { sendEmailNotification } from '@/common/utils/mailService';
// import { NotificationType } from '@/api/entity/Notifications';
// import { generateNotification } from '../../controllers/notification/NotificationController';

const Router = express.Router();

// Schema for Google OAuth callback
const googleCallbackSchema = z.object({
  code: z.string(),
  state: z.string().optional(),
});

// Schema for Google ID token verification
const googleIdTokenSchema = z.object({
  idToken: z.string(),
});

/**
 * GET /api/v1/auth/google/url
 * Get Google OAuth authorization URL
 */
Router.get('/url', async (req: Request, res: Response) => {
  try {
    const googleOAuthService = GoogleOAuthService.getInstance();
    const state = req.query.state as string;
    const authUrl = googleOAuthService.getAuthUrl(state);

    handleServiceResponse(
      new ServiceResponse(
        ResponseStatus.Success,
        'Google OAuth URL generated successfully',
        { authUrl },
        StatusCodes.OK
      ),
      res
    );
  } catch (error) {
    console.error('Error generating Google OAuth URL:', error);
    handleServiceResponse(
      new ServiceResponse(
        ResponseStatus.Failed,
        'Failed to generate Google OAuth URL',
        null,
        StatusCodes.INTERNAL_SERVER_ERROR
      ),
      res
    );
  }
});

/**
 * POST /api/v1/auth/google/callback
 * Handle Google OAuth callback with authorization code
 */
Router.post('/callback', async (req: Request, res: Response) => {
  try {
    const validationResult = googleCallbackSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors.map((err) => err.message).join(', ');
      handleServiceResponse(
        new ServiceResponse(ResponseStatus.Failed, errorMessage, null, StatusCodes.BAD_REQUEST),
        res
      );
      return;
    }

    const { code, state } = validationResult.data;
    const googleOAuthService = GoogleOAuthService.getInstance();

    // Complete OAuth flow
    const { userInfo } = await googleOAuthService.completeOAuthFlow(code);

    // Find or create user
    const userRepo = AppDataSource.getRepository(UserAuth);
    let user = await userRepo.findOne({
      where: [{ googleId: userInfo.id }, { email: userInfo.email }],
    });

    if (!user) {
      // Create new user
      user = new UserAuth();
      user.googleId = userInfo.id;
      user.email = userInfo.email;
      user.fullName = userInfo.name;
      user.profileImg = userInfo.picture;
      user.isEmailVerified = true; // Google email is pre-verified
      user.isMobileVerified = false;
      user.isSignedUp = false;

      user = await userRepo.save(user);

      // Send welcome notification and email
      // generateNotification(
      //   user.id,
      //   `Great news! Your ${user.userType === "Agent" ? "5" : "1"} property active on Nextdeal is absolutely FREE -list now and connect with serious buyers!`,
      //   user.userProfileKey || undefined,
      //   NotificationType.WELCOME,
      //   user.fullName,
      //   'Get Started',
      //   undefined,
      //   'Welcome',
      //   undefined,
      //   undefined,
      //   undefined,
      //   user.id
      // );

      if (user.email) {
        // Schedule welcome email to be sent after 2 hours instead of immediately
        const welcomeEmailSubject = `Great news! ${user.fullName} welcome to Dhikcar`;
        const welcomeEmailBody = `Great news! Your ${user.userType === 'Dealer' ? '5' : '1'} car active on Dhikcar is absolutely FREE -list now and connect with serious buyers!`;

        delayedEmailService.scheduleEmail(
          user.email,
          welcomeEmailSubject,
          welcomeEmailBody,
          2 // Send after 2 hours
        );
      }
    } else {
      // Update existing user with Google data if needed
      if (!user.googleId) {
        user.googleId = userInfo.id;
        user.isEmailVerified = true;
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
        'Google OAuth authentication successful',
        {
          user: {
            id: user.id,
            fullName: user.fullName,
            email: user.email,
            mobileNumber: user.mobileNumber,
            userType: user.userType,
            isEmailVerified: user.isEmailVerified,
            isMobileVerified: user.isMobileVerified,
            profilePhoto: user.userProfileKey,
            profileImg: user.profileImg,
            isSignedUp: !!user.userType,
            isFullyVerified: user.isFullyVerified(),
            isNewUser: !user.userType,
            userProfileKey: user.userProfileKey,
          },
          token,
          state,
        },
        StatusCodes.OK
      ),
      res
    );
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    handleServiceResponse(
      new ServiceResponse(
        ResponseStatus.Failed,
        'Google OAuth authentication failed',
        null,
        StatusCodes.INTERNAL_SERVER_ERROR
      ),
      res
    );
  }
});

/**
 * POST /api/v1/auth/google/verify-token
 * Verify Google ID token and authenticate user
 */
Router.post('/verify-token', async (req: Request, res: Response) => {
  try {
    const validationResult = googleIdTokenSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors.map((err) => err.message).join(', ');
      handleServiceResponse(
        new ServiceResponse(ResponseStatus.Failed, errorMessage, null, StatusCodes.BAD_REQUEST),
        res
      );
      return;
    }

    const { idToken } = validationResult.data;
    const googleOAuthService = GoogleOAuthService.getInstance();

    console.log('🔐 Verifying Google ID token...');

    // Verify ID token
    const userInfo = await googleOAuthService.verifyIdToken(idToken);

    console.log('✅ Google ID token verified successfully for user:', userInfo.email);

    // Find or create user
    const userRepo = AppDataSource.getRepository(UserAuth);
    let user = await userRepo.findOne({
      where: [{ googleId: userInfo.id }, { email: userInfo.email }],
    });

    if (!user) {
      console.log('👤 Creating new user for Google authentication:', userInfo.email);

      // Create new user
      user = new UserAuth();
      user.googleId = userInfo.id;
      user.email = userInfo.email;
      user.fullName = userInfo.name;
      user.profileImg = userInfo.picture;
      user.isEmailVerified = true;
      user.isMobileVerified = false;
      user.isSignedUp = false;

      user = await userRepo.save(user);

      if (user.email) {
        // Schedule welcome email to be sent after 2 hours instead of immediately
        const welcomeEmailSubject = `Great news! ${user.fullName} welcome to Dhikcar`;
        const welcomeEmailBody = `Great news! Your ${user.userType === 'Dealer' ? '5' : '1'} car active on Dhikcar is absolutely FREE -list now and connect with serious buyers!`;

        delayedEmailService.scheduleEmail(
          user.email,
          welcomeEmailSubject,
          welcomeEmailBody,
          2 // Send after 2 hours
        );
      }
    } else {
      console.log('👤 Existing user found for Google authentication:', user.email);

      // Update existing user with Google data if needed
      if (!user.googleId) {
        user.googleId = userInfo.id;
        user.isEmailVerified = true;
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

    console.log('🎉 Google authentication successful for user:', user.email);

    handleServiceResponse(
      new ServiceResponse(
        ResponseStatus.Success,
        'Google ID token verification successful',
        {
          user: {
            id: user.id,
            fullName: user.fullName,
            email: user.email,
            mobileNumber: user.mobileNumber,
            userType: user.userType,
            isEmailVerified: user.isEmailVerified,
            isMobileVerified: user.isMobileVerified,
            profilePhoto: user.userProfileKey,
            profileImg: user.profileImg,
            isSignedUp: !!user.userType,
            isFullyVerified: user.isFullyVerified(),
            isNewUser: !user.userType,
            userProfileKey: user.userProfileKey,
          },
          token,
        },
        StatusCodes.OK
      ),
      res
    );
  } catch (error) {
    console.error('❌ Google ID token verification error:', error);

    // Provide more specific error messages
    let errorMessage = 'Google ID token verification failed';
    if (error instanceof Error) {
      if (error.message.includes('invalid_token')) {
        errorMessage = 'Invalid Google ID token';
      } else if (error.message.includes('expired_token')) {
        errorMessage = 'Google ID token has expired';
      } else if (error.message.includes('network')) {
        errorMessage = 'Network error while verifying Google token';
      }
    }

    handleServiceResponse(
      new ServiceResponse(ResponseStatus.Failed, errorMessage, null, StatusCodes.INTERNAL_SERVER_ERROR),
      res
    );
  }
});

export default Router;
