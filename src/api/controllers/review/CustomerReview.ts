import { Request, Response } from 'express';
import { UserAuth } from '@/api/entity';
import { UserReview } from '@/api/entity/UserReview';
import { AppDataSource } from '@/server';
import cloudinary from '../s3/clodinaryConfig';

// Function to format timestamp into relative time
const getRelativeTime = (date: Date): string => {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'just now';
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} min`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}h`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays}d`;
  }

  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    return `${diffInWeeks}w`;
  }

  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return `${diffInMonths}mon`;
  }

  const diffInYears = Math.floor(diffInDays / 365);
  return `${diffInYears}y`;
};

// Helper to generate Cloudinary image URL
const generateCloudinaryUrl = (publicId: string): string => {
  if (!publicId) return null;
  return cloudinary.url(publicId, {
    secure: true,
    transformation: [{ width: 150, height: 150, crop: "thumb", gravity: "face" }],
  });
};

// Create a new review
export const createReview = async (req: Request, res: Response) => {
  try {
    const { userId, reviewerId, message, rating } = req.body;

    if (!userId || !reviewerId) {
      return res.status(400).json({
        status: 'error',
        message: 'userId and reviewerId are required',
      });
    }

    const reviewRepo = AppDataSource.getRepository(UserReview);
    const userRepo = AppDataSource.getRepository(UserAuth);

    const [user, reviewer] = await Promise.all([
      userRepo.findOne({ where: { id: userId } }),
      userRepo.findOne({ where: { id: reviewerId } }),
    ]);

    if (!user || !reviewer) {
      return res.status(404).json({
        status: 'error',
        message: 'User or reviewer not found',
      });
    }

    const review = reviewRepo.create({
      userId,
      reviewerId,
      message,
      rating,
      createdBy: req.user?.id || 'system',
      updatedBy: req.user?.id || 'system',
    });

    await reviewRepo.save(review);

    return res.status(201).json({
      status: 'success',
      message: 'Review created successfully',
      data: review,
    });
  } catch (error: any) {
    return res.status(500).json({
      status: 'error',
      message: 'Error creating review',
      error: error.message,
    });
  }
};

// Get reviews for a specific user
export const getUserReviews = async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;

    const reviewRepo = AppDataSource.getRepository(UserReview);
    const userRepo = AppDataSource.getRepository(UserAuth);

    const user = await userRepo.findOne({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found',
      });
    }

    const reviews = await reviewRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    const formattedReviews = await Promise.all(
      reviews.map(async (review) => {
        const reviewer = await userRepo.findOne({
          where: { id: review.reviewerId },
          select: ['fullName', 'userProfileUrl'],
        });

        let reviewerProfileImg = null;
        if (reviewer?.userProfileUrl) {
          reviewerProfileImg = generateCloudinaryUrl(reviewer.userProfileUrl);
        }

        return {
          id: review.id,
          reviewerName: reviewer?.fullName || 'Anonymous',
          reviewerProfileImg,
          reviewermessage: review.message,
          revieweTimeStamp: getRelativeTime(review.createdAt),
          rating: review.rating,
          createdAt: review.createdAt,
          isReported: review.isReported,
          isVerified: review.isVerified,
          reportReason: review.reportReason,
        };
      })
    );

    return res.status(200).json({
      status: 'success',
      message: 'Reviews retrieved successfully',
      data: formattedReviews,
    });
  } catch (error: any) {
    console.error('Error fetching reviews:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Error fetching reviews',
      error: error.message,
    });
  }
};

// import { Request, Response } from 'express';

// import { UserAuth } from '@/api/entity';
// import { UserReview } from '@/api/entity/UserReview';
// import { AppDataSource } from '@/server';

// import { generatePresignedUrl } from '../s3/cloudinaryController';

// // Function to format timestamp into relative time
// const getRelativeTime = (date: Date): string => {
//   const now = new Date();
//   const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

//   if (diffInSeconds < 60) {
//     return 'just now';
//   }

//   const diffInMinutes = Math.floor(diffInSeconds / 60);
//   if (diffInMinutes < 60) {
//     return `${diffInMinutes} min`;
//   }

//   const diffInHours = Math.floor(diffInMinutes / 60);
//   if (diffInHours < 24) {
//     return `${diffInHours}h`;
//   }

//   const diffInDays = Math.floor(diffInHours / 24);
//   if (diffInDays < 7) {
//     return `${diffInDays}d`;
//   }

//   const diffInWeeks = Math.floor(diffInDays / 7);
//   if (diffInWeeks < 4) {
//     return `${diffInWeeks}w`;
//   }

//   const diffInMonths = Math.floor(diffInDays / 30);
//   if (diffInMonths < 12) {
//     return `${diffInMonths}mon`;
//   }

//   const diffInYears = Math.floor(diffInDays / 365);
//   return `${diffInYears}y`;
// };

// // Create a new review
// export const createReview = async (req: Request, res: Response) => {
//   try {
//     const { userId, reviewerId, message, rating } = req.body;

//     if (!userId || !reviewerId) {
//       return res.status(400).json({
//         status: 'error',
//         message: 'userId and reviewerId are required',
//       });
//     }

//     const reviewRepo = AppDataSource.getRepository(UserReview);
//     const userRepo = AppDataSource.getRepository(UserAuth);

//     // Verify if both users exist
//     const [user, reviewer] = await Promise.all([
//       userRepo.findOne({ where: { id: userId } }),
//       userRepo.findOne({ where: { id: reviewerId } }),
//     ]);

//     if (!user || !reviewer) {
//       return res.status(404).json({
//         status: 'error',
//         message: 'User or reviewer not found',
//       });
//     }

//     const review = reviewRepo.create({
//       userId,
//       reviewerId,
//       message,
//       rating,
//       createdBy: req.user?.id || 'system',
//       updatedBy: req.user?.id || 'system',
//     });

//     await reviewRepo.save(review);

//     return res.status(201).json({
//       status: 'success',
//       message: 'Review created successfully',
//       data: review,
//     });
//   } catch (error: any) {
//     return res.status(500).json({
//       status: 'error',
//       message: 'Error creating review',
//       error: error.message,
//     });
//   }
// };

// // Get reviews for a specific user
// export const getUserReviews = async (req: Request, res: Response) => {
//   try {
//     const { userId } = req.body;

//     const reviewRepo = AppDataSource.getRepository(UserReview);
//     const userRepo = AppDataSource.getRepository(UserAuth);

//     // Verify if user exists
//     const user = await userRepo.findOne({ where: { id: userId } });
//     if (!user) {
//       return res.status(404).json({
//         status: 'error',
//         message: 'User not found',
//       });
//     }

//     // Get reviews without relations first
//     const reviews = await reviewRepo.find({
//       where: { userId },
//       order: {
//         createdAt: 'DESC',
//       },
//     });

//     // Format reviews with reviewer information
//     const formattedReviews = await Promise.all(
//       reviews.map(async (review) => {
//         const reviewer = await userRepo.findOne({
//           where: { id: review.reviewerId },
//           select: ['fullName', 'userProfileUrl'],
//         });

//         let reviewerProfileImg = null;
//         if (reviewer?.userProfileUrl) {
//           reviewerProfileImg = await generatePresignedUrl(reviewer.userProfileUrl);
//         }

//         return {
//           id: review.id,
//           reviewerName: reviewer?.fullName || 'Anonymous',
//           reviewerProfileImg,
//           reviewermessage: review.message,
//           revieweTimeStamp: getRelativeTime(review.createdAt),
//           rating: review.rating,
//           createdAt: review.createdAt,
//           isReported: review.isReported,
//           isVerified: review.isVerified,
//           reportReason: review.reportReason,
//         };
//       })
//     );

//     return res.status(200).json({
//       status: 'success',
//       message: 'Reviews retrieved successfully',
//       data: formattedReviews,
//     });
//   } catch (error: any) {
//     console.error('Error fetching reviews:', error);
//     return res.status(500).json({
//       status: 'error',
//       message: 'Error fetching reviews',
//       error: error.message,
//     });
//   }
// };
