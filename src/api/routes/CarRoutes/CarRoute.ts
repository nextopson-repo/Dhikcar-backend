import { Router } from 'express';
import {
  deleteCar,
  getAllCars,
  getCarFilterData,
  getCarLeads,
  getSlides,
  getUserCars,
  getUserCarsByIds,
  offeringCar,
  shareCarEmailNotification,
  trendingCar,
  updateCarStatus,
  updateIsSold,
} from '@/api/controllers/car/CarController';
import { createOrUpdateCar } from '@/api/controllers/car/createOrUpdateCar';
import { getCarById } from '@/api/controllers/car/GetCarById';
import {
  CreateOrUpdateRequirement,
  createRequirementEnquiry,
  createUserRequirementsEnquiry,
  deleteUserRequirements,
  deleteUserRequirementsEnquiry,
  getAllRequirements,
  getRequirementEnquiries,
  getUserRequirements,
  getUserRequirementsEnquiry,
  updateUserRequirementsFoundStatus,
} from '@/api/controllers/car/RequirementsController';
import { searchCar, testSearch } from '@/api/controllers/car/SearchCar';
import { getSubCategoryTrendingDetails, getTrendingSubCategories } from '@/api/controllers/car/trendingSubcategouries';
// import { authenticate } from '@/api/middlewares/auth/Authenticate';
import {
  carCreationRateLimiter,
  searchRateLimiter,
  strictRateLimiter,
  uploadRateLimiter,
} from '@/common/middleware/rateLimiter';
import { uploadCarImagesController } from '@/api/controllers/car/uploadCarImages';
import multer from 'multer';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Error handling wrapper for async routes
const asyncHandler = (fn: any) => (req: any, res: any, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Apply authentication middleware to all property routes
// router.use(authenticate);

// Public endpoints with standard rate limiting
router.post('/get-car-by-id', asyncHandler(getCarById));
router.post('/getAll', asyncHandler(getAllCars));
router.post('/trending-car', asyncHandler(trendingCar));
router.post('/trending-subcategories', asyncHandler(getTrendingSubCategories));
router.post('/subcategory-trending-details', asyncHandler(getSubCategoryTrendingDetails));
router.get('/get-slides', asyncHandler(getSlides));

// Search endpoints with higher limits
router.post('/search-car', searchRateLimiter, asyncHandler(searchCar));
router.post('/test-search', asyncHandler(testSearch)); // Test endpoint for debugging
router.post('/get-car-filter-data', searchRateLimiter, asyncHandler(getCarFilterData));

// Car management endpoints with strict rate limiting
router.post('/delete-car', strictRateLimiter, asyncHandler(deleteCar));
router.post('/update-is-sold', strictRateLimiter, asyncHandler(updateIsSold));
router.post('/update-car-status', strictRateLimiter, asyncHandler(updateCarStatus));
// router.post('/update-working-with-dealer', strictRateLimiter, asyncHandler(updateWorkingWithDealer));

// Car creation with specific rate limiting
router.post('/create-update', carCreationRateLimiter, asyncHandler(createOrUpdateCar));

// File upload endpoints with upload rate limiting
router.post('/upload-car-images', uploadRateLimiter, upload.single('file'), asyncHandler(uploadCarImagesController));
// router.post(
//   '/upload-car-images-with-rekognition',
//   uploadRateLimiter,
//   upload.single('file'),
//   asyncHandler(uploadPropertyImagesWithRecognitionController)
// );
// router.post(
//   '/test-recognition-analysis',
//   uploadRateLimiter,
//   upload.single('file'),
//   asyncHandler(testRecognitionAnalysisController)
// );
// router.post(
//   '/test-image-compression',
//   uploadRateLimiter,
//   upload.single('file'),
//   asyncHandler(testImageCompressionController)
// );
// router.post(
//   '/test-nsfw-detection',
//   uploadRateLimiter,
//   upload.single('file'),
//   asyncHandler(testNsfwDetectionController)
// );
// router.post(
//   '/test-contact-detection',
//   uploadRateLimiter,
//   upload.single('file'),
//   asyncHandler(testContactDetectionController)
// );
// router.post('/test-watermark', uploadRateLimiter, upload.single('file'), asyncHandler(testWatermarkController));

// Status check endpoints with burst rate limiting
// router.get('/check-model-status', burstRateLimiter, asyncHandler(checkModelStatusController));
// router.get('/check-recognition-status', burstRateLimiter, asyncHandler(checkRecognitionStatusController));

// User-specific endpoints with standard rate limiting
router.post('/get-user-cars', asyncHandler(getUserCars));
router.post('/get-user-cars-by-ids', asyncHandler(getUserCarsByIds));
router.post('/get-car-leads', asyncHandler(getCarLeads));
router.post('/share-car-email-notification', asyncHandler(shareCarEmailNotification));

// Requirements endpoints with standard rate limiting
router.post('/create-update-requirement', asyncHandler(CreateOrUpdateRequirement));
router.post('/get-user-requirements', asyncHandler(getUserRequirements));
router.post('/get-all-requirements', asyncHandler(getAllRequirements));
router.post('/delete-user-requirements', strictRateLimiter, asyncHandler(deleteUserRequirements));
router.post(
  '/update-user-requirements-found-status',
  strictRateLimiter,
  asyncHandler(updateUserRequirementsFoundStatus)
);
router.post('/create-user-requirements-enquiry', asyncHandler(createUserRequirementsEnquiry));
router.post('/get-user-requirements-enquiry', asyncHandler(getUserRequirementsEnquiry));
router.post('/get-requirement-enquiries', asyncHandler(getRequirementEnquiries));
router.post('/delete-user-requirements-enquiry', strictRateLimiter, asyncHandler(deleteUserRequirementsEnquiry));
router.post('/create-requirement-enquiry', asyncHandler(createRequirementEnquiry));

// Car offering with standard rate limiting
router.post('/offering-Car', asyncHandler(offeringCar));

// Global error handler for this router
router.use((error: any, req: any, res: any) => {
  console.error('Car route error:', error);
  if (!res.headersSent) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    });
  }
});

export default router;
