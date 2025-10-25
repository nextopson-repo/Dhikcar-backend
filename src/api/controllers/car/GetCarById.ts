import { Request, Response } from 'express';
import { Address } from '@/api/entity/Address';
import { CarDetails } from '@/api/entity/CarDetails';
import { SavedCar } from '@/api/entity/SavedCars';
import { UserAuth } from '@/api/entity/UserAuth';
import { AppDataSource } from '@/server';

// Type for car response based on actual CarDetails entity
type CarResponseType = {
  id: string;
  userId: string | null;
  address: Address;
  title: string;
  description: string;
  carName: string;
  brand: string;
  model: string;
  variant: string;
  fuelType: 'Petrol' | 'Diesel' | 'CNG' | 'Electric';
  transmission: 'Manual' | 'Automatic';
  bodyType: string;
  ownership: '1st' | '2nd' | '3rd' | '3+';
  manufacturingYear: number;
  registrationYear: number;
  isSale: 'Sell' | 'Buy';
  carPrice: number;
  kmDriven: number;
  seats: number;
  isSold: boolean;
  workingWithDealer: boolean | null;
  isActive: boolean;
  carImages: string[];
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
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
 * Get a single car by ID with complete details, images, and owner information
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
    const user = foundCar.userId ? await userRepo.findOne({
      where: { id: foundCar.userId },
      select: ['id', 'fullName', 'mobileNumber', 'email', 'userProfileUrl', 'userType'],
    }) : null;

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
      },
    });
  } catch (error) {
    console.error('Error in getCarById:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

