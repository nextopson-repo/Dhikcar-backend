// import { deleteNotification } from '@/api/controllers/notification/socketNotificationController';
// import{sendNotification} from '@/api/controllers/notification/socketNotificationController'
import { Router } from 'express';

import { testSocketConnection } from '@/socket';

const router = Router();

// Test socket connection endpoint
router.get('/test-socket', testSocketConnection);

// router.post('/send', WebSocketNotification.sendNotification);
// router.get('/get', WebSocketNotification.getNotificationCount);
// router.post('/mark-read', WebSocketNotification.markRead);
// router.post('/mark-all-read', WebSocketNotification.markAllRead);
// router.get('/get-count', WebSocketNotification.getNotificationCount);

// router.post('/send-notification', sendNotification);
// router.post('/delete-notification', deleteNotification);

export default router;
