import { Request, Response } from 'express';

import { IndianCity } from '@/api/entity/IndianCity';
import { UserAuth } from '@/api/entity/UserAuth';
import { UserLocation } from '@/api/entity/UserLocation';
import { AppDataSource } from '@/server';

// Interface for location data
interface LocationData {
  latitude: number;
  longitude: number;
  address?: string;
  city?: string;
  state?: string;
  locality?: string;
  country?: string;
  postalCode?: string;
}

// Remove the static INDIAN_CITIES array

// API endpoint to get the Indian cities array from the database
export const getIndianCities = async (_req: Request, res: Response) => {
  try {
    const cities = await IndianCity.find();
    return res.status(200).json({
      success: true,
      data: cities,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch Indian cities',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Save user's current location
export const saveUserLocation = async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    const locationData: LocationData = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    if (!locationData.latitude || !locationData.longitude) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required',
      });
    }

    const userRepo = AppDataSource.getRepository(UserAuth);
    const userLocationRepo = AppDataSource.getRepository(UserLocation);

    // Check if user exists
    const user = await userRepo.findOne({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Set all previous locations as not current
    await userLocationRepo.update({ userId, isCurrentLocation: true }, { isCurrentLocation: false });

    // Create new location entry
    const newLocation = new UserLocation();
    newLocation.userId = userId;
    newLocation.latitude = locationData.latitude;
    newLocation.longitude = locationData.longitude;
    if (locationData.address) newLocation.address = locationData.address;
    if (locationData.city) newLocation.city = locationData.city;
    if (locationData.state) newLocation.state = locationData.state;
    if (locationData.locality) newLocation.locality = locationData.locality;
    if (locationData.country) newLocation.country = locationData.country;
    if (locationData.postalCode) newLocation.postalCode = locationData.postalCode;
    newLocation.isCurrentLocation = true;
    newLocation.createdBy = userId;
    newLocation.updatedBy = userId;

    const savedLocation = await userLocationRepo.save(newLocation);

    return res.status(200).json({
      success: true,
      message: 'Location saved successfully',
      data: {
        id: savedLocation.id,
        latitude: savedLocation.latitude,
        longitude: savedLocation.longitude,
        city: savedLocation.city,
        state: savedLocation.state,
        locality: savedLocation.locality,
        isCurrentLocation: savedLocation.isCurrentLocation,
        createdAt: savedLocation.createdAt,
      },
    });
  } catch (error) {
    console.error('Error in saveUserLocation:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Get user's current location
export const getUserCurrentLocation = async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    const userLocationRepo = AppDataSource.getRepository(UserLocation);

    const currentLocation = await userLocationRepo.findOne({
      where: { userId, isCurrentLocation: true },
      order: { createdAt: 'DESC' },
    });

    if (!currentLocation) {
      return res.status(200).json({
        success: true,
        message: 'No current location found',
        data: null,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Current location retrieved successfully',
      data: {
        id: currentLocation.id,
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        address: currentLocation.address,
        city: currentLocation.city,
        state: currentLocation.state,
        locality: currentLocation.locality,
        country: currentLocation.country,
        postalCode: currentLocation.postalCode,
        isCurrentLocation: currentLocation.isCurrentLocation,
        createdAt: currentLocation.createdAt,
      },
    });
  } catch (error) {
    console.error('Error in getUserCurrentLocation:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Get user's location history
export const getUserLocationHistory = async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    const { page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    const userLocationRepo = AppDataSource.getRepository(UserLocation);

    // Get total count
    const totalCount = await userLocationRepo.count({
      where: { userId },
    });

    // Get location history with pagination
    const locations = await userLocationRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip,
      take: Number(limit),
    });

    return res.status(200).json({
      success: true,
      message: 'Location history retrieved successfully',
      data: {
        locations: locations.map((location) => ({
          id: location.id,
          latitude: location.latitude,
          longitude: location.longitude,
          address: location.address,
          city: location.city,
          state: location.state,
          locality: location.locality,
          country: location.country,
          postalCode: location.postalCode,
          isCurrentLocation: location.isCurrentLocation,
          createdAt: location.createdAt,
        })),
        pagination: {
          currentPage: Number(page),
          totalPages: Math.ceil(totalCount / Number(limit)),
          totalCount,
          hasMore: skip + locations.length < totalCount,
        },
      },
    });
  } catch (error) {
    console.error('Error in getUserLocationHistory:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Update user's current location
export const updateUserLocation = async (req: Request, res: Response) => {
  try {
    const { userId, locationId } = req.body;
    const locationData: Partial<LocationData> = req.body;

    if (!userId || !locationId) {
      return res.status(400).json({
        success: false,
        message: 'User ID and Location ID are required',
      });
    }

    const userLocationRepo = AppDataSource.getRepository(UserLocation);

    // Find the location to update
    const location = await userLocationRepo.findOne({
      where: { id: locationId, userId },
    });

    if (!location) {
      return res.status(404).json({
        success: false,
        message: 'Location not found',
      });
    }

    // Update location data
    Object.assign(location, {
      ...locationData,
      updatedBy: userId,
      updatedAt: new Date(),
    });

    await userLocationRepo.save(location);

    return res.status(200).json({
      success: true,
      message: 'Location updated successfully',
      data: {
        id: location.id,
        latitude: location.latitude,
        longitude: location.longitude,
        address: location.address,
        city: location.city,
        state: location.state,
        locality: location.locality,
        country: location.country,
        postalCode: location.postalCode,
        isCurrentLocation: location.isCurrentLocation,
        updatedAt: location.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error in updateUserLocation:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Delete user location
export const deleteUserLocation = async (req: Request, res: Response) => {
  try {
    const { userId, locationId } = req.body;

    if (!userId || !locationId) {
      return res.status(400).json({
        success: false,
        message: 'User ID and Location ID are required',
      });
    }

    const userLocationRepo = AppDataSource.getRepository(UserLocation);

    // Find the location to delete
    const location = await userLocationRepo.findOne({
      where: { id: locationId, userId },
    });

    if (!location) {
      return res.status(404).json({
        success: false,
        message: 'Location not found',
      });
    }

    await userLocationRepo.remove(location);

    return res.status(200).json({
      success: true,
      message: 'Location deleted successfully',
    });
  } catch (error) {
    console.error('Error in deleteUserLocation:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
