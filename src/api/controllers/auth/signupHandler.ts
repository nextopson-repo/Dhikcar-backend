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
    mobileNumber: z.string().min(10, 'Mobile number must be at least 10 digits'),
    email: z.string().email('Invalid email address'),
    userType: z
      .enum(['Dealer', 'Owner', 'EndUser'], {
        errorMap: () => ({ message: 'Invalid user type' }),
      })
      .optional(),
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

    const { fullName, mobileNumber, email, userType } = req.body;

    // Check if user already exists - check both mobile and email separately
    const userLoginRepository = queryRunner.manager.getRepository(UserAuth);

    // Check for existing user with same mobile number
    const existingUserByMobile = await userLoginRepository.findOne({
      where: { mobileNumber },
    });

    // Check for existing user with same email
    const existingUserByEmail = await userLoginRepository.findOne({
      where: { email },
    });

    // Handle fully verified users - return their information with token and OTP
    const fullyVerifiedUser = existingUserByMobile?.isFullyVerified()
      ? existingUserByMobile
      : existingUserByEmail?.isFullyVerified()
        ? existingUserByEmail
        : null;

    if (fullyVerifiedUser) {
      // Generate new OTPs for the fully verified user
      fullyVerifiedUser.generateEmailOTP();
      fullyVerifiedUser.generateMobileOTP();

      // Save the updated user with new OTPs
      const updatedUser = await userLoginRepository.save(fullyVerifiedUser);

      // Send email OTP
      if (updatedUser.emailOTP) {
        try {
          await sendEmailOTP(email, updatedUser.emailOTP);
        } catch (emailError) {
          console.error('Failed to send email OTP:', emailError);
          // Continue with the process even if email fails
        }
      }

      // Generate JWT token for the fully verified user
      const token = jwt.sign(
        {
          id: updatedUser.id,
          email: updatedUser.email,
          userType: updatedUser.userType,
          fullName: updatedUser.fullName,
          mobileNumber: updatedUser.mobileNumber,
          userProfileKey: updatedUser.userProfileKey,
          profileImg: updatedUser.profileImg,
        },
        env.ACCESS_SECRET_KEY,
        { expiresIn: '1d' }
      );

      // Commit transaction
      await queryRunner.commitTransaction();

      // Return success response for fully verified user
      handleServiceResponse(
        new ServiceResponse(
          ResponseStatus.Success,
          'User already exists and is fully verified. New OTPs sent.',
          {
            user: {
              id: updatedUser.id,
              fullName: updatedUser.fullName,
              email: updatedUser.email,
              mobileNumber: updatedUser.mobileNumber,
              userType: updatedUser.userType,
              isEmailVerified: updatedUser.isEmailVerified,
              isMobileVerified: updatedUser.isMobileVerified,
              isSignedUp: updatedUser.isSignedUp,
              isFullyVerified: updatedUser.isFullyVerified(),
            },
            token,
            mobileOTP: updatedUser.mobileOTP,
          },
          StatusCodes.OK
        ),
        res
      );
      return;
    }

    // Handle duplicate scenarios with proper cleanup
    let userToSave: UserAuth;
    let shouldDeleteDuplicate = false;
    let duplicateUserId: string | null = null;

    // Scenario 1: Both mobile and email exist but belong to different users
    if (existingUserByMobile && existingUserByEmail && existingUserByMobile.id !== existingUserByEmail.id) {
      // Check if one of them is fully verified
      const verifiedUser = existingUserByMobile.isFullyVerified()
        ? existingUserByMobile
        : existingUserByEmail.isFullyVerified()
          ? existingUserByEmail
          : null;

      if (verifiedUser) {
        // If one is fully verified, delete the other and use the verified one
        const unverifiedUser = existingUserByMobile.isFullyVerified() ? existingUserByEmail : existingUserByMobile;
        duplicateUserId = unverifiedUser.id;
        shouldDeleteDuplicate = true;
        userToSave = verifiedUser;
      } else {
        // Both are unverified, keep the one that matches current request better
        const userToKeep =
          existingUserByMobile.mobileNumber === mobileNumber ? existingUserByMobile : existingUserByEmail;
        const userToDelete = userToKeep.id === existingUserByMobile.id ? existingUserByEmail : existingUserByMobile;
        duplicateUserId = userToDelete.id;
        shouldDeleteDuplicate = true;
        userToSave = userToKeep;
      }
    }
    // Scenario 2: Only mobile exists
    else if (existingUserByMobile && !existingUserByEmail) {
      userToSave = existingUserByMobile;
    }
    // Scenario 3: Only email exists
    else if (!existingUserByMobile && existingUserByEmail) {
      userToSave = existingUserByEmail;
    }
    // Scenario 4: Neither exists
    else {
      userToSave = new UserAuth();
      userToSave.fullName = fullName;
      userToSave.mobileNumber = mobileNumber;
      userToSave.email = email;
      userToSave.userType = userType || null;
      userToSave.isSignedUp = true;
    }

    // Delete duplicate user if needed (before updating the main user)
    if (shouldDeleteDuplicate && duplicateUserId) {
      try {
        await userLoginRepository.delete(duplicateUserId);
        console.log(`Deleted duplicate user with ID: ${duplicateUserId}`);
      } catch (deleteError) {
        console.error('Failed to delete duplicate user:', deleteError);
        // Continue with the process even if deletion fails
      }
    }

    // Update existing user or set properties for new user
    if (existingUserByMobile || existingUserByEmail) {
      // Only update if the values are different to avoid unnecessary updates
      if (userToSave.email !== email) userToSave.email = email;
      if (userToSave.fullName !== fullName) userToSave.fullName = fullName;
      if (userToSave.mobileNumber !== mobileNumber) userToSave.mobileNumber = mobileNumber;
      if (userType && userToSave.userType !== userType) userToSave.userType = userType;
      userToSave.isSignedUp = true;
    }

    // Generate OTPs first
    userToSave.generateEmailOTP();
    userToSave.generateMobileOTP();

    // Set verification flags AFTER generating OTPs
    userToSave.isEmailVerified = true;
    userToSave.isMobileVerified = true;

    // Save user with retry logic for duplicate entry
    let savedUser: UserAuth;
    try {
      savedUser = await userLoginRepository.save(userToSave);
    } catch (saveError: any) {
      // Handle duplicate entry error specifically
      if (saveError && saveError.code === 'ER_DUP_ENTRY') {
        console.log('Duplicate entry detected, attempting to find existing user...');

        // Try to find the existing user with the same email or mobile
        const existingUser = await userLoginRepository.findOne({
          where: [{ email: email }, { mobileNumber: mobileNumber }],
        });

        if (existingUser) {
          // Update the existing user instead
          existingUser.fullName = fullName;
          existingUser.mobileNumber = mobileNumber;
          existingUser.email = email;
          existingUser.userType = userType || existingUser.userType;
          existingUser.isSignedUp = true;
          existingUser.generateEmailOTP();
          existingUser.generateMobileOTP();
          existingUser.isEmailVerified = true;
          existingUser.isMobileVerified = true;

          savedUser = await userLoginRepository.save(existingUser);
        } else {
          throw saveError; // Re-throw if we can't find the user
        }
      } else {
        throw saveError; // Re-throw other errors
      }
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

    // Get mobile OTP for response
    const mobileOTP = savedUser.mobileOTP;

    // Generate JWT token for the user (since they are now fully verified)
    const token = jwt.sign(
      {
        id: savedUser.id,
        email: savedUser.email,
        userType: savedUser.userType || null,
        fullName: savedUser.fullName,
        mobileNumber: savedUser.mobileNumber,
        userProfileKey: savedUser.userProfileKey,
        profileImg: savedUser.profileImg,
      },
      env.ACCESS_SECRET_KEY,
      { expiresIn: '1d' }
    );

    // Commit transaction
    await queryRunner.commitTransaction();

    // Return success response with user ID, token, and mobile OTP
    handleServiceResponse(
      new ServiceResponse(
        ResponseStatus.Success,
        'User registered successfully and fully verified',
        {
          user: {
            id: savedUser.id,
            fullName: savedUser.fullName,
            email: savedUser.email,
            mobileNumber: savedUser.mobileNumber,
            userType: savedUser.userType || null,
            isEmailVerified: savedUser.isEmailVerified,
            isMobileVerified: savedUser.isMobileVerified,
            isSignedUp: savedUser.isSignedUp,
            isFullyVerified: savedUser.isFullyVerified(),
          },
          token,
          mobileOTP,
        },
        StatusCodes.CREATED
      ),
      res
    );

    // Generate welcome notification using bundleNotification
    await bundleNotification([
      {
        userId: savedUser.id,
        message: `Great news! Your ${savedUser.userType === 'Owner' ? '5' : '1'} car active on Dhikcar is absolutely FREE -list now and connect with serious buyers!`,
        mediakey: savedUser.userProfileKey || undefined,
        type: NotificationType.WELCOME,
        user: savedUser.fullName,
        button: 'Get Started',
        status: 'Welcome',
        actionId: savedUser.id, // For navigation to Dashboard My Listings tab
      },
    ]);

    // Schedule welcome email to be sent after 2 hours instead of immediately
    const welcomeEmailSubject = `Great news! ${savedUser.fullName} welcome to Nextdeal`;
    const welcomeEmailBody = `Great news! Your ${savedUser.userType === 'Owner' ? '5' : '1'} car active on Dhikcar is absolutely FREE -list now and connect with serious buyers!`;

    delayedEmailService.scheduleEmail(
      email,
      welcomeEmailSubject,
      welcomeEmailBody,
      2 // Send after 2 hours
    );
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
