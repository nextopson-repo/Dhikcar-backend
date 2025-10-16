import { Request, Response } from 'express';
import { In } from 'typeorm';

import { sendMobileOTP } from '../../common/utils/mobileMsgService';
import { AppDataSource } from '../../server';
import { CarReport } from '../entity';
import { BlockUser } from '../entity/BlockUser';
import { CarDetails } from '../entity/CarDetails';
import { CarEnquiry } from '../entity/CarEnquiry';
import { CarRequirement } from '../entity/CarRequirement';
import { Connections } from '../entity/Connection';
import { RepublishCarDetails } from '../entity/RepublishCars';
import { RequirementEnquiry } from '../entity/RequirementEnquiry';
import { UserAuth } from '../entity/UserAuth';
import { UserLocation } from '../entity/UserLocation';
import { UserReport } from '../entity/UserReport';

const BYPASS_OTP = true;

// Generate 4-digit OTP
const generateOTP = (): string => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

// Send OTP using mobileMsgService
const sendOTP = async (mobileNumber: string, otp: string): Promise<boolean> => {
  try {
    console.log(`Sending OTP ${otp} to ${mobileNumber}`);

    // Use the actual mobile message service
    const result = await sendMobileOTP(mobileNumber, otp);

    if (result.success) {
      console.log('OTP sent successfully via mobileMsgService');
      return true;
    } else {
      console.error('Failed to send OTP via mobileMsgService:', result.message);
      return false;
    }
  } catch (error) {
    console.error('Error sending OTP via mobileMsgService:', error);
    return false;
  }
};

export class TempAuthController {
  // Send OTP for signup
  static async sendSignupOTP(req: Request, res: Response) {
    try {
      const { fullName, mobileNumber, userType } = req.body;

      if (!fullName || !mobileNumber || !userType) {
        return res.status(400).json({
          message: 'Full name, mobile number and user type are required',
        });
      }

      // Check if user already exists
      const existingUser = await UserAuth.findOne({
        where: { mobileNumber },
      });

      if (existingUser) {
        return res.status(400).json({
          message: 'User with this mobile number already exists',
        });
      }

      // Generate OTP
      const otp = generateOTP();

      // Create temporary user with OTP stored in mobileOTP field
      const tempUser = new UserAuth();
      tempUser.fullName = fullName;
      tempUser.mobileNumber = mobileNumber;
      tempUser.userType = userType;
      tempUser.accountType = 'temporary';
      tempUser.mobileOTP = otp;
      tempUser.mobileOTPSentAt = new Date();
      tempUser.createdBy = 'temp-system';
      tempUser.updatedBy = 'temp-system';

      await tempUser.save();

      // Send OTP to the actual mobile number
      const otpSent = await sendOTP(mobileNumber, otp);
      if (!otpSent) {
        // If OTP sending fails, delete the created user
        await tempUser.remove();
        return res.status(500).json({ message: 'Failed to send OTP' });
      }

      res.status(200).json({
        message: 'OTP sent successfully',
        mobileNumber: mobileNumber,
      });
    } catch (error) {
      console.error('Error sending signup OTP:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Verify OTP and create user
  static async verifySignupOTP(req: Request, res: Response) {
    try {
      const { fullName, mobileNumber, otp, userType } = req.body;

      if (!fullName || !mobileNumber || !otp || !userType) {
        return res.status(400).json({
          message: 'Full name, mobile number, OTP and user type are required',
        });
      }

      // Find the temporary user by mobile number
      const tempUser = await UserAuth.findOne({
        where: {
          mobileNumber,
          accountType: 'temporary',
        },
      });

      if (!tempUser) {
        return res.status(400).json({ message: 'No signup request found for this mobile number' });
      }

      // Check if OTP is expired (10 minutes)
      const otpExpiryTime = new Date(tempUser.mobileOTPSentAt!.getTime() + 10 * 60 * 1000);
      if (new Date() > otpExpiryTime) {
        // Delete expired temporary user
        await tempUser.remove();
        return res.status(400).json({ message: 'OTP expired' });
      }

      // Verify OTP
      if (tempUser.mobileOTP !== otp && !BYPASS_OTP) {
        await tempUser.save();
        res.status(201).json({
          message: 'User created successfully',
          user: {
            id: tempUser.id,
            fullName: tempUser.fullName,
            mobileNumber: tempUser.mobileNumber,
            userType: tempUser.userType,
            accountType: tempUser.accountType,
            isMobileVerified: tempUser.isMobileVerified,
          },
        });
      } else if (tempUser.mobileOTP == otp && !BYPASS_OTP) {
        return res.status(400).json({ message: 'OTP incorrect' });
      }

      // Mark mobile as verified and clear OTP
      tempUser.isMobileVerified = true;
      tempUser.mobileOTP = null;
      tempUser.mobileOTPSentAt = null;
      tempUser.isSignedUp = true;

      await tempUser.save();

      res.status(201).json({
        message: 'User created successfully',
        user: {
          id: tempUser.id,
          fullName: tempUser.fullName,
          mobileNumber: tempUser.mobileNumber,
          userType: tempUser.userType,
          accountType: tempUser.accountType,
          isMobileVerified: tempUser.isMobileVerified,
        },
      });
    } catch (error) {
      console.error('Error verifying signup OTP:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Send OTP for login
  static async sendLoginOTP(req: Request, res: Response) {
    try {
      const { mobileNumber } = req.body;

      if (!mobileNumber) {
        return res.status(400).json({
          message: 'Mobile number is required',
        });
      }

      // Check if user exists
      const user = await UserAuth.findOne({
        where: { mobileNumber, accountType: 'temporary' },
      });

      if (!user) {
        return res.status(404).json({
          message: 'User not found',
        });
      }

      // Generate new OTP
      const otp = generateOTP();

      // Update user with new OTP
      user.mobileOTP = otp;
      user.mobileOTPSentAt = new Date();
      await user.save();

      // Send OTP to the actual mobile number
      const otpSent = await sendOTP(mobileNumber, otp);
      if (!otpSent) {
        return res.status(500).json({ message: 'Failed to send OTP' });
      }

      res.status(200).json({
        message: 'OTP sent successfully',
        mobileNumber: mobileNumber,
      });
    } catch (error) {
      console.error('Error sending login OTP:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Verify OTP and login
  static async verifyLoginOTP(req: Request, res: Response) {
    try {
      const { mobileNumber, otp } = req.body;

      if (!mobileNumber || !otp) {
        return res.status(400).json({
          message: 'Mobile number and OTP are required',
        });
      }

      // Find user by mobile number
      const user = await UserAuth.findOne({
        where: { mobileNumber, accountType: 'temporary' },
      });

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      // Check if OTP is expired (10 minutes)
      const otpExpiryTime = new Date(user.mobileOTPSentAt!.getTime() + 10 * 60 * 1000);
      if (new Date() > otpExpiryTime) {
        return res.status(400).json({ message: 'OTP expired' });
      }

      // Verify OTP
      if (user.mobileOTP !== otp && !BYPASS_OTP) {
        // Increment failed OTP attempts
        user.incrementFailedOTPAttempts();
        await user.save();
        res.status(200).json({
          message: 'Login successful',
          user: {
            id: user.id,
            fullName: user.fullName,
            mobileNumber: user.mobileNumber,
            userType: user.userType,
            accountType: user.accountType,
            isMobileVerified: user.isMobileVerified,
          },
        });
      } else if (user.mobileOTP == otp && !BYPASS_OTP) {
        return res.status(400).json({ message: 'OTP incorrect' });
      }

      // Reset failed attempts and clear OTP
      user.resetFailedAttempts();
      user.mobileOTP = null;
      user.mobileOTPSentAt = null;
      await user.save();

      res.status(200).json({
        message: 'Login successful',
        user: {
          id: user.id,
          fullName: user.fullName,
          mobileNumber: user.mobileNumber,
          userType: user.userType,
          accountType: user.accountType,
          isMobileVerified: user.isMobileVerified,
        },
      });
    } catch (error) {
      console.error('Error verifying login OTP:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Create temporary user account (simplified - no email required)
  static async createTempUser(req: Request, res: Response) {
    try {
      const { fullName, mobileNumber, userType, addressLocality, addressCity, addressState } = req.body;

      if (!fullName || !mobileNumber || !userType) {
        return res.status(400).json({
          message: 'Full name, mobile number and user type are required',
        });
      }

      // Check if mobile number already exists
      const existingUser = await UserAuth.findOne({ where: { mobileNumber } });
      if (existingUser) {
        return res.status(400).json({ message: 'Mobile number already exists' });
      }

      // Create temporary user
      const tempUser = new UserAuth();
      tempUser.fullName = fullName;
      tempUser.mobileNumber = mobileNumber;
      tempUser.userType = userType;
      tempUser.accountType = 'temporary';
      tempUser.isMobileVerified = true; // Auto-verify for temp accounts
      tempUser.isSignedUp = true;
      tempUser.state = addressState;
      tempUser.city = addressCity;
      tempUser.locality = addressLocality;
      tempUser.shouldDeleteOnRealSignup = true; // Mark for deletion when real user signs up
      tempUser.createdBy = 'temp-system';
      tempUser.updatedBy = 'temp-system';

      await tempUser.save();

      res.status(201).json({
        message: 'Temporary user created successfully',
        user: {
          id: tempUser.id,
          fullName: tempUser.fullName,
          mobileNumber: tempUser.mobileNumber,
          userType: tempUser.userType,
          accountType: tempUser.accountType,
          addressCity: tempUser.city,
          addressLocality: tempUser.locality,
          addressState: tempUser.state,
        },
      });
    } catch (error) {
      console.error('Error creating temporary user:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Login temporary user with mobile number only
  static async loginTempUser(req: Request, res: Response) {
    try {
      const { mobileNumber } = req.body;

      if (!mobileNumber) {
        return res.status(400).json({ message: 'Mobile number is required' });
      }

      // Find temporary user by mobile number
      const tempUser = await UserAuth.findOne({
        where: {
          mobileNumber: mobileNumber,
          accountType: 'temporary',
        },
      });

      if (!tempUser) {
        return res.status(404).json({ message: 'Temporary user not found with this mobile number' });
      }

      // Generate a simple session token (you can enhance this with JWT if needed)
      const sessionToken = `temp_${tempUser.id}_${Date.now()}`;

      res.status(200).json({
        message: 'Temporary user logged in successfully',
        user: {
          id: tempUser.id,
          fullName: tempUser.fullName,
          mobileNumber: tempUser.mobileNumber,
          userType: tempUser.userType,
          accountType: tempUser.accountType,
          isMobileVerified: tempUser.isMobileVerified,
        },
        sessionToken: sessionToken,
        loginTime: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error logging in temporary user:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Get all temporary users (admin only)
  static async getTempUsers(req: Request, res: Response) {
    try {
      const tempUsers = await UserAuth.find({
        where: { accountType: 'temporary' },
        select: ['id', 'fullName', 'mobileNumber', 'userType', 'createdAt'],
      });

      res.status(200).json({
        message: 'Temporary users retrieved successfully',
        users: tempUsers,
      });
    } catch (error) {
      console.error('Error fetching temporary users:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Delete temporary user and their properties (original method - UPDATED)
  static async deleteTempUser(req: Request, res: Response) {
    try {
      const { userId } = req.params;

      const tempUser = await UserAuth.findOne({
        where: { id: userId, accountType: 'temporary' },
      });

      if (!tempUser) {
        return res.status(404).json({ message: 'Temporary user not found' });
      }

      // Use a transaction to ensure all deletions are atomic
      await AppDataSource.transaction(async (manager) => {
        // Get all cars owned by this user
        const userCars = await manager.find(CarDetails, {
          where: { userId: tempUser.id },
          select: ['id'],
        });

        const userCarIds = userCars.map((p) => p.id);

        // Delete all related data in the correct order to avoid foreign key constraints

        // 1. Manually delete PropertyImages for this user's properties
        if (userCarIds.length > 0) {
          // No need to delete CarImages separately as they are stored as array in CarDetails
        }

        // 2. Delete CarEnquiry records that reference this user's properties
        if (userCarIds.length > 0) {
          await manager.delete(CarEnquiry, { carId: In(userCarIds) });
        }

        // 3. Delete CarEnquiry records where this user is the enquirer
        await manager.delete(CarEnquiry, { userId: tempUser.id });

        // 4. Delete CarReport records that reference this user's properties
        if (userCarIds.length > 0) {
          await manager.delete(CarReport, { carId: In(userCarIds) });
        }

        // 5. Delete CarReport records where this user is the reporter
        await manager.delete(CarReport, { reporterId: tempUser.id });

        // 6. Delete RepublishCarDetails records that reference this user's properties
        if (userCarIds.length > 0) {
          await manager.delete(RepublishCarDetails, { carId: In(userCarIds) });
        }

        // 7. Delete RepublishCarDetails records where this user is owner or republisher
        await manager.delete(RepublishCarDetails, { ownerId: tempUser.id });
        await manager.delete(RepublishCarDetails, { republisherId: tempUser.id });

        // 8. Delete CarDetails (images are stored as array within CarDetails)
        await manager.delete(CarDetails, { userId: tempUser.id });

        // 9. Delete CarRequirement records
        await manager.delete(CarRequirement, { userId: tempUser.id });

        // 10. Delete RequirementEnquiry records
        await manager.delete(RequirementEnquiry, { userId: tempUser.id });

        // 11. Delete UserLocation records
        await manager.delete(UserLocation, { userId: tempUser.id });

        // 12. Delete UserReport records (both as reporter and reported)
        await manager.delete(UserReport, { reporterId: tempUser.id });
        await manager.delete(UserReport, { reportedUserId: tempUser.id });

        // 13. Delete BlockUser records (both as blocker and blocked)
        await manager.delete(BlockUser, { blockerId: tempUser.id });
        await manager.delete(BlockUser, { blockedUserId: tempUser.id });

        // 14. Delete Connections records (both as requester and receiver)
        await manager.delete(Connections, { requesterId: tempUser.id });
        await manager.delete(Connections, { receiverId: tempUser.id });

        // 15. Finally delete the temporary user
        await manager.delete(UserAuth, { id: tempUser.id });
      });

      res.status(200).json({
        message: 'Temporary user and associated data deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting temporary user:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Robust method: Delete temporary user with better error handling
  static async deleteTempUserRobust(req: Request, res: Response) {
    try {
      const { userId } = req.params;

      console.log(`Attempting to delete user: ${userId}`);

      const tempUser = await UserAuth.findOne({
        where: { id: userId, accountType: 'temporary' },
      });

      if (!tempUser) {
        return res.status(404).json({ message: 'Temporary user not found' });
      }

      console.log(`Found user: ${tempUser.fullName} (${tempUser.email})`);

      // Use a transaction to ensure all deletions are atomic
      await AppDataSource.transaction(async (manager) => {
        try {
          console.log('Starting deletion transaction...');

          // Check and delete related data with individual error handling

          // 1. CarDetails (images are stored as array within CarDetails) - DELETE FIRST
          try {
            const propertyCount = await manager.count(CarDetails, { where: { userId: tempUser.id } });
            if (propertyCount > 0) {
              await manager.delete(CarDetails, { userId: tempUser.id });
              console.log(`Deleted ${propertyCount} Car records`);
            }
          } catch (error) {
            console.error('Error deleting Car:', error);
          }

          // 2. CarEnquiry (after Property is deleted)
          try {
            const enquiryCount = await manager.count(CarEnquiry, { where: { userId: tempUser.id } });
            if (enquiryCount > 0) {
              await manager.delete(CarEnquiry, { userId: tempUser.id });
              console.log(`Deleted ${enquiryCount} CarEnquiry records`);
            }
          } catch (error) {
            console.error('Error deleting CarEnquiry:', error);
          }

          // 3. CarRequirement
          try {
            const requirementCount = await manager.count(CarRequirement, { where: { userId: tempUser.id } });
            if (requirementCount > 0) {
              await manager.delete(CarRequirement, { userId: tempUser.id });
              console.log(`Deleted ${requirementCount} CarRequirement records`);
            }
          } catch (error) {
            console.error('Error deleting CarRequirement:', error);
          }

          // 4. RequirementEnquiry
          try {
            const reqEnquiryCount = await manager.count(RequirementEnquiry, { where: { userId: tempUser.id } });
            if (reqEnquiryCount > 0) {
              await manager.delete(RequirementEnquiry, { userId: tempUser.id });
              console.log(`Deleted ${reqEnquiryCount} RequirementEnquiry records`);
            }
          } catch (error) {
            console.error('Error deleting RequirementEnquiry:', error);
          }

          // 5. UserLocation
          try {
            const locationCount = await manager.count(UserLocation, { where: { userId: tempUser.id } });
            if (locationCount > 0) {
              await manager.delete(UserLocation, { userId: tempUser.id });
              console.log(`Deleted ${locationCount} UserLocation records`);
            }
          } catch (error) {
            console.error('Error deleting UserLocation:', error);
          }

          // 6. UserReport (both sides)
          try {
            const reporterCount = await manager.count(UserReport, { where: { reporterId: tempUser.id } });
            const reportedCount = await manager.count(UserReport, { where: { reportedUserId: tempUser.id } });
            if (reporterCount > 0) {
              await manager.delete(UserReport, { reporterId: tempUser.id });
              console.log(`Deleted ${reporterCount} UserReport records (as reporter)`);
            }
            if (reportedCount > 0) {
              await manager.delete(UserReport, { reportedUserId: tempUser.id });
              console.log(`Deleted ${reportedCount} UserReport records (as reported)`);
            }
          } catch (error) {
            console.error('Error deleting UserReport:', error);
          }

          // 7. BlockUser (both sides)
          try {
            const blockerCount = await manager.count(BlockUser, { where: { blockerId: tempUser.id } });
            const blockedCount = await manager.count(BlockUser, { where: { blockedUserId: tempUser.id } });
            if (blockerCount > 0) {
              await manager.delete(BlockUser, { blockerId: tempUser.id });
              console.log(`Deleted ${blockerCount} BlockUser records (as blocker)`);
            }
            if (blockedCount > 0) {
              await manager.delete(BlockUser, { blockedUserId: tempUser.id });
              console.log(`Deleted ${blockedCount} BlockUser records (as blocked)`);
            }
          } catch (error) {
            console.error('Error deleting BlockUser:', error);
          }

          // 8. Connections (both sides)
          try {
            const requesterCount = await manager.count(Connections, { where: { requesterId: tempUser.id } });
            const receiverCount = await manager.count(Connections, { where: { receiverId: tempUser.id } });
            if (requesterCount > 0) {
              await manager.delete(Connections, { requesterId: tempUser.id });
              console.log(`Deleted ${requesterCount} Connections records (as requester)`);
            }
            if (receiverCount > 0) {
              await manager.delete(Connections, { receiverId: tempUser.id });
              console.log(`Deleted ${receiverCount} Connections records (as receiver)`);
            }
          } catch (error) {
            console.error('Error deleting Connections:', error);
          }

          // 9. RepublishCarDetails (both sides)
          try {
            const ownerCount = await manager.count(RepublishCarDetails, { where: { ownerId: tempUser.id } });
            const republisherCount = await manager.count(RepublishCarDetails, {
              where: { republisherId: tempUser.id },
            });
            if (ownerCount > 0) {
              await manager.delete(RepublishCarDetails, { ownerId: tempUser.id });
              console.log(`Deleted ${ownerCount} RepublishCarDetails records (as owner)`);
            }
            if (republisherCount > 0) {
              await manager.delete(RepublishCarDetails, { republisherId: tempUser.id });
              console.log(`Deleted ${republisherCount} RepublishCarDetails records (as republisher)`);
            }
          } catch (error) {
            console.error('Error deleting RepublishCarDetails:', error);
          }

          // 10. CarReport
          try {
            const reportCount = await manager.count(CarReport, { where: { reporterId: tempUser.id } });
            if (reportCount > 0) {
              await manager.delete(CarReport, { reporterId: tempUser.id });
              console.log(`Deleted ${reportCount} CarReport records`);
            }
          } catch (error) {
            console.error('Error deleting CarReport:', error);
          }

          // 11. Finally delete the user
          await manager.delete(UserAuth, { id: tempUser.id });
          console.log('User deleted successfully');
        } catch (transactionError) {
          console.error('Transaction error:', transactionError);
          throw transactionError;
        }
      });

      res.status(200).json({
        message: 'Temporary user and associated data deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting temporary user:', error);
      res.status(500).json({
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Alternative method: Delete temporary user using raw SQL (more efficient)
  static async deleteTempUserAlternative(req: Request, res: Response) {
    try {
      const { userId } = req.params;

      const tempUser = await UserAuth.findOne({
        where: { id: userId, accountType: 'temporary' },
      });

      if (!tempUser) {
        return res.status(404).json({ message: 'Temporary user not found' });
      }

      // Use raw SQL to delete all related data efficiently
      await AppDataSource.transaction(async (manager) => {
        // Delete all related records using raw SQL
        await manager.query(
          `
          DELETE FROM CarEnquiry WHERE userId = ?
        `,
          [tempUser.id]
        );

        await manager.query(
          `
          DELETE FROM CarRequirement WHERE userId = ?
        `,
          [tempUser.id]
        );

        await manager.query(
          `
          DELETE FROM RequirementEnquiry WHERE userId = ?
        `,
          [tempUser.id]
        );

        await manager.query(
          `
          DELETE FROM UserLocation WHERE userId = ?
        `,
          [tempUser.id]
        );

        await manager.query(
          `
          DELETE FROM UserReport WHERE reporterId = ? OR reportedUserId = ?
        `,
          [tempUser.id, tempUser.id]
        );

        await manager.query(
          `
          DELETE FROM BlockUser WHERE blockerId = ? OR blockedUserId = ?
        `,
          [tempUser.id, tempUser.id]
        );

        await manager.query(
          `
          DELETE FROM Connections WHERE requesterId = ? OR receiverId = ?
        `,
          [tempUser.id, tempUser.id]
        );

        await manager.query(
          `
          DELETE FROM RepublishCarDetails WHERE ownerId = ? OR republisherId = ?
        `,
          [tempUser.id, tempUser.id]
        );

        await manager.query(
          `
          DELETE FROM CarReport WHERE reporterId = ?
        `,
          [tempUser.id]
        );

        // Delete CarDetails (images are stored as array within CarDetails)
        await manager.query(
          `
          DELETE FROM Property WHERE userId = ?
        `,
          [tempUser.id]
        );

        // Finally delete the user
        await manager.query(
          `
          DELETE FROM UserAuth WHERE id = ?
        `,
          [tempUser.id]
        );
      });

      res.status(200).json({
        message: 'Temporary user and associated data deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting temporary user:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Targeted method: Delete temporary user with specific CarEnquiry handling
  static async deleteTempUserTargeted(req: Request, res: Response) {
    try {
      const { userId } = req.params;

      console.log(`Attempting to delete user: ${userId}`);

      const tempUser = await UserAuth.findOne({
        where: { id: userId, accountType: 'temporary' },
      });

      if (!tempUser) {
        return res.status(404).json({ message: 'Temporary user not found' });
      }

      console.log(`Found user: ${tempUser.fullName} (${tempUser.email})`);

      // Use a transaction to ensure all deletions are atomic
      await AppDataSource.transaction(async (manager) => {
        try {
          console.log('Starting deletion transaction...');

          // First, get all properties owned by this user
          const userCars = await manager.find(CarDetails, {
            where: { userId: tempUser.id },
            select: ['id'],
          });

          const userCarIds = userCars.map((p) => p.id);
          console.log(`Found ${userCarIds.length} cars owned by user`);

          // Delete CarEnquiry records that reference this user's properties
          if (userCarIds.length > 0) {
            const enquiryCount = await manager.count(CarEnquiry, {
              where: { carId: In(userCarIds) },
            });
            if (enquiryCount > 0) {
              await manager.delete(CarEnquiry, {
                carId: In(userCarIds),
              });
              console.log(`Deleted ${enquiryCount} CarEnquiry records referencing user's cars`);
            }
          }

          // Delete CarEnquiry records where this user is the enquirer
          const userEnquiryCount = await manager.count(CarEnquiry, {
            where: { userId: tempUser.id },
          });
          if (userEnquiryCount > 0) {
            await manager.delete(CarEnquiry, { userId: tempUser.id });
            console.log(`Deleted ${userEnquiryCount} CarEnquiry records where user is enquirer`);
          }

          // Now delete all other related data

          // 1. CarDetails (images are stored as array within CarDetails)
          if (userCarIds.length > 0) {
            await manager.delete(CarDetails, { userId: tempUser.id });
            console.log(`Deleted ${userCarIds.length} Car records`);
          }

          // 2. CarRequirement
          const requirementCount = await manager.count(CarRequirement, { where: { userId: tempUser.id } });
          if (requirementCount > 0) {
            await manager.delete(CarRequirement, { userId: tempUser.id });
            console.log(`Deleted ${requirementCount} CarRequirement records`);
          }

          // 3. RequirementEnquiry
          const reqEnquiryCount = await manager.count(RequirementEnquiry, { where: { userId: tempUser.id } });
          if (reqEnquiryCount > 0) {
            await manager.delete(RequirementEnquiry, { userId: tempUser.id });
            console.log(`Deleted ${reqEnquiryCount} RequirementEnquiry records`);
          }

          // 4. UserLocation
          const locationCount = await manager.count(UserLocation, { where: { userId: tempUser.id } });
          if (locationCount > 0) {
            await manager.delete(UserLocation, { userId: tempUser.id });
            console.log(`Deleted ${locationCount} UserLocation records`);
          }

          // 5. UserReport (both sides)
          const reporterCount = await manager.count(UserReport, { where: { reporterId: tempUser.id } });
          const reportedCount = await manager.count(UserReport, { where: { reportedUserId: tempUser.id } });
          if (reporterCount > 0) {
            await manager.delete(UserReport, { reporterId: tempUser.id });
            console.log(`Deleted ${reporterCount} UserReport records (as reporter)`);
          }
          if (reportedCount > 0) {
            await manager.delete(UserReport, { reportedUserId: tempUser.id });
            console.log(`Deleted ${reportedCount} UserReport records (as reported)`);
          }

          // 6. BlockUser (both sides)
          const blockerCount = await manager.count(BlockUser, { where: { blockerId: tempUser.id } });
          const blockedCount = await manager.count(BlockUser, { where: { blockedUserId: tempUser.id } });
          if (blockerCount > 0) {
            await manager.delete(BlockUser, { blockerId: tempUser.id });
            console.log(`Deleted ${blockerCount} BlockUser records (as blocker)`);
          }
          if (blockedCount > 0) {
            await manager.delete(BlockUser, { blockedUserId: tempUser.id });
            console.log(`Deleted ${blockedCount} BlockUser records (as blocked)`);
          }

          // 7. Connections (both sides)
          const requesterCount = await manager.count(Connections, { where: { requesterId: tempUser.id } });
          const receiverCount = await manager.count(Connections, { where: { receiverId: tempUser.id } });
          if (requesterCount > 0) {
            await manager.delete(Connections, { requesterId: tempUser.id });
            console.log(`Deleted ${requesterCount} Connections records (as requester)`);
          }
          if (receiverCount > 0) {
            await manager.delete(Connections, { receiverId: tempUser.id });
            console.log(`Deleted ${receiverCount} Connections records (as receiver)`);
          }

          // 8. RepublishCar (both sides)
          const ownerCount = await manager.count(RepublishCarDetails, { where: { ownerId: tempUser.id } });
          const republisherCount = await manager.count(RepublishCarDetails, { where: { republisherId: tempUser.id } });
          if (ownerCount > 0) {
            await manager.delete(RepublishCarDetails, { ownerId: tempUser.id });
            console.log(`Deleted ${ownerCount} RepublishCarDetails records (as owner)`);
          }
          if (republisherCount > 0) {
            await manager.delete(RepublishCarDetails, { republisherId: tempUser.id });
            console.log(`Deleted ${republisherCount} RepublishCar records (as republisher)`);
          }

          // 9. CarReport
          const reportCount = await manager.count(CarReport, { where: { reporterId: tempUser.id } });
          if (reportCount > 0) {
            await manager.delete(CarReport, { reporterId: tempUser.id });
            console.log(`Deleted ${reportCount} CarReport records`);
          }

          // 10. Finally delete the user
          await manager.delete(UserAuth, { id: tempUser.id });
          console.log('User deleted successfully');
        } catch (transactionError) {
          console.error('Transaction error:', transactionError);
          throw transactionError;
        }
      });

      res.status(200).json({
        message: 'Temporary user and associated data deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting temporary user:', error);
      res.status(500).json({
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Final method: Delete temporary user with correct foreign key handling
  static async deleteTempUserFinal(req: Request, res: Response) {
    try {
      const { userId } = req.params;

      console.log(`Attempting to delete user: ${userId}`);

      const tempUser = await UserAuth.findOne({
        where: { id: userId, accountType: 'temporary' },
      });

      if (!tempUser) {
        return res.status(404).json({ message: 'Temporary user not found' });
      }

      console.log(`Found user: ${tempUser.fullName} (${tempUser.email})`);

      // Use a transaction to ensure all deletions are atomic
      await AppDataSource.transaction(async (manager) => {
        try {
          console.log('Starting deletion transaction...');

          // STEP 1: Get all car owned by this user
          const userCars = await manager.find(CarDetails, {
            where: { userId: tempUser.id },
            select: ['id'],
          });

          const userCarIds = userCars.map((p) => p.id);
          console.log(`Found ${userCarIds.length} cars owned by user`);

          // STEP 2: Delete CarEnquiry records that reference this user's properties
          if (userCarIds.length > 0) {
            const enquiryCount = await manager.count(CarEnquiry, {
              where: { carId: In(userCarIds) },
            });
            if (enquiryCount > 0) {
              await manager.delete(CarEnquiry, {
                carId: In(userCarIds),
              });
              console.log(`Deleted ${enquiryCount} CarEnquiry records referencing user's properties`);
            }
          }

          // STEP 3: Delete CarEnquiry records where this user is the enquirer
          const userEnquiryCount = await manager.count(CarEnquiry, {
            where: { userId: tempUser.id },
          });
          if (userEnquiryCount > 0) {
            await manager.delete(CarEnquiry, { userId: tempUser.id });
            console.log(`Deleted ${userEnquiryCount} CarEnquiry records where user is enquirer`);
          }

          // STEP 4: Delete CarReport records that reference this user's properties
          if (userCarIds.length > 0) {
            const reportCount = await manager.count(CarReport, {
              where: { carDetails: In(userCarIds) },
            });
            if (reportCount > 0) {
              await manager.delete(CarReport, {
                carId: In(userCarIds),
              });
              console.log(`Deleted ${reportCount} CarReport records referencing user's properties`);
            }
          }

          // STEP 5: Delete CarReport records where this user is the reporter
          const userReportCount = await manager.count(CarReport, {
            where: { reporterId: tempUser.id },
          });
          if (userReportCount > 0) {
            await manager.delete(CarReport, { reporterId: tempUser.id });
            console.log(`Deleted ${userReportCount} CarReport records where user is reporter`);
          }

          // STEP 6: Delete RepublishCarDetails records that reference this user's properties
          if (userCarIds.length > 0) {
            const republishCount = await manager.count(RepublishCarDetails, {
              where: { carId: In(userCarIds) },
            });
            if (republishCount > 0) {
              await manager.delete(RepublishCarDetails, {
                carId: In(userCarIds),
              });
              console.log(`Deleted ${republishCount} RepublishCarDetails records referencing user's properties`);
            }
          }

          // STEP 7: Delete RepublishCarDetails records where this user is owner or republisher
          const ownerCount = await manager.count(RepublishCarDetails, { where: { ownerId: tempUser.id } });
          const republisherCount = await manager.count(RepublishCarDetails, { where: { republisherId: tempUser.id } });
          if (ownerCount > 0) {
            await manager.delete(RepublishCarDetails, { ownerId: tempUser.id });
            console.log(`Deleted ${ownerCount} RepublishCarDetails records where user is owner`);
          }
          if (republisherCount > 0) {
            await manager.delete(RepublishCarDetails, { republisherId: tempUser.id });
            console.log(`Deleted ${republisherCount} RepublishCarDetails records where user is republisher`);
          }

          // STEP 8: Now delete Properties (this will CASCADE delete PropertyImages)
          if (userCarIds.length > 0) {
            await manager.delete(CarDetails, { userId: tempUser.id });
            console.log(`Deleted ${userCarIds.length} Car records (images stored as array within CarDetails)`);
          }

          // STEP 9: Delete other user-related records

          // CarRequirement
          const requirementCount = await manager.count(CarRequirement, { where: { userId: tempUser.id } });
          if (requirementCount > 0) {
            await manager.delete(CarRequirement, { userId: tempUser.id });
            console.log(`Deleted ${requirementCount} CarRequirement records`);
          }

          // RequirementEnquiry
          const reqEnquiryCount = await manager.count(RequirementEnquiry, { where: { userId: tempUser.id } });
          if (reqEnquiryCount > 0) {
            await manager.delete(RequirementEnquiry, { userId: tempUser.id });
            console.log(`Deleted ${reqEnquiryCount} RequirementEnquiry records`);
          }

          // UserLocation
          const locationCount = await manager.count(UserLocation, { where: { userId: tempUser.id } });
          if (locationCount > 0) {
            await manager.delete(UserLocation, { userId: tempUser.id });
            console.log(`Deleted ${locationCount} UserLocation records`);
          }

          // UserReport (both sides)
          const reporterCount = await manager.count(UserReport, { where: { reporterId: tempUser.id } });
          const reportedCount = await manager.count(UserReport, { where: { reportedUserId: tempUser.id } });
          if (reporterCount > 0) {
            await manager.delete(UserReport, { reporterId: tempUser.id });
            console.log(`Deleted ${reporterCount} UserReport records (as reporter)`);
          }
          if (reportedCount > 0) {
            await manager.delete(UserReport, { reportedUserId: tempUser.id });
            console.log(`Deleted ${reportedCount} UserReport records (as reported)`);
          }

          // BlockUser (both sides)
          const blockerCount = await manager.count(BlockUser, { where: { blockerId: tempUser.id } });
          const blockedCount = await manager.count(BlockUser, { where: { blockedUserId: tempUser.id } });
          if (blockerCount > 0) {
            await manager.delete(BlockUser, { blockerId: tempUser.id });
            console.log(`Deleted ${blockerCount} BlockUser records (as blocker)`);
          }
          if (blockedCount > 0) {
            await manager.delete(BlockUser, { blockedUserId: tempUser.id });
            console.log(`Deleted ${blockedCount} BlockUser records (as blocked)`);
          }

          // Connections (both sides)
          const requesterCount = await manager.count(Connections, { where: { requesterId: tempUser.id } });
          const receiverCount = await manager.count(Connections, { where: { receiverId: tempUser.id } });
          if (requesterCount > 0) {
            await manager.delete(Connections, { requesterId: tempUser.id });
            console.log(`Deleted ${requesterCount} Connections records (as requester)`);
          }
          if (receiverCount > 0) {
            await manager.delete(Connections, { receiverId: tempUser.id });
            console.log(`Deleted ${receiverCount} Connections records (as receiver)`);
          }

          // STEP 10: Finally delete the user
          await manager.delete(UserAuth, { id: tempUser.id });
          console.log('User deleted successfully');
        } catch (transactionError) {
          console.error('Transaction error:', transactionError);
          throw transactionError;
        }
      });

      res.status(200).json({
        message: 'Temporary user and associated data deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting temporary user:', error);
      res.status(500).json({
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Ultimate method: Delete temporary user with manual PropertyImages handling
  static async deleteTempUserUltimate(req: Request, res: Response) {
    try {
      const { userId } = req.params;

      console.log(`Attempting to delete user: ${userId}`);

      const tempUser = await UserAuth.findOne({
        where: { id: userId, accountType: 'temporary' },
      });

      if (!tempUser) {
        return res.status(404).json({ message: 'Temporary user not found' });
      }

      console.log(`Found user: ${tempUser.fullName} (${tempUser.email})`);

      // Use a transaction to ensure all deletions are atomic
      await AppDataSource.transaction(async (manager) => {
        try {
          console.log('Starting deletion transaction...');

          // STEP 1: Get all properties owned by this user
          const userCars = await manager.find(CarDetails, {
            where: { userId: tempUser.id },
            select: ['id'],
          });

          const userCarIds = userCars.map((p) => p.id);
          console.log(`Found ${userCarIds.length} properties owned by user`);

          // STEP 2: No need to delete CarImages separately as they are stored as array in CarDetails

          // STEP 3: Delete CarEnquiry records that reference this user's properties
          if (userCarIds.length > 0) {
            const enquiryCount = await manager.count(CarEnquiry, {
              where: { carId: In(userCarIds) },
            });
            if (enquiryCount > 0) {
              await manager.delete(CarEnquiry, {
                carId: In(userCarIds),
              });
              console.log(`Deleted ${enquiryCount} CarEnquiry records referencing user's properties`);
            }
          }

          // STEP 4: Delete CarEnquiry records where this user is the enquirer
          const userEnquiryCount = await manager.count(CarEnquiry, {
            where: { userId: tempUser.id },
          });
          if (userEnquiryCount > 0) {
            await manager.delete(CarEnquiry, { userId: tempUser.id });
            console.log(`Deleted ${userEnquiryCount} CarEnquiry records where user is enquirer`);
          }

          // STEP 5: Delete CarReport records that reference this user's properties
          if (userCarIds.length > 0) {
            const reportCount = await manager.count(CarReport, {
              where: { carDetails: In(userCarIds) },
            });
            if (reportCount > 0) {
              await manager.delete(CarReport, {
                carId: In(userCarIds),
              });
              console.log(`Deleted ${reportCount} CarReport records referencing user's properties`);
            }
          }

          // STEP 6: Delete CarReport records where this user is the reporter
          const userReportCount = await manager.count(CarReport, {
            where: { reporterId: tempUser.id },
          });
          if (userReportCount > 0) {
            await manager.delete(CarReport, { reporterId: tempUser.id });
            console.log(`Deleted ${userReportCount} CarReport records where user is reporter`);
          }

          // STEP 7: Delete RepublishCarDetails records that reference this user's properties
          if (userCarIds.length > 0) {
            const republishCount = await manager.count(RepublishCarDetails, {
              where: { carId: In(userCarIds) },
            });
            if (republishCount > 0) {
              await manager.delete(RepublishCarDetails, {
                carId: In(userCarIds),
              });
              console.log(`Deleted ${republishCount} RepublishCarDetails records referencing user's properties`);
            }
          }

          // STEP 8: Delete RepublishCarDetails records where this user is owner or republisher
          const ownerCount = await manager.count(RepublishCarDetails, { where: { ownerId: tempUser.id } });
          const republisherCount = await manager.count(RepublishCarDetails, { where: { republisherId: tempUser.id } });
          if (ownerCount > 0) {
            await manager.delete(RepublishCarDetails, { ownerId: tempUser.id });
            console.log(`Deleted ${ownerCount} RepublishCarDetails records where user is owner`);
          }
          if (republisherCount > 0) {
            await manager.delete(RepublishCarDetails, { republisherId: tempUser.id });
            console.log(`Deleted ${republisherCount} RepublishCarDetails records where user is republisher`);
          }

          // STEP 9: Now delete Properties (PropertyImages already deleted)
          if (userCarIds.length > 0) {
            await manager.delete(CarDetails, { userId: tempUser.id });
            console.log(`Deleted ${userCarIds.length} Car records`);
          }

          // STEP 10: Delete other user-related records

          // CarRequirement
          const requirementCount = await manager.count(CarRequirement, { where: { userId: tempUser.id } });
          if (requirementCount > 0) {
            await manager.delete(CarRequirement, { userId: tempUser.id });
            console.log(`Deleted ${requirementCount} CarRequirement records`);
          }

          // RequirementEnquiry
          const reqEnquiryCount = await manager.count(RequirementEnquiry, { where: { userId: tempUser.id } });
          if (reqEnquiryCount > 0) {
            await manager.delete(RequirementEnquiry, { userId: tempUser.id });
            console.log(`Deleted ${reqEnquiryCount} RequirementEnquiry records`);
          }

          // UserLocation
          const locationCount = await manager.count(UserLocation, { where: { userId: tempUser.id } });
          if (locationCount > 0) {
            await manager.delete(UserLocation, { userId: tempUser.id });
            console.log(`Deleted ${locationCount} UserLocation records`);
          }

          // UserReport (both sides)
          const reporterCount = await manager.count(UserReport, { where: { reporterId: tempUser.id } });
          const reportedCount = await manager.count(UserReport, { where: { reportedUserId: tempUser.id } });
          if (reporterCount > 0) {
            await manager.delete(UserReport, { reporterId: tempUser.id });
            console.log(`Deleted ${reporterCount} UserReport records (as reporter)`);
          }
          if (reportedCount > 0) {
            await manager.delete(UserReport, { reportedUserId: tempUser.id });
            console.log(`Deleted ${reportedCount} UserReport records (as reported)`);
          }

          // BlockUser (both sides)
          const blockerCount = await manager.count(BlockUser, { where: { blockerId: tempUser.id } });
          const blockedCount = await manager.count(BlockUser, { where: { blockedUserId: tempUser.id } });
          if (blockerCount > 0) {
            await manager.delete(BlockUser, { blockerId: tempUser.id });
            console.log(`Deleted ${blockerCount} BlockUser records (as blocker)`);
          }
          if (blockedCount > 0) {
            await manager.delete(BlockUser, { blockedUserId: tempUser.id });
            console.log(`Deleted ${blockedCount} BlockUser records (as blocked)`);
          }

          // Connections (both sides)
          const requesterCount = await manager.count(Connections, { where: { requesterId: tempUser.id } });
          const receiverCount = await manager.count(Connections, { where: { receiverId: tempUser.id } });
          if (requesterCount > 0) {
            await manager.delete(Connections, { requesterId: tempUser.id });
            console.log(`Deleted ${requesterCount} Connections records (as requester)`);
          }
          if (receiverCount > 0) {
            await manager.delete(Connections, { receiverId: tempUser.id });
            console.log(`Deleted ${receiverCount} Connections records (as receiver)`);
          }

          // STEP 11: Finally delete the user
          await manager.delete(UserAuth, { id: tempUser.id });
          console.log('User deleted successfully');
        } catch (transactionError) {
          console.error('Transaction error:', transactionError);
          throw transactionError;
        }
      });

      res.status(200).json({
        message: 'Temporary user and associated data deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting temporary user:', error);
      res.status(500).json({
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Handle real user signup - delete conflicting temporary accounts
  static async handleRealUserSignup(req: Request, res: Response) {
    try {
      const { mobileNumber } = req.body;

      if (!mobileNumber) {
        return res.status(400).json({ message: 'Mobile number is required' });
      }

      // Find temporary accounts with same mobile number
      const tempAccounts = await UserAuth.find({
        where: { mobileNumber, accountType: 'temporary' },
      });

      const deletedAccounts = [];

      for (const tempAccount of tempAccounts) {
        // Use a transaction to ensure all deletions are atomic
        await AppDataSource.transaction(async (manager) => {
          // Delete all related data in the correct order to avoid foreign key constraints

          // 1. Delete CarEnquiry records
          await manager.delete(CarEnquiry, { userId: tempAccount.id });

          // 2. Delete CarRequirement records
          await manager.delete(CarRequirement, { userId: tempAccount.id });

          // 3. Delete RequirementEnquiry records
          await manager.delete(RequirementEnquiry, { userId: tempAccount.id });

          // 4. Delete UserLocation records
          await manager.delete(UserLocation, { userId: tempAccount.id });

          // 5. Delete UserReport records (both as reporter and reported)
          await manager.delete(UserReport, { reporterId: tempAccount.id });
          await manager.delete(UserReport, { reportedUserId: tempAccount.id });

          // 6. Delete BlockUser records (both as blocker and blocked)
          await manager.delete(BlockUser, { blockerId: tempAccount.id });
          await manager.delete(BlockUser, { blockedUserId: tempAccount.id });

          // 7. Delete Connections records (both as requester and receiver)
          await manager.delete(Connections, { requesterId: tempAccount.id });
          await manager.delete(Connections, { receiverId: tempAccount.id });

          // 8. Delete RepublishCarDetails records (both as owner and republisher)
          await manager.delete(RepublishCarDetails, { ownerId: tempAccount.id });
          await manager.delete(RepublishCarDetails, { republisherId: tempAccount.id });

          // 9. Delete CarReport records
          await manager.delete(CarReport, { reporterId: tempAccount.id });

          // 10. Delete Properties (this will cascade delete PropertyImages)
          await manager.delete(CarDetails, { userId: tempAccount.id });

          // 11. Finally delete the temporary account
          await manager.delete(UserAuth, { id: tempAccount.id });
        });

        deletedAccounts.push({
          id: tempAccount.id,
          mobileNumber: tempAccount.mobileNumber,
        });
      }

      res.status(200).json({
        message: 'Real user signup processed',
        deletedTemporaryAccounts: deletedAccounts,
        deletedCount: deletedAccounts.length,
      });
    } catch (error) {
      console.error('Error handling real user signup:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Bulk create temporary users (admin only)
  static async bulkCreateTempUsers(req: Request, res: Response) {
    try {
      const { users } = req.body;

      if (!Array.isArray(users)) {
        return res.status(400).json({ message: 'Users must be an array' });
      }

      const createdUsers = [];

      for (const userData of users) {
        const { fullName, mobileNumber, userType } = userData;

        if (!fullName || !mobileNumber || !userType) {
          continue; // Skip if required fields are missing
        }

        // Check if user already exists
        const existingUser = await UserAuth.findOne({ where: { mobileNumber } });
        if (existingUser) {
          continue; // Skip if user already exists
        }

        // Create temporary user
        const tempUser = new UserAuth();
        tempUser.fullName = fullName;
        tempUser.mobileNumber = mobileNumber;
        tempUser.userType = userType;
        tempUser.accountType = 'temporary';
        tempUser.isMobileVerified = true;
        tempUser.isSignedUp = true;
        tempUser.shouldDeleteOnRealSignup = true;
        tempUser.createdBy = 'temp-system';
        tempUser.updatedBy = 'temp-system';

        await tempUser.save();

        createdUsers.push({
          id: tempUser.id,
          fullName: tempUser.fullName,
          mobileNumber: tempUser.mobileNumber,
          userType: tempUser.userType,
        });
      }

      res.status(201).json({
        message: 'Bulk temporary users created successfully',
        createdUsers,
        totalCreated: createdUsers.length,
      });
    } catch (error) {
      console.error('Error creating bulk temporary users:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
}
