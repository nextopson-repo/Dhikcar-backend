import { Request, Response } from 'express';
import { Connections } from '@/api/entity/Connection';
import { sendMobileOTP } from '@/common/utils/mobileMsgService';
import { verifyOTP } from '@/common/utils/otpService';
import { AppDataSource } from '../../../server';
import { UserAuth } from '../../entity/UserAuth';
import { UserKyc } from '../../entity/userkyc';
import { UserReview } from '../../entity/UserReview';
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
  kycStatus: string;
  userProfile: string | null;
  subscriptionsType: string;
  followers: string;
  following: string;
  creditbilityScore: number;
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
    const kycRepo = AppDataSource.getRepository(UserKyc);
    const connectionRepo = AppDataSource.getRepository(Connections);
    const reviewRepo = AppDataSource.getRepository(UserReview);

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

    let kyc = await kycRepo.findOne({
      where: { userId: userId },
    });

    if (!kyc) {
      try {
        const newKyc = new UserKyc();
        newKyc.userId = userId;
        newKyc.kycStatus = 'Pending';
        newKyc.createdBy = 'system';
        newKyc.updatedBy = 'system';
        kyc = await kycRepo.save(newKyc);
        console.log(`Created new KYC record for user ${userId}`);
      } catch (error) {
        console.error(`Error creating KYC record for user ${userId}:`, error);
      }
    }

    const reviews = await reviewRepo.find({
      where: { userId },
    });

    let creditbilityScore = 50;

    const computeRecencyWeight = (date: Date | string | undefined): number => {
      if (!date) return 0.5;
      const reviewDate = typeof date === 'string' ? new Date(date) : date;
      const now = new Date();
      const ageDays = Math.max(0, Math.floor((now.getTime() - reviewDate.getTime()) / (1000 * 60 * 60 * 24)));
      if (ageDays <= 90) return 1.0;
      if (ageDays <= 180) return 0.85;
      if (ageDays <= 365) return 0.7;
      return 0.5;
    };

    if (reviews && reviews.length > 0) {
      if (reviews.length < 5) {
        const increment = reviews.reduce(
          (sum, review) => sum + (Number.isFinite(review.rating) ? review.rating : 0),
          0
        );
        creditbilityScore = 50 + increment;
      } else {
        let weightedSum = 0;
        let weightTotal = 0;
        let reportedCount = 0;

        for (const review of reviews) {
          const rating = Number.isFinite(review.rating) ? review.rating : 0;
          let weight = computeRecencyWeight((review as any).createdAt);

          if (review.isVerified) weight *= 1.15;
          if (review.isReported) {
            weight *= 0.7;
            reportedCount += 1;
          }

          weightedSum += rating * weight;
          weightTotal += weight;
        }

        const avgRatingWeighted = weightTotal > 0 ? weightedSum / weightTotal : 0;
        creditbilityScore = (avgRatingWeighted / 10) * 100;

        let adjustment = 0;

        if (kyc?.kycStatus === 'Success') adjustment += 3;
        if (kyc?.rera && kyc?.reraId) adjustment += 2;
        if (user.isEmailVerified) adjustment += 1;
        if (user.isMobileVerified) adjustment += 1;

        const followerBoost = Math.min(2.5, Math.log10(1 + followerCount) * 1.5);
        const followingBoost = Math.min(1.5, Math.log10(1 + followingCount) * 1.0);
        adjustment += Math.min(4, followerBoost + followingBoost);
        adjustment -= Math.min(5, reportedCount * 0.5);

        creditbilityScore += adjustment;
      }
    }

    creditbilityScore = Math.round(creditbilityScore * 100) / 100;
    if (creditbilityScore >= 100) {
      creditbilityScore = 99.99;
    } else if (creditbilityScore < 0) {
      creditbilityScore = 0;
    }

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
      kycStatus: kyc?.kycStatus || 'Pending',
      userProfile: userProfileUrl,
      subscriptionsType: 'Premium Active',
      followers: formatNumber(followerCount),
      following: formatNumber(followingCount),
      creditbilityScore,
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

// import { Request, Response } from 'express';

// import { Connections } from '@/api/entity/Connection';
// import { sendMobileOTP } from '@/common/utils/mobileMsgService';
// import { verifyOTP } from '@/common/utils/otpService';

// import { AppDataSource } from '../../../server';
// import { UserAuth } from '../../entity/UserAuth';
// import { UserKyc } from '../../entity/userkyc';
// import { UserReview } from '../../entity/UserReview';
// import { generatePresignedUrl } from '../s3/cloudinaryController';

// // Helper function to format numbers
// const formatNumber = (num: number): string => {
//   if (num >= 1000000) {
//     return (num / 1000000).toFixed(1) + 'M';
//   }
//   if (num >= 1000) {
//     return (num / 1000).toFixed(1) + 'K';
//   }
//   return num.toString();
// };

// // interface GetUserProfileRequest {
// //   userId: string;
// // }

// interface UserProfileResponse {
//   id: string;
//   mobileNumber: string;
//   email: string;
//   fullName: string;
//   userType: string;
//   userProfileUrl: string | null;
//   address: string;
//   landmark: string;
//   city: string;
//   pin: string;
//   isEmailVerified: boolean;
//   isMobileVerified: boolean;
//   kycStatus: string;
//   userProfile: string | null;
//   subscriptionsType: string;
//   followers: string;
//   following: string;
//   creditbilityScore: number;
//   socialMediaLinks?: Array<{
//     type: string;
//     link: string;
//   }>;
// }

// export const getUserProfile = async (req: Request, res: Response) => {
//   const { userId } = req.body;

//   if (!userId) {
//     return res.status(400).json({
//       status: 'error',
//       message: 'userId required',
//     });
//   }

//   try {
//     // Check if TypeORM is initialized
//     if (!AppDataSource.isInitialized) {
//       await AppDataSource.initialize();
//     }

//     // Initialize repositories
//     const userRepo = AppDataSource.getRepository(UserAuth);
//     const kycRepo = AppDataSource.getRepository(UserKyc);
//     const connectionRepo = AppDataSource.getRepository(Connections);
//     const reviewRepo = AppDataSource.getRepository(UserReview);

//     // First check if user exists
//     const user = await userRepo.findOne({
//       where: { id: userId },
//     });

//     if (!user) {
//       return res.status(404).json({
//         status: 'error',
//         message: 'User not found',
//       });
//     }

//     // Get connection counts (removed status field since it doesn't exist in our entity)
//     const followingCount = await connectionRepo.count({
//       where: { requesterId: userId },
//     });
//     const followerCount = await connectionRepo.count({
//       where: { receiverId: userId },
//     });

//     // Fetch KYC data early for use in score adjustments
//     let kyc = await kycRepo.findOne({
//       where: { userId: userId },
//     });

//     // If user is not registered for KYC, create a new KYC record
//     if (!kyc) {
//       try {
//         const newKyc = new UserKyc();
//         newKyc.userId = userId;
//         newKyc.kycStatus = 'Pending';
//         newKyc.createdBy = 'system';
//         newKyc.updatedBy = 'system';

//         kyc = await kycRepo.save(newKyc);
//         console.log(`Created new KYC record for user ${userId}`);
//       } catch (error) {
//         console.error(`Error creating KYC record for user ${userId}:`, error);
//         // Continue with null kyc rather than failing the whole request
//       }
//     }

//     // Calculate average rating and credibility score
//     const reviews = await reviewRepo.find({
//       where: { userId },
//     });

//     let creditbilityScore = 50;

//     // Helper to compute recency weight (newer reviews weigh more)
//     const computeRecencyWeight = (date: Date | string | undefined): number => {
//       if (!date) return 0.5;
//       const reviewDate = typeof date === 'string' ? new Date(date) : date;
//       const now = new Date();
//       const ageDays = Math.max(0, Math.floor((now.getTime() - reviewDate.getTime()) / (1000 * 60 * 60 * 24)));
//       if (ageDays <= 90) return 1.0; // up to ~3 months
//       if (ageDays <= 180) return 0.85; // 3-6 months
//       if (ageDays <= 365) return 0.7; // 6-12 months
//       return 0.5; // older than a year
//     };

//     if (reviews && reviews.length > 0) {
//       if (reviews.length < 5) {
//         // For first few reviews, keep the simple, transparent increments
//         const increment = reviews.reduce(
//           (sum, review) => sum + (Number.isFinite(review.rating) ? review.rating : 0),
//           0
//         );
//         creditbilityScore = 50 + increment;
//       } else {
//         // Recency-weighted and quality-weighted average for 5+ reviews
//         let weightedSum = 0;
//         let weightTotal = 0;
//         let reportedCount = 0;

//         for (const review of reviews) {
//           const rating = Number.isFinite(review.rating) ? review.rating : 0;
//           let weight = computeRecencyWeight((review as any).createdAt);

//           // Verified reviews get a bit more influence; reported get less
//           if (review.isVerified) weight *= 1.15;
//           if (review.isReported) {
//             weight *= 0.7;
//             reportedCount += 1;
//           }

//           weightedSum += rating * weight;
//           weightTotal += weight;
//         }

//         const avgRatingWeighted = weightTotal > 0 ? weightedSum / weightTotal : 0;
//         creditbilityScore = (avgRatingWeighted / 10) * 100; // convert to 0-100 scale

//         // Small, explainable adjustments (bounded and deterministic)
//         let adjustment = 0;

//         // Identity/KYC signals
//         if (kyc?.kycStatus === 'Success') adjustment += 3; // verified identity
//         if (kyc?.rera && kyc?.reraId) adjustment += 2; // RERA verified
//         if (user.isEmailVerified) adjustment += 1; // email verified
//         if (user.isMobileVerified) adjustment += 1; // mobile verified

//         // Network effects (logarithmic, small impact, max ~4)
//         const followerBoost = Math.min(2.5, Math.log10(1 + followerCount) * 1.5);
//         const followingBoost = Math.min(1.5, Math.log10(1 + followingCount) * 1.0);
//         adjustment += Math.min(4, followerBoost + followingBoost);

//         // Reported reviews penalty (small, capped)
//         adjustment -= Math.min(5, reportedCount * 0.5);

//         creditbilityScore += adjustment;
//       }
//     }

//     // Round to two decimals for a more precise, stable display
//     creditbilityScore = Math.round(creditbilityScore * 100) / 100;

//     // Ensure the score never exceeds 100; if it hits/exceeds 100, show 99.99
//     if (creditbilityScore >= 100) {
//       creditbilityScore = 99.99;
//     } else if (creditbilityScore < 0) {
//       creditbilityScore = 0;
//     }

//     // KYC already fetched above for use in adjustments

//     // Generate presigned URL if profile image exists
//     let userProfileUrl = null;
//     if (user.userProfileUrl) {
//       try {
//         userProfileUrl = await generatePresignedUrl(user.userProfileUrl);
//       } catch (error) {
//         console.error(`Error generating presigned URL for user ${userId}:`, error);
//       }
//     }

//     const response: UserProfileResponse = {
//       id: user.id,
//       mobileNumber: user.mobileNumber,
//       email: user.email || '',
//       fullName: user.fullName || '',
//       userType: user.userType || 'EndUser',
//       userProfileUrl: user.userProfileUrl,
//       address: user.address || '',
//       landmark: user.landmark || '',
//       city: user.city || '',
//       pin: user.pin || '',
//       isEmailVerified: user.isEmailVerified,
//       isMobileVerified: user.isMobileVerified,
//       kycStatus: kyc?.kycStatus || 'Pending',
//       userProfile: userProfileUrl,
//       subscriptionsType: 'Premium Active',
//       followers: formatNumber(followerCount),
//       following: formatNumber(followingCount),
//       creditbilityScore,
//       socialMediaLinks: user.socialMediaLinks || [],
//     };

//     return res.json({
//       status: 'success',
//       message: 'User profile fetched successfully',
//       data: response,
//     });
//   } catch (error) {
//     console.error(`Error fetching user ${userId}:`, error);
//     return res.status(500).json({
//       status: 'error',
//       message: 'Internal server error while fetching user profile',
//       error: error instanceof Error ? error.message : 'Unknown error',
//     });
//   }
// };

// export const deleteUserAccount = async (req: Request, res: Response) => {
//   const { userId, otp } = req.body;

//   if (!userId || !otp) {
//     return res.status(400).json({ message: 'User ID and OTP are required.' });
//   }

//   try {
//     const userRepo = AppDataSource.getRepository(UserAuth);
//     const user = await userRepo.findOne({ where: { id: userId } });

//     if (!user) {
//       return res.status(404).json({ message: 'User not found.' });
//     }

//     // Placeholder for OTP verification logic
//     // In a real application, you would compare the provided OTP with a stored OTP (e.g., in a database or cache)
//     // and ensure it hasn't expired.
//     // For this example, let's assume a simple verification if an otpService.verifyOTP exists
//     const isOtpValid = await verifyOTP(user.mobileNumber, otp, 'delete_account');

//     if (!isOtpValid) {
//       return res.status(400).json({ message: 'Invalid or expired OTP.' });
//     }

//     await userRepo.delete(userId);

//     return res.status(200).json({ message: 'Account deleted successfully.' });
//   } catch (error) {
//     console.error('Error deleting user account:', error);
//     return res.status(500).json({ message: 'Internal server error.' });
//   }
// };

// export const resendDeleteAccountOTP = async (req: Request, res: Response) => {
//   const { userId } = req.body;

//   if (!userId) {
//     return res.status(400).json({ message: 'User ID is required.' });
//   }

//   try {
//     const userRepo = AppDataSource.getRepository(UserAuth);
//     const user = await userRepo.findOne({ where: { id: userId } });

//     if (!user) {
//       return res.status(404).json({ message: 'User not found.' });
//     }

//     // Generate a new OTP and send it
//     const newOtp = Math.floor(1000 + Math.random() * 9000).toString(); // Generate a 4-digit OTP
//     // In a real application, you would store this new OTP with an expiration time
//     // and then send it via SMS.
//     await sendMobileOTP(user.mobileNumber, newOtp);

//     return res.status(200).json({ message: 'OTP sent successfully.' });
//   } catch (error) {
//     console.error('Error resending OTP:', error);
//     return res.status(500).json({ message: 'Internal server error.' });
//   }
// };
