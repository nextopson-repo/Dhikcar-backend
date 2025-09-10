import { Request, Response } from 'express';

export const getHello = (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Hello from NextDeal',
    timestamp: new Date().toISOString(),
  });
};
