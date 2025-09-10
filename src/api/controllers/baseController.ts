import { NextFunction, Request, Response } from 'express';

import { AppError } from '../middlewares/errorHandler';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export class BaseController {
  protected async handleRequest<T>(req: Request, res: Response, next: NextFunction, operation: () => Promise<T>) {
    try {
      const result = await operation();
      return this.sendResponse(res, { success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  protected handleError(error: any, res: Response) {
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Internal Server Error';

    return this.sendResponse(
      res,
      {
        success: false,
        error: message,
      },
      statusCode
    );
  }

  protected validateRequest(req: Request, schema: any) {
    const { error } = schema.validate(req.body);
    if (error) {
      throw new AppError(error.details[0].message, 400);
    }
  }

  protected sendResponse<T>(res: Response, data: ApiResponse<T>, statusCode: number = 200) {
    return res.status(statusCode).json(data);
  }

  protected getPaginationParams(req: Request) {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    return { page, limit, skip };
  }
}
