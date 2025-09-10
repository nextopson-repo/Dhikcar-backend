import { Request, Response } from 'express';

import { UserAuth } from '@/api/entity';
import { Address } from '@/api/entity/Address';
import { CarDetails } from '@/api/entity/CarDetails';
import { CarImages } from '@/api/entity/CarImages';
import { AppDataSource } from '@/server';

// Custom type for request user
type RequestUser = {
  id: string;
  userType: 'Dealer' | 'Owner' | 'EndUser';
  email: string;
  mobileNumber: string;
  isAdmin?: boolean;
};

// Car creation/update request type
export interface CarRequest extends Omit<Request, 'user'> {
  body: {
    carId?: string;
    userId: string;
    addressState?: string;
    addressCity?: string;
    addressLocality?: string;
    imageKeys: Array<{
      imageKey: string;
      imgClassifications: 'Left' | 'Right' | 'Front' | 'Back' | 'Door' | 'Roof' | 'Window' | 'Other';
      accurencyPercent: number;
    }>;
    title?: string;
    carName?: string;
    brand?: string;
    model?: string;
    variant?: string;
    fuelType?: 'Petrol' | 'Diesel' | 'CNG' | 'Electric';
    transmission?: 'Manual' | 'Automatic';
    ownership?: '1st' | '2nd' | '3rd' | '3+';
    manufacturingYear?: number;
    registrationYear?: number;
    bodyType?: string;
    isSale?: 'Sell' | 'Rent';
    carPrice?: number;
    kmDriven?: number;
    seats: number;
    isSold?: boolean;
    isActive?: boolean;
  };
  user?: RequestUser;
}

// Validation and transformation functions
// const validateAndTransformFurnishing = (
//   input: string | undefined
// ): 'Semi Furnished' | 'Fully Furnished' | 'Unfurnished' | null => {
//   if (!input) return null;

//   const normalized = input.toLowerCase().trim();

//   if (normalized.includes('semi') || normalized.includes('partial')) {
//     return 'Semi Furnished';
//   }
//   if (normalized.includes('full') || normalized.includes('complete')) {
//     return 'Fully Furnished';
//   }
//   if (normalized.includes('unfurnished') || normalized.includes('bare') || normalized.includes('empty')) {
//     return 'Unfurnished';
//   }

//   return null; // Invalid input
// };

// const validateAndTransformConstructionStatus = (
//   input: string | undefined
// ): 'Ready to Move' | 'Under Construction' | 'New Launch' | null => {
//   if (!input) return null;

//   const normalized = input.toLowerCase().trim();

//   if (normalized.includes('ready') || normalized.includes('move') || normalized.includes('complete')) {
//     return 'Ready to Move';
//   }
//   if (normalized.includes('under') || normalized.includes('construction') || normalized.includes('ongoing')) {
//     return 'Under Construction';
//   }
//   if (normalized.includes('new') || normalized.includes('launch') || normalized.includes('pre')) {
//     return 'New Launch';
//   }

//   return null; // Invalid input
// };

// const validateAndTransformPropertyFacing = (
//   input: string | undefined
// ): 'North' | 'South' | 'East' | 'West' | 'North-East' | 'North-West' | 'South-East' | 'South-West' | null => {
//   if (!input) return null;

//   const normalized = input.toLowerCase().trim();

//   // Handle abbreviations and variations
//   if (normalized === 'n' || normalized === 'north') return 'North';
//   if (normalized === 's' || normalized === 'south') return 'South';
//   if (normalized === 'e' || normalized === 'east') return 'East';
//   if (normalized === 'w' || normalized === 'west') return 'West';
//   if (
//     normalized === 'ne' ||
//     normalized.includes('north-east') ||
//     normalized.includes('northeast') ||
//     normalized.includes('North East')
//   )
//     return 'North-East';
//   if (
//     normalized === 'nw' ||
//     normalized.includes('north-west') ||
//     normalized.includes('northwest') ||
//     normalized.includes('north west') ||
//     normalized.includes('North West')
//   )
//     return 'North-West';
//   if (
//     normalized === 'se' ||
//     normalized.includes('south-east') ||
//     normalized.includes('southeast') ||
//     normalized.includes('south east') ||
//     normalized.includes('South East')
//   )
//     return 'South-East';
//   if (
//     normalized === 'sw' ||
//     normalized.includes('south-west') ||
//     normalized.includes('southwest') ||
//     normalized.includes('south west') ||
//     normalized.includes('South West')
//   )
//     return 'South-West';

//   return null; // Invalid input
// };

const validateAndTransformIsSale = (input: string | undefined): 'Sell' | 'Buy' | null => {
  if (!input) return null;

  const normalized = input.toLowerCase().trim();

  if (normalized === 'sell' || normalized === 'sale' || normalized === 'buy') {
    return 'Sell';
  }
  if (normalized === 'rent' || normalized === 'rental') {
    return 'Buy';
  }

  return null; // Invalid input
};

export const createOrUpdateCar = async (req: CarRequest, res: Response) => {
  const {
    carId,
    userId,
    addressState,
    addressCity,
    addressLocality,
    carName,
    brand,
    model,
    variant,
    fuelType,
    transmission,
    manufacturingYear,
    registrationYear,
    ownership,
    bodyType,
    carPrice,
    kmDriven,
    seats,
    isSale,
    isSold,
    imageKeys,
    title: requestTitle,
  } = req.body;

  // Helper function to safely transform fields
  const safeTransform = (field: any, isArray: boolean = false) => {
    if (field === null || field === undefined || field === '') {
      return null;
    }
    if (Array.isArray(field)) {
      if (isArray) {
        return field.length > 0 ? field : [];
      } else {
        return field.length > 0 ? field[0] : null;
      }
    }
    return field;
  };

  try {
    const carRepo = AppDataSource.getRepository(CarDetails);
    const addressRepo = AppDataSource.getRepository(Address);
    const carImagesRepo = AppDataSource.getRepository(CarImages);
    const userRepo = AppDataSource.getRepository(UserAuth);
    const user = await userRepo.findOne({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!CarImages) {
      return res.status(404).json({ success: false, message: 'Car Images not found' });
    }

    // Check if car exists for update
    if (carId) {
      const existingCar = await carRepo.findOne({
        where: { id: carId },
        relations: ['address', 'carImages'],
      });

      if (!existingCar) {
        return res.status(404).json({
          success: false,
          message: 'Car not found',
        });
      }

      // Update address if provided
      if (existingCar.address && (addressState || addressCity || addressLocality)) {
        existingCar.address.state = addressState || existingCar.address.state;
        existingCar.address.city = addressCity || existingCar.address.city;
        existingCar.address.locality = addressLocality || existingCar.address.locality;
        await addressRepo.save(existingCar.address);
      }

      // Update car with only provided fields
      const carUpdateData: Partial<CarDetails> = {};

      // Always update category and subCategory as they are required
      // carUpdateData.category = category; // category is now properly typed
      // carUpdateData.subCategory = subCategory; // subCategory is now properly typed

      // Only include other fields that are provided in the request
      if (requestTitle !== undefined) carUpdateData.title = safeTransform(requestTitle);
      if (carName !== undefined) carUpdateData.carName = safeTransform(carName);
      if (isSale !== undefined) {
        const validatedIsSale = validateAndTransformIsSale(isSale);
        if (validatedIsSale) {
          carUpdateData.isSale = validatedIsSale;
        } else if (isSale) {
          console.warn(`Invalid isSale value: "${isSale}". Valid options: Sell, Buy`);
        }
      }
      // if (carPrice !== undefined) carUpdateData.carPrice = safeTransform(carPrice);
      if (isSold !== undefined) carUpdateData.isSold = safeTransform(isSold);
      // if (workingWithDealer !== undefined) carUpdateData.workingWithDealer = safeTransform(workingWithDealer);

      Object.assign(existingCar, carUpdateData);

      // Handle car images update
      if (imageKeys && imageKeys.length > 0) {
        // Delete existing images
        if (existingCar.carImages.length > 0) {
          await carImagesRepo.remove(existingCar.carImages);
        }

        // Create new car images (only with valid imageKey)
        const carImages = imageKeys
          .filter((imgData) => imgData.imageKey)
          .map((imgData) => {
            const carImage = new CarImages();
            carImage.imageKey = imgData.imageKey;
            carImage.imgClassifications = imgData.imgClassifications;
            carImage.accurencyPercent = imgData.accurencyPercent;
            carImage.car = existingCar;
            return carImage;
          });

        if (carImages.length > 0) {
          existingCar.carImages = await carImagesRepo.save(carImages);
        } else {
          existingCar.carImages = [];
        }
      }

      // Generate title and description for updated car before saving
      // This is a critical async operation that must complete before saving to database
      // The CarTitleAndDescription.generate() method handles all fallbacks and ensures reliable output

      // Only generate title and description if they don't already exist or if title is not provided in request
      const updatedCar = await carRepo.save(existingCar);

      // Fetch the updated car with all relations
      const carWithRelations = await carRepo.findOne({
        where: { id: updatedCar.id },
        relations: ['address', 'carImages'],
      });

      return res.status(200).json({
        success: true,
        message: 'Car updated successfully',
        car: carWithRelations,
      });
    }

    if (!addressCity || !addressLocality) {
      return res.status(400).json({
        success: false,
        message: 'Address details are required for creating a new car',
      });
    }

    const newAddress = addressRepo.create({
      state: addressState,
      city: addressCity,
      locality: addressLocality,
      createdBy: userId,
      updatedBy: userId,
    });
    await addressRepo.save(newAddress);
    // Create new car with all required fields
    const newCar = new CarDetails();
    newCar.userId = userId;
    newCar.address = newAddress;
    newCar.carName = carName;
    newCar.brand = brand;
    newCar.model = model;
    newCar.variant = variant;
    newCar.fuelType = fuelType;
    newCar.transmission = transmission;
    newCar.ownership = ownership;
    newCar.bodyType = bodyType;
    newCar.kmDriven = kmDriven;
    newCar.seats = seats;
    newCar.isSale = isSale;
    newCar.carPrice = carPrice;
    newCar.isSold = isSold;
    newCar.manufacturingYear = manufacturingYear;
    newCar.registrationYear = registrationYear;

    // Validate and transform isSale
    const validatedIsSale = validateAndTransformIsSale(isSale);
    if (isSale && !validatedIsSale) {
      console.warn(`Invalid isSale value: "${isSale}". Valid options: Sell, Buy`);
    }
    newCar.isSale = validatedIsSale as any;
    newCar.carPrice = safeTransform(carPrice) || 0;
    newCar.isSold = safeTransform(isSold) || false;
    newCar.model = safeTransform(model);
    newCar.variant = safeTransform(variant);
    newCar.fuelType = safeTransform(fuelType);
    newCar.transmission = safeTransform(transmission);
    newCar.ownership = safeTransform(ownership);
    newCar.bodyType = safeTransform(bodyType);
    newCar.manufacturingYear = safeTransform(manufacturingYear);
    newCar.registrationYear = safeTransform(registrationYear);
    newCar.kmDriven = safeTransform(kmDriven);
    newCar.seats = safeTransform(seats);
    newCar.createdBy = userId;
    newCar.updatedBy = userId;

    // Always generate title and description using TitleAndDiscription.ts before saving to database
    // This is a critical async operation that must complete before saving to database
    // The CarTitleAndDescription.generate() method handles all fallbacks and ensures reliable output

    // Only generate title and description if title is not provided in request

    const savedCar = await carRepo.save(newCar);

    // Create car images if provided
    if (imageKeys && imageKeys.length > 0) {
      const carImages = imageKeys
        .filter((imgData) => imgData.imageKey)
        .map((imgData) => {
          const carImage = new CarImages();
          carImage.imageKey = imgData.imageKey;
          carImage.imgClassifications = imgData.imgClassifications;
          carImage.accurencyPercent = imgData.accurencyPercent;
          carImage.car = savedCar;
          return carImage;
        });

      if (carImages.length > 0) {
        await carImagesRepo.save(carImages);
      }
    }

    // Fetch the new car with all relations
    const carWithRelations = await carRepo.findOne({
      where: { id: savedCar.id },
      relations: ['address', 'carImages'],
    });

    const activeCar = await carRepo.count({
      where: {
        userId,
        isActive: true,
        isSold: false,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Car created successfully',
      car: carWithRelations,
      activeCar,
    });
  } catch (error) {
    console.error('Error in createOrUpdateCar:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};
