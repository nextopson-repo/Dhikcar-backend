import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

import { UserAuth } from '@/api/entity/UserAuth';
import { ResponseStatus, ServiceResponse } from '@/common/models/serviceResponse';
import { env } from '@/common/utils/envConfig';
import { handleServiceResponse } from '@/common/utils/httpHandlers';
import { AppDataSource } from '@/server';

// Add Google authentication schema
const googleAuthSchema = z.object({
  googleId: z.string(),
  email: z.string().email(),
  fullName: z.string(),
  profilePicture: z.string().optional(),
});

// Error handling wrapper
const withErrorHandling = (handler: (req: Request, res: Response) => Promise<void>) => {
  return async (req: Request, res: Response) => {
    try {
      await handler(req, res);
    } catch (error) {
      console.error('Error in handler:', error);
      handleServiceResponse(
        new ServiceResponse(
          ResponseStatus.Failed,
          'An error occurred while processing your request',
          null,
          StatusCodes.INTERNAL_SERVER_ERROR
        ),
        res
      );
    }
  };
};

// Google authentication handler
const googleAuthHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = googleAuthSchema.parse(req.body);
    const { googleId, email, fullName, profilePicture } = validatedData;

    const userRepo = AppDataSource.getRepository(UserAuth);

    // Check if user exists with Google ID or email
    let user = await userRepo.findOne({
      where: [{ googleId }, { email }],
    });

    if (!user) {
      // Create new user with Google data
      user = new UserAuth();
      user.googleId = googleId;
      user.email = email;
      user.fullName = fullName;
      if (profilePicture) {
        user.profileImg = profilePicture;
      }
      user.isEmailVerified = true; // Google email is pre-verified
      user.isMobileVerified = false;
      user.isSignedUp = false;

      user = await userRepo.save(user);
    } else {
      // Update existing user with Google data if needed
      if (!user.googleId) {
        user.googleId = googleId;
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
        'Google authentication successful',
        {
          user: {
            id: user.id,
            fullName: user.fullName,
            email: user.email,
            userType: user.userType,
            isEmailVerified: user.isEmailVerified,
            isMobileVerified: user.isMobileVerified,
            profilePhoto: user.userProfileKey,
            isSignedUp: !!user.userType,
            isFullyVerified: user.isFullyVerified(),
            isNewUser: !user.userType,
          },
          token,
        },
        StatusCodes.OK
      ),
      res
    );
  } catch (error) {
    console.error('Google Auth Error:', error);

    if (error instanceof z.ZodError) {
      handleServiceResponse(
        new ServiceResponse(ResponseStatus.Failed, 'Invalid Google authentication data', null, StatusCodes.BAD_REQUEST),
        res
      );
      return;
    }

    handleServiceResponse(
      new ServiceResponse(
        ResponseStatus.Failed,
        'Google authentication failed',
        null,
        StatusCodes.INTERNAL_SERVER_ERROR
      ),
      res
    );
  }
};

export const googleAuth = withErrorHandling(googleAuthHandler);
