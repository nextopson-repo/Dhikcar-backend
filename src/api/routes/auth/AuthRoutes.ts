import express from 'express';

// import { validateOTP, validateOTPRequest } from '@/common/middleware/otpMiddleware';
// import rateLimiter from '@/common/middleware/rateLimiter';
// import {
//   checkAccountLockout,
//   detectSuspiciousActivity,
//   sanitizeInput,
//   trackLoginAttempts,
//   trackOTPAttempts,
//   trackSignupAttempts,
// } from '@/common/middleware/securityMiddleware';
import { googleAuth } from '../../controllers/auth/googleAuthHandler';
import { login } from '../../controllers/auth/loginHandler';
import { resendEmailOtp, resendMobileOtp } from '../../controllers/auth/resendOtp';
import { sendOtp } from '../../controllers/auth/sendOtpHandler';
import { signup } from '../../controllers/auth/signupHandler';
import { updateUserType } from '../../controllers/auth/updateUserTypeHandler';
import { VerifyOTP } from '../../controllers/auth/verifyOTPHandler';
import { authenticate } from '../../middlewares/auth/Authenticate';

const Router = express.Router();

// Apply rate limiting to auth routes
// Router.use(rateLimiter); 

// Public routes with security middleware
Router.post(
  '/signup',
  // sanitizeInput,
  // detectSuspiciousActivity,
  // trackSignupAttempts,
  // checkAccountLockout,
  signup
);

Router.post('/send-otp', sendOtp);

Router.post(
  '/verify-otp',
  //sanitizeInput,
  //validateOTPRequest,
  //detectSuspiciousActivity,
  //trackOTPAttempts,
  // validateOTP,
  VerifyOTP
);

Router.post(
  '/resend-email-otp',
  //sanitizeInput,
  //detectSuspiciousActivity,
  //trackOTPAttempts,
  //validateOTPRequest,
  resendEmailOtp
);

Router.post(
  '/resend-mobile-otp',
  //sanitizeInput,
  //detectSuspiciousActivity,
  //trackOTPAttempts,
  //validateOTPRequest,
  resendMobileOtp
);

Router.post(
  '/login',
  //sanitizeInput,
  //detectSuspiciousActivity,
  //trackLoginAttempts,
  //  checkAccountLockout,
  login
);

// Google authentication route
Router.post(
  '/google-auth',
  //sanitizeInput,
  //detectSuspiciousActivity,
  googleAuth
);

// User type update route (protected)
Router.post(
  '/update-user-type',
  //sanitizeInput,
  updateUserType
);

export default Router;
