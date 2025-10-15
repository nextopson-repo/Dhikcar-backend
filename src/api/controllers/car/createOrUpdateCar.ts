import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { UserAuth } from '@/api/entity/UserAuth';
import { Address } from '@/api/entity/Address';
import { CarDetails } from '@/api/entity/CarDetails';
import { AppDataSource } from '@/server';
import cloudinary from '../s3/clodinaryConfig';

// Use process.cwd() as fallback for directory path
const __dirname = path.join(process.cwd(), 'src', 'api', 'controllers', 'car');

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
    isActive?: boolean;
  };
  files?: Express.Multer.File[];
  user?: RequestUser;
}

const validateAndTransformIsSale = (input: string | undefined): 'Sell' | 'Buy' | null => {
  if (!input) return null;

  const normalized = input.toLowerCase().trim();

  if (normalized === 'sell' || normalized === 'sale') {
    return 'Sell';
  }
  if (normalized === 'buy' || normalized === 'rent' || normalized === 'rental') {
    return 'Buy';
  }

  return null; 
};

// Helper function to generate unique key for uploaded images
function generateUniqueKey(originalname: string): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return `${timestamp}-${random}-${originalname}`;
}

// Helper function to upload image to Cloudinary with timeout
async function uploadImageToCloudinary(file: Express.Multer.File, userId: string): Promise<{ imageKey: string; presignedUrl: string }> {
  return new Promise(async (resolve, reject) => {
    // Check if Cloudinary is configured
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      console.warn('Cloudinary not configured, skipping image upload');
      reject(new Error('Cloudinary not configured'));
      return;
    }

    const timeout = setTimeout(() => {
      reject(new Error('Upload timeout after 20 seconds'));
    }, 20000); // 20 seconds timeout

    try {
      const imageBuffer = file.buffer;
      const originalName = file.originalname;
      const tempFileName = `temp-${Date.now()}-${originalName}`;
      const tempFilePath = path.join(__dirname, '../../temp', tempFileName);

      // Create temp folder if it doesn't exist
      if (!fs.existsSync(path.dirname(tempFilePath))) {
        fs.mkdirSync(path.dirname(tempFilePath), { recursive: true });
      }

      // Save image temporarily
      fs.writeFileSync(tempFilePath, imageBuffer);

      console.log(`Processing file: ${originalName}, size: ${imageBuffer.length} bytes`);

      // Upload to Cloudinary with optimized settings
      const result = await cloudinary.uploader.upload(tempFilePath, {
        folder: 'nextdeal/car-images',
        public_id: generateUniqueKey(originalName).split('.')[0],
        resource_type: 'auto',
        quality: 'auto',
        fetch_format: 'auto',
        transformation: [
          { width: 1200, height: 800, crop: 'limit', quality: 'auto' }
        ],
        eager: [
          { width: 400, height: 300, crop: 'fill', quality: 'auto' }
        ]
      });

      // Clean up temp file immediately
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }

      clearTimeout(timeout);
      resolve({
        imageKey: result.public_id,
        presignedUrl: result.secure_url,
      });
    } catch (error) {
      clearTimeout(timeout);
      console.error('Error uploading to Cloudinary:', error);
      reject(new Error(`Image upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
  });
}

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
    title: requestTitle,
  } = req.body;

  const uploadedFiles = req.files as Express.Multer.File[] || [];

  console.warn('req.body', req.body);
  console.log(`Processing ${uploadedFiles.length} uploaded images`);

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
    const userRepo = AppDataSource.getRepository(UserAuth);
    const user = await userRepo.findOne({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Process uploaded images
    let processedImages: string[] = [];

    if (uploadedFiles.length > 0) {
      console.log(`Processing ${uploadedFiles.length} uploaded images`);
      
      for (const file of uploadedFiles) {
        try {
          const uploadResult = await uploadImageToCloudinary(file, userId);
          processedImages.push(uploadResult.presignedUrl);
        } catch (error) {
          console.error(`Error uploading image ${file.originalname}:`, error);
          // If Cloudinary is not configured, create a mock entry for testing
          if (error instanceof Error && error.message.includes('Cloudinary not configured')) {
            console.log('Creating mock image entry for testing purposes');
            processedImages.push(`https://via.placeholder.com/400x300?text=${encodeURIComponent(file.originalname)}`);
          }
          // Continue with other images even if one fails
        }
      }
      
      console.log(`Final image keys count: ${processedImages.length}`);
    }

    // Check if car exists for update
    if (carId) {
      const existingCar = await carRepo.findOne({
        where: { id: carId },
        relations: ['address'],
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
     
      Object.assign(existingCar, carUpdateData);

      // Handle car images update
      if (processedImages.length > 0) {
        existingCar.carImages = processedImages;
      }

      // Only generate title and description if they don't already exist or if title is not provided in request
      const updatedCar = await carRepo.save(existingCar);

      // Fetch the updated car with all relations
      const carWithRelations = await carRepo.findOne({
        where: { id: updatedCar.id },
        relations: ['address'],
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
    newCar.carName = safeTransform(carName) || '';
    newCar.brand = safeTransform(brand) || '';
    newCar.model = safeTransform(model) || '';
    newCar.variant = safeTransform(variant) || '';
    newCar.fuelType = safeTransform(fuelType) || 'Petrol';
    newCar.transmission = safeTransform(transmission) || 'Manual';
    newCar.ownership = safeTransform(ownership) || '1st';
    newCar.bodyType = safeTransform(bodyType) || '';
    newCar.kmDriven = safeTransform(kmDriven) || 0;
    newCar.seats = safeTransform(seats) || 4;
    newCar.manufacturingYear = safeTransform(manufacturingYear) || new Date().getFullYear();
    newCar.registrationYear = safeTransform(registrationYear) || new Date().getFullYear();

    // Validate and transform isSale
    const validatedIsSale = validateAndTransformIsSale(isSale);
    if (isSale && !validatedIsSale) {
      console.warn(`Invalid isSale value: "${isSale}". Valid options: Sell, Buy`);
    }
    newCar.isSale = validatedIsSale || 'Sell';
    newCar.carPrice = safeTransform(carPrice) || 0;
    newCar.createdBy = userId;
    newCar.updatedBy = userId;

    // Always generate title and description using TitleAndDiscription.ts before saving to database
    // This is a critical async operation that must complete before saving to database
    // The CarTitleAndDescription.generate() method handles all fallbacks and ensures reliable output

    // Only generate title and description if title is not provided in request

    const savedCar = await carRepo.save(newCar);

    // Set car images if provided
    if (processedImages.length > 0) {
      newCar.carImages = processedImages;
      await carRepo.save(newCar);
    }

    // Fetch the new car with all relations
    const carWithRelations = await carRepo.findOne({
      where: { id: savedCar.id },
      relations: ['address'],
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
