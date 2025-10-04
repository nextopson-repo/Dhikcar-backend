import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

import { UserAuth } from '@/api/entity/UserAuth';
import { ResponseStatus, ServiceResponse } from '@/common/models/serviceResponse';
import { env } from '@/common/utils/envConfig';
import { handleServiceResponse } from '@/common/utils/httpHandlers';
import { AppDataSource } from '@/server';

// User type update schema
const updateUserTypeSchema = z.object({
  userId: z.string(),
  userType: z.enum(['Dealer', 'Owner', 'EndUser']),
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

// User type update handler
const updateUserTypeHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = updateUserTypeSchema.parse(req.body);
    const { userId, userType } = validatedData;

    const userRepo = AppDataSource.getRepository(UserAuth);
    const user = await userRepo.findOne({ where: { id: userId } });

    if (!user) {
      handleServiceResponse(
        new ServiceResponse(ResponseStatus.Failed, 'User not found', null, StatusCodes.NOT_FOUND),
        res
      );
      return;
    }

    user.userType = userType;
    user.isSignedUp = true;

    const updatedUser = await userRepo.save(user);

    // Generate JWT token if fully verified
    let token = null;
    if (updatedUser.isFullyVerified()) {
      token = jwt.sign(
        {
          id: updatedUser.id,
          email: updatedUser.email,
          userType: updatedUser.userType,
        },
        env.ACCESS_SECRET_KEY,
        { expiresIn: '1d' }
      );
    }

    handleServiceResponse(
      new ServiceResponse(
        ResponseStatus.Success,
        'User type updated successfully',
        {
          user: {
            id: updatedUser.id,
            fullName: updatedUser.fullName,
            email: updatedUser.email,
            userType: updatedUser.userType,
            isEmailVerified: updatedUser.isEmailVerified,
            isMobileVerified: updatedUser.isMobileVerified,
            profilePhoto: updatedUser.userProfileUrl,
            isSignedUp: !!updatedUser.userType,
            isFullyVerified: updatedUser.isFullyVerified(),
          },
          token,
        },
        StatusCodes.OK
      ),
      res
    );
  } catch (error) {
    console.error('Update User Type Error:', error);

    if (error instanceof z.ZodError) {
      handleServiceResponse(
        new ServiceResponse(ResponseStatus.Failed, 'Invalid user type data', null, StatusCodes.BAD_REQUEST),
        res
      );
      return;
    }

    handleServiceResponse(
      new ServiceResponse(ResponseStatus.Failed, 'Failed to update user type', null, StatusCodes.INTERNAL_SERVER_ERROR),
      res
    );
  }
};

export const updateUserType = withErrorHandling(updateUserTypeHandler);
