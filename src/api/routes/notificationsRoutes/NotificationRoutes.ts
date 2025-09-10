import { Router } from 'express';

import {
  createBundledNotifications,
  createNotification,
  createNotificationWithPush,
  fetchNotifications,
  getBundledNotificationDetails,
  getDelayedEmailStatus,
  manualCleanupNotifications,
  markAsRead,
  registerFCMToken,
  sendBulkNotifications,
  testBundledNotifications,
  testFollowNotificationBundling,
  unregisterFCMToken,
} from '@/api/controllers/notification/NotificationController';

const router = Router();
router.post('/create-notification', createNotification);
router.post('/create-notification-with-push', createNotificationWithPush);
router.post('/mark-as-read', markAsRead);
router.get('/fetch-notifications', fetchNotifications);
router.post('/register-fcm-token', registerFCMToken);
router.post('/unregister-fcm-token', unregisterFCMToken);
router.get('/delayed-email-status', getDelayedEmailStatus);
router.post('/manual-cleanup/:userId', manualCleanupNotifications);

// Bundled notification routes
router.post('/bundle-notifications', createBundledNotifications);
router.get('/bundle-details/:notificationId', getBundledNotificationDetails);
router.post('/bulk-notifications', sendBulkNotifications);
router.post('/test-bundled-notifications', testBundledNotifications);
router.post('/test-follow-bundling', testFollowNotificationBundling);

export default router;
