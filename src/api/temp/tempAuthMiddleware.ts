import { NextFunction, Request, Response } from 'express';

import { UserAuth } from '../entity/UserAuth';

export interface AuthenticatedRequest extends Request {
  user?: any;
  isTemporaryAccount?: boolean;
}

export class TempAuthMiddleware {
  // Middleware to prevent temporary accounts from logging in
  static async preventTempAccountLogin(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, mobileNumber } = req.body;

      if (email) {
        const user = await UserAuth.findOne({ where: { email } });
        if (user && user.isTemporaryAccount()) {
          return res.status(403).json({
            message: 'Temporary accounts cannot log in. Please create a real account.',
            accountType: 'temporary',
          });
        }
      }

      if (mobileNumber) {
        const user = await UserAuth.findOne({ where: { mobileNumber } });
        if (user && user.isTemporaryAccount()) {
          return res.status(403).json({
            message: 'Temporary accounts cannot log in. Please create a real account.',
            accountType: 'temporary',
          });
        }
      }

      next();
    } catch (error) {
      console.error('Error in preventTempAccountLogin middleware:', error);
      next();
    }
  }

  // Middleware to check if user is temporary account
  static async checkAccountType(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (req.user) {
        req.isTemporaryAccount = req.user.isTemporaryAccount();
      }
      next();
    } catch (error) {
      console.error('Error in checkAccountType middleware:', error);
      next();
    }
  }

  // Middleware to ensure only real accounts can access protected routes
  static async requireRealAccount(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      if (req.user.isTemporaryAccount()) {
        return res.status(403).json({
          message: 'This feature is not available for temporary accounts',
          accountType: 'temporary',
        });
      }

      next();
    } catch (error) {
      console.error('Error in requireRealAccount middleware:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Middleware to handle property visibility based on account type
  static async handlePropertyVisibility(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      // Add account type info to request for property filtering
      if (req.user) {
        req.isTemporaryAccount = req.user.isTemporaryAccount();
      }
      next();
    } catch (error) {
      console.error('Error in handlePropertyVisibility middleware:', error);
      next();
    }
  }

  // Middleware to clean up temporary accounts when real user signs up
  static async cleanupTempAccounts(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, mobileNumber } = req.body;

      if (email || mobileNumber) {
        // This will be handled by the TempAuthController.handleRealUserSignup
        // We just pass through here
        next();
      } else {
        next();
      }
    } catch (error) {
      console.error('Error in cleanupTempAccounts middleware:', error);
      next();
    }
  }
}
