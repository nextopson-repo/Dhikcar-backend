import { Router } from 'express';

import { errorHandler } from '../middlewares/errorHandler';

const router = Router();

/**
 * API Routes
 *
 * All routes are prefixed with /api
 *
 * @route   GET /api/health
 * @desc    Health check endpoint
 * @access  Public
 */
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Import route modules
// Auth routes
// import authRoutes from './auth';
// router.use('/auth', authRoutes);

// Property routes
// import propertyRoutes from './PropertyRoutes';
// router.use('/properties', propertyRoutes);

// Dashboard routes
// import dashboardRoutes from './dashboardRoutes';
// router.use('/dashboard', dashboardRoutes);

// KYC routes
import kycRoutes from './kycProcess/kycProcessRoutes';
router.use('/kyc', kycRoutes);

// Suspend user routes
import suspendUserRoutes from './User/suspendUserRoutes';
router.use('/suspend', suspendUserRoutes);

// Profile routes
// import profileRoutes from './UpdateProfileRoute';
// router.use('/profile', profileRoutes);

// AWS routes
// import awsRoutes from './aws';
// router.use('/aws', awsRoutes);

// Dropdown routes
// import dropdownRoutes from './dropDown';
// router.use('/dropdowns', dropdownRoutes);

// Notification routes
// import notificationRoutes from './notifications';
// router.use('/notifications', notificationRoutes);

// Error handling middleware should be last
router.use(errorHandler);

export default router;
