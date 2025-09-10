import express from 'express';

import {
  getActiveUsers,
  getActiveUsersList,
  getInactiveUsers,
  getInactiveUsersList,
  getOnlineUsers,
  getTotalUsers,
  getUserStatistics,
} from '@/api/controllers/User/UserStatisticsController';

const router = express.Router();

// Get total users count
router.get('/total', getTotalUsers);

// Get active users count
router.get('/active', getActiveUsers);

// Get inactive users count
router.get('/inactive', getInactiveUsers);

// Get currently online users count
router.get('/online', getOnlineUsers);

// Get comprehensive user statistics
router.get('/statistics', getUserStatistics);

// Get list of active users with pagination
router.get('/active/list', getActiveUsersList);

// Get list of inactive users with pagination
router.get('/inactive/list', getInactiveUsersList);

export default router;
