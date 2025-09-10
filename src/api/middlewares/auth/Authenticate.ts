import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { UserAuth } from '@/api/entity/UserAuth';
import { AppDataSource } from '@/server';

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ status: 'error', message: 'You are not logged in' });
  }

  const accessToken = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(accessToken, process.env.ACCESS_SECRET_KEY || '') as any;

    // Get user information from the database
    const userRepository = AppDataSource.getRepository(UserAuth);
    const user = await userRepository.findOne({ where: { id: payload.id } });

    if (!user) {
      return res.status(401).json({ status: 'error', message: 'User not found' });
    }

    // Add user information to the request
    req.user = {
      id: user.id,
      userType: user.userType,
      email: user.email,
      mobileNumber: user.mobileNumber,
    };

    console.log('Authentication successful for user:', user.id);
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(403).json({ status: 'error', message: 'Need to login again' });
  }
};
