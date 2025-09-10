import { Request, Response } from 'express';

import { UserAuth } from '@/api/entity/UserAuth';
import { UserReview } from '@/api/entity/UserReview';
import { AppDataSource } from '@/server';

// Create a new review
export const createReview = async (req: Request, res: Response) => {
  const { userId, reviewerId, message, rating } = req.body;

  try {
    const reviewRepo = AppDataSource.getRepository(UserReview);
    const userRepo = AppDataSource.getRepository(UserAuth);

    // Verify both users exist
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

    // Create new review
    const review = reviewRepo.create({
      userId,
      reviewerId,
      message,
      rating,
      createdBy: reviewerId,
      updatedBy: reviewerId,
    });

    await reviewRepo.save(review);

    return res.status(201).json({
      status: 'success',
      message: 'Review created successfully',
      data: review,
    });
  } catch (error) {
    console.error('Review creation error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Error creating review',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Get all reviews for a user
export const getUserReviews = async (req: Request, res: Response) => {
  const { userId } = req.body;

  try {
    const reviewRepo = AppDataSource.getRepository(UserReview);
    const userRepo = AppDataSource.getRepository(UserAuth);

    // Verify user exists
    const user = await userRepo.findOne({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found',
      });
    }

    // Get all reviews for the user
    const reviews = await reviewRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    return res.status(200).json({
      status: 'success',
      message: 'Reviews retrieved successfully',
      data: reviews,
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Error fetching reviews',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Get a specific review by ID
export const getReviewById = async (req: Request, res: Response) => {
  const { reviewId } = req.body;

  try {
    const reviewRepo = AppDataSource.getRepository(UserReview);
    const review = await reviewRepo.findOne({ where: { id: reviewId } });

    if (!review) {
      return res.status(404).json({
        status: 'error',
        message: 'Review not found',
      });
    }

    return res.status(200).json({
      status: 'success',
      message: 'Review retrieved successfully',
      data: review,
    });
  } catch (error) {
    console.error('Error fetching review:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Error fetching review',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Update a review
export const updateReview = async (req: Request, res: Response) => {
  const { reviewId, message, rating, reviewerId } = req.body;

  try {
    const reviewRepo = AppDataSource.getRepository(UserReview);
    const review = await reviewRepo.findOne({ where: { id: reviewId } });

    if (!review) {
      return res.status(404).json({
        status: 'error',
        message: 'Review not found',
      });
    }

    // Verify the reviewer is the one who created the review
    if (review.reviewerId !== reviewerId) {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to update this review',
      });
    }

    // Update review fields
    if (message) review.message = message;
    if (rating) review.rating = rating;
    review.updatedBy = reviewerId;

    await reviewRepo.save(review);

    return res.status(200).json({
      status: 'success',
      message: 'Review updated successfully',
      data: review,
    });
  } catch (error) {
    console.error('Error updating review:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Error updating review',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Delete a review
export const deleteReview = async (req: Request, res: Response) => {
  const { reviewId, reviewerId } = req.body;

  try {
    const reviewRepo = AppDataSource.getRepository(UserReview);
    const review = await reviewRepo.findOne({ where: { id: reviewId } });

    if (!review) {
      return res.status(404).json({
        status: 'error',
        message: 'Review not found',
      });
    }

    // Verify the reviewer is the one who created the review
    if (review.reviewerId !== reviewerId) {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to delete this review',
      });
    }

    await reviewRepo.remove(review);

    return res.status(200).json({
      status: 'success',
      message: 'Review deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting review:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Error deleting review',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Report a review
export const reportReview = async (req: Request, res: Response) => {
  const { reviewId, reporterId, reason } = req.body;

  try {
    const reviewRepo = AppDataSource.getRepository(UserReview);
    const review = await reviewRepo.findOne({ where: { id: reviewId } });

    if (!review) {
      return res.status(404).json({
        status: 'error',
        message: 'Review not found',
      });
    }

    review.isReported = true;
    review.reportReason = reason;
    review.updatedBy = reporterId;

    await reviewRepo.save(review);

    return res.status(200).json({
      status: 'success',
      message: 'Review reported successfully',
      data: review,
    });
  } catch (error) {
    console.error('Error reporting review:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Error reporting review',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Remove report from a review
export const removeReport = async (req: Request, res: Response) => {
  const { reviewId, adminId } = req.body;

  try {
    const reviewRepo = AppDataSource.getRepository(UserReview);
    const review = await reviewRepo.findOne({ where: { id: reviewId } });

    if (!review) {
      return res.status(404).json({
        status: 'error',
        message: 'Review not found',
      });
    }

    review.isReported = false;
    review.reportReason = '';
    review.updatedBy = adminId;

    await reviewRepo.save(review);

    return res.status(200).json({
      status: 'success',
      message: 'Review report removed successfully',
      data: review,
    });
  } catch (error) {
    console.error('Error removing review report:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Error removing review report',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
