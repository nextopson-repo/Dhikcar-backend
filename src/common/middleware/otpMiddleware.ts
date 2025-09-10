import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { UserAuth } from '@/api/entity/UserAuth';
import { ResponseStatus, ServiceResponse } from '@/common/models/serviceResponse';
import { handleServiceResponse } from '@/common/utils/httpHandlers';
import { AppDataSource } from '@/server';
// import { AppDataSource } from '../config/database';

// OTP expiration time in minutes
const OTP_EXPIRATION_TIME = 10;

// Extend Express Request type to include user
declare global {
  namespace Express { interface Request { user?: UserAuth; }}
}

export const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const validateOTPRequest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, otpType } = req.body;

    if (!userId || !otpType) {
      handleServiceResponse(
        new ServiceResponse(ResponseStatus.Failed, 'User ID and OTP type are required', null, StatusCodes.BAD_REQUEST),
        res
      );
      return;
    }

    const userRepository = AppDataSource.getRepository(UserAuth);
    const user = await userRepository.findOne({ where: { id: userId } });

    if (!user) {
      handleServiceResponse(
        new ServiceResponse(ResponseStatus.Failed, 'User not found', null, StatusCodes.NOT_FOUND),
        res
      );
      return;
    }

    // Check if OTP was recently sent
    const lastOTPSent = otpType === 'email' ? user.emailOTPSentAt : user.mobileOTPSentAt;
    if (lastOTPSent) {
      const timeSinceLastOTP = (Date.now() - lastOTPSent.getTime()) / (1000 * 60); // in minutes
      if (timeSinceLastOTP < 1) {
        // 1 minute cooldown
        handleServiceResponse(
          new ServiceResponse(
            ResponseStatus.Failed,
            'Please wait before requesting another OTP',
            null,
            StatusCodes.TOO_MANY_REQUESTS
          ),
          res
        );
        return;
      }
    }

    // Store user in request
    req.user = user;
    next();
  } catch (error) {
    console.error('OTP request validation error:', error);
    handleServiceResponse(
      new ServiceResponse(
        ResponseStatus.Failed,
        'Error validating OTP request',
        null,
        StatusCodes.INTERNAL_SERVER_ERROR
      ),
      res
    );
  }
};

export const validateOTP = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { otp, otpType } = req.body;

    if (!req.user) {
      handleServiceResponse(
        new ServiceResponse(ResponseStatus.Failed, 'User not found in request', null, StatusCodes.BAD_REQUEST),
        res
      );
      return;
    }

    const user = req.user;

    if (!otp || !otpType) {
      handleServiceResponse(
        new ServiceResponse(ResponseStatus.Failed, 'OTP and OTP type are required', null, StatusCodes.BAD_REQUEST),
        res
      );
      return;
    }

    // Get the appropriate OTP and sent time based on type
    const storedOTP = otpType === 'email' ? user.emailOTP : user.mobileOTP;
    const otpSentAt = otpType === 'email' ? user.emailOTPSentAt : user.mobileOTPSentAt;

    if (!storedOTP || !otpSentAt) {
      handleServiceResponse(
        new ServiceResponse(ResponseStatus.Failed, 'No OTP found or OTP expired', null, StatusCodes.BAD_REQUEST),
        res
      );
      return;
    }

    // Check if OTP is expired
    const timeSinceOTP = (Date.now() - otpSentAt.getTime()) / (1000 * 60); // in minutes
    if (timeSinceOTP > OTP_EXPIRATION_TIME) {
      handleServiceResponse(
        new ServiceResponse(ResponseStatus.Failed, 'OTP has expired', null, StatusCodes.BAD_REQUEST),
        res
      );
      return;
    }

    // Verify OTP using UserAuth methods
    let isVerified = false;
    if (otpType === 'email') {
      isVerified = user.verifyEmailOTP(otp);
    } else if (otpType === 'mobile') {
      isVerified = user.verifyMobileOTP(otp);
    }

    if (!isVerified) {
      // Increment failed OTP attempts
      user.incrementFailedOTPAttempts();
      await AppDataSource.getRepository(UserAuth).save(user);

      handleServiceResponse(
        new ServiceResponse(ResponseStatus.Failed, 'Invalid OTP', null, StatusCodes.BAD_REQUEST),
        res
      );
      return;
    }

    // Reset failed attempts on successful verification
    user.resetFailedAttempts();
    await AppDataSource.getRepository(UserAuth).save(user);

    next();
  } catch (error) {
    console.error('OTP validation error:', error);
    handleServiceResponse(
      new ServiceResponse(ResponseStatus.Failed, 'Error validating OTP', null, StatusCodes.INTERNAL_SERVER_ERROR),
      res
    );
  }
};
