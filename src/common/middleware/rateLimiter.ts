import { Request, Response } from 'express';
import { rateLimit } from 'express-rate-limit';

import { env } from '@/common/utils/envConfig';

// Production-ready rate limiter with multiple tiers
const createRateLimiter = (options: {
  windowMs: number;
  limit: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}) => {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    message: options.message || 'Too many requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false, // Disable legacy headers for security
    keyGenerator:
      options.keyGenerator ||
      ((req: Request) => {
        // Use IP + User-Agent for better rate limiting
        const userAgent = req.get('User-Agent') || 'unknown';
        return `${req.ip}-${userAgent}`;
      }),
    skipSuccessfulRequests: options.skipSuccessfulRequests || false,
    skipFailedRequests: options.skipFailedRequests || false,
    handler: (req: Request, res: Response) => {
      res.status(429).json({
        success: false,
        message: options.message || 'Too many requests, please try again later.',
        retryAfter: Math.ceil(options.windowMs / 1000),
        timestamp: new Date().toISOString(),
      });
    },
    // Add rate limit headers
    headers: true,
    // Store rate limit info in memory (consider Redis for production)
    store: undefined, // Use default in-memory store
  });
};

// Different rate limiters for different use cases
export const strictRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  limit: 10, // 10 requests per minute
  message: 'Rate limit exceeded. Please wait before making more requests.',
});

export const standardRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  limit: 30, // 30 requests per minute
  message: 'Too many requests. Please slow down.',
});

export const burstRateLimiter = createRateLimiter({
  windowMs: 15 * 1000, // 15 seconds
  limit: 5, // 5 requests per 15 seconds
  message: 'Burst rate limit exceeded. Please wait.',
});

export const carCreationRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  limit: 5, // 5 property creations per minute
  message: 'Car creation rate limit exceeded. Please wait before creating more cars.',
});

export const searchRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  limit: 50, // 50 searches per minute
  message: 'Search rate limit exceeded. Please wait before searching again.',
});

export const uploadRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  limit: 15, // 3 uploads per minute
  message: 'Upload rate limit exceeded. Please wait before uploading more files.',
});

// Default rate limiter (fallback)
const defaultRateLimiter = createRateLimiter({
  windowMs: env.COMMON_RATE_LIMIT_WINDOW_MS || 60000, // 1 minute default
  limit: env.COMMON_RATE_LIMIT_MAX_REQUESTS || 30, // 30 requests per minute default
  message: 'Rate limit exceeded. Please try again later.',
});

export default defaultRateLimiter;
