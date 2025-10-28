import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

import { UserAuth } from '@/api/entity/UserAuth';
import { ResponseStatus, ServiceResponse } from '@/common/models/serviceResponse';
import { env } from '@/common/utils/envConfig';
import { handleServiceResponse } from '@/common/utils/httpHandlers';
import { AppDataSource } from '@/server';

// ✅ Validation schema
const updateUserTypeSchema = z.object({
  userId: z.string(),
  userType: z.enum(['Dealer', 'Owner', 'EndUser']),
});

// ✅ Error handler wrapper
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

// ✅ Actual route handler
const updateUserTypeHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    // Step 1: Validate input
    const { userId, userType } = updateUserTypeSchema.parse(req.body);

    // Step 2: Find user
    const userRepo = AppDataSource.getRepository(UserAuth);
    const user = await userRepo.findOne({ where: { id: userId } });

    if (!user) {
      handleServiceResponse(
        new ServiceResponse(ResponseStatus.Failed, 'User not found', null, StatusCodes.NOT_FOUND),
        res
      );
      return;
    }

    // Step 3: Update fields
    user.userType = userType;
    user.isSignedUp = true;

    const updatedUser = await userRepo.save(user);

    // Step 4: Generate token only if fully verified
    let token: string | null = null;
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

    // Step 5: Clean response structure (for Redux)
    const responseData = {
      userType: updatedUser.userType, // 👈 Redux reads this directly
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
    };

    handleServiceResponse(
      new ServiceResponse(
        ResponseStatus.Success,
        'User type updated successfully',
        responseData,
        StatusCodes.OK
      ),
      res
    );
  } catch (error) {
    console.error('Update User Type Error:', error);

    if (error instanceof z.ZodError) {
      handleServiceResponse(
        new ServiceResponse(
          ResponseStatus.Failed,
          'Invalid user type data',
          null,
          StatusCodes.BAD_REQUEST
        ),
        res
      );
      return;
    }

    handleServiceResponse(
      new ServiceResponse(
        ResponseStatus.Failed,
        'Failed to update user type',
        null,
        StatusCodes.INTERNAL_SERVER_ERROR
      ),
      res
    );
  }
};

export const updateUserType = withErrorHandling(updateUserTypeHandler);
