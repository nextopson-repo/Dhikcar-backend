import { randomUUID } from 'crypto';
import { Request, RequestHandler, Response } from 'express';
import { IncomingMessage, ServerResponse } from 'http';
import { getReasonPhrase, StatusCodes } from 'http-status-codes';
import { LevelWithSilent } from 'pino';
import { CustomAttributeKeys, Options, pinoHttp } from 'pino-http';
import { ParsedQs } from 'qs';

import { env } from '@/common/utils/envConfig';

enum LogLevel {
  Fatal = 'fatal',
  Error = 'error',
  Warn = 'warn',
  Info = 'info',
  Debug = 'debug',
  Trace = 'trace',
  Silent = 'silent',
}

type RequestLog = {
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  query: ParsedQs;
  body: any;
  ip: string | undefined;
};

type ResponseLog = {
  statusCode: number;
};

type PinoCustomProps = {
  request: RequestLog;
  response: ResponseLog;
  error: Error;
  responseBody: unknown;
};

const requestLogger = (options?: Options): RequestHandler[] => {
  const pinoOptions: Options = {
    enabled: true,
    customProps: customProps as unknown as Options['customProps'],
    redact: ['headers.authorization', 'headers.cookie'],
    genReqId,
    customLogLevel,
    customSuccessMessage,
    customReceivedMessage: (req) => `request received: ${req.method} ${req.url}`,
    customErrorMessage: (_req, res) => `request errored with status code: ${res.statusCode}`,
    customAttributeKeys,
    ...options,
  };
  return [responseBodyMiddleware, pinoHttp(pinoOptions)];
};

const customAttributeKeys: CustomAttributeKeys = {
  req: 'request',
  res: 'response',
  err: 'error',
  responseTime: 'timeTaken',
};

const customProps = (req: Request, res: Response): PinoCustomProps => ({
  request: {
    method: req.method,
    url: req.url,
    headers: req.headers,
    query: req.query,
    body: req.body,
    ip: req.ip,
  },
  response: {
    statusCode: res.statusCode,
  },
  error: res.locals.err,
  responseBody: res.locals.responseBody,
});

const responseBodyMiddleware: RequestHandler = (_req, res, next) => {
  const originalSend = res.send;
  const originalStatus = res.status;

  // Intercept status setting
  res.status = function (code: number) {
    res.statusCode = code;
    return originalStatus.call(res, code);
  };

  // Intercept send to capture response body and final status
  res.send = function (content) {
    res.locals.responseBody = content;
    res.locals.finalStatusCode = res.statusCode;
    res.send = originalSend;
    return originalSend.call(res, content);
  };
  next();
};

const customLogLevel = (_req: IncomingMessage, res: ServerResponse<IncomingMessage>, err?: Error): LevelWithSilent => {
  if (err || res.statusCode >= StatusCodes.INTERNAL_SERVER_ERROR) return LogLevel.Error;
  if (res.statusCode >= StatusCodes.BAD_REQUEST) return LogLevel.Warn;
  if (res.statusCode >= StatusCodes.MULTIPLE_CHOICES) return LogLevel.Info;
  return LogLevel.Info;
};

const customSuccessMessage = (req: IncomingMessage, res: ServerResponse<IncomingMessage>) => {
  if (res.statusCode === StatusCodes.NOT_FOUND) return getReasonPhrase(StatusCodes.NOT_FOUND);
  return `${req.method} ${req.url} completed`;
};

const genReqId = (req: IncomingMessage, res: ServerResponse<IncomingMessage>) => {
  const existingID = req.id ?? req.headers['x-request-id'];
  if (existingID) return existingID;
  const id = randomUUID();
  res.setHeader('X-Request-Id', id);
  return id;
};

export default requestLogger();
