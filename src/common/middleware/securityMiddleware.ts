import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';

import { UserAuth } from '@/api/entity/UserAuth';
import { ResponseStatus, ServiceResponse } from '@/common/models/serviceResponse';
import { handleServiceResponse } from '@/common/utils/httpHandlers';

import { AppDataSource } from '../config/database';

// Rate limiting configuration
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_OTP_ATTEMPTS = 3;
const OTP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

// Track failed attempts
const failedAttempts = new Map<string, { count: number; lastAttempt: number }>();

// Input sanitization schemas
const signupSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  mobileNumber: z.string().min(10, 'Mobile number must be at least 10 digits'),
  email: z.string().email('Invalid email address'),
  userType: z.enum(['Agent', 'Owner', 'EndUser', 'Investor'], {
    errorMap: () => ({ message: 'Invalid user type' }),
  }),
});

const otpVerificationSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  otpType: z.enum(['email', 'mobile'], {
    errorMap: () => ({ message: 'Invalid OTP type' }),
  }),
  otp: z.string().min(4, 'OTP must be 4 digits').max(4, 'OTP must be 4 digits'),
});

// Middleware to sanitize input
export const sanitizeInput = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let schema;
    if (req.path.includes('/signup')) {
      schema = signupSchema;
    } else if (req.path.includes('/verify-otp')) {
      schema = otpVerificationSchema;
    } else {
      next();
      return;
    }

    const validationResult = schema.safeParse(req.body);
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors.map((err) => err.message).join(', ');
      handleServiceResponse(
        new ServiceResponse(ResponseStatus.Failed, errorMessage, null, StatusCodes.BAD_REQUEST),
        res
      );
      return;
    }

    // Update request body with validated data
    req.body = validationResult.data;
    next();
  } catch (error) {
    console.error('Error in sanitizeInput middleware:', error);
    handleServiceResponse(
      new ServiceResponse(
        ResponseStatus.Failed,
        'Error validating input data',
        null,
        StatusCodes.INTERNAL_SERVER_ERROR
      ),
      res
    );
  }
};

// Check for suspicious patterns
export const detectSuspiciousActivity = (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || req.socket.remoteAddress;
  if (!ip) {
    handleServiceResponse(
      new ServiceResponse(ResponseStatus.Failed, 'Invalid request', null, StatusCodes.BAD_REQUEST),
      res
    );
    return;
  }

  const userAgent = req.headers['user-agent'];
  const now = Date.now();

  // Initialize or get existing attempts
  if (!failedAttempts.has(ip)) {
    failedAttempts.set(ip, { count: 0, lastAttempt: now });
  }

  const attempts = failedAttempts.get(ip)!;

  // Check for rapid consecutive requests (rate limiting)
  if (now - attempts.lastAttempt < 1000) {
    // Less than 1 second between requests
    attempts.count += 1;
    attempts.lastAttempt = now;

    if (attempts.count >= 10) {
      // Allow up to 10 requests per second
      handleServiceResponse(
        new ServiceResponse(
          ResponseStatus.Failed,
          'Rate limit exceeded. Please try again later.',
          null,
          StatusCodes.TOO_MANY_REQUESTS
        ),
        res
      );
      return;
    }
  } else {
    // Reset count if more than 1 second has passed
    attempts.count = 1;
    attempts.lastAttempt = now;
  }

  // Check for suspicious user agent
  if (!userAgent || userAgent.length < 10 || !/^[a-zA-Z0-9\s\-_.,;:()]+$/.test(userAgent)) {
    handleServiceResponse(
      new ServiceResponse(ResponseStatus.Failed, 'Invalid request', null, StatusCodes.BAD_REQUEST),
      res
    );
    return;
  }

  // Check for suspicious headers
  const suspiciousHeaders = ['x-forwarded-for', 'x-real-ip', 'cf-connecting-ip'];
  for (const header of suspiciousHeaders) {
    if (req.headers[header] && req.headers[header] !== ip) {
      handleServiceResponse(
        new ServiceResponse(ResponseStatus.Failed, 'Invalid request', null, StatusCodes.BAD_REQUEST),
        res
      );
      return;
    }
  }

  next();
};

// Track failed login attempts
export const trackLoginAttempts = async (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || req.socket.remoteAddress;
  if (!ip) {
    handleServiceResponse(
      new ServiceResponse(ResponseStatus.Failed, 'Invalid request', null, StatusCodes.BAD_REQUEST),
      res
    );
    return;
  }

  const now = Date.now();

  if (failedAttempts.has(ip)) {
    const attempts = failedAttempts.get(ip)!;
    if (now - attempts.lastAttempt > LOGIN_WINDOW_MS) {
      failedAttempts.delete(ip);
    } else if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
      handleServiceResponse(
        new ServiceResponse(
          ResponseStatus.Failed,
          'Too many failed attempts. Please try again later.',
          null,
          StatusCodes.TOO_MANY_REQUESTS
        ),
        res
      );
      return;
    }
  }

  next();
};

// Track failed OTP attempts
export const trackOTPAttempts = async (req: Request, res: Response, next: NextFunction) => {
  const data = req.body as z.infer<typeof otpVerificationSchema>;
  if (!data.userId || !data.otpType) {
    handleServiceResponse(
      new ServiceResponse(ResponseStatus.Failed, 'User ID and OTP type are required', null, StatusCodes.BAD_REQUEST),
      res
    );
    return;
  }

  try {
    const userRepository = AppDataSource.getRepository(UserAuth);
    const user = await userRepository.findOne({ where: { id: data.userId } });

    if (!user) {
      handleServiceResponse(
        new ServiceResponse(ResponseStatus.Failed, 'User not found', null, StatusCodes.NOT_FOUND),
        res
      );
      return;
    }

    // Check if user is locked
    if (user.isLocked && user.lockedUntil && user.lockedUntil > new Date()) {
      const remainingMinutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / (1000 * 60));
      handleServiceResponse(
        new ServiceResponse(
          ResponseStatus.Failed,
          `Account is locked. Please try again in ${remainingMinutes} minutes.`,
          null,
          StatusCodes.TOO_MANY_REQUESTS
        ),
        res
      );
      return;
    }

    // Check if OTP was recently sent
    const lastOTPSent = data.otpType === 'email' ? user.emailOTPSentAt : user.mobileOTPSentAt;
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

    next();
  } catch (error) {
    console.error('Error tracking OTP attempts:', error);
    handleServiceResponse(
      new ServiceResponse(
        ResponseStatus.Failed,
        'Error processing OTP request',
        null,
        StatusCodes.INTERNAL_SERVER_ERROR
      ),
      res
    );
  }
};

// Check for account lockout
export const checkAccountLockout = async (req: Request, res: Response, next: NextFunction) => {
  const { email, mobileNumber } = req.body;

  if (!email && !mobileNumber) {
    next();
    return;
  }

  try {
    const userRepository = AppDataSource.getRepository(UserAuth);
    const whereConditions = [];

    if (email) {
      whereConditions.push({ email });
    }
    if (mobileNumber) {
      whereConditions.push({ mobileNumber });
    }

    const user = await userRepository.findOne({
      where: whereConditions,
    });

    if (user && user.isLocked) {
      handleServiceResponse(
        new ServiceResponse(
          ResponseStatus.Failed,
          'Account is temporarily locked. Please try again later.',
          null,
          StatusCodes.FORBIDDEN
        ),
        res
      );
      return;
    }

    next();
  } catch (error) {
    handleServiceResponse(
      new ServiceResponse(
        ResponseStatus.Failed,
        'Error checking account status',
        null,
        StatusCodes.INTERNAL_SERVER_ERROR
      ),
      res
    );
  }
};

// Update failed attempts
export const updateFailedAttempts = (identifier: string) => {
  const now = Date.now();
  if (failedAttempts.has(identifier)) {
    const attempts = failedAttempts.get(identifier)!;
    attempts.count += 1;
    attempts.lastAttempt = now;
  } else {
    failedAttempts.set(identifier, { count: 1, lastAttempt: now });
  }
};

// Reset failed attempts
export const resetFailedAttempts = (identifier: string) => {
  failedAttempts.delete(identifier);
};

// Track failed signup attempts
export const trackSignupAttempts = async (req: Request, res: Response, next: NextFunction) => {
  const data = req.body as z.infer<typeof signupSchema>;
  if (!data.email || !data.mobileNumber) {
    handleServiceResponse(
      new ServiceResponse(ResponseStatus.Failed, 'Email and mobile number are required', null, StatusCodes.BAD_REQUEST),
      res
    );
    return;
  }

  try {
    const userRepository = AppDataSource.getRepository(UserAuth);
    const user = await userRepository.findOne({
      where: [{ email: data.email }, { mobileNumber: data.mobileNumber }],
    });

    // If user exists and is fully verified, prevent signup
    if (user && user.isFullyVerified()) {
      handleServiceResponse(
        new ServiceResponse(
          ResponseStatus.Failed,
          'User with this email or mobile number already exists',
          null,
          StatusCodes.CONFLICT
        ),
        res
      );
      return;
    }

    // If user exists but is not fully verified, track attempts
    if (user && !user.isFullyVerified()) {
      user.incrementFailedOTPAttempts();
      await userRepository.save(user);

      if (user.failedOTPAttempts >= 3) {
        handleServiceResponse(
          new ServiceResponse(
            ResponseStatus.Failed,
            'Too many signup attempts. Please try again later.',
            null,
            StatusCodes.TOO_MANY_REQUESTS
          ),
          res
        );
        return;
      }
    }

    next();
  } catch (error) {
    console.error('Error tracking signup attempts:', error);
    handleServiceResponse(
      new ServiceResponse(
        ResponseStatus.Failed,
        'Error processing signup request',
        null,
        StatusCodes.INTERNAL_SERVER_ERROR
      ),
      res
    );
  }
};
