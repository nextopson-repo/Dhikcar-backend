import { NextFunction, Request, Response } from 'express';

class ErrorHandler extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

const errorMiddleware = (err: any, req: Request, res: Response, next: NextFunction) => {
  // Default values for statusCode and message
  err.statusCode = err.statusCode || 500;
  err.message = err.message || 'Internal server error';

  // Handling TypeORM invalid ID error (similar to MongoDB CastError)
  if (err.name === 'EntityNotFoundError') {
    const message = `Resource not found with ID: ${err.id || 'unknown'}`;
    err = new ErrorHandler(message, 400);
  }

  // Handling MySQL duplicate key error (ER_DUP_ENTRY)
  if (err.code === 'ER_DUP_ENTRY') {
    const message = `Duplicate field value entered`;
    err = new ErrorHandler(message, 409);
  }

  // Handling JWT error (Invalid Token)
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid Token, please login again';
    err = new ErrorHandler(message, 401);
  }

  // Handling JWT expired error
  if (err.name === 'TokenExpiredError') {
    const message = 'Your token has expired, please login again';
    err = new ErrorHandler(message, 401);
  }

  // Send error response
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message,
  });
};

export { ErrorHandler, errorMiddleware };

export const errorHandler = (
  err: Error & { statusCode?: number; code?: string; id?: string },
  req: Request,
  res: Response
) => {
  // Default values for statusCode and message
  err.statusCode = err.statusCode || 500;
  err.message = err.message || 'Internal server error';

  // Handling TypeORM invalid ID error (similar to MongoDB CastError)
  if (err.name === 'EntityNotFoundError') {
    const message = `Resource not found with ID: ${err.id || 'unknown'}`;
    err = new ErrorHandler(message, 400);
  }

  // Handling MySQL duplicate key error (ER_DUP_ENTRY)
  if (err.code === 'ER_DUP_ENTRY') {
    const message = `Duplicate field value entered`;
    err = new ErrorHandler(message, 409);
  }

  // Handling JWT error (Invalid Token)
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid Token, please login again';
    err = new ErrorHandler(message, 401);
  }

  // Handling JWT expired error
  if (err.name === 'TokenExpiredError') {
    const message = 'Your token has expired, please login again';
    err = new ErrorHandler(message, 401);
  }

  // Send error response
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message,
  });
};
