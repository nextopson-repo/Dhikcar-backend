import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { UserAuth } from '@/api/entity/UserAuth';
import { ResponseStatus, ServiceResponse } from '@/common/models/serviceResponse';
import { handleServiceResponse } from '@/common/utils/httpHandlers';
import { sendEmailOTP } from '@/common/utils/mailService';
import { sendMobileOTP } from '@/common/utils/mobileMsgService';
import { AppDataSource } from '@/server';

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

const sendOtpHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, mobileNumber, userId } = req.body;
    const userRepo = AppDataSource.getRepository(UserAuth);

    // Validate input - either userId or email/mobileNumber should be provided
    if (!userId && !email && !mobileNumber) {
      handleServiceResponse(
        new ServiceResponse(
          ResponseStatus.Failed,
          'Either userId or email/mobileNumber is required',
          null,
          StatusCodes.BAD_REQUEST
        ),
        res
      );
      return;
    }

    // Validate that only one verification method is provided
    if (email && mobileNumber) {
      handleServiceResponse(
        new ServiceResponse(
          ResponseStatus.Failed,
          'Please provide either email OR mobile number, not both',
          null,
          StatusCodes.BAD_REQUEST
        ),
        res
      );
      return;
    }

    let user: UserAuth | null = null;

    // Find user by userId if provided, otherwise by email or mobileNumber
    if (userId) {
      user = await userRepo.findOne({ where: { id: userId } });
    } else if (email) {
      user = await userRepo.findOne({ where: { email } });
    } else if (mobileNumber) {
      user = await userRepo.findOne({ where: { mobileNumber } });
    }

    if (!user) {
      handleServiceResponse(
        new ServiceResponse(ResponseStatus.Failed, 'User not found', null, StatusCodes.NOT_FOUND),
        res
      );
      return;
    }

    // Check if the email/mobile is already used by another fully verified user
    if (email) {
      const existingUserWithEmail = await userRepo.findOne({
        where: { email },
        select: ['id', 'isEmailVerified', 'isMobileVerified'],
      });

      if (existingUserWithEmail && existingUserWithEmail.id !== user.id && existingUserWithEmail.isFullyVerified()) {
        handleServiceResponse(
          new ServiceResponse(
            ResponseStatus.Failed,
            'This email is already associated with another verified account',
            null,
            StatusCodes.CONFLICT
          ),
          res
        );
        return;
      }
    }

    if (mobileNumber) {
      const existingUserWithMobile = await userRepo.findOne({
        where: { mobileNumber },
        select: ['id', 'isEmailVerified', 'isMobileVerified'],
      });

      if (existingUserWithMobile && existingUserWithMobile.id !== user.id && existingUserWithMobile.isFullyVerified()) {
        handleServiceResponse(
          new ServiceResponse(
            ResponseStatus.Failed,
            'This mobile number is already associated with another verified account',
            null,
            StatusCodes.CONFLICT
          ),
          res
        );
        return;
      }
    }

    try {
      let otpResponse = null;
      let verificationType = '';

      // Generate and send OTP based on what was provided
      if (email) {
        // Update user's email if it's different
        if (user.email !== email) {
          user.email = email;
          user.isEmailVerified = false; // Reset email verification
        }

        // Generate new email OTP
        user.generateEmailOTP();
        await userRepo.save(user);

        // Send email OTP
        otpResponse = await sendEmailOTP(user.email, user.emailOTP!);
        verificationType = 'email';

        if (otpResponse !== true) {
          handleServiceResponse(
            new ServiceResponse(
              ResponseStatus.Failed,
              'Failed to send email OTP',
              null,
              StatusCodes.INTERNAL_SERVER_ERROR
            ),
            res
          );
          return;
        }
      } else if (mobileNumber) {
        // Update user's mobile number if it's different
        if (user.mobileNumber !== mobileNumber) {
          user.mobileNumber = mobileNumber;
          user.isMobileVerified = false;
        }

        // Generate new mobile OTP
        user.generateMobileOTP();
        await userRepo.save(user);

        // Send mobile OTP
        otpResponse = await sendMobileOTP(mobileNumber, user.mobileOTP!);
        verificationType = 'mobile';

        if (
          typeof otpResponse === 'object' &&
          'statusCode' in otpResponse &&
          otpResponse.statusCode !== StatusCodes.OK
        ) {
          handleServiceResponse(
            new ServiceResponse(
              ResponseStatus.Failed,
              'Failed to send mobile OTP',
              null,
              StatusCodes.INTERNAL_SERVER_ERROR
            ),
            res
          );
          return;
        }
      }

      handleServiceResponse(
        new ServiceResponse(
          ResponseStatus.Success,
          'OTP sent successfully',
          {
            userId: user.id,
            verificationType,
            user: {
              id: user.id,
              fullName: user.fullName,
              email: user.email,
              mobileNumber: user.mobileNumber,
              userType: user.userType,
              isEmailVerified: user.isEmailVerified,
              isMobileVerified: user.isMobileVerified,
              isSignedUp: !!user.userType,
              isFullyVerified: user.isFullyVerified(),
            },
          },
          StatusCodes.OK
        ),
        res
      );
    } catch (otpError) {
      console.error('Error sending OTP:', otpError);
      handleServiceResponse(
        new ServiceResponse(
          ResponseStatus.Failed,
          'Failed to send OTP. Please try again.',
          null,
          StatusCodes.INTERNAL_SERVER_ERROR
        ),
        res
      );
    }
  } catch (error) {
    console.error('Send OTP Error:', error);
    handleServiceResponse(
      new ServiceResponse(
        ResponseStatus.Failed,
        'Something went wrong. Please try again later.',
        null,
        StatusCodes.INTERNAL_SERVER_ERROR
      ),
      res
    );
  }
};

export const sendOtp = withErrorHandling(sendOtpHandler);
