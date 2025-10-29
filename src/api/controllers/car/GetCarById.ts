import { Request, Response } from 'express';
import { Address } from '@/api/entity/Address';
import { CarDetails } from '@/api/entity/CarDetails';
import { SavedCar } from '@/api/entity/SavedCars';
import { UserAuth } from '@/api/entity/UserAuth';
import { AppDataSource } from '@/server';

// Type for car response
type CarResponseType = {
  id: string;
  userId: string;
  address: Address;
  title: string;
  description: string;
  carName: string | null;
  brand: string | null;
  model: string | null;
  variant: string | null;
  fuelType: string;
  transmission: string;
  bodyType: string | null;
  ownership: string;
  manufacturingYear: number;
  registrationYear: number;
  isSale: 'Sell' | 'Buy' | null;
  carPrice: number;
  kmDriven: number;
  seats: number;
  isSold: boolean;
  isActive: boolean;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
  carImages: string[];
  isSaved?: boolean;
};

// Map full car response
async function mapCarResponse(car: CarDetails): Promise<CarResponseType> {
  return {
    ...car,
    carImages: car.carImages || [],
  };
}

/**
 * Get a single car by ID with complete details and images
 */
export const getCarById = async (req: Request, res: Response) => {
  try {
    const { carId, userId } = req.body;

    if (!carId) {
      return res.status(400).json({ message: 'Car ID is required' });
    }

    const carRepo = AppDataSource.getRepository(CarDetails);
    const userRepo = AppDataSource.getRepository(UserAuth);
    const savedCarRepo = AppDataSource.getRepository(SavedCar);

    // Get car with relations
    const foundCar = await carRepo.findOne({
      where: { id: carId },
      relations: ['address'],
    });

    if (!foundCar) {
      return res.status(404).json({ message: 'Car not found' });
    }

    // Get owner details
    const user = await userRepo.findOne({
      where: { id: foundCar.userId },
      select: ['id', 'fullName', 'mobileNumber', 'email', 'userProfileUrl', 'userType'],
    });

    // Map car response
    const carResponse = await mapCarResponse(foundCar);

    // Check if saved by current user
    let isSaved = false;
    if (userId) {
      const savedCar = await savedCarRepo.findOne({
        where: { carId: foundCar.id, userId: userId },
      });
      isSaved = !!savedCar;
    }
    carResponse.isSaved = isSaved;

    return res.status(200).json({
      message: 'Car retrieved successfully',
      car: carResponse,
      owner: {
        id: user?.id,
        fullName: user?.fullName,
        mobileNumber: user?.mobileNumber,
        email: user?.email,
        userType: user?.userType,
        userProfileUrl: user?.userProfileUrl,
      },
    });
  } catch (error) {
    console.error('Error in getCarById:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};