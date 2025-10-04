import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

import { NotificationType } from '@/api/entity/Notifications';
import { UserAuth } from '@/api/entity/UserAuth';
import { ResponseStatus, ServiceResponse } from '@/common/models/serviceResponse';
import { delayedEmailService } from '@/common/utils/delayedEmailService';
import { env } from '@/common/utils/envConfig';
import { handleServiceResponse } from '@/common/utils/httpHandlers';
import { sendEmailOTP } from '@/common/utils/mailService';
import { AppDataSource } from '@/server';
import { bundleNotification } from '../notification/NotificationController';

// Validation schema for signup request
const signupSchema = z.object({
  body: z.object({
    fullName: z.string().min(2, 'Full name must be at least 2 characters'),
    email: z.string().email('Invalid email address'),
  }),
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

// Signup handler
const signupHandler = async (req: Request, res: Response): Promise<void> => {
  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    // Validate request body
    const validationResult = signupSchema.safeParse({ body: req.body });
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors.map((err) => err.message).join(', ');
      handleServiceResponse(
        new ServiceResponse(ResponseStatus.Failed, errorMessage, null, StatusCodes.BAD_REQUEST),
        res
      );
      return;
    }

    const { fullName, email } = req.body;

    // Extract and verify JWT token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      handleServiceResponse(
        new ServiceResponse(
          ResponseStatus.Failed,
          'Authorization header with Bearer token is required',
          null,
          StatusCodes.UNAUTHORIZED
        ),
        res
      );
      return;
    }

    const bearerToken = authHeader.substring(7); // Remove 'Bearer ' prefix
    let userId: string;
    
    try {
      const decoded = jwt.verify(bearerToken, env.ACCESS_SECRET_KEY) as any;
      userId = decoded.id;
      
      if (!userId) {
        throw new Error('Invalid token: userId not found');
      }
    } catch (error) {
      handleServiceResponse(
        new ServiceResponse(
          ResponseStatus.Failed,
          'Invalid or expired token',
          null,
          StatusCodes.UNAUTHORIZED
        ),
        res
      );
      return;
    }

    // Check if user already exists with the provided userId
    const userLoginRepository = queryRunner.manager.getRepository(UserAuth);
    const existingUser = await userLoginRepository.findOne({
      where: { id: userId },
    });

    let savedUser: UserAuth;
    let isNewUser = false;

    if (existingUser) {
      // Update existing user
      existingUser.fullName = fullName;
      existingUser.email = email;
      existingUser.isSignedUp = true;
      existingUser.isEmailVerified = true;
      existingUser.isMobileVerified = true;

      // Generate new OTPs
      existingUser.generateEmailOTP();
      existingUser.generateMobileOTP();

      savedUser = await userLoginRepository.save(existingUser);
    } else {
      // Create new user
      const newUser = new UserAuth();
      newUser.id = userId;
      newUser.fullName = fullName;
      newUser.email = email;
      newUser.isSignedUp = true;
      newUser.isEmailVerified = true;
      newUser.isMobileVerified = true;

      // Generate OTPs
      newUser.generateEmailOTP();
      newUser.generateMobileOTP();

      savedUser = await userLoginRepository.save(newUser);
      isNewUser = true;
    }

    // Send email OTP
    if (savedUser.emailOTP) {
      try {
        await sendEmailOTP(email, savedUser.emailOTP);
      } catch (emailError) {
        console.error('Failed to send email OTP:', emailError);
        // Continue with the signup process even if email fails
      }
    }

    // Generate JWT token for the user
    const token = jwt.sign(
      {
        id: savedUser.id,
        email: savedUser.email,
        userType: savedUser.userType,
        fullName: savedUser.fullName,
        mobileNumber: savedUser.mobileNumber,
        userProfileUrl: savedUser.userProfileUrl,
        profileImg: savedUser.profileImg,
      },
      env.ACCESS_SECRET_KEY,
      { expiresIn: '1d' }
    );

    // Commit transaction
    await queryRunner.commitTransaction();

    // Return success response with all user data
    handleServiceResponse(
      new ServiceResponse(
        ResponseStatus.Success,
        isNewUser ? 'User account created successfully' : 'User account updated successfully',
        {
          user: {
            id: savedUser.id,
            fullName: savedUser.fullName,
            email: savedUser.email,
            mobileNumber: savedUser.mobileNumber,
            userType: savedUser.userType,
            isEmailVerified: savedUser.isEmailVerified,
            isMobileVerified: savedUser.isMobileVerified,
            isSignedUp: savedUser.isSignedUp,
            isFullyVerified: savedUser.isFullyVerified(),
            userProfileUrl: savedUser.userProfileUrl,
            profileImg: savedUser.profileImg,
            emailOTP: savedUser.emailOTP,
            mobileOTP: savedUser.mobileOTP,
            createdAt: savedUser.createdAt,
            updatedAt: savedUser.updatedAt,
          },
          token,
          isNewUser,
        },
        isNewUser ? StatusCodes.CREATED : StatusCodes.OK
      ),
      res
    );

    // Generate notification based on whether it's a new user or update
    if (isNewUser) {
      // Generate welcome notification for new users
      await bundleNotification([
        {
          userId: savedUser.id,
          message: `Welcome to Dhikcar! Your account has been created successfully.`,
          mediakey: savedUser.userProfileUrl || undefined,
          type: NotificationType.WELCOME,
          user: savedUser.fullName,
          button: 'Get Started',
          status: 'Welcome',
          actionId: savedUser.id,
        },
      ]);

      // Schedule welcome email to be sent after 2 hours for new users
      const welcomeEmailSubject = `Welcome to Dhikcar, ${savedUser.fullName}!`;
      const welcomeEmailBody = `Welcome to Dhikcar! Your account has been created successfully. Start exploring and listing your cars today!`;

      delayedEmailService.scheduleEmail(
        email,
        welcomeEmailSubject,
        welcomeEmailBody,
        2 // Send after 2 hours
      );
    } else {
      // Generate update notification for existing users
      await bundleNotification([
        {
          userId: savedUser.id,
          message: `Your account has been updated successfully.`,
          mediakey: savedUser.userProfileUrl || undefined,
          type: NotificationType.WELCOME,
          user: savedUser.fullName,
          button: 'View Profile',
          status: 'Updated',
          actionId: savedUser.id, // For navigation to Dashboard My Listings tab
        },
      ]);
    }
  } catch (error: any) {
    // Rollback transaction on error
    await queryRunner.rollbackTransaction();
    console.error('Signup Error:', error);

    // Handle specific duplicate entry error
    if (error && error.code === 'ER_DUP_ENTRY') {
      handleServiceResponse(
        new ServiceResponse(
          ResponseStatus.Failed,
          'Email or mobile number already exists. Please use different credentials.',
          null,
          StatusCodes.CONFLICT
        ),
        res
      );
    } else {
      handleServiceResponse(
        new ServiceResponse(
          ResponseStatus.Failed,
          'Failed to complete signup process',
          null,
          StatusCodes.INTERNAL_SERVER_ERROR
        ),
        res
      );
    }
  } finally {
    // Release query runner
    await queryRunner.release();
  }
};

export const signup = withErrorHandling(signupHandler);
