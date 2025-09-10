import { ErrorRequestHandler, RequestHandler } from 'express';
import { StatusCodes } from 'http-status-codes';

const unexpectedRequest: RequestHandler = (_req, res) => {
  res.status(StatusCodes.NOT_FOUND).json({
    status: 'error',
    message: 'Route not found',
  });
};

const addErrorToRequestLog: ErrorRequestHandler = (err, _req, res, next) => {
  console.error('Error:', err);
  res.locals.err = err;
  next(err);
};

const errorHandler: ErrorRequestHandler = (err, _req, res) => {
  const statusCode = err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
  const message = err.message || 'Something went wrong';

  res.status(statusCode).json({
    status: 'error',
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

export default () => [unexpectedRequest, addErrorToRequestLog, errorHandler];
