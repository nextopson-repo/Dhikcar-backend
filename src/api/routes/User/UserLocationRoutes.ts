import express from 'express';

import {
  deleteUserLocation,
  getIndianCities,
  getUserCurrentLocation,
  getUserLocationHistory,
  saveUserLocation,
  updateUserLocation,
} from '@/api/controllers/User/UserLocationController';

const router = express.Router();

// Save user's current location
router.post('/save', saveUserLocation);

// Get user's current location
router.post('/current', getUserCurrentLocation);

// Get user's location history with pagination
router.get('/history', getUserLocationHistory);

// Update user location
router.put('/update', updateUserLocation);

// Delete user location
router.delete('/delete', deleteUserLocation);

// Get Indian cities (static list)
router.get('/indian-cities', getIndianCities);

export default router;
