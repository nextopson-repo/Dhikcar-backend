import { Request, Response } from 'express';
import { In } from 'typeorm';

import { UserAuth } from '@/api/entity';
import { UserKyc } from '@/api/entity/userkyc';
import { AppDataSource } from '@/server';

// Get all KYC submissions for admin review
export const getAllKYCSubmissions = async (req: Request, res: Response) => {
  try {
    const kycRepo = AppDataSource.getRepository(UserKyc);
    const userRepo = AppDataSource.getRepository(UserAuth);

    // Get all KYC records
    const kycSubmissions = await kycRepo.find({
      order: { createdAt: 'DESC' },
    });

    // Get user data for all KYC submissions
    const userIds = kycSubmissions.map((kyc) => kyc.userId);
    const users = await userRepo.find({
      where: { id: In(userIds) },
    });

    // Create a map for quick user lookup
    const userMap = new Map(users.map((user) => [user.id, user]));

    // Transform data for admin dashboard
    const submissions = kycSubmissions.map((kyc, index) => {
      const user = userMap.get(kyc.userId);
      return {
        id: kyc.id,
        userId: kyc.userId,
        fullName: user?.fullName || 'N/A',
        email: user?.email || 'N/A',
        mobileNumber: user?.mobileNumber || 'N/A',
        reraId: kyc.reraId || 'N/A',
        reraIdState: kyc.reraIdState || 'N/A',
        aadharcardNumber: kyc.aadharcardNumber || 'N/A',
        aadharcardAddress: kyc.aadharcardAddress || 'N/A',
        aadharFrontKey: kyc.aadharFrontKey || 'N/A',
        aadharBackKey: kyc.aadharBackKey || 'N/A',
        selfieImageKey: kyc.selfieImageKey || 'N/A',
        kycStatus: kyc.kycStatus || 'Pending',
        attemptCount: kyc.attemptCount || 0,
        isAttemptsExhausted: kyc.isAttemptsExhausted || false,
        rera: kyc.rera || false,
        createdAt: kyc.createdAt,
        updatedAt: kyc.updatedAt,
        serial: index + 1,
      };
    });

    return res.status(200).json({
      message: 'KYC submissions retrieved successfully',
      data: submissions,
      total: submissions.length,
    });
  } catch (error) {
    console.error('Error fetching KYC submissions:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ message: 'Error retrieving KYC submissions', error: errorMessage });
  }
};

// Get pending KYC submissions only
export const getPendingKYCSubmissions = async (req: Request, res: Response) => {
  try {
    const kycRepo = AppDataSource.getRepository(UserKyc);
    const userRepo = AppDataSource.getRepository(UserAuth);

    // Get pending KYC records
    const kycSubmissions = await kycRepo.find({
      where: { kycStatus: 'Pending' },
      order: { createdAt: 'DESC' },
    });

    // Get user data for all KYC submissions
    const userIds = kycSubmissions.map((kyc) => kyc.userId);
    const users = await userRepo.find({
      where: { id: In(userIds) },
    });

    // Create a map for quick user lookup
    const userMap = new Map(users.map((user) => [user.id, user]));

    // Transform data for admin dashboard
    const submissions = kycSubmissions.map((kyc, index) => {
      const user = userMap.get(kyc.userId);
      return {
        id: kyc.id,
        userId: kyc.userId,
        fullName: user?.fullName || 'N/A',
        email: user?.email || 'N/A',
        mobileNumber: user?.mobileNumber || 'N/A',
        reraId: kyc.reraId || 'N/A',
        reraIdState: kyc.reraIdState || 'N/A',
        aadharcardNumber: kyc.aadharcardNumber || 'N/A',
        aadharcardAddress: kyc.aadharcardAddress || 'N/A',
        aadharFrontKey: kyc.aadharFrontKey || 'N/A',
        aadharBackKey: kyc.aadharBackKey || 'N/A',
        selfieImageKey: kyc.selfieImageKey || 'N/A',
        kycStatus: kyc.kycStatus || 'Pending',
        attemptCount: kyc.attemptCount || 0,
        isAttemptsExhausted: kyc.isAttemptsExhausted || false,
        rera: kyc.rera || false,
        createdAt: kyc.createdAt,
        updatedAt: kyc.updatedAt,
        serial: index + 1,
      };
    });

    return res.status(200).json({
      message: 'Pending KYC submissions retrieved successfully',
      data: submissions,
      total: submissions.length,
    });
  } catch (error) {
    console.error('Error fetching pending KYC submissions:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ message: 'Error retrieving pending KYC submissions', error: errorMessage });
  }
};

// Update KYC status (approve/reject) - Admin function
export const updateKYCStatus = async (req: Request, res: Response) => {
  const { userId, status, reason } = req.body;

  try {
    if (!userId || !status) {
      return res.status(400).json({ message: 'User ID and status are required' });
    }

    if (!['Success', 'Rejected', 'Pending'].includes(status)) {
      return res.status(400).json({ message: "Invalid status. Must be 'Success', 'Rejected', or 'Pending'" });
    }

    const kycRepo = AppDataSource.getRepository(UserKyc);
    const userRepo = AppDataSource.getRepository(UserAuth);

    // Find the KYC record
    const kyc = await kycRepo.findOne({ where: { userId } });
    if (!kyc) {
      return res.status(404).json({ message: 'KYC record not found for this user' });
    }

    // Update KYC status
    kyc.kycStatus = status;
    kyc.updatedAt = new Date();

    // If rejected, store the reason (you might want to add a reason field to the UserKyc entity)
    if (status === 'Rejected' && reason) {
      // Note: You'll need to add a rejectionReason field to your UserKyc entity
      // kyc.rejectionReason = reason;
      console.log(`KYC rejected for user ${userId} with reason: ${reason}`);
    }

    await kycRepo.save(kyc);

    // Get user info for response
    const user = await userRepo.findOne({ where: { id: userId } });

    return res.status(200).json({
      message: `KYC status updated to ${status} successfully`,
      kyc: {
        userId: kyc.userId,
        kycStatus: kyc.kycStatus,
        updatedAt: kyc.updatedAt,
        userFullName: user?.fullName || 'N/A',
        userEmail: user?.email || 'N/A',
      },
    });
  } catch (error) {
    console.error('Error updating KYC status:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ message: 'Error updating KYC status', error: errorMessage });
  }
};

// Get KYC statistics for admin dashboard
export const getKYCStatistics = async (req: Request, res: Response) => {
  try {
    const kycRepo = AppDataSource.getRepository(UserKyc);

    // Get counts for different statuses
    const [total, pending, success, rejected] = await Promise.all([
      kycRepo.count(),
      kycRepo.count({ where: { kycStatus: 'Pending' } }),
      kycRepo.count({ where: { kycStatus: 'Success' } }),
      kycRepo.count({ where: { kycStatus: 'Rejected' } }),
    ]);

    // Get recent submissions (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentSubmissions = await kycRepo.count({
      where: {
        createdAt: {
          $gte: sevenDaysAgo,
        } as any,
      },
    });

    return res.status(200).json({
      message: 'KYC statistics retrieved successfully',
      statistics: {
        total,
        pending,
        success,
        rejected,
        recentSubmissions,
        approvalRate: total > 0 ? ((success / total) * 100).toFixed(2) : '0',
      },
    });
  } catch (error) {
    console.error('Error fetching KYC statistics:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ message: 'Error retrieving KYC statistics', error: errorMessage });
  }
};
