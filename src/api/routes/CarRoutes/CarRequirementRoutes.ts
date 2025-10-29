import { Router } from 'express';
import {
  createOrUpdateCarRequirement,
  getAllCarRequirements,
  getUserCarRequirements,
  getCarRequirementById,
  updateCarRequirementFoundStatus,
  deleteCarRequirement,
} from '@/api/controllers/car/CarRequirementController';
import { strictRateLimiter } from '@/common/middleware/rateLimiter';

const router = Router();

// Error handling wrapper for async routes
const asyncHandler = (fn: any) => (req: any, res: any, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Car Requirement routes
router.post('/create-update', asyncHandler(createOrUpdateCarRequirement));
router.post('/get-all', asyncHandler(getAllCarRequirements));
router.post('/get-user-requirements', asyncHandler(getUserCarRequirements));
router.post('/get-by-id', asyncHandler(getCarRequirementById));
router.post('/update-found-status', strictRateLimiter, asyncHandler(updateCarRequirementFoundStatus));
router.post('/delete', strictRateLimiter, asyncHandler(deleteCarRequirement));

// Global error handler for this router
router.use((error: any, req: any, res: any) => {
  console.error('Car requirement route error:', error);
  if (!res.headersSent) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    });
  }
});

export default router;

