import { NextFunction, Request, Response } from 'express';

export class AppError extends Error {
  statusCode: number;
  status: string;
  isOperational: boolean;
  code?: string;

  constructor(message: string, statusCode: number, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    this.code = code;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Not authorized') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

export const errorHandler = (err: AppError, req: Request, res: Response, next: NextFunction) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  const errorResponse = {
    status: err.status,
    message: err.message,
    ...(err.code && { code: err.code }),
  };

  if (process.env.NODE_ENV === 'development') {
    Object.assign(errorResponse, {
      error: err,
      stack: err.stack,
    });
  }

  // Log error in production
  if (process.env.NODE_ENV === 'production' && !err.isOperational) {
    console.error('ERROR 💥', {
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      body: req.body,
      query: req.query,
      params: req.params,
    });
  }

  res.status(err.statusCode).json(errorResponse);
};
