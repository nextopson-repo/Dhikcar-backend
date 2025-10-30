import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { Between, In, IsNull, Like, Not } from 'typeorm';

// import { generatePresignedUrl } from '@/api/controllers/s3/cloudinaryController';
import { Address } from '@/api/entity/Address';
import { CarDetails } from '@/api/entity/CarDetails';
import { CarEnquiry } from '@/api/entity/CarEnquiry';
import { SavedCar } from '@/api/entity/SavedCars';
import { UserAuth } from '@/api/entity/UserAuth';
import { sendEmailNotification } from '@/common/utils/mailService';
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
    carDetailsId?: string;
    userId?: string;
    addressState?: string;
    addressCity?: string;
    addressLocality?: string;
    imageKeys?: string[];
    category: string;
    carName?: string;
    isSale?: 'Sell' | 'Buy';
    carPrice?: number;
    isSold?: boolean;
  };
  user?: RequestUser;
}

// Interface for car image with presigned URL
interface CarDetailsImageWithUrl {
  imageKey: string;
  presignedUrl: string;
}

// Type for car details response with images that have presigned URLs
type CarDetailsResponseType = {
  id: string;
  userId: string | null;
  address: Address;
  title: string;
  description: string;
  carName: string | null;
  brand: string | null;
  model: string | null;
  variant: string | null;
  fuelType: 'Petrol' | 'Diesel' | 'CNG' | 'Electric';
  manufacturingYear: number;
  transmission: 'Manual' | 'Automatic';
  kmDriven: number;
  registrationYear: number;
  seats: number;
  ownership: '1st' | '2nd' | '3rd' | '3+';
  bodyType: string | null;
  isSale: 'Sell' | 'Buy' | null;
  carPrice: number;
  isSold: boolean;
  isActive: boolean;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
  carImages: CarDetailsImageWithUrl[];
  enquiries?: {
    viewCars: number;
    calling: number;
  };
  ownerDetails?: {
    name: string | null;
    email: string | null;
    mobileNumber: string | null;
  };
  isSaved?: boolean;
  isReported?: boolean;
};

// Simple helper to format car images as array of strings
function formatCarImages(images: string[]): string[] {
  if (!images || !Array.isArray(images)) {
    return [];
  }
  return images.filter((imageKey) => imageKey && imageKey.trim());
}

// Simple mapping for car details response
function mapCarDetailsResponse(car: CarDetails): any {
  if (!car) {
    return null;
  }

  return {
    ...car,
    carImages: formatCarImages(car.carImages || [])
  };
}

/**
 * Format date to relative time string
 */
export const formateTime = (time: Date) => {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - time.getTime()) / 1000);

  if (diffInSeconds < 30) {
    return 'just now';
  } else if (diffInSeconds < 60) {
    return `${diffInSeconds}sec ago`;
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes}min ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else if (diffInSeconds < 2592000) {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days}day${days > 1 ? 's' : ''} ago`;
  } else if (diffInSeconds < 31536000) {
    const months = Math.floor(diffInSeconds / 2592000);
    return `${months} month${months > 1 ? 's' : ''} ago`;
  } else {
    const years = Math.floor(diffInSeconds / 31536000);
    return `${years} year${years > 1 ? 's' : ''} ago`;
  }
};

export const formatCarPrice = (price: number): string => {
  if (!price || price <= 0) {
    return '0';
  }

  // For prices less than 1000, show as is
  if (price < 1000) {
    return `${price}`;
  }

  // For prices 1000 to 99999, format as k
  if (price < 100000) {
    const kValue = price / 1000;
    if (kValue === Math.floor(kValue)) {
      return `${kValue}K`;
    } else {
      return `${kValue.toFixed(1)}K`;
    }
  }

  // For prices 1,00,000 to 99,99,999 format as l
  if (price < 10000000) {
    const lValue = price / 100000;
    if (lValue === Math.floor(lValue)) {
      return `${lValue}L`;
    } else {
      return `${lValue.toFixed(1)}L`;
    }
  }

  // For prices 1,00,00,000 and above, format as cr
  const crValue = price / 10000000;
  if (crValue === Math.floor(crValue)) {
    return `${crValue}Cr`;
  } else {
    return `${crValue.toFixed(1)}Cr`;
  }
};

/**
 * Get Cars owned by a specific user with pagination and filtering
 */
export const getUserCars = async (req: Request, res: Response) => {
  try {
    const { userId, search, isSale, carTypes, priceRange, sort = 'newest' } = req.body;
    const { page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    const carsRepo = AppDataSource.getRepository(CarDetails);
    const carEnquiryRepo = AppDataSource.getRepository(CarEnquiry);
    const userRepo = AppDataSource.getRepository(UserAuth);
    const savedCarsRepo = AppDataSource.getRepository(SavedCar);

    // Get saved cars
    const SavedCars = await savedCarsRepo.find({ where: { userId }, select: ['carId'] });
    const savedCarIds = SavedCars.map((sc: any) => sc.carId);

    // Query builder with correct alias
    const queryBuilder = carsRepo
      .createQueryBuilder('car')
      .leftJoinAndSelect('car.address', 'address')
      .where('car.userId = :userId', { userId });

    // 🔍 Search
    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      queryBuilder.andWhere(
        '(car.carName LIKE :search OR car.description LIKE :search OR address.city LIKE :search OR address.state LIKE :search OR address.locality LIKE :search OR CAST(car.carPrice AS CHAR) LIKE :search)',
        { search: searchTerm }
      );
    }

    // Filter isSale
    if (isSale !== undefined) {
      queryBuilder.andWhere('car.isSale = :isSale', { isSale });
    }

    // Filter by type
    if (carTypes && carTypes.length > 0) {
      queryBuilder.andWhere('car.bodyType IN (:...carTypes)', { carTypes });
    }

    // Filter by price
    if (priceRange) {
      queryBuilder.andWhere('car.carPrice BETWEEN :minPrice AND :maxPrice', {
        minPrice: priceRange.min * 1000,
        maxPrice: priceRange.max * 1000,
      });
    }

    // Total count
    const totalCount = await queryBuilder.getCount();

    // Paginated data
    const carDetails = await queryBuilder
      .skip(skip)
      .take(Number(limit))
      .orderBy('car.createdAt', sort === 'newest' ? 'DESC' : 'ASC')
      .getMany();

    if (!carDetails || carDetails.length === 0) {
      return res.status(200).json({
        message: 'No cars found for this user',
        carDetails: [],
        totalCount: 0,
        currentPage: Number(page),
        totalPages: 0,
        hasMore: false,
      });
    }

    // Map response
    const carDetailsWithUrls = await Promise.all(
      carDetails.map(async (carDetail) => {
        try {
          const carEnquiries = await carEnquiryRepo.find({
            where: { carId: carDetail.id },
            order: { createdAt: 'DESC' },
          });

          const carOwner = carDetail.userId ? await userRepo.findOne({
            where: { id: carDetail.userId },
            select: ['fullName', 'email', 'mobileNumber'],
          }) : null;

          const time = formateTime(carDetail.createdAt);

          return {
            id: carDetail.id,
            // title: carDetail.carName,
            title: `${carDetail.brand} ${carDetail.model } ${carDetail.variant}`,
            description: carDetail.description,
            price: carDetail.carPrice,
            isSale: carDetail.isSale,
            fuel: carDetail.fuelType,
            kmDriven: carDetail.kmDriven,
            seats: carDetail.seats,
            transmission: carDetail.transmission,
            bodyType: carDetail.bodyType,
            images: carDetail.carImages || [],
            address: {
              city: carDetail.address?.city || null,
              state: carDetail.address?.state || null,
              locality: carDetail.address?.locality || null,
            },
            createdAt: carDetail.createdAt,
            updatedAt: carDetail.updatedAt,
            isSaved: savedCarIds.includes(carDetail.id),
            enquiries: {
              viewProperty: carEnquiries.length,
              calling: carEnquiries.filter((enq: any) => enq.calling).length,
            },
            ownerDetails: {
              name: carOwner?.fullName || null,
              email: carOwner?.email || null,
              mobileNumber: carOwner?.mobileNumber || null,
            },
          };
        } catch (error) {
          console.error('Error processing carDetail:', carDetail.id, error);
          return null;
        }
      })
    );

    const validCars = carDetailsWithUrls.filter((c) => c !== null);

    return res.status(200).json({
      message: 'Cars retrieved successfully',
      cars: validCars,
      totalCount,
      currentPage: Number(page),
      totalPages: Math.ceil(totalCount / Number(limit)),
      hasMore: skip + carDetails.length < totalCount,
    });
  } catch (error) {
    console.error('Error in getUserCars:', error);
    return res.status(500).json({
      message: 'Server error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Get cars by their IDs with complete details and owner information
 */
export const getUserCarsByIds = async (req: Request, res: Response) => {
  try {
    const {
      userId,
      carDetailIds,
      search,
      isSale,
      carTypes,
      priceRange,
      sort = 'newest',
      showAll = false, // New parameter to show all properties when user is viewing their own profile
    } = req.body;

    console.log('getUserCarsByIds called with params:', {
      userId,
      carDetailIds,
      search,
      isSale,
      carTypes,
      priceRange,
      sort,
      showAll,
    });

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    // If showAll is true, we don't need carDetailIds validation
    if (!showAll && (!carDetailIds || !Array.isArray(carDetailIds) || carDetailIds.length === 0)) {
      return res.status(400).json({ message: 'CarDetail IDs array is required' });
    }

    const carRepo = AppDataSource.getRepository(CarDetails);
    const carEnquiryRepo = AppDataSource.getRepository(CarEnquiry);
    const userRepo = AppDataSource.getRepository(UserAuth);

    // Use query builder for more complex queries with search, filter, and sort
    const queryBuilder = carRepo
      .createQueryBuilder('car')
      .leftJoinAndSelect('car.address', 'address')
      .where('car.userId = :userId', { userId });

    // Only add carDetailIds filter if showAll is false
    if (!showAll && carDetailIds && carDetailIds.length > 0) {
      queryBuilder.andWhere('car.id IN (:...carDetailIds)', { carDetailIds });
    }

    // Add search functionality
    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      console.log('Search term:', searchTerm);

      queryBuilder.andWhere(
        '(car.title LIKE :search OR car.carName LIKE :search OR car.description LIKE :search OR address.city LIKE :search OR address.state LIKE :search OR address.locality LIKE :search OR CAST(car.carPrice AS CHAR) LIKE :search)',
        { search: searchTerm }
      );
    }

    if (isSale !== undefined) {
      queryBuilder.andWhere('property.isSale = :isSale', { isSale });
    }

    if (carTypes && carTypes.length > 0) {
      queryBuilder.andWhere('car.subCategory IN (:...carTypes)', { carTypes });
    }

    if (priceRange) {
      queryBuilder.andWhere('car.carPrice BETWEEN :minPrice AND :maxPrice', {
        minPrice: priceRange.min * 1000, // Convert to actual price
        maxPrice: priceRange.max * 1000,
      });
    }

    // Get cars with sorting
    const cars = await queryBuilder.orderBy('car.createdAt', sort === 'newest' ? 'DESC' : 'ASC').getMany();

    if (!cars || cars.length === 0) {
      return res.status(200).json({
        message: 'No properties found for the specified IDs',
        properties: [],
        totalCount: 0,
        filteredCount: 0,
      });
    }

    const carsWithUrls = await Promise.all(
      cars.map(async (car) => {
        try {
          const carResponse = await mapCarDetailsResponse(car);

          // Get property enquiries for this property
          const carEnquiries = await carEnquiryRepo.find({
            where: { carId: car.id },
            order: { createdAt: 'DESC' },
          });

          const carOwner = car.userId ? await userRepo.findOne({
            where: { id: car.userId },
            select: ['fullName', 'email', 'mobileNumber'],
          }) : null;

          return {
            ...carResponse,
            enquiries: {
              viewProperty: carEnquiries.length,
              calling: carEnquiries.filter((enquiry) => enquiry.calling).length,
            },
            ownerDetails: {
              name: carOwner?.fullName || null,
              email: carOwner?.email || null,
              mobileNumber: carOwner?.mobileNumber || null,
            },
          };
        } catch (error) {
          console.error('Error processing car:', car.id, error);
          return null;
        }
      })
    );

    // Filter out any null values from failed processing
    const validCarsWithUrls = carsWithUrls.filter((car) => car !== null);

    return res.status(200).json({
      message: showAll ? 'All cars retrieved successfully' : 'Filtered cars retrieved successfully',
      cars: validCarsWithUrls,
      totalCount: validCarsWithUrls.length,
      filteredCount: validCarsWithUrls.length,
      requestedIds: showAll ? undefined : carDetailIds,
      foundIds: cars.map((c) => c.id),
      showAll: showAll,
    });
  } catch (error) {
    console.error('Error in getUserCarsByIds:', error);
    return res.status(500).json({
      message: 'Server error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
/**
 * Get all cars with pagination, filtering, and user type restrictions
 */

export const getAllCars = async (req: Request, res: Response) => {
  try {
    const {
      userType,
      priceRange,
      brands,
      model,
      modelYear,
      location,
      bodyType,
      fuelType,
      search,
      sort = 'newest',
      isActive = false
    } = req.body;
    const { page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    // Input validation
    if (isNaN(Number(page)) || Number(page) < 1) {
      return res.status(400).json({
        success: false,
        message: 'Page must be a positive integer',
        error: 'INVALID_PAGE'
      });
    }

    if (isNaN(Number(limit)) || Number(limit) < 1 || Number(limit) > 100) {
      return res.status(400).json({
        success: false,
        message: 'Limit must be a positive integer between 1 and 100',
        error: 'INVALID_LIMIT'
      });
    }

    // Validate and normalize userType to array
    let normalizedUserType: string[] | undefined;
    if (userType) {
      if (typeof userType === 'string') {
        normalizedUserType = [userType];
      } else if (Array.isArray(userType)) {
        normalizedUserType = userType.filter(type => typeof type === 'string');
      } else {
        return res.status(400).json({
          success: false,
          message: 'userType must be a string or array of strings',
          error: 'INVALID_USER_TYPE'
        });
      }
    }

    // Validate priceRange
    if (priceRange && (typeof priceRange !== 'object' || !priceRange.min || !priceRange.max)) {
      return res.status(400).json({
        success: false,
        message: 'priceRange must be an object with min and max properties',
        error: 'INVALID_PRICE_RANGE'
      });
    }

    if (priceRange && (isNaN(Number(priceRange.min)) || isNaN(Number(priceRange.max)))) {
      return res.status(400).json({
        success: false,
        message: 'priceRange min and max must be valid numbers',
        error: 'INVALID_PRICE_RANGE'
      });
    }

    // Validate modelYear
    if (modelYear && (typeof modelYear !== 'object' || !modelYear.min || !modelYear.max)) {
      return res.status(400).json({
        success: false,
        message: 'modelYear must be an object with min and max properties',
        error: 'INVALID_MODEL_YEAR'
      });
    }

    if (modelYear && (isNaN(Number(modelYear.min)) || isNaN(Number(modelYear.max)))) {
      return res.status(400).json({
        success: false,
        message: 'modelYear min and max must be valid numbers',
        error: 'INVALID_MODEL_YEAR'
      });
    }

    // Validate arrays
    const validateStringArray = (value: any, fieldName: string) => {
      if (value && !Array.isArray(value)) {
        return res.status(400).json({
          success: false,
          message: `${fieldName} must be an array`,
          error: `INVALID_${fieldName.toUpperCase()}`
        });
      }
      if (value && !value.every((item: any) => typeof item === 'string')) {
        return res.status(400).json({
          success: false,
          message: `${fieldName} must be an array of strings`,
          error: `INVALID_${fieldName.toUpperCase()}`
        });
      }
      return null;
    };

    const brandsValidation = validateStringArray(brands, 'brands');
    if (brandsValidation) return brandsValidation;

    const modelValidation = validateStringArray(model, 'model');
    if (modelValidation) return modelValidation;

    const locationValidation = validateStringArray(location, 'location');
    if (locationValidation) return locationValidation;

    const bodyTypeValidation = validateStringArray(bodyType, 'bodyType');
    if (bodyTypeValidation) return bodyTypeValidation;

    const fuelTypeValidation = validateStringArray(fuelType, 'fuelType');
    if (fuelTypeValidation) return fuelTypeValidation;

    // Validate sort
    if (sort && !['newest', 'oldest', 'price_low', 'price_high'].includes(sort)) {
      return res.status(400).json({
        success: false,
        message: 'sort must be one of: newest, oldest, price_low, price_high',
        error: 'INVALID_SORT'
      });
    }

    const carRepo = AppDataSource.getRepository(CarDetails);
    const userRepo = AppDataSource.getRepository(UserAuth);
    const savedCarRepo = AppDataSource.getRepository(SavedCar);

    // Extract userId from Authorization token if present
    let authUserId: string | null = null;
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const payload: any = jwt.verify(token, process.env.ACCESS_SECRET_KEY || '');
        authUserId = payload?.id || null;
      } catch (err) {
        // ignore invalid token, treat as anonymous
        authUserId = null;
      }
    }

    // Build where conditions using TypeORM operators
    const whereConditions: any = {
      isActive: isActive,
      isSold: false
    };

    // Apply price range filter
    if (priceRange && priceRange.min && priceRange.max) {
      whereConditions.carPrice = Between(priceRange.min, priceRange.max);
    }

    // Apply brand filter
    if (brands && brands.length > 0) {
      whereConditions.brand = In(brands);
    }

    // Apply model year filter
    if (modelYear && modelYear.min && modelYear.max) {
      whereConditions.manufacturingYear = Between(modelYear.min, modelYear.max);
    }

    // Apply body type filter
    if (bodyType && bodyType.length > 0) {
      whereConditions.bodyType = In(bodyType);
    }

    // Apply fuel type filter
    if (fuelType && fuelType.length > 0) {
      whereConditions.fuelType = In(fuelType);
    }

    // Note: Search filter will be applied after fetching data to avoid conflicts with other filters

    // Determine sort order
    let orderBy: any = {};
    switch (sort) {
      case 'newest':
        orderBy = { createdAt: 'DESC' };
        break;
      case 'oldest':
        orderBy = { createdAt: 'ASC' };
        break;
      case 'price_low':
        orderBy = { carPrice: 'ASC' };
        break;
      case 'price_high':
        orderBy = { carPrice: 'DESC' };
        break;
      default:
        orderBy = { createdAt: 'DESC' };
    }

    // Get cars with relations
    const cars = await carRepo.find({
      where: whereConditions,
      relations: ['address', 'user'],
      order: orderBy,
      skip: skip,
      take: Number(limit)
    });

    // Get total count for pagination
    const totalCount = await carRepo.count({
      where: whereConditions
    });

    // Filter by userType if specified
    let filteredCars = cars;
    if (normalizedUserType && normalizedUserType.includes('Dealer')) {
      filteredCars = cars.filter(car => {
        if (!car.user) return false;
        return car.user.userType === 'Dealer' || car.workingWithDealer === true;
      });
    }

    // Filter by location if specified
    if (location && location.length > 0) {
      const locationLower = location.map((loc: string) => loc.toLowerCase());
      filteredCars = filteredCars.filter(car => {
        if (!car.address) return false;
        return locationLower.includes(car.address.state?.toLowerCase() || '') || 
               locationLower.includes(car.address.city?.toLowerCase() || '');
      });
    }

    // Apply search filter for multiple fields if search is provided
    if (search && search.trim()) {
      const searchTerm = search.trim().toLowerCase();
      filteredCars = filteredCars.filter(car => {
        return car.brand?.toLowerCase().includes(searchTerm) ||
               car.model?.toLowerCase().includes(searchTerm) ||
               car.variant?.toLowerCase().includes(searchTerm);
      });
    }

    if (!filteredCars || filteredCars.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No cars found',
        cars: [],
        totalCount: 0,
        currentPage: Number(page),
        totalPages: 0,
        hasMore: false,
      });
    }

    // Map cars with simple format
    // Preload saved car IDs if user is authenticated
    let savedCarIdsSet = new Set<string>();
    if (authUserId) {
      const saved = await savedCarRepo.find({ where: { userId: authUserId }, select: ['carId'] });
      savedCarIdsSet = new Set(saved.map((s) => s.carId));
    }

    const carsWithUrls = filteredCars.map((car) => {
      return {
        id: car.id,
        userId: car.userId,
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
        isSale: car.isSale,
        carPrice: car.carPrice,
        kmDriven: car.kmDriven,
        seats: car.seats,
        isSold: car.isSold,
        workingWithDealer: car.workingWithDealer,
        createdAt: car.createdAt,
        updatedAt: car.updatedAt,
        carImages: formatCarImages(car.carImages || []),
        address: car.address ? {
          id: car.address.id,
          state: car.address.state,
          city: car.address.city,
          locality: car.address.locality,
          latitude: car.address.latitude,
          longitude: car.address.longitude
        } : null,
        user: car.user ? {
          id: car.user.id,
          fullName: car.user.fullName,
          email: car.user.email,
          mobileNumber: car.user.mobileNumber,
          userType: car.user.userType,
        } : null,
        isSaved: authUserId ? savedCarIdsSet.has(car.id) : false,
      };
    });

    return res.status(200).json({
      success: true,
      message: 'Cars retrieved successfully',
      cars: carsWithUrls,
      totalCount: carsWithUrls.length,
      currentPage: Number(page),
      totalPages: Math.ceil(carsWithUrls.length / Number(limit)),
      hasMore: skip + carsWithUrls.length < totalCount,
    });
  } catch (error) {
    console.error('Error in getAllCars:', error);
    
    // Log error details for debugging
    const errorDetails = {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      requestBody: req.body,
      queryParams: req.query,
      timestamp: new Date().toISOString()
    };
    
    console.error('Error details:', errorDetails);

    // Return consistent error response
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: 'DATABASE_ERROR',
      timestamp: new Date().toISOString()
    });
  }
};


/**
 * Search cars by category, subcategory, and city
 */
export const trendingCar = async (req: Request, res: Response) => {
  try {
    const { city, userType } = req.body;

    const { page = 1, limit = 10 } = req.query;

    if (!city || typeof city !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Valid city is required',
      });
    }

    const sanitizedPage = Math.max(1, Number(page) || 1);
    const sanitizedLimit = Math.min(100, Math.max(1, Number(limit) || 10));
    const skip = (sanitizedPage - 1) * sanitizedLimit;

    const validUserTypes = ['Dealer', 'Owner', 'EndUser'];
    if (userType && !validUserTypes.includes(userType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid userType provided',
      });
    }

    const carRepo = AppDataSource.getRepository(CarDetails);
    const userRepo = AppDataSource.getRepository(UserAuth);
    const carEnquiryRepo = AppDataSource.getRepository(CarEnquiry);

    const whereClause = {
      // subCategory: subCategory as any,
      isActive: true,
      isSold: false,
      address: {
        city: Like(`%${city}%`),
      },
    };

    const cars = await carRepo.find({
      where: whereClause,
      relations: ['address'],
      order: { createdAt: 'DESC' },
    });

    if (!cars || cars.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No cars found',
        cars: [],
        totalCount: 0,
        currentPage: sanitizedPage,
        totalPages: 0,
        hasMore: false,
        searchLocation: { targetCity: city },
      });
    }

    const carEnquiries = await carEnquiryRepo.find({
      where: { carId: In(cars.map((c) => c.id)) },
    });

    const enquiryCounts = carEnquiries.reduce(
      (acc: any, enquiry: any) => {
        acc[enquiry.carId] = (acc[enquiry.carId] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const sortedCars = cars.sort((a, b) => (enquiryCounts[b.id] || 0) - (enquiryCounts[a.id] || 0));

    const subcategoryFilteredCars = sortedCars.filter((car) => car);

    // Collect all user IDs
    const userIds = new Set<string>();
    subcategoryFilteredCars.forEach((car: any) => {
      userIds.add(car.userId);
    });

    const users =
      userIds.size > 0
        ? await userRepo.find({
            where: { id: In(Array.from(userIds)) },
            select: ['id', 'fullName', 'userType', 'userProfileUrl', 'mobileNumber'],
          })
        : [];

    const userMap = new Map(users.map((user) => [user.id, user]));

    const filteredCars = subcategoryFilteredCars.filter((car: any) => {
      if (!userType || userType !== 'Dealer') {
        return true;
      }

      const carOwner = userMap.get(car.userId);
      if (!carOwner) {
        return true;
      }

      if ((carOwner.userType === 'Owner' || carOwner.userType === 'EndUser') && car.workingWithDealer === false) {
        return false;
      }
      return true;
    });

    if (!filteredCars.length) {
      return res.status(200).json({
        success: true,
        message: 'No cars found after filtering',
        cars: [],
        totalCount: 0,
        currentPage: sanitizedPage,
        totalPages: 0,
        hasMore: false,
        searchLocation: { targetCity: city },
      });
    }

    const carsWithDetails = await mapCarsWithDetails(filteredCars, userMap);

    const validCarsWithDetails = carsWithDetails.filter((car) => car !== null);

    return res.status(200).json({
      success: true,
      message: 'Properties retrieved successfully',
      properties: validCarsWithDetails,
      totalCount: sortedCars.length,
      currentPage: sanitizedPage,
      totalPages: Math.ceil(sortedCars.length / sanitizedLimit),
      hasMore: skip + filteredCars.length < sortedCars.length,
      searchLocation: {
        targetCity: city,
      },
    });
  } catch (error) {
    console.error('Error in trendingCar:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error:
        process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : undefined,
    });
  }
};

// Helper function to map cars with complete details
async function mapCarsWithDetails(cars: CarDetails[], userMap: Map<string, any>) {
  return Promise.all(
    cars.map(async (car: CarDetails) => {
      try {
        const carResponse = await mapCarDetailsResponse(car);
        const carOwner = car.userId ? userMap.get(car.userId) : null;

        const userProfileImage =
          'https://static.vecteezy.com/system/resources/previews/000/439/863/non_2x/vector-users-icon.jpg';

        const ownerData = {
          id: carOwner?.id || car.userId || null,
          fullName: carOwner?.fullName || 'Unknown Owner',
          userType: carOwner?.userType || 'Unknown',
          userProfileKey: carOwner?.userProfileKey || null,
          mobileNumber: carOwner?.mobileNumber || null,
          userProfile: userProfileImage,
        };

        return {
          ...carResponse,
          owner: ownerData,
        };
      } catch (error) {
        console.error('Error processing car:', car.id, error);
        return null;
      }
    })
  );
}

// Helper function to filter car based on userType and workingWithDealer
// async function filterCarsByUserType(cars: CarDetails[], userRepo: any, userType?: string) {
//   if (!userType || userType !== 'Owner') {
//     return cars; // No filtering needed for non-agent users
//   }

//   const filteredCars = await Promise.all(
//     cars.map(async (car) => {
//       try {
//         const carOwner = await userRepo.findOne({
//           where: { id: car.userId },
//           select: ['userType'],
//         });

//         // If requesting user is an agent and property owner is an owner/enduser who doesn't work with agents
//         if (carOwner?.userType === 'Owner' || carOwner?.userType === 'EndUser') {
//           if (car.workingWithDealer === false) {
//             return null; // Dealer cannot see this property
//           }
//         }
//         return car;
//       } catch (error) {
//         console.error(`Error filtering car ${car.id}:`, error);
//         return car; // Return property if error occurs during filtering
//       }
//     })
//   );

//   return filteredCars.filter((car) => car !== null);
// }

// Helper function to map properties with complete details
// async function mapCarsWithDetails(
//   cars: CarDetails[],
//   republishedCars: any[],
//   userMap: Map<string, any>
// ) {
//   return Promise.all(
//     cars.map(async (car) => {
//       try {
//         const carResponse = await mapCarResponse(car);
//         const republishInfo = republishedCars.find((rp) => rp.carId === car.id);

//         // Get original property owner
//         let originalOwner = userMap.get(car.userId);

//         // Fallback: if user not found in map, fetch individually
//         if (!originalOwner && car.userId) {
//           try {
//             const userRepo = AppDataSource.getRepository(UserAuth);
//             originalOwner = await userRepo.findOne({
//               where: { id: car.userId },
//               select: ['id', 'fullName', 'userType', 'userProfileUrl', 'mobileNumber'],
//             });
//             if (originalOwner) {
//               userMap.set(car.userId, originalOwner);
//             }
//           } catch (error) {
//             console.error(`Error fetching user ${car.userId}:`, error);
//           }
//         }

//         // Get republisher details if property is republished
//         let republisher = null;
//         if (republishInfo) {
//           republisher = userMap.get(republishInfo.republisherId);

//           // Fallback: if republisher not found in map, fetch individually
//           if (!republisher && republishInfo.republisherId) {
//             try {
//               const userRepo = AppDataSource.getRepository(UserAuth);
//               republisher = await userRepo.findOne({
//                 where: { id: republishInfo.republisherId },
//                 select: ['id', 'fullName', 'userType', 'userProfileUrl', 'mobileNumber'],
//               });
//               if (republisher) {
//                 userMap.set(republishInfo.republisherId, republisher);
//               }
//             } catch (error) {
//               console.error(`Error fetching republisher ${republishInfo.republisherId}:`, error);
//             }
//           }
//         }

//         // Determine the primary owner (republisher if republished, otherwise original owner)
//         const primaryOwner = republisher || originalOwner;

//         // Handle user profile image for primary owner
//         let userProfileImage =
//           'https://static.vecteezy.com/system/resources/previews/000/439/863/non_2x/vector-users-icon.jpg';
//         if (primaryOwner?.userProfileUrl) {
//           try {
//             const presignedUrl = await generatePresignedUrl(primaryOwner.userProfileUrl);
//             if (presignedUrl && presignedUrl.startsWith('http')) {
//               userProfileImage = presignedUrl;
//             }
//           } catch (error) {
//             console.error('Error generating presigned URL:', error);
//           }
//         }

//         // Ensure we always have valid owner data, even if user doesn't exist
//         const ownerData = {
//           id: primaryOwner?.id || car.userId || null,
//           fullName: primaryOwner?.fullName || 'Unknown Owner',
//           userType: primaryOwner?.userType || 'Unknown',
//           userProfileUrl: primaryOwner?.userProfileUrl || null,
//           mobileNumber: primaryOwner?.mobileNumber || null,
//           userProfile: userProfileImage,
//         };

//         return {
//           ...carResponse,
//           owner: ownerData,
//           isRepublished: !!republishInfo,
//           republishDetails: republishInfo
//             ? {
//                 republishId: republishInfo.id,
//                 republisherId: republishInfo.republisherId,
//                 status: republishInfo.status,
//                 republishedAt: republishInfo.createdAt,
//               }
//             : null,
//           // Original owner details (for republished properties)
//           originalOwner:
//             republishInfo && originalOwner
//               ? {
//                   id: originalOwner.id,
//                   fullName: originalOwner.fullName,
//                   userType: originalOwner.userType,
//                   userProfileUrl: originalOwner.userProfileUrl,
//                   mobileNumber: originalOwner.mobileNumber,
//                 }
//               : null,
//         };
//       } catch (error) {
//         console.error('Error processing car:', car.id, error);
//         return null;
//       }
//     })
//   );
// }

/**
 * Get offering cars with filtering by category, location, and user type
 * Supports pagination, agent visibility rules, and car status filtering
 */
export const offeringCar = async (req: Request, res: Response) => {
  try {
    const { filter, userType, city, state, isSale } = req.body;
    const { page = 1, limit = 10 } = req.query;

    const sanitizedPage = Math.max(1, Number(page) || 1);
    const sanitizedLimit = Math.min(100, Math.max(1, Number(limit) || 10));
    const skip = (sanitizedPage - 1) * sanitizedLimit;

    if (!filter) {
      return res.status(400).json({
        success: false,
        message: 'filter required',
      });
    }

    if (!AppDataSource.isInitialized) {
      return res.status(500).json({
        success: false,
        message: 'Database connection error',
      });
    }

    const carRepo = AppDataSource.getRepository(CarDetails);
    const userRepo = AppDataSource.getRepository(UserAuth);

    const queryBuilder = carRepo
      .createQueryBuilder('car')
      .leftJoinAndSelect('car.address', 'address')
      .where('car.isActive = :isActive', { isActive: true })
      .andWhere('car.isSold = :isSold', { isSold: false });

    if (filter !== 'All') {
      queryBuilder.andWhere('car.subCategory = :subCategory', { subCategory: filter });
    }

    if (isSale !== undefined) {
      queryBuilder.andWhere('car.isSale = :isSale', { isSale });
    }

    if (city) {
      queryBuilder.andWhere('LOWER(address.city) LIKE LOWER(:city)', { city: `%${city}%` });
    }

    if (state) {
      queryBuilder.andWhere('LOWER(address.state) LIKE LOWER(:state)', { state: `%${state}%` });
    }

    const totalCount = await queryBuilder.getCount();

    let cars;
    if (totalCount === 0 && (city || state)) {
      const fallbackQueryBuilder = carRepo
        .createQueryBuilder('car')
        .leftJoinAndSelect('car.address', 'address')
        .where('car.isActive = :isActive', { isActive: true })
        .andWhere('car.isSold = :isSold', { isSold: false });

      if (filter !== 'All') {
        fallbackQueryBuilder.andWhere('car.subCategory = :subCategory', { subCategory: filter });
      }

      if (isSale !== undefined) {
        fallbackQueryBuilder.andWhere('car.isSale = :isSale', { isSale });
      }

      cars = await fallbackQueryBuilder
        // .orderBy('car.createdAt', 'DESC')
        // .skip(skip)
        // .take(sanitizedLimit)
        .getMany();
    } else {
      cars = await queryBuilder.orderBy('car.createdAt', 'DESC').skip(skip).take(sanitizedLimit).getMany();
    }

    if (!cars || cars.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No cars found',
        data: {
          car: [],
          totalCount: 0,
          currentPage: sanitizedPage,
          totalPages: 0,
          hasMore: false,
        },
      });
    }

    const userIds = [...new Set(cars.map((p) => p.userId).filter((id): id is string => id !== null))];
    const users =
      userIds.length > 0
        ? await userRepo.find({
            where: { id: In(userIds) },
            select: ['id', 'fullName', 'userType', 'userProfileUrl', 'mobileNumber', 'email'],
          })
        : [];

    const userMap = new Map(users.map((user) => [user.id, user]));

    const filteredCars = cars.filter((car) => {
      if (!userType || userType !== 'Dealer') {
        return true;
      }

      const carOwner = car.userId ? userMap.get(car.userId) : null;
      if (!carOwner) {
        return true;
      }

      if (carOwner.userType === 'Dealer') {
        return true;
      }

      return true;
    });

    const carsWithDetails = await Promise.all(
      filteredCars.map(async (car) => {
        try {
          const carResponse = await mapCarDetailsResponse(car);
          const originalOwner = car.userId ? userMap.get(car.userId) : null;
          const userProfileImage =
            'https://static.vecteezy.com/system/resources/previews/000/439/863/non_2x/vector-users-icon.jpg';

          return {
            ...carResponse,
            ownerProfile: userProfileImage,
            owner: originalOwner ? {
              id: originalOwner.id,
              fullName: originalOwner.fullName,
              userType: originalOwner.userType,
              mobileNumber: originalOwner.mobileNumber,
              email: originalOwner.email,
            } : null,
          };
        } catch (error) {
          return {
            ...car,
            ownerProfile:
              'https://static.vecteezy.com/system/resources/previews/000/439/863/non_2x/vector-users-icon.jpg',
            owner: null,
          };
        }
      })
    );

    const finalCars = carsWithDetails.filter((car) => car !== null);

    const actualTotalCount =
      totalCount === 0 && (city || state)
        ? await carRepo
            .createQueryBuilder('car')
            .leftJoin('car.address', 'address')
            .where('car.isActive = :isActive', { isActive: true })
            .andWhere('car.isSold = :isSold', { isSold: false })
            .andWhere(
              filter !== 'All' ? 'car.subCategory = :subCategory' : '1=1',
              filter !== 'All' ? { subCategory: filter } : {}
            )
            // .andWhere(
            //   isSale !== undefined ? 'car.isSale = :isSale' : '1=1',
            //   isSale !== undefined ? { isSale } : {}
            // )
            .getCount()
        : totalCount;

    const message =
      totalCount === 0 && (city || state)
        ? 'Cars fetched successfully (location filter removed due to no matches)'
        : 'Cars fetched successfully';

    return res.status(200).json({
      success: true,
      message: message,
      data: {
        car: finalCars,
        totalCount: actualTotalCount,
        currentPage: sanitizedPage,
        totalPages: Math.ceil(actualTotalCount / sanitizedLimit),
        hasMore: skip + finalCars.length < actualTotalCount,
      },
    });
  } catch (error) {
    console.error('Error in offeringCar:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error:
        process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : undefined,
    });
  }
};

/**
 * Delete a car by ID with user authentication and ownership validation
 */
export const deleteCar = async (req: Request, res: Response) => {
  try {
    const { carId, userId } = req.body;

    if (!carId) {
      return res.status(400).json({
        success: false,
        message: 'Car ID is required',
      });
    }

    const carRepo = AppDataSource.getRepository(CarDetails);
    const userRepo = AppDataSource.getRepository(UserAuth);
    const carEnquiryRepo = AppDataSource.getRepository(CarEnquiry);

    // Get the car with relations
    const car = await carRepo.findOne({
      where: { id: carId },
      relations: ['address'],
    });

    const user = await userRepo.findOne({
      where: { id: userId },
    });

    if (!car) {
      return res.status(404).json({
        success: false,
        message: 'Car not found',
      });
    }
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check authorization
    if (!user.isAdmin && car.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    // Start a transaction
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // No need to delete car images separately as they are stored as array in car

      // Delete property enquiries
      await carEnquiryRepo.delete({ carId: car.id });

      // Delete the property
      await carRepo.remove(car);

      // Commit the transaction
      await queryRunner.commitTransaction();

      return res.status(200).json({
        success: true,
        message: user.isAdmin ? 'Car deleted by admin successfully' : 'Car deleted successfully',
      });
    } catch (error) {
      // Rollback the transaction on error
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      // Release the query runner
      await queryRunner.release();
    }
  } catch (error) {
    console.error('Error in deleteCar:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Update car sold status with user authentication and ownership validation
 */
export const updateIsSold = async (req: Request, res: Response) => {
  try {
    const { carId, isSold, userId } = req.body;

    // Validate required fields
    if (!carId || userId === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Car ID and User ID are required',
      });
    }

    // Validate isSold is a boolean
    if (typeof isSold !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isSold must be a boolean value',
      });
    }

    const carRepo = AppDataSource.getRepository(CarDetails);
    const userRepo = AppDataSource.getRepository(UserAuth);

    // Get the car
    const car = await carRepo.findOne({
      where: { id: carId },
    });

    if (!car) {
      return res.status(404).json({
        success: false,
        message: 'Car not found',
      });
    }

    // Get the user
    const user = await userRepo.findOne({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check authorization
    if (!user.isAdmin && car.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to update this car',
      });
    }

    // Update the car
    car.isSold = isSold;
    await carRepo.save(car);

    return res.status(200).json({
      success: true,
      message: 'Car status updated successfully',
      property: {
        id: car.id,
        isSold: car.isSold,
      },
    });
  } catch (error) {
    console.error('Error in updateIsSold:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Update car active status with user authentication and ownership validation
 */
export const updateCarStatus = async (req: Request, res: Response) => {
  try {
    const { carId, isActive, userId } = req.body;

    if (!carId || userId === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Car ID and User ID are required',
      });
    }

    const carRepo = AppDataSource.getRepository(CarDetails);
    const userRepo = AppDataSource.getRepository(UserAuth);

    const car = await carRepo.findOne({
      where: { id: carId },
    });

    if (!car) {
      return res.status(404).json({
        success: false,
        message: 'Car not found',
      });
    }

    const user = await userRepo.findOne({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (car.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to update this car',
      });
    }

    car.isActive = isActive;
    await carRepo.save(car);

    return res.status(200).json({
      success: true,
      message: `Car ${isActive ? 'activated' : 'deactivated'} successfully`,
      car: {
        id: car.id,
        isActive: car.isActive,
      },
    });
  } catch (error) {
    console.error('Error in updateCarStatus:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// get car leads
export const getCarLeads = async (req: Request, res: Response) => {
  try {
    const { carId } = req.body;

    const carRepo = AppDataSource.getRepository(CarDetails);
    const carEnquiriesRepo = AppDataSource.getRepository(CarEnquiry);
    const userRepo = AppDataSource.getRepository(UserAuth);

    const car = await carRepo.findOne({
      where: { id: carId },
    });

    if (!car) {
      return res.status(404).json({
        success: false,
        message: 'Car not found',
      });
    }

    const carEnquiries = await carEnquiriesRepo.find({
      where: { carId },
      order: { createdAt: 'DESC' },
    });

    // Fetch user details for each enquiry
    const userIds = carEnquiries.map((e) => e.userId);
    const users =
      userIds.length > 0
        ? await userRepo.find({
            where: {
              id: In(userIds),
              mobileNumber: Not(IsNull()),
            },
            select: ['id', 'fullName', 'userType', 'userProfileUrl', 'mobileNumber'],
          })
        : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    // Build leads
    let leads = await Promise.all(
      carEnquiries
        .filter((enquiry) => {
          const user = userMap.get(enquiry.userId);
          return user && user.mobileNumber;
        })
        .map(async (enquiry) => {
          const user = userMap.get(enquiry.userId);
          return {
            enquiryId: enquiry.id,
            createdAt: enquiry.createdAt,
            userId: enquiry.userId,
            fullName: user?.fullName || 'Unknown',
            userType: user?.userType || 'User',
            // userProfileImage: user?.userProfileUrl
            //   ? await generatePresignedUrl(user.userProfileUrl)
            //   : 'https://static.vecteezy.com/system/resources/previews/000/439/863/non_2x/vector-users-icon.jpg',
            mobileNumber: user?.mobileNumber || null,
          };
        })
    );

    // ❌ remove duplicates by userId (keep only latest enquiry)
    const uniqueLeadsMap = new Map<string, (typeof leads)[0]>();
    for (const lead of leads) {
      if (!uniqueLeadsMap.has(lead.userId)) {
        uniqueLeadsMap.set(lead.userId, lead);
      }
    }
    leads = Array.from(uniqueLeadsMap.values());

    return res.status(200).json({
      success: true,
      leads,
      total: leads.length,
    });
  } catch (error) {
    console.error('Error in getCarLeads:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

//  share car email notification
export const shareCarEmailNotification = async (req: Request, res: Response) => {
  try {
    const { carId, userId } = req.body;

    if (!carId || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Car ID and User ID are required',
      });
    }

    const carRepo = AppDataSource.getRepository(CarDetails);
    const userRepo = AppDataSource.getRepository(UserAuth);

    // Get car with relations
    const car = await carRepo.findOne({
      where: { id: carId },
      relations: ['address'],
    });

    if (!car) {
      return res.status(404).json({
        success: false,
        message: 'Car not found',
      });
    }

    // Get user who is sharing
    const user = await userRepo.findOne({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Get car owner
    const carOwner = car.userId ? await userRepo.findOne({
      where: { id: car.userId },
    }) : null;

    if (!carOwner || !carOwner.email) {
      return res.status(404).json({
        success: false,
        message: 'Car owner not found or email not available',
      });
    }

    // Get car image URL
    let carImageUrl = '';
    if (car.carImages && car.carImages.length > 0) {
      const firstImage = car.carImages[0];
      carImageUrl = firstImage; // carImages is now an array of strings (image keys/URLs)
    }

    const email = carOwner.email;
    const subject = `Dhikcar : ${user.fullName} sharing your car ${car.carName}`;
    const body = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #ffffff;">
      <div style="background-color: #001A48; padding: 20px; border-radius: 8px 8px 0 0; margin: -20px -20px 20px -20px;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Property Details</h1>
      </div>

      <div style="margin-bottom: 20px;">
        <p style="color: #666666; font-size: 16px; line-height: 1.5;">Dear ${carOwner.fullName},</p>
        <p style="color: #666666; font-size: 16px; line-height: 1.5;">We are pleased to share the following car details with you:</p>
      </div>

      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h2 style="color: #001A48; margin-top: 0; font-size: 20px;">${car.carName}</h2>
        
        <div style="margin: 15px 0; padding: 15px; background-color: #ffffff; border-radius: 6px; border: 1px solid #e0e0e0;">
          <p style="color: #333333; font-size: 15px; line-height: 1.6; margin: 0;">${car.description || 'No description available'}</p>
        </div>

        <div style="display: flex; justify-content: space-between; margin: 15px 0;">
          <div style="flex: 1;">
            <p style="color: #001A48; font-size: 18px; font-weight: bold; margin: 0;">₹${car.carPrice || 'Price not available'}</p>
          </div>
          <div style="flex: 1; text-align: right;">
            <p style="color: #666666; font-size: 15px; margin: 0;">${car.address?.locality || car.address?.city || 'Location not available'}</p>
          </div>
        </div>
      </div>

      ${
        carImageUrl
          ? `
      <div style="margin-bottom: 20px;">
        <img src="${carImageUrl}" alt="Car Image" style="width: 100%; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);" />
      </div>
      `
          : ''
      }

      <div style="text-align: center; margin: 25px 0;">
        <a href="https://nextdeal.in/car/${car.id}" style="display: inline-block; background-color: #001A48; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">View Property Details</a>
      </div>

      <div style="border-top: 1px solid #e0e0e0; padding-top: 20px; margin-top: 20px;">
        <p style="color: #666666; font-size: 14px; margin: 0;">Shared by: ${user.fullName}</p>
      </div>

      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
        <p style="color: #666666; font-size: 14px; margin: 0;">Best regards,</p>
        <p style="color: #001A48; font-size: 16px; font-weight: bold; margin: 5px 0 0 0;">NextDeal Team</p>
      </div>
    </div>
    `;

    await sendEmailNotification(email, subject, body);

    return res.status(200).json({
      success: true,
      message: 'Email sent successfully',
    });
  } catch (error) {
    console.error('Error in shareCarEmailNotification:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// get slides for splash screen
export const getSlides = async (req: Request, res: Response) => {
  try {
    // Using a static array for slides since this is splash screen content
    const slides = [
      {
        id: '1',
        title: 'Find Your Dream Car with Ease!',
        image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c',
      },
      {
        id: '2',
        title: 'Discover Amazing\nCars',
        image: 'https://i.pinimg.com/736x/80/04/eb/8004eb1a8fc7859735df1c2f6f7cb210.jpg',
      },
      {
        id: '3',
        title: 'Discover Amazing\nCars',
        image: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914',
      },
      {
        id: '4',
        title: 'Get the Best\nDeals',
        image: 'https://i.pinimg.com/736x/80/5e/0d/805e0d50c567e1dec13863ef4f140e02.jpg',
      },
      {
        id: '5',
        title: 'Start Your Journey\nToday',
        image: 'https://i.pinimg.com/736x/4f/85/94/4f8594589d64ea636a3603b64b5328b1.jpg',
      },
    ];

    // Set cache headers
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    res.setHeader('Content-Type', 'application/json');

    // Send response immediately
    return res.status(200).json({
      success: true,
      message: 'Slides retrieved successfully',
      slides,
    });
  } catch (error) {
    console.error('Error in getSlides:', error);

    // Send error response immediately
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// car Filter data
export const getCarFilterData = async (req: Request, res: Response) => {
  try {
    // const { state, city, locality } = req.body;

    // Get unique property types
    const carTypes = await CarDetails.createQueryBuilder('car')
      .select('DISTINCT car.subCategory', 'subCategory')
      .where('car.isActive = :isActive', { isActive: true })
      .getRawMany();

    // Get price range
    const priceRange = await CarDetails.createQueryBuilder('car')
      .select('MIN(car.carPrice)', 'min')
      .addSelect('MAX(car.carPrice)', 'max')
      .where('car.isActive = :isActive', { isActive: true })
      .getRawOne();

    return res.status(200).json({
      success: true,
      data: {
        propertyTypes: carTypes.map((pt) => pt.subCategory),
        // furnishingTypes: furnishingTypes.map((ft) => ft.furnishing),
        // bhkTypes: bhkTypes.map((bt) => `${bt.bhks} BHK`),
        priceRange: {
          min: Math.floor(priceRange.min / 1000), // Convert to thousands
          max: Math.ceil(priceRange.max / 1000),
          step: 10,
        },
        listedBy: ['Dealer', 'Owner', 'EndUser'],
        // RERAStatus: ['Approved'],
      },
    });
  } catch (error) {
    console.error('Error in getCarFilterData:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Update working with agent status for a car
export const updateWorkingWithOwner = async (req: Request, res: Response) => {
  try {
    const { carId, workingWithOwner } = req.body;

    // Validate required fields
    if (!carId) {
      return res.status(400).json({
        success: false,
        message: 'Car ID is required',
      });
    }

    if (typeof workingWithOwner !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'workingWithOwner must be a boolean value (true/false)',
      });
    }

    const carRepo = AppDataSource.getRepository(CarDetails);

    // Find the car
    const car = await carRepo.findOne({
      where: { id: carId },
      relations: ['address'],
    });

    if (!car) {
      return res.status(404).json({
        success: false,
        message: 'Car not found',
      });
    }

    // Update the workingWithDealer field
    car.workingWithDealer = workingWithOwner;
    car.updatedBy = req.body.userId || 'system';

    const updatedCar = await carRepo.save(car);

    // Map the car response
    const carResponse = await mapCarDetailsResponse(updatedCar);

    return res.status(200).json({
      success: true,
      message: `Car ${workingWithOwner ? 'is now visible to Dealer' : 'is now hidden from Dealer'}`,
      car: carResponse,
    });
  } catch (error) {
    console.error('Error updating working with Dealer status:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

