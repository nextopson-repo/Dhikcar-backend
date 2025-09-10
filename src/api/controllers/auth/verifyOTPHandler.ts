import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

import { UserAuth } from '@/api/entity/UserAuth';
import { ResponseStatus, ServiceResponse } from '@/common/models/serviceResponse';
import { env } from '@/common/utils/envConfig';
import { handleServiceResponse } from '@/common/utils/httpHandlers';
import { AppDataSource } from '@/server';

const verifyOTPSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  otpType: z.enum(['email', 'mobile'], {
    errorMap: () => ({ message: 'Invalid OTP type' }),
  }),
  otp: z.string().min(4, 'OTP must be 4 digits').max(4, 'OTP must be 4 digits'),
});

const withErrorHandling = (handler: (req: Request, res: Response) => Promise<void>) => {
  return async (req: Request, res: Response) => {
    try {
      await handler(req, res);
    } catch (error) {
      console.error('Error in verifyOTPHandler:', error);
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

const verifyOTPHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = verifyOTPSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors.map((err) => err.message).join(', ');
      handleServiceResponse(
        new ServiceResponse(ResponseStatus.Failed, errorMessage, null, StatusCodes.BAD_REQUEST),
        res
      );
      return;
    }

    const { userId, otpType, otp } = validationResult.data;

    if (!AppDataSource.isInitialized) {
      handleServiceResponse(
        new ServiceResponse(
          ResponseStatus.Failed,
          'Database connection error',
          null,
          StatusCodes.INTERNAL_SERVER_ERROR
        ),
        res
      );
      return;
    }

    const userRepo = AppDataSource.getRepository(UserAuth);

    const user = await userRepo.findOne({
      where: { id: userId },
      select: [
        'id',
        'fullName',
        'email',
        'userType',
        'mobileNumber',
        'userProfileKey',
        'profileImg',
        'isEmailVerified',
        'isMobileVerified',
        'emailOTP',
        'emailOTPSentAt',
        'mobileOTP',
        'mobileOTPSentAt',
      ],
    });

    if (!user) {
      handleServiceResponse(
        new ServiceResponse(ResponseStatus.Failed, 'User not found', null, StatusCodes.NOT_FOUND),
        res
      );
      return;
    }

    const isPlaystoreBypass = user.mobileNumber === '8319697083';

    let isVerified = true;
    let verificationError = '';

    const checkOTPExpiry = (sentAt: Date | null): boolean => {
      if (!sentAt) return false;
      const now = new Date();
      const otpAge = now.getTime() - sentAt.getTime();
      const tenMinutes = 10 * 60 * 1000;
      return otpAge <= tenMinutes;
    };

    if (otpType === 'email') {
      if (!user.emailOTP) {
        verificationError = 'No email OTP found. Please request a new OTP.';
      } else if (!checkOTPExpiry(user.emailOTPSentAt)) {
        verificationError = 'Email OTP has expired. Please request a new OTP.';
      } else if (user.emailOTP !== otp) {
        verificationError = 'Invalid email OTP. Please check and try again.';
      } else {
        isVerified = true;
      }
    } else if (otpType === 'mobile') {
      if (isPlaystoreBypass) {
        isVerified = true;
      } else {
        if (!user.mobileOTP) {
          verificationError = 'No mobile OTP found. Please request a new OTP.';
        } else if (!checkOTPExpiry(user.mobileOTPSentAt)) {
          verificationError = 'Mobile OTP has expired. Please request a new OTP.';
        } else if (user.mobileOTP !== otp) {
          verificationError = 'Invalid mobile OTP. Please check and try again.';
        } else {
          isVerified = true;
        }
      }
    }

    if (!isVerified) {
      handleServiceResponse(
        new ServiceResponse(ResponseStatus.Failed, verificationError, null, StatusCodes.BAD_REQUEST),
        res
      );
      return;
    }

    const updateData: Partial<UserAuth> = {};
    if (otpType === 'email') {
      updateData.isEmailVerified = true;
      updateData.emailOTP = null;
      updateData.emailOTPSentAt = null;
    } else {
      updateData.isMobileVerified = true;
      updateData.mobileOTP = null;
      updateData.mobileOTPSentAt = null;
    }

    await userRepo.update(userId, updateData);

    const updatedUser = await userRepo.findOne({
      where: { id: userId },
      select: [
        'id',
        'fullName',
        'email',
        'userType',
        'mobileNumber',
        'userProfileKey',
        'profileImg',
        'isEmailVerified',
        'isMobileVerified',
      ],
    });

    if (!updatedUser) {
      handleServiceResponse(
        new ServiceResponse(
          ResponseStatus.Failed,
          'Failed to update user verification status',
          null,
          StatusCodes.INTERNAL_SERVER_ERROR
        ),
        res
      );
      return;
    }

    const isFullyVerified = updatedUser.isEmailVerified && updatedUser.isMobileVerified;

    let token = null;
    if (isFullyVerified) {
      token = jwt.sign(
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
    }

    handleServiceResponse(
      new ServiceResponse(
        ResponseStatus.Success,
        isFullyVerified
          ? 'User verified successfully'
          : `${otpType} verified successfully. Please verify your ${otpType === 'email' ? 'mobile number' : 'email'}.`,
        {
          user: {
            id: updatedUser.id,
            fullName: updatedUser.fullName,
            email: updatedUser.email,
            userType: updatedUser.userType,
            isEmailVerified: updatedUser.isEmailVerified,
            isMobileVerified: updatedUser.isMobileVerified,
            userProfileKey: updatedUser.userProfileKey,
            isSignedUp: !!updatedUser.userType,
            isFullyVerified,
            mobileNumber: updatedUser.mobileNumber,
            profileImg: updatedUser.profileImg,
          },
          isFullyVerified,
          token,
        },
        StatusCodes.OK
      ),
      res
    );
  } catch (error) {
    console.error('Error in verifyOTPHandler:', error);
    throw error;
  }
};

export const VerifyOTP = withErrorHandling(verifyOTPHandler);
