/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication endpoints
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     SignupRequest:
 *       type: object
 *       required:
 *         - fullName
 *         - mobileNumber
 *         - email
 *         - userType
 *       properties:
 *         fullName:
 *           type: string
 *           description: User's full name
 *         mobileNumber:
 *           type: string
 *           description: User's mobile number
 *         email:
 *           type: string
 *           format: email
 *           description: User's email address
 *         userType:
 *           type: string
 *           enum: [Agent, Owner, EndUser, Investor]
 *           description: Type of user
 *     SignupResponse:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           enum: [Success, Failed]
 *         message:
 *           type: string
 *         data:
 *           type: object
 *           properties:
 *             user:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   format: uuid
 *                 fullName:
 *                   type: string
 *                 email:
 *                   type: string
 *                 userType:
 *                   type: string
 *             emailOTP:
 *               type: string
 *             mobileOTP:
 *               type: string
 *     VerifyOTPRequest:
 *       type: object
 *       required:
 *         - userId
 *         - otpType
 *         - otp
 *       properties:
 *         userId:
 *           type: string
 *           format: uuid
 *           description: User ID from signup response
 *         otpType:
 *           type: string
 *           enum: [email, mobile]
 *           description: Type of OTP to verify
 *         otp:
 *           type: string
 *           description: 6-digit OTP code
 *     VerifyOTPResponse:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           enum: [Success, Failed]
 *         message:
 *           type: string
 *         data:
 *           type: object
 *           properties:
 *             user:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   format: uuid
 *                 fullName:
 *                   type: string
 *                 email:
 *                   type: string
 *                 userType:
 *                   type: string
 *                 isEmailVerified:
 *                   type: boolean
 *                 isMobileVerified:
 *                   type: boolean
 *             token:
 *               type: string
 *               description: JWT token (only if fully verified)
 */

/**
 * @swagger
 * /api/v1/auth/signup:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SignupRequest'
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SignupResponse'
 *       400:
 *         description: Invalid input data
 *       409:
 *         description: User already exists
 */

/**
 * @swagger
 * /api/v1/auth/verify-otp:
 *   post:
 *     summary: Verify OTP for email or mobile
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VerifyOTPRequest'
 *     responses:
 *       200:
 *         description: OTP verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VerifyOTPResponse'
 *       400:
 *         description: Invalid OTP
 *       404:
 *         description: User not found
 */
