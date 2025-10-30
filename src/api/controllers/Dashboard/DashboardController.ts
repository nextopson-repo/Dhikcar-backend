import { Request, Response } from 'express';
import { In } from 'typeorm';

import { UserAuth } from '@/api/entity';
import { CarDetails } from '@/api/entity/CarDetails';
import { SavedCar } from '@/api/entity/SavedCars';
import { AppDataSource } from '@/server';

// Custom type for request user
type RequestUser = {
  id: string;
  userType: 'Dealer' | 'Owner' | 'EndUser';
  email: string;
  mobileNumber: string;
  isAdmin?: boolean;
  isSold?: boolean;
  conversion?: string;
};

export interface CarRequest extends Omit<Request, 'user'> {
  body: {
    carId?: string;
    userId?: string;
    addressState?: string;
    addressCity?: string;
    addressLocality?: string;
    imageKeys?: string[];
    category: string;
    subCategory: string;
    carName?: string;
    carPrice?: number;
    width?: number;
    height?: number;
    length?: number;
    groundHeight?: number;
    unit?: string;
    isSold?: boolean;
    conversion?: string;
    // Analytics filter fields
    dateRangeType?: 'lastMonth' | 'last3Months' | 'lastYear' | 'custom';
    fromDate?: string; // ISO string, required if dateRangeType is 'custom'
    toDate?: string; // ISO string, required if dateRangeType is 'custom'
  };
  user?: RequestUser;
}

// create saved property
export const createSavedCar = async (req: Request, res: Response) => {
  try {
    const { carId, userId } = req.body;
    if (!carId || !userId) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }

    const savedCarRepo = AppDataSource.getRepository(SavedCar);
    const carRepo = AppDataSource.getRepository(CarDetails);

    // First check if property exists
    const carDetails = await carRepo.findOne({
      where: { id: carId }
    });

    if (!carDetails) {
      return res.status(404).json({ message: 'Car not found' });
    }

     // ✅ Duplicate check: agar already saved hai to return kar do
    const existing = await savedCarRepo.findOne({
      where: { carId, userId }
    });
    if (existing) {
      return res.status(200).json({
        message: 'Car already saved',
        newCar: existing,
        carDetails,
      });
    }

    const savedCar = savedCarRepo.create({
      carId,
      ownerId: carDetails.userId,
      userId,
    });
    const newCar = await savedCarRepo.save(savedCar);

    return res.status(201).json({
      message: 'Saved car created successfully',
      newCar,
      carDetails,
    });
  } catch (error: any) {
    console.error('Error in createSavedCar:', error);
    return res.status(500).json({
      message: error.message || 'Internal server error',
      error: error,
    });
  }
};

// saved car
export const getSavedCars = async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }
    const savedCarRepo = AppDataSource.getRepository(SavedCar);
    const carRepo = AppDataSource.getRepository(CarDetails);
    const userRepo = AppDataSource.getRepository(UserAuth);

    const user = await userRepo.findOne({
      where: { id: userId },
    });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    const savedCars = await savedCarRepo.find({
      where: { userId },
    });

    if (!savedCars || savedCars.length === 0) {
      return res.status(404).json({ message: 'No saved cars found' });
    }
    const carIds = savedCars.map((sp) => sp.carId);
    const cars = await carRepo.find({
      where: { id: In(carIds) }
    });
    const carMap = new Map(cars.map((p) => [p.id, p]));
    const result = savedCars.map((sp) => ({
      savedCar: sp,
      property: carMap.get(sp.carId) || null,
    }));
    return res.status(200).json({
      message: 'Saved cars retrieved successfully',
      result: {
        savedCars: result,
        user,
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Internal server error' });
  }
};

// remove saved car
export const removeSavedCar = async (req: Request, res: Response) => {
  try {
    const { savedCarId, userId } = req.body;
    if (!savedCarId || !userId) {
      return res.status(400).json({ message: 'Saved car ID and user ID are required' });
    }
    const savedCarRepo = AppDataSource.getRepository(SavedCar);
    const savedCar = await savedCarRepo.findOne({
      where: { carId: savedCarId, userId },
    });

    if (!savedCar) {
      return res.status(404).json({ message: 'Saved car not found' });
    }
    await savedCarRepo.remove(savedCar);
    return res.status(200).json({ message: 'Saved car removed successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Internal server error' });
  }
};

// get top dealers by city
export const getTopDealers = async (req: Request, res: Response) => {
  try {
    const { city, limit } = req.body as { city?: string; limit?: number };

    if (!city) {
      return res.status(400).json({ message: 'city is required' });
    }

    const userRepo = AppDataSource.getRepository(UserAuth);

    const dealers = await userRepo.find({
      where: {
        userType: 'Dealer',
        city: city,
        accountType: 'real' as any,
      },
      order: { createdAt: 'DESC' },
      take: typeof limit === 'number' && limit > 0 ? limit : 20,
      select: [
        'id',
        'fullName',
        'profileImg',
        'userProfileUrl',
        'address',
        'landmark',
        'city',
        'state',
        'pin',
        'mobileNumber',
        'createdAt',
      ],
    });

    const data = dealers.map((u) => ({
      id: u.id,
      name: u.fullName || '',
      img: u.profileImg || u.userProfileUrl || null,
      address: u.address || '',
      landmark: u.landmark || '',
      city: u.city || '',
      state: u.state || '',
      pin: u.pin || '',
      mobileNumber: u.mobileNumber || '',
      createdAt: u.createdAt,
    }));

    return res.status(200).json({
      message: 'Top dealers fetched successfully',
      data,
    });
  } catch (error: any) {
    console.error('Error in getTopDealers:', error);
    return res.status(500).json({ message: error.message || 'Internal server error' });
  }
};
