import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { In } from 'typeorm';
import { z } from 'zod';

import { UserAuth } from '@/api/entity';
import { BlockUser } from '@/api/entity/BlockUser';
import { CarDetails } from '@/api/entity/CarDetails';
import { CarEnquiry } from '@/api/entity/CarEnquiry';
import { CarImages } from '@/api/entity/CarImages';
import { CarReport } from '@/api/entity/CarReport';
import { CarRequirement } from '@/api/entity/CarRequirement';
import { Connections } from '@/api/entity/Connection';
import { RepublishCarDetails } from '@/api/entity/RepublishCars';
import { RequirementEnquiry } from '@/api/entity/RequirementEnquiry';
import { UserLocation } from '@/api/entity/UserLocation';
import { UserReport } from '@/api/entity/UserReport';
import { ResponseStatus, ServiceResponse } from '@/common/models/serviceResponse';
import { handleServiceResponse } from '@/common/utils/httpHandlers';
import { sendEmailOTP } from '@/common/utils/mailService';
import { sendMobileOTP } from '@/common/utils/mobileMsgService';
import { AppDataSource } from '@/server';

// Update loginSchema to support both mobile and email
const loginSchema = z
  .object({
    mobileNumber: z.string().optional(),
    email: z.string().email().optional(),
    checkBox: z.boolean().optional(),
  })
  .refine((data) => data.mobileNumber || data.email, {
    message: 'Either mobile number or email is required',
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

const deleteTempUser = async (userId: string) => {
  try {
    const userRepo = AppDataSource.getRepository(UserAuth);
    const user = await userRepo.findOne({ where: { id: userId, accountType: 'temporary' } });

    if (!user) {
      return;
    }

    // Use a transaction to ensure all deletions are atomic
    await AppDataSource.transaction(async (manager) => {
      // Get all properties owned by this user
      const userCar = await manager.find(CarDetails, {
        where: { userId: user.id },
        select: ['id'],
      });

      const userCarIds = userCar.map((p) => p.id);

      // Delete all related data in the correct order to avoid foreign key constraints

      // 1. Delete CarImages for this user's properties
      if (userCarIds.length > 0) {
        await manager.delete(CarImages, { carId: In(userCarIds) });
      }

      // 2. Delete CarEnquiry records that reference this user's properties
      if (userCarIds.length > 0) {
        await manager.delete(CarEnquiry, { carId: In(userCarIds) });
      }

      // 3. Delete CarEnquiry records where this user is the enquirer
      await manager.delete(CarEnquiry, { userId: user.id });

      // 4. Delete CarReport records that reference this user's properties
      if (userCarIds.length > 0) {
        await manager.delete(CarReport, { carId: In(userCarIds) });
      }

      // 5. Delete CarReport records where this user is the reporter
      await manager.delete(CarReport, { reporterId: user.id });

      // 6. Delete RepublishCarDetails records that reference this user's properties
      if (userCarIds.length > 0) {
        await manager.delete(RepublishCarDetails, { carId: In(userCarIds) });
      }

      // 7. Delete RepublishCarDetails records where this user is owner or republisher
      await manager.delete(RepublishCarDetails, { ownerId: user.id });
      await manager.delete(RepublishCarDetails, { republisherId: user.id });

      // 8. Delete Properties (CarImages already deleted)
      await manager.delete(CarDetails, { userId: user.id });

      // 9. Delete CarRequirement records
      await manager.delete(CarRequirement, { userId: user.id });

      // 10. Delete RequirementEnquiry records
      await manager.delete(RequirementEnquiry, { userId: user.id });

      // 11. Delete UserLocation records
      await manager.delete(UserLocation, { userId: user.id });

      // 12. Delete UserReport records (both as reporter and reported)
      await manager.delete(UserReport, { reporterId: user.id });
      await manager.delete(UserReport, { reportedUserId: user.id });

      // 13. Delete BlockUser records (both as blocker and blocked)
      await manager.delete(BlockUser, { blockerId: user.id });
      await manager.delete(BlockUser, { blockedUserId: user.id });

      // 14. Delete Connections records (both as requester and receiver)
      await manager.delete(Connections, { requesterId: user.id });
      await manager.delete(Connections, { receiverId: user.id });

      // 15. Finally delete the temporary user
      await manager.delete(UserAuth, { id: user.id });
    });

    console.log(`Temporary user ${userId} and all associated data deleted successfully`);
  } catch (error) {
    console.error('Error deleting temporary user:', error);
  }
};

const loginHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = loginSchema.parse(req.body);
    const { mobileNumber, email, checkBox } = validatedData;

    console.log('Validated login data:', { mobileNumber, email, checkBox });

    if (!checkBox) {
      handleServiceResponse(
        new ServiceResponse(ResponseStatus.Failed, 'Please accept terms and conditions', null, StatusCodes.BAD_REQUEST),
        res
      );
      return;
    }

    const userRepo = AppDataSource.getRepository(UserAuth);
    let user: UserAuth | null = null;
    const tempUser = await userRepo.findOne({
      where: {
        email: email ? email : undefined,
        accountType: 'temporary',
        mobileNumber: mobileNumber ? mobileNumber : undefined,
      },
    });
    if (tempUser) {
      await deleteTempUser(tempUser.id);
    }

    let identifier = '';

    // Determine search criteria
    if (mobileNumber) {
      console.log('Searching by mobile number:', mobileNumber);
      user = await userRepo.findOne({ where: { mobileNumber } });
      identifier = mobileNumber;
    } else if (email) {
      console.log('Searching by email:', email);
      user = await userRepo.findOne({ where: { email } });
      identifier = email;
    }
    console.log('User found:', user ? 'Yes' : 'No');
    console.log('identifier', identifier);

    // Case 1: New user
    if (!user) {
      console.log('Creating new user');
      const newUser = new UserAuth();
      if (mobileNumber) {
        newUser.mobileNumber = mobileNumber;
        newUser.generateMobileOTP();
      } else if (email) {
        newUser.email = email;
        newUser.generateEmailOTP();
      }

      const savedUser = await userRepo.save(newUser);
      console.log('New user saved with ID:', savedUser.id);

      try {
        // Send OTP based on identifier type
        let otpResponse;
        if (mobileNumber) {
          console.log('Sending mobile OTP');
          otpResponse = await sendMobileOTP(mobileNumber, savedUser.mobileOTP!);
        } else {
          console.log('Sending email OTP');
          otpResponse = await sendEmailOTP(email!, savedUser.emailOTP!);
        }

        console.log('OTP response:', otpResponse);

        if (
          mobileNumber &&
          typeof otpResponse === 'object' &&
          'statusCode' in otpResponse &&
          otpResponse.statusCode !== StatusCodes.OK
        ) {
          handleServiceResponse(
            new ServiceResponse(
              ResponseStatus.Failed,
              'Failed to send OTP. Please try again.',
              {
                user: {
                  id: savedUser.id,
                  fullName: null,
                  email: savedUser.email,
                  mobileNumber: savedUser.mobileNumber,
                  isExistingUser: false,
                  isFullyVerified: false,
                  isSignedUp: false,
                  userType: savedUser.userType || null,
                },
              },
              StatusCodes.OK
            ),
            res
          );
          return;
        }

        if (email && otpResponse !== true) {
          handleServiceResponse(
            new ServiceResponse(
              ResponseStatus.Failed,
              'Failed to send OTP. Please try again.',
              {
                user: {
                  id: savedUser.id,
                  isExistingUser: false,
                  isFullyVerified: false,
                  isSignedUp: !!savedUser.userType,
                  userType: savedUser.userType || null,
                },
              },
              StatusCodes.OK
            ),
            res
          );
          return;
        }

        handleServiceResponse(
          new ServiceResponse(
            ResponseStatus.Success,
            'New user. Please verify OTP and complete signup.',
            {
              user: {
                id: savedUser.id,
                isExistingUser: false,
                isFullyVerified: false,
                isSignedUp: !!savedUser.userType,
                userType: savedUser.userType || null,
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
            {
              user: {
                id: savedUser.id,
                isExistingUser: false,
                isFullyVerified: false,
                isSignedUp: !!savedUser.userType,
                userType: savedUser.userType || null,
              },
            },
            StatusCodes.OK
          ),
          res
        );
      }
      return;
    }

    // Case 2: Existing user - Generate and send new OTP
    console.log('Processing existing user');
    try {
      if (mobileNumber) {
        console.log('Generating mobile OTP for existing user');
        user.generateMobileOTP();
      } else if (email) {
        console.log('Generating email OTP for existing user');
        user.generateEmailOTP();
      }
      await userRepo.save(user);
      console.log('User updated with new OTP');

      let otpResponse;
      if (mobileNumber) {
        console.log('Sending mobile OTP to existing user');
        otpResponse = await sendMobileOTP(mobileNumber, user.mobileOTP!);
      } else {
        console.log('Sending email OTP to existing user');
        otpResponse = await sendEmailOTP(email!, user.emailOTP!);
      }

      console.log('OTP response for existing user:', otpResponse);

      if (
        mobileNumber &&
        typeof otpResponse === 'object' &&
        'statusCode' in otpResponse &&
        otpResponse.statusCode !== StatusCodes.OK
      ) {
        handleServiceResponse(
          new ServiceResponse(
            ResponseStatus.Failed,
            'Failed to send OTP. Please try again.',
            {
              user: {
                id: user.id,
                isExistingUser: true,
                fullName: user.fullName,
                email: user.email,
                mobileNumber: user.mobileNumber,
                isFullyVerified: user.isFullyVerified(),
                isSignedUp: !!user.userType,
                userType: user.userType,
              },
            },
            StatusCodes.OK
          ),
          res
        );
        return;
      }

      if (email && otpResponse !== true) {
        handleServiceResponse(
          new ServiceResponse(
            ResponseStatus.Failed,
            'Failed to send OTP. Please try again.',
            {
              user: {
                id: user.id,
                isExistingUser: true,
                fullName: user.fullName,
                email: user.email,
                mobileNumber: user.mobileNumber,
                isFullyVerified: user.isFullyVerified(),
                isSignedUp: !!user.userType,
                userType: user.userType || null,
              },
            },
            StatusCodes.OK
          ),
          res
        );
        return;
      }

      // Case 3: Not fully verified user
      if (!user.isFullyVerified()) {
        console.log('User not fully verified');
        handleServiceResponse(
          new ServiceResponse(
            ResponseStatus.Success,
            'User not fully verified. Please complete verification.',
            {
              user: {
                id: user.id,
                isExistingUser: true,
                isFullyVerified: false,
                fullName: user.fullName,
                email: user.email,
                mobileNumber: user.mobileNumber,
                isSignedUp: !!user.userType,
                userType: user.userType || null,
              },
            },
            StatusCodes.OK
          ),
          res
        );
        return;
      }

      // Case 4: Fully verified existing user
      console.log('User fully verified, OTP sent successfully');
      handleServiceResponse(
        new ServiceResponse(
          ResponseStatus.Success,
          'OTP sent successfully',
          {
            user: {
              id: user.id,
              isExistingUser: true,
              fullName: user.fullName,
              email: user.email,
              mobileNumber: user.mobileNumber,
              isFullyVerified: true,
              isSignedUp: !!user.userType,
              userType: user.userType || null,
            },
          },
          StatusCodes.OK
        ),
        res
      );
    } catch (otpError) {
      console.error('Error sending OTP to existing user:', otpError);
      handleServiceResponse(
        new ServiceResponse(
          ResponseStatus.Failed,
          'Failed to send OTP. Please try again.',
          {
            user: {
              id: user.id,
              isExistingUser: true,
              isFullyVerified: user.isFullyVerified(),
              isSignedUp: !!user.userType,
              userType: user.userType || null,
            },
          },
          StatusCodes.OK
        ),
        res
      );
    }
  } catch (error) {
    console.error('Login Error:', error);

    if (error instanceof z.ZodError) {
      console.error('Validation error:', error.errors);
      handleServiceResponse(
        new ServiceResponse(ResponseStatus.Failed, 'Invalid input format', null, StatusCodes.BAD_REQUEST),
        res
      );
      return;
    }

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

export const login = withErrorHandling(loginHandler);
