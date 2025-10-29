import { Request, Response } from 'express';
import { Connections } from '@/api/entity/Connection';
import { sendMobileOTP } from '@/common/utils/mobileMsgService';
import { verifyOTP } from '@/common/utils/otpService';
import { AppDataSource } from '../../../server';
import { UserAuth } from '../../entity/UserAuth';
import cloudinary from '../s3/clodinaryConfig';

// Helper function to format numbers
const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
};

// Generate Cloudinary URL from publicId
const generateCloudinaryUrl = (publicId: string): string | null => {
  if (!publicId) return null;
  return cloudinary.url(publicId, {
    secure: true,
    transformation: [{ width: 150, height: 150, crop: "thumb", gravity: "face" }],
  });
};

interface UserProfileResponse {
  id: string;
  mobileNumber: string;
  email: string;
  fullName: string;
  userType: string;
  userProfileUrl: string | null;
  address: string;
  landmark: string;
  city: string;
  pin: string;
  isEmailVerified: boolean;
  isMobileVerified: boolean;
  userProfile: string | null;
  subscriptionsType: string;
  followers: string;
  following: string;
  socialMediaLinks?: Array<{
    type: string;
    link: string;
  }>;
}

export const getUserProfile = async (req: Request, res: Response) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({
      status: 'error',
      message: 'userId required',
    });
  }

  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    const userRepo = AppDataSource.getRepository(UserAuth);
    const connectionRepo = AppDataSource.getRepository(Connections);

    const user = await userRepo.findOne({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found',
      });
    }

    const followingCount = await connectionRepo.count({
      where: { requesterId: userId },
    });
    const followerCount = await connectionRepo.count({
      where: { receiverId: userId },
    });

    let userProfileUrl = null;
    if (user.userProfileUrl) {
      try {
        userProfileUrl = generateCloudinaryUrl(user.userProfileUrl);
      } catch (error) {
        console.error(`Error generating Cloudinary URL for user ${userId}:`, error);
      }
    }

    const response: UserProfileResponse = {
      id: user.id,
      mobileNumber: user.mobileNumber,
      email: user.email || '',
      fullName: user.fullName || '',
      userType: user.userType || 'EndUser',
      userProfileUrl: user.userProfileUrl,
      address: user.address || '',
      landmark: user.landmark || '',
      city: user.city || '',
      pin: user.pin || '',
      isEmailVerified: user.isEmailVerified,
      isMobileVerified: user.isMobileVerified,
      userProfile: userProfileUrl,
      subscriptionsType: 'Premium Active',
      followers: formatNumber(followerCount),
      following: formatNumber(followingCount),
      socialMediaLinks: user.socialMediaLinks || [],
    };

    return res.json({
      status: 'success',
      message: 'User profile fetched successfully',
      data: response,
    });
  } catch (error) {
    console.error(`Error fetching user ${req.body.userId}:`, error);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error while fetching user profile',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

export const deleteUserAccount = async (req: Request, res: Response) => {
  const { userId, otp } = req.body;

  if (!userId || !otp) {
    return res.status(400).json({ message: 'User ID and OTP are required.' });
  }

  try {
    const userRepo = AppDataSource.getRepository(UserAuth);
    const user = await userRepo.findOne({ where: { id: userId } });

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const isOtpValid = await verifyOTP(user.mobileNumber, otp, 'delete_account');

    if (!isOtpValid) {
      return res.status(400).json({ message: 'Invalid or expired OTP.' });
    }

    await userRepo.delete(userId);

    return res.status(200).json({ message: 'Account deleted successfully.' });
  } catch (error) {
    console.error('Error deleting user account:', error);
    return res.status(500).json({ message: 'Internal server error.' });
  }
};

export const resendDeleteAccountOTP = async (req: Request, res: Response) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ message: 'User ID is required.' });
  }

  try {
    const userRepo = AppDataSource.getRepository(UserAuth);
    const user = await userRepo.findOne({ where: { id: userId } });

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const newOtp = Math.floor(1000 + Math.random() * 9000).toString();
    await sendMobileOTP(user.mobileNumber, newOtp);

    return res.status(200).json({ message: 'OTP sent successfully.' });
  } catch (error) {
    console.error('Error resending OTP:', error);
    return res.status(500).json({ message: 'Internal server error.' });
  }
};

