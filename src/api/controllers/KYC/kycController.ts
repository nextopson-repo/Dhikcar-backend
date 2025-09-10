import { Request, Response } from 'express';

import { UserAuth } from '@/api/entity';
import { NotificationType } from '@/api/entity/Notifications';
import { UserKyc } from '@/api/entity/userkyc';
import { AppDataSource } from '@/server';

import { bundleNotification } from '../notification/NotificationController';

// Create or Update KYC
export const createUpdateKyc = async (req: Request, res: Response) => {
  const {
    userId,
    reraIdState,
    reraId,
    aadharFrontKey,
    aadharBackKey,
    selfieImageKey,
    aadharcardNumber,
    aadharcardAddress,
    isReraChoice,
  } = req.body;

  // Debug: Log the received data
  console.log('KYC Update Request Data:', {
    userId,
    reraIdState,
    reraId,
    aadharFrontKey,
    aadharBackKey,
    selfieImageKey,
    aadharcardNumber,
    aadharcardAddress,
    isReraChoice,
  });

  try {
    const kycRepo = AppDataSource.getRepository(UserKyc);
    const userRepo = AppDataSource.getRepository(UserAuth);

    const user = await userRepo.findOne({ where: { id: userId } });
    if (!user) return res.status(404).json({ message: 'User not found' });

    let kyc = await kycRepo.findOne({ where: { userId } });
    const isNew = !kyc;

    if (!kyc) {
      kyc = kycRepo.create({ userId });
    }

    // Check if attempts are exhausted (increased to 5 attempts)
    if (kyc.isAttemptsExhausted) {
      return res.status(400).json({
        message: 'Maximum KYC attempts reached. Please contact support.',
        attemptsExhausted: true,
      });
    }

    // If this is a RERA choice (allowing changes)
    if (isReraChoice !== undefined) {
      // Allow changing RERA choice - no restrictions
      kyc.rera = isReraChoice;

      // Ensure attemptCount is a valid number before incrementing
      if (typeof kyc.attemptCount !== 'number' || isNaN(kyc.attemptCount)) {
        kyc.attemptCount = 0;
      }
      kyc.attemptCount += 1;
      kyc.lastAttemptDate = new Date();

      // Debug: Log attempt count
      console.log('Updated attempt count:', kyc.attemptCount);

      // Check if attempts are exhausted after this choice (5 attempts max)
      if (kyc.attemptCount >= 5) {
        kyc.isAttemptsExhausted = true;
      }
    }

    // Update KYC fields if present
    if (reraIdState) kyc.reraIdState = reraIdState;
    if (reraId) {
      kyc.reraId = reraId;
      // Don't set rera to true here as it should only be set during initial choice
    }
    if (aadharcardNumber) {
      // Handle number type directly
      if (typeof aadharcardNumber === 'number' && !isNaN(aadharcardNumber)) {
        kyc.aadharcardNumber = aadharcardNumber;
      } else if (typeof aadharcardNumber === 'string') {
        // Fallback for string type (backward compatibility)
        const cardNumber = parseFloat(aadharcardNumber);
        if (!isNaN(cardNumber)) {
          kyc.aadharcardNumber = cardNumber;
        }
      }
    }
    if (aadharcardAddress) kyc.aadharcardAddress = aadharcardAddress;
    if (aadharFrontKey) kyc.aadharFrontKey = aadharFrontKey;
    if (aadharBackKey) kyc.aadharBackKey = aadharBackKey;
    if (selfieImageKey) kyc.selfieImageKey = selfieImageKey;

    // Check if KYC is complete and update status
    if (kyc.aadharFrontKey && kyc.aadharBackKey && kyc.selfieImageKey) {
      // If all documents are uploaded, mark as Success
      kyc.kycStatus = 'Success';

      // Increase user's credibility score by 20 points for successful KYC
      // Note: This would need to be implemented in the user profile system
      // For now, we'll just log it
      console.log(`KYC completed for user ${userId} - credibility score should be increased`);
    }

    // Debug: Log the final KYC object before saving
    console.log('Final KYC object before saving:', {
      id: kyc.id,
      userId: kyc.userId,
      kycStatus: kyc.kycStatus,
      attemptCount: kyc.attemptCount,
      isAttemptsExhausted: kyc.isAttemptsExhausted,
      rera: kyc.rera,
      aadharcardNumber: kyc.aadharcardNumber,
      aadharFrontKey: kyc.aadharFrontKey,
      aadharBackKey: kyc.aadharBackKey,
      selfieImageKey: kyc.selfieImageKey,
    });

    await kycRepo.save(kyc);

    if (kyc.kycStatus === 'Success') {
      await bundleNotification([
        {
          userId: userId,
          message: `Verification Successful! You're now a KYC Verified Agent on Nextdeal - credibility unlocked. opportunities await`,
          mediakey: user.userProfileKey || undefined,
          type: NotificationType.VERIFICATION,
          user: user.fullName,
          status: kyc.kycStatus,
          actionId: kyc.id, // For navigation to StartKycScreen
        },
      ]);
    }
    if (kyc.kycStatus === 'Rejected') {
      await bundleNotification([
        {
          userId: userId,
          message: `Verification Rejected! Your KYC verification has been rejected. Please try again.`,
          mediakey: user.userProfileKey || undefined,
          type: NotificationType.VERIFICATION,
          user: user.fullName,
          status: kyc.kycStatus,
          actionId: kyc.id, // For navigation to StartKycScreen
        },
      ]);
    }

    return res.status(isNew ? 201 : 200).json({
      message: isNew ? 'KYC created successfully' : 'KYC updated successfully',
      created: isNew,
      kyc,
    });
  } catch (error) {
    console.error('KYC update error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ message: 'Error updating KYC', error: errorMessage });
  }
};

// Get KYC Status
export const GetKycStatus = async (req: Request, res: Response) => {
  const { userId } = req.body;

  try {
    const kycRepo = AppDataSource.getRepository(UserKyc);
    const userRepo = AppDataSource.getRepository(UserAuth);

    const user = await userRepo.findOne({ where: { id: userId } });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const kyc = await kycRepo.findOne({ where: { userId } });
    if (!kyc) return res.status(404).json({ message: 'KYC not found for this user' });

    return res.status(200).json({
      message: 'KYC status retrieved successfully',
      kyc,
      status: {
        kycStatus: kyc.kycStatus,
        attemptCount: kyc.attemptCount,
        isAttemptsExhausted: kyc.isAttemptsExhausted,
        reraChoiceMade: kyc.rera !== null && kyc.rera !== undefined,
        documentsSubmitted: {
          reraId: !!kyc.reraId,
          reraVerified: kyc.rera,
          aadharCard: !!kyc.aadharcardNumber,
          aadharAddress: !!kyc.aadharcardAddress,
          selfie: !!kyc.selfieImageKey,
          aadharFront: !!kyc.aadharFrontKey,
          aadharBack: !!kyc.aadharBackKey,
        },
      },
    });
  } catch (error) {
    console.error('KYC status retrieval error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ message: 'Error retrieving KYC status', error: errorMessage });
  }
};

// Reset KYC attempts (for admin use)
export const resetKycAttempts = async (req: Request, res: Response) => {
  const { userId } = req.body;

  try {
    const kycRepo = AppDataSource.getRepository(UserKyc);
    const userRepo = AppDataSource.getRepository(UserAuth);

    const user = await userRepo.findOne({ where: { id: userId } });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const kyc = await kycRepo.findOne({ where: { userId } });
    if (!kyc) return res.status(404).json({ message: 'KYC not found for this user' });

    kyc.attemptCount = 0;
    kyc.isAttemptsExhausted = false;
    kyc.lastAttemptDate = null;

    await kycRepo.save(kyc);

    return res.status(200).json({
      message: 'KYC attempts reset successfully',
      kyc,
    });
  } catch (error) {
    console.error('KYC attempts reset error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ message: 'Error resetting KYC attempts', error: errorMessage });
  }
};
