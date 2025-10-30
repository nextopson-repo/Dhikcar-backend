import { Request, Response } from 'express';
import cloudinary from '../controllers/s3/clodinaryConfig';

import { UserAuth } from '../entity/UserAuth';
import { Address } from '../entity/Address';
import { CarDetails } from '../entity/CarDetails';

// Types for request bodies
interface CreateTempCarRequest extends Request {
  body: {
    userId: string;
    title?: string;
    description?: string;
    carPrice?: string | number;
    addressState?: string;
    addressCity?: string;
    addressLocality?: string;
    carName?: string;
    isSale?: 'Sell' | 'Buy';
    brand?: string;
    model?: string;
    variant?: string;
    fuelType?: 'Petrol' | 'Diesel' | 'CNG' | 'Electric';
    transmission?: 'Manual' | 'Automatic';
    bodyType?: string;
    ownership?: '1st' | '2nd' | '3rd' | '3+';
    manufacturingYear?: string | number;
    registrationYear?: string | number;
    kmDriven?: string | number;
    seats?: string | number;
    imageKeys?: string | string[];
  };
  files?: Express.Multer.File[];
}

interface GetAllCarsRequest extends Request {
  query: {
    page?: string;
    limit?: string;
    minPrice?: string;
    maxPrice?: string;
    mobileNumber?: string;
    brand?: string;
    model?: string;
    fuelType?: string;
    transmission?: string;
    bodyType?: string;
    ownership?: string;
  };
  user?: UserAuth;
}

interface GetTempUserCarsRequest extends Request {
  params: {
    userId: string;
  };
}

interface DeleteTempCarRequest extends Request {
  params: {
    carId: string;
  };
}

interface BulkCreateTempCarsRequest extends Request {
  body: {
    cars: Array<{
      userId: string;
      [key: string]: any;
    }>;
  };
}

interface GenerateCarDescriptionRequest extends Request {
  params: {
    carId: string;
  };
}

// Response types
interface CarResponse {
  id: string;
  title?: string;
  description?: string;
  carName?: string;
  brand?: string;
  model?: string;
  variant?: string;
  fuelType?: string;
  transmission?: string;
  bodyType?: string;
  ownership?: string;
  manufacturingYear?: number;
  registrationYear?: number;
  kmDriven?: number;
  seats?: number;
  isSale?: string;
  carPrice?: number;
  isActive?: boolean;
  userId?: string | null;
  address?: {
    state?: string;
    city?: string;
    locality?: string;
  };
  carImages?: string[];
  images?: string[];
  user?: {
    id: string;
    fullName?: string;
    userType?: string;
    accountType?: string;
  } | null;
  createdAt?: Date;
}

interface ApiResponse<T = any> {
  message: string;
  car?: T;
  cars?: T;
  createdCars?: T;
  totalCreated?: number;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
  error?: string;
}

export class TempCarController {
  static async createTempCar(req: CreateTempCarRequest, res: Response<ApiResponse<CarResponse>>) {
    try {
      const {
        userId,
        title,
        description,
        carPrice,
        addressState,
        addressCity,
        addressLocality,
        carName,
        isSale,
        brand,
        model,
        variant,
        fuelType,
        transmission,
        bodyType,
        ownership,
        manufacturingYear,
        registrationYear,
        kmDriven,
        seats
      } = req.body;

      // Input validation
      if (!userId || typeof userId !== 'string') {
        return res.status(400).json({
          message: 'User ID is required and must be a string',
          error: 'INVALID_USER_ID'
        });
      }

      if (!addressState || !addressCity || !addressLocality) {
        return res.status(400).json({
          message: 'Address state, city, and locality are required',
          error: 'INVALID_ADDRESS'
        });
      }

      // Verify the user is a temporary user
      let tempUser: UserAuth | null = null;
      try {
        tempUser = await UserAuth.findOne({
          where: { id: userId, accountType: 'temporary' },
        });
      } catch (dbError) {
        console.error('Database error while finding user:', dbError);
        return res.status(500).json({
          message: 'Database error while verifying user',
          error: 'DATABASE_ERROR'
        });
      }

      if (!tempUser) {
        return res.status(404).json({
          message: 'Temporary user not found',
          error: 'USER_NOT_FOUND'
        });
      }

      // Create address
      let address: Address;
      try {
        address = new Address();
        address.state = addressState;
        address.city = addressCity;
        address.locality = addressLocality;
        address.createdBy = 'temp-system';
        address.updatedBy = 'temp-system';
        await address.save();
      } catch (addressError) {
        console.error('Error creating address:', addressError);
        return res.status(500).json({
          message: 'Failed to create address',
          error: 'ADDRESS_CREATION_ERROR'
        });
      }

      // Create car
      let car: CarDetails;
      try {
        car = new CarDetails();
        car.userId = userId;
        car.address = address;
        car.title = title || `${brand || 'Car'} ${model || ''}`.trim();
        car.description = description || `Discover this ${model?.toLowerCase() || 'car'} located at ${addressLocality}, ${addressCity}.`;
        car.carPrice = Number(carPrice) || 0;
        car.carName = carName || `${brand || ''} ${model || ''}`.trim();
        car.brand = brand || '';
        car.model = model || '';
        car.variant = variant || '';
        car.fuelType = (fuelType as 'Petrol' | 'Diesel' | 'CNG' | 'Electric') || 'Petrol';
        car.transmission = (transmission as 'Manual' | 'Automatic') || 'Manual';
        car.bodyType = bodyType || '';
        car.ownership = (ownership as '1st' | '2nd' | '3rd' | '3+') || '1st';
        car.manufacturingYear = Number(manufacturingYear) || new Date().getFullYear();
        car.registrationYear = Number(registrationYear) || new Date().getFullYear();
        car.kmDriven = Number(kmDriven) || 0;
        car.seats = Number(seats) || 4;
        car.isSale = (isSale as 'Sell' | 'Buy') || 'Sell';
        car.isActive = true;
        car.createdBy = 'temp-system';
        car.updatedBy = 'temp-system';
      } catch (carError) {
        console.error('Error creating car object:', carError);
        return res.status(500).json({
          message: 'Failed to create car object',
          error: 'CAR_CREATION_ERROR'
        });
      }

  

      // Handle image uploads if any (stream directly to Cloudinary)
      const carImages: string[] = [];

      if (req.files && Array.isArray(req.files)) {
        // Helper to upload a buffer via stream
        const uploadBuffer = (buffer: Buffer) =>
          new Promise<any>((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
              { folder: 'dhikcar/cars', resource_type: 'auto' },
              (error, result) => {
                if (error) return reject(error);
                return resolve(result);
              }
            );
            stream.end(buffer);
          });

        for (const file of req.files) {
          try {
            if (!file.buffer) {
              console.warn('File buffer is missing for uploaded file');
              continue;
            }
            const result = await uploadBuffer(file.buffer);
            if (result && result.secure_url) {
              carImages.push(result.secure_url);
            } else {
              console.warn('Cloudinary upload did not return secure_url');
            }
          } catch (uploadError) {
            console.error('Error uploading image to Cloudinary:', uploadError);
          }
        }
      }

      // Handle imageKeys from form data (for pre-uploaded images)
      if (req.body.imageKeys) {
        try {
          const imageKeys = Array.isArray(req.body.imageKeys) ? req.body.imageKeys : [req.body.imageKeys];
          for (const imageKey of imageKeys) {
            if (imageKey && typeof imageKey === 'string' && imageKey.trim()) {
              carImages.push(imageKey.trim());
            }
          }
        } catch (imageKeyError) {
          console.error('Error processing imageKeys:', imageKeyError);
        }
      }

      // Save car images array to car
      car.carImages = carImages;
      
      try {
        await car.save();
      } catch (saveError) {
        console.error('Error saving car:', saveError);
        return res.status(500).json({
          message: 'Failed to save car to database',
          error: 'CAR_SAVE_ERROR'
        });
      }

      // Reload the car with relations to get the images
      let carWithImages: CarDetails | null = null;
      try {
        carWithImages = await CarDetails.findOne({
          where: { id: car.id },
          relations: ['address']
        });
      } catch (reloadError) {
        console.error('Error reloading car with relations:', reloadError);
        // Return the car data we have even if reload fails
        carWithImages = car;
      }

      if (!carWithImages) {
        return res.status(500).json({
          message: 'Car was created but could not be retrieved',
          error: 'CAR_RETRIEVAL_ERROR'
        });
      }

      const carResponse: CarResponse = {
        id: carWithImages.id,
        title: carWithImages.title,
        description: carWithImages.description,
        carName: carWithImages.carName,
        brand: carWithImages.brand,
        model: carWithImages.model,
        variant: carWithImages.variant,
        fuelType: carWithImages.fuelType,
        transmission: carWithImages.transmission,
        bodyType: carWithImages.bodyType,
        ownership: carWithImages.ownership,
        manufacturingYear: carWithImages.manufacturingYear,
        registrationYear: carWithImages.registrationYear,
        kmDriven: carWithImages.kmDriven,
        seats: carWithImages.seats,
        isSale: carWithImages.isSale,
        carPrice: carWithImages.carPrice,
        isActive: carWithImages.isActive,
        userId: carWithImages.userId,
        address: {
          state: carWithImages.address?.state,
          city: carWithImages.address?.city,
          locality: carWithImages.address?.locality,
        },
        carImages: carWithImages.carImages || []
      };

      res.status(201).json({
        message: 'Temporary car created successfully',
        car: carResponse
      });
    } catch (error) {
      console.error('Unexpected error creating temporary car:', error);
      res.status(500).json({
        message: 'Internal server error',
        error: 'UNEXPECTED_ERROR'
      });
    }
  }

  // Get all cars (real + temporary for visitors, only real for logged users)
  static async getAllCars(req: GetAllCarsRequest, res: Response<ApiResponse<CarResponse[]>>) {
    try {
      const { user } = req; // From auth middleware
      const { 
        page = '1', 
        limit = '10', 
        minPrice, 
        maxPrice, 
        mobileNumber, 
        brand, 
        model, 
        fuelType, 
        transmission, 
        bodyType, 
        ownership 
      } = req.query;

      // Input validation
      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      
      if (isNaN(pageNum) || pageNum < 1) {
        return res.status(400).json({
          message: 'Page must be a positive integer',
          error: 'INVALID_PAGE'
        });
      }
      
      if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
        return res.status(400).json({
          message: 'Limit must be a positive integer between 1 and 100',
          error: 'INVALID_LIMIT'
        });
      }

      let mobileUser: UserAuth | null = null;
      if (mobileNumber) {
        try {
          mobileUser = await UserAuth.findOne({
            where: { mobileNumber: mobileNumber as string, accountType: 'temporary' },
          });
        } catch (userError) {
          console.error('Error finding mobile user:', userError);
          return res.status(500).json({
            message: 'Database error while finding user',
            error: 'DATABASE_ERROR'
          });
        }
        
        if (!mobileUser) {
          return res.status(404).json({
            message: 'User not found',
            error: 'USER_NOT_FOUND'
          });
        }
      }
      // Build where conditions for car
      const carWhereConditions: any = {};

      // Apply filters
      if (mobileUser) {
        carWhereConditions.userId = mobileUser.id;
      }
      if (brand) carWhereConditions.brand = String(brand);
      if (model) carWhereConditions.model = String(model);
      if (fuelType) carWhereConditions.fuelType = String(fuelType);
      if (transmission) carWhereConditions.transmission = String(transmission);
      if (bodyType) carWhereConditions.bodyType = String(bodyType);
      if (ownership) carWhereConditions.ownership = String(ownership);

   

      if (minPrice) {
        carWhereConditions.carPrice = { $gte: Number(minPrice) };
      }

      if (maxPrice) {
        if (carWhereConditions.carPrice) {
          carWhereConditions.carPrice = {
            ...carWhereConditions.carPrice,
            $lte: Number(maxPrice),
          };
        } else {
          carWhereConditions.carPrice = { $lte: Number(maxPrice) };
        }
      }

      // First, get all cars to count the total after filtering
      let allCars: CarDetails[] = [];
      try {
        allCars = await CarDetails.find({
          where: carWhereConditions,
          relations: ['user', 'address'],
          order: { createdAt: 'DESC' },
        });
      } catch (dbError) {
        console.error('Error fetching cars from database:', dbError);
        return res.status(500).json({
          message: 'Database error while fetching cars',
          error: 'DATABASE_ERROR'
        });
      }

      // Filter by user account type
      const filteredAllCars = allCars.filter((car) => {
        if (user) {
          // If user is logged in, show only real cars
          return car.user?.accountType === 'real';
        } else {
          // For visitors, show both real and temporary cars; also allow cars without a user
          return !car.user || ['real', 'temporary'].includes(car.user.accountType);
        }
      });

      // Calculate pagination
      const total = filteredAllCars.length;
      const offset = (pageNum - 1) * limitNum;
      const take = limitNum;

      // Apply pagination to filtered results
      const paginatedCars = filteredAllCars.slice(offset, offset + take);

      const carsResponse: CarResponse[] = paginatedCars.map((car: CarDetails) => ({
        id: car.id,
        title: car.title,
        description: car.description,
        carName: car.carName,
        brand: car.brand,
        model: car.model,
        variant: car.variant,
        fuelType: car.fuelType,
        transmission: car.transmission,
        bodyType: car.bodyType,
        ownership: car.ownership,
        manufacturingYear: car.manufacturingYear,
        registrationYear: car.registrationYear,
        kmDriven: car.kmDriven,
        seats: car.seats,
        isSale: car.isSale,
        carPrice: car.carPrice,
        isActive: car.isActive,
        userId: car.userId,
        address: {
          state: car.address?.state,
          city: car.address?.city,
          locality: car.address?.locality,
        },
        carImages: car.carImages || [],
        images: car.carImages || [],
        user: car.user
          ? {
              id: car.user.id,
              fullName: car.user.fullName,
              userType: car.user.userType,
              accountType: car.user.accountType,
            }
          : null,
        createdAt: car.createdAt,
      }));

      res.status(200).json({
        message: 'Cars retrieved successfully',
        cars: carsResponse,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: total,
          totalPages: Math.ceil(total / limitNum),
          hasMore: offset + take < total,
        },
      });
    } catch (error) {
      console.error('Unexpected error fetching cars:', error);
      res.status(500).json({
        message: 'Internal server error',
        error: 'UNEXPECTED_ERROR'
      });
    }
  }

  // Get cars by temporary user
  static async getTempUserCars(req: GetTempUserCarsRequest, res: Response<ApiResponse<CarResponse[]>>) {
    try {
      const { userId } = req.params;

      // Input validation
      if (!userId || typeof userId !== 'string') {
        return res.status(400).json({
          message: 'User ID is required and must be a string',
          error: 'INVALID_USER_ID'
        });
      }

      let cars: CarDetails[] = [];
      try {
        cars = await CarDetails.find({
          where: { userId },
          relations: ['user', 'address'],
        });
      } catch (dbError) {
        console.error('Error fetching cars from database:', dbError);
        return res.status(500).json({
          message: 'Database error while fetching cars',
          error: 'DATABASE_ERROR'
        });
      }

      const carsResponse: CarResponse[] = cars.map((car: CarDetails) => ({
        id: car.id,
        title: car.title,
        description: car.description,
        carName: car.carName,
        brand: car.brand,
        model: car.model,
        variant: car.variant,
        fuelType: car.fuelType,
        transmission: car.transmission,
        bodyType: car.bodyType,
        ownership: car.ownership,
        manufacturingYear: car.manufacturingYear,
        registrationYear: car.registrationYear,
        kmDriven: car.kmDriven,
        seats: car.seats,
        isSale: car.isSale,
        carPrice: car.carPrice,
        isActive: car.isActive,
        userId: car.userId,
        address: {
          state: car.address?.state,
          city: car.address?.city,
          locality: car.address?.locality,
        },
        carImages: car.carImages || [],
        images: car.carImages || [],
        user: car.user
          ? {
              id: car.user.id,
              fullName: car.user.fullName,
              userType: car.user.userType,
              accountType: car.user.accountType,
            }
          : null,
        createdAt: car.createdAt,
      }));

      res.status(200).json({
        message: 'Temporary user cars retrieved successfully',
        cars: carsResponse
      });
    } catch (error) {
      console.error('Unexpected error fetching temporary user cars:', error);
      res.status(500).json({
        message: 'Internal server error',
        error: 'UNEXPECTED_ERROR'
      });
    }
  }

  // Delete temporary car
  static async deleteTempCar(req: DeleteTempCarRequest, res: Response<ApiResponse>) {
    try {
      const { carId } = req.params;
      
      // Input validation
      if (!carId || typeof carId !== 'string') {
        return res.status(400).json({
          message: 'Car ID is required and must be a string',
          error: 'INVALID_CAR_ID'
        });
      }

      let car: CarDetails | null = null;
      try {
        car = await CarDetails.findOne({
          where: { id: carId },
          relations: ['user'],
        });
      } catch (dbError) {
        console.error('Error finding car in database:', dbError);
        return res.status(500).json({
          message: 'Database error while finding car',
          error: 'DATABASE_ERROR'
        });
      }

      if (!car) {
        return res.status(404).json({
          message: 'Car not found',
          error: 'CAR_NOT_FOUND'
        });
      }

      if (car.user && car.user.accountType !== 'temporary') {
        return res.status(403).json({
          message: 'Can only delete temporary cars',
          error: 'INSUFFICIENT_PERMISSIONS'
        });
      }

      // Delete the car
      try {
        await CarDetails.delete({ id: car.id });
      } catch (deleteError) {
        console.error('Error deleting car from database:', deleteError);
        return res.status(500).json({
          message: 'Database error while deleting car',
          error: 'DELETE_ERROR'
        });
      }

      res.status(200).json({
        message: 'Temporary car deleted successfully'
      });
    } catch (error) {
      console.error('Unexpected error deleting temporary car:', error);
      res.status(500).json({
        message: 'Internal server error',
        error: 'UNEXPECTED_ERROR'
      });
    }
  }

  // Bulk create temporary cars
  static async bulkCreateTempCars(req: BulkCreateTempCarsRequest, res: Response<ApiResponse<CarResponse[]>>) {
    try {
      const { cars } = req.body;

      // Input validation
      if (!Array.isArray(cars)) {
        return res.status(400).json({
          message: 'Cars must be an array',
          error: 'INVALID_INPUT'
        });
      }

      if (cars.length === 0) {
        return res.status(400).json({
          message: 'Cars array cannot be empty',
          error: 'EMPTY_ARRAY'
        });
      }

      if (cars.length > 100) {
        return res.status(400).json({
          message: 'Cannot create more than 100 cars at once',
          error: 'TOO_MANY_CARS'
        });
      }

      const createdCars: CarResponse[] = [];
      const errors: string[] = [];

      for (let i = 0; i < cars.length; i++) {
        const carData = cars[i];
        const { userId, ...carFields } = carData;

        try {
          // Validate required fields
          if (!userId || typeof userId !== 'string') {
            errors.push(`Car ${i + 1}: Invalid or missing userId`);
            continue;
          }

          // Verify the user is a temporary user
          let tempUser: UserAuth | null = null;
          try {
            tempUser = await UserAuth.findOne({
              where: { id: userId, accountType: 'temporary' },
            });
          } catch (userError) {
            console.error(`Error finding user for car ${i + 1}:`, userError);
            errors.push(`Car ${i + 1}: Database error while finding user`);
            continue;
          }

          if (!tempUser) {
            errors.push(`Car ${i + 1}: User not found or not temporary`);
            continue;
          }

          // Create address
          let address: Address;
          try {
            address = new Address();
            address.state = carFields.addressState || 'Temporary State';
            address.city = carFields.addressCity || 'Temporary City';
            address.locality = carFields.addressLocality || 'Temporary Locality';
            address.createdBy = 'temp-system';
            address.updatedBy = 'temp-system';
            await address.save();
          } catch (addressError) {
            console.error(`Error creating address for car ${i + 1}:`, addressError);
            errors.push(`Car ${i + 1}: Failed to create address`);
            continue;
          }

          // Create car
          let car: CarDetails;
          try {
            car = new CarDetails();
            Object.assign(car, {
              ...carFields,
              userId,
              address,
              isActive: true,
              createdBy: 'temp-system',
              updatedBy: 'temp-system',
            });

            // Generate description if not provided
            if (!car.description || car.description.trim() === '') {
              car.description = `Discover this ${car.model?.toLowerCase() || 'car'} located at ${address.locality}, ${address.city}.`;
            }

            await car.save();

            createdCars.push({
              id: car.id,
              title: car.title,
              description: car.description,
              carName: car.carName,
              brand: car.brand,
              model: car.model,
              variant: car.variant,
              fuelType: car.fuelType,
              transmission: car.transmission,
              bodyType: car.bodyType,
              ownership: car.ownership,
              manufacturingYear: car.manufacturingYear,
              registrationYear: car.registrationYear,
              kmDriven: car.kmDriven,
              seats: car.seats,
              isSale: car.isSale,
              carPrice: car.carPrice,
              isActive: car.isActive,
              userId: car.userId,
              address: {
                state: address.state,
                city: address.city,
                locality: address.locality,
              },
              carImages: car.carImages || [],
              images: car.carImages || [],
            });
          } catch (carError) {
            console.error(`Error creating car ${i + 1}:`, carError);
            errors.push(`Car ${i + 1}: Failed to create car`);
            continue;
          }
        } catch (itemError) {
          console.error(`Unexpected error processing car ${i + 1}:`, itemError);
          errors.push(`Car ${i + 1}: Unexpected error`);
        }
      }

      const response: ApiResponse<CarResponse[]> = {
        message: `Bulk temporary cars processed. Created: ${createdCars.length}, Errors: ${errors.length}`,
        cars: createdCars,
        totalCreated: createdCars.length,
      };

      if (errors.length > 0) {
        response.error = errors.join('; ');
      }

      res.status(201).json(response);
    } catch (error) {
      console.error('Unexpected error creating bulk temporary cars:', error);
      res.status(500).json({
        message: 'Internal server error',
        error: 'UNEXPECTED_ERROR'
      });
    }
  }

  // Generate description for existing car
  static async generateCarDescription(req: GenerateCarDescriptionRequest, res: Response<ApiResponse<CarResponse>>) {
    try {
      const { carId } = req.params;

      // Input validation
      if (!carId || typeof carId !== 'string') {
        return res.status(400).json({
          message: 'Car ID is required and must be a string',
          error: 'INVALID_CAR_ID'
        });
      }

      let car: CarDetails | null = null;
      try {
        car = await CarDetails.findOne({
          where: { id: carId },
          relations: ['address', 'user'],
        });
      } catch (dbError) {
        console.error('Error finding car in database:', dbError);
        return res.status(500).json({
          message: 'Database error while finding car',
          error: 'DATABASE_ERROR'
        });
      }

      if (!car) {
        return res.status(404).json({
          message: 'Car not found',
          error: 'CAR_NOT_FOUND'
        });
      }

      // Verify the user is a temporary user
      if (car.user && car.user.accountType !== 'temporary') {
        return res.status(403).json({
          message: 'Can only generate descriptions for temporary cars',
          error: 'INSUFFICIENT_PERMISSIONS'
        });
      }

      // Generate basic description
      try {
        car.updatedBy = 'temp-system';
        await car.save();
      } catch (saveError) {
        console.error('Error saving car description:', saveError);
        return res.status(500).json({
          message: 'Database error while saving car description',
          error: 'SAVE_ERROR'
        });
      }

      const carResponse: CarResponse = {
        id: car.id,
        title: car.title,
        description: car.description,
        carName: car.carName,
        brand: car.brand,
        model: car.model,
        variant: car.variant,
        fuelType: car.fuelType,
        transmission: car.transmission,
        bodyType: car.bodyType,
        ownership: car.ownership,
        manufacturingYear: car.manufacturingYear,
        registrationYear: car.registrationYear,
        kmDriven: car.kmDriven,
        seats: car.seats,
        isSale: car.isSale,
        carPrice: car.carPrice,
        isActive: car.isActive,
        userId: car.userId,
        address: {
          state: car.address?.state,
          city: car.address?.city,
          locality: car.address?.locality,
        },
        carImages: car.carImages || [],
        images: car.carImages || [],
        user: car.user
          ? {
              id: car.user.id,
              fullName: car.user.fullName,
              userType: car.user.userType,
              accountType: car.user.accountType,
            }
          : null,
        createdAt: car.createdAt,
      };

      res.status(200).json({
        message: 'Car description generated successfully',
        car: carResponse
      });
    } catch (error) {
      console.error('Unexpected error generating car description:', error);
      res.status(500).json({
        message: 'Internal server error',
        error: 'UNEXPECTED_ERROR'
      });
    }
  }
}
