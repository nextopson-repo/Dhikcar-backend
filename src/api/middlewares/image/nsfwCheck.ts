import { NextFunction, Request, Response } from 'express';

import nsfwDetectionService from '@/api/nsfw/nsfwDetectionService';

export const nsfwCheck = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Check if there's a file in the request
    if (!req.file) {
      return next();
    }

    // Check for NSFW content
    const nsfwResult = await nsfwDetectionService.predict(req.file.buffer);
    if (nsfwResult.isAdult) {
      return res.status(400).json({
        status: 'error',
        message: 'Image contains inappropriate content and cannot be uploaded',
        details: {
          label: nsfwResult.label,
          confidence: nsfwResult.confidence,
        },
      });
    }

    // Image is safe, proceed to next middleware/controller
    next();
  } catch (error) {
    console.error('NSFW check error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Error checking image content',
    });
  }
};
