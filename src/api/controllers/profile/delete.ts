import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { Property } from '@/api/entity/Car';
import { UserAuth } from '@/api/entity/UserAuth';
import { ResponseStatus, ServiceResponse } from '@/common/models/serviceResponse';
import { handleServiceResponse } from '@/common/utils/httpHandlers';
import { AppDataSource } from '@/server';

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

const deleteHandler = async (req: Request, res: Response): Promise<void> => {
  const { type, id } = req.query;

  if (!type || !id) {
    handleServiceResponse(
      new ServiceResponse(ResponseStatus.Failed, 'Type and ID are required', null, StatusCodes.BAD_REQUEST),
      res
    );
    return;
  }

  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    switch (type) {
      case 'user':
        await queryRunner.manager.delete(UserAuth, { id });
        break;
      case 'property':
        await queryRunner.manager.delete(Property, { id });
        break;
      default:
        handleServiceResponse(
          new ServiceResponse(ResponseStatus.Failed, 'Invalid type specified', null, StatusCodes.BAD_REQUEST),
          res
        );
        return;
    }

    await queryRunner.commitTransaction();
    handleServiceResponse(
      new ServiceResponse(ResponseStatus.Success, 'Deletion successful', null, StatusCodes.OK),
      res
    );
  } catch (error) {
    await queryRunner.rollbackTransaction();
    console.error('Deletion Error:', error);
    handleServiceResponse(
      new ServiceResponse(
        ResponseStatus.Failed,
        'An error occurred while processing your request',
        null,
        StatusCodes.INTERNAL_SERVER_ERROR
      ),
      res
    );
  } finally {
    await queryRunner.release();
  }
};

export const deleteResource = withErrorHandling(deleteHandler);
