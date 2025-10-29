import axios from 'axios';
import { Request, Response } from 'express';
import { Between, In } from 'typeorm';

// import { generatePresignedUrl } from '@/api/controllers/s3/cloudinaryController';
import { Address } from '@/api/entity/Address';
import { CarDetails } from '@/api/entity/CarDetails';
import { Location } from '@/api/entity/Location';
import { RepublishCarDetails } from '@/api/entity/RepublishCars';
import { UserAuth } from '@/api/entity/UserAuth';
import { AppDataSource } from '@/server';

// Simple in-memory cache for geocoding results
const geocodingCache = new Map<string, { lat: number; lng: number; timestamp: number }>();
const CACHE_DURATION = 24 * 60 * 60 * 1000;

// Type for car response with simple image arrays
type CarResponseType = {
  id: string;
  userId: string | null;
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
  workingWithDealer: boolean | null;
  carImages: string[];
  enquiries?: {
    viewCar: number;
    calling: number;
  };
  ownerDetails?: {
    name: string | null;
    email: string | null;
    mobileNumber: string | null;
  };
  isSaved?: boolean;
  isRepublished?: boolean;
  isReported?: boolean;
};

// Interface for geocoding response
interface GeocodingResponse {
  results: Array<{
    geometry: {
      location: {
        lat: number;
        lng: number;
      };
    };
    formatted_address: string;
  }>;
  status: string;
}

// Interface for car with distance
// interface CarWithDistance extends CarResponseType {
//   distance: number;
// }


// Consistent mapping for a single car
async function mapCarResponse(carDetails: CarDetails): Promise<CarResponseType> {
  try {
    if (!carDetails) {
      console.error('Car is null or undefined in CarResponse');
      throw new Error('Car is null or undefined');
    }

    return {
      ...carDetails,
      carImages: carDetails.carImages || [],
    };
  } catch (error) {
    console.error('Error in CarResponse:', error);
    // Return car with empty images array if mapping fails
    return {
      ...carDetails,
      carImages: [],
    };
  }
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

  // For prices 1000 to 999999, format as k
  if (price < 1000000) {
    const kValue = price / 1000;
    if (kValue === Math.floor(kValue)) {
      return `${kValue}K`;
    } else {
      return `${kValue.toFixed(1)}K`;
    }
  }

  // For prices 1000000 to 99999999, format as l
  if (price < 100000000) {
    const lValue = price / 100000;
    if (lValue === Math.floor(lValue)) {
      return `${lValue}L`;
    } else {
      return `${lValue.toFixed(1)}L`;
    }
  }

  // For prices 100000000 and above, format as cr
  const crValue = price / 10000000;
  if (crValue === Math.floor(crValue)) {
    return `${crValue}Cr`;
  } else {
    return `${crValue.toFixed(1)}Cr`;
  }
};

/**
 * Calculate distance between two points using Haversine formula
 * @param lat1 Latitude of first point
 * @param lon1 Longitude of first point
 * @param lat2 Latitude of second point
 * @param lon2 Longitude of second point
 * @returns Distance in kilometers
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Geocode locality name to get coordinates using Google Maps API with caching
 * @param localityName The locality name to geocode
 * @param city Optional city for better context
 * @param state Optional state for better context
 * @returns Promise with latitude and longitude
 */
async function geocodeLocality(
  localityName: string,
  city?: string,
  state?: string
): Promise<{ lat: number; lng: number }> {
  try {
    // Build cache key
    const cacheKey = `${localityName.toLowerCase()}_${city?.toLowerCase() || ''}_${state?.toLowerCase() || ''}`;

    // Check cache first
    const cached = geocodingCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log('Using cached geocoding result for:', cacheKey);
      return { lat: cached.lat, lng: cached.lng };
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      throw new Error('Google Maps API key not found in environment variables');
    }

    // Build the address string with context
    let addressString = localityName;
    if (city && city.trim()) {
      addressString += `, ${city.trim()}`;
    }
    if (state && state.trim()) {
      addressString += `, ${state.trim()}`;
    }

    console.log('Geocoding address:', addressString);

    const response = await axios.get<GeocodingResponse>(`https://maps.googleapis.com/maps/api/geocode/json`, {
      params: {
        address: addressString,
        key: apiKey,
      },
    });

    if (response.data.status !== 'OK') {
      throw new Error(`Geocoding failed: ${response.data.status}`);
    }

    if (response.data.results.length === 0) {
      throw new Error('No results found for the given locality');
    }

    const location = response.data.results[0].geometry.location;
    const result = {
      lat: location.lat,
      lng: location.lng,
    };

    // Cache the result
    geocodingCache.set(cacheKey, {
      ...result,
      timestamp: Date.now(),
    });

    console.log('Geocoding successful for:', addressString, result);
    return result;
  } catch (error) {
    console.error('Error in geocodeLocality:', error);
    throw error;
  }
}

/**
 * Update car coordinates if they don't exist
 * @param car Car to update
 * @param addressRepo Address repository
 */
async function updateCarCoordinates(car: any, addressRepo: any): Promise<void> {
  try {
    if (!car.address || (car.address.latitude && car.address.longitude)) {
      return; // Already has coordinates or no address
    }

    const address = car.address;
    if (!address.locality || !address.city || !address.state) {
      return; // Missing required address fields
    }

    try {
      const coordinates = await geocodeLocality(address.locality, address.city, address.state);

      // Update the address with coordinates
      await addressRepo.update(address.id, {
        latitude: coordinates.lat,
        longitude: coordinates.lng,
      });

      // Update the car object for current request
      car.address.latitude = coordinates.lat;
      car.address.longitude = coordinates.lng;

      console.log(`Updated coordinates for car ${car.id}:`, coordinates);
    } catch (error) {
      console.warn(`Failed to update coordinates for car ${car.id}:`, error);
    }
  } catch (error) {
    console.error('Error in updateCarCoordinates:', error);
  }
}

/**
 * Search cars by category, subcategory, city, locality, and state
 */
export const searchCar = async (req: Request, res: Response) => {
  const {
    subCategory = 'All',
    state,
    city,
    locality,
    isSale,
    carTypes,
    priceRange,
    page = 1,
    limit = 5,
    sort = 'newest',
    userType,
    userId,
    SavedCar,
  } = req.body;

  try {
    const carRepo = AppDataSource.getRepository(CarDetails);
    const userRepo = AppDataSource.getRepository(UserAuth);
    const saveCarRepo = AppDataSource.getRepository(SavedCar);
    const republishCarRepo = AppDataSource.getRepository(RepublishCarDetails);
    const locationRepo = AppDataSource.getRepository(Location);
    const addressRepo = AppDataSource.getRepository(Address);

    // Check if locality search is requested
    let searchCoordinates: { lat: number; lng: number } | null = null;
    let searchLocation: Location | null = null;

    if (locality && locality.trim()) {
      try {
        // First try to find the location in our database
        searchLocation = await locationRepo.findOne({
          where: {
            locality: locality.trim(),
            city: city,
            state: state,
            isActive: true,
          },
        });

        // Try to geocode the locality for distance-based search
        try {
          searchCoordinates = await geocodeLocality(locality.trim(), city, state);
          console.log('Geocoding successful for locality search:', searchCoordinates);
        } catch (geocodingError) {
          console.warn('Geocoding failed, falling back to text-based search:', geocodingError);
          searchCoordinates = null;
        }
      } catch (error) {
        console.error('Location lookup failed:', error);
        // Continue with regular search if location lookup fails
      }
    }

    // Build where conditions for car search
    const whereConditions: any = {
      isActive: true,
      isSold: false,
    };

    // Only add subCategory filter if it's not "All"
    if (subCategory && subCategory !== 'All') {
      whereConditions.subCategory = subCategory;
    }

    // Add filters only if they are provided
    if (isSale !== undefined) {
      whereConditions.isSale = isSale;
    }

    if (carTypes && carTypes.length > 0) {
      whereConditions.subCategory = In(carTypes);
    }

    if (priceRange) {
      whereConditions.carPrice = Between(priceRange.min, priceRange.max);
    }

    // Calculate skip for pagination
    const skip = (page - 1) * limit;

    let cars: any[] = [];
    let totalCount = 0;

    // Determine sorting order based on sort parameter
    let orderBy: any = {};

    switch (sort) {
      case 'newest':
        orderBy = { createdAt: 'DESC' };
        break;
      case 'oldest':
        orderBy = { createdAt: 'ASC' };
        break;
      case 'price-low':
        orderBy = { carPrice: 'ASC' };
        break;
      case 'price-high':
        orderBy = { carPrice: 'DESC' };
        break;
      default:
        orderBy = { createdAt: 'DESC' }; // Default to newest
    }

    // Build query with address filtering at database level
    let queryBuilder = carRepo
      .createQueryBuilder('car')
      .leftJoinAndSelect('car.address', 'address')
      .where('car.isActive = :isActive', { isActive: true })
      .andWhere('car.isSold = :isSold', { isSold: false });

    // Add filters
    if (subCategory && subCategory !== 'All') {
      queryBuilder = queryBuilder.andWhere('car.subCategory = :subCategory', { subCategory });
    }

    if (isSale !== undefined) {
      queryBuilder = queryBuilder.andWhere('car.isSale = :isSale', { isSale });
    }

    if (carTypes && carTypes.length > 0) {
      queryBuilder = queryBuilder.andWhere('car.subCategory IN (:...carTypes)', { carTypes });
    }

    if (priceRange) {
      queryBuilder = queryBuilder.andWhere('car.carPrice BETWEEN :minPrice AND :maxPrice', {
        minPrice: priceRange.min,
        maxPrice: priceRange.max,
      });
    }

    // Add address filters at database level
    if (state) {
      queryBuilder = queryBuilder.andWhere('address.state LIKE :state', { state: `%${state}%` });
    }

    if (city) {
      queryBuilder = queryBuilder.andWhere('address.city LIKE :city', { city: `%${city}%` });
    }

    if (locality) {
      queryBuilder = queryBuilder.andWhere('address.locality LIKE :locality', { locality: `%${locality}%` });
    }

    // Add sorting
    if (sort === 'newest') {
      queryBuilder = queryBuilder.orderBy('car.createdAt', 'DESC');
    } else if (sort === 'oldest') {
      queryBuilder = queryBuilder.orderBy('car.createdAt', 'ASC');
    } else if (sort === 'price-low') {
      queryBuilder = queryBuilder.orderBy('car.carPrice', 'ASC');
    } else if (sort === 'price-high') {
      queryBuilder = queryBuilder.orderBy('car.carPrice', 'DESC');
    } else {
      queryBuilder = queryBuilder.orderBy('car.createdAt', 'DESC');
    }

    // Add pagination
    queryBuilder = queryBuilder.skip(skip).take(limit);

    console.log('🔍 Search Debug - Generated SQL:', queryBuilder.getSql());

    // Execute query
    cars = await queryBuilder.getMany();
    totalCount = await queryBuilder.getCount();

    console.log('🔍 Search Debug - Cars found with database filtering:', cars.length);
    console.log('🔍 Search Debug - Total count:', totalCount);

    // Update coordinates for properties that don't have them (in background)
    if (cars.length > 0) {
      // Update coordinates for first few properties to avoid blocking the response
      const carsToUpdate = cars.slice(0, 3);
      carsToUpdate.forEach((car) => {
        updateCarCoordinates(car, addressRepo).catch((error) => {
          console.error('Background coordinate update failed:', error);
        });
      });
    }

    // Use properties directly since filtering is done at database level
    let filteredCars = cars;

    // If we have search coordinates, calculate distances and sort by distance
    if (searchCoordinates && filteredCars.length > 0) {
      const carsWithDistance = filteredCars.map((car: any) => {
        if (car.address?.latitude && car.address?.longitude) {
          const distance = calculateDistance(
            searchCoordinates!.lat,
            searchCoordinates!.lng,
            car.address.latitude,
            car.address.longitude
          );
          return { ...car, distance };
        } else {
          // If car doesn't have coordinates, assign a high distance
          return { ...car, distance: 999999 };
        }
      });

      // Sort by distance (closest first)
      carsWithDistance.sort((a, b) => a.distance - b.distance);
      filteredCars = carsWithDistance;
    }

    // Get republished cars
    const republishedCars = await republishCarRepo.find({
      where: {
        status: 'Accepted',
      },
    });

    if (!filteredCars || filteredCars.length === 0) {
      return res.status(200).json({
        message: 'No cars found',
        car: [],
        totalCount: 0,
        currentPage: page,
        totalPages: 0,
      });
    }

    // Filter cars based on userType and workingWithDealer
    const userFilteredCars = await Promise.all(
      filteredCars.map(async (car: any) => {
        const carOwner = await userRepo.findOne({
          where: { id: car.userId },
          select: ['userType'],
        });

        // If requesting user is an dealer and car owner is an owner/endUser who doesn't work with dealers for this car
        if (
          userType === 'Dealer' &&
          (carOwner?.userType === 'Owner' || carOwner?.userType === 'EndUser') &&
          car.workingWithDealer === false
        ) {
          return null;
        }
        return car;
      })
    );

    // Remove null values from filtered properties
    const validCars = userFilteredCars.filter((car: any) => car !== null);

    // Get saved properties for the user if userId is provided
    let savedCarIds: string[] = [];
    if (userId) {
      const savedCars = await saveCarRepo.find({
        where: { userId },
        select: ['carId'],
      });
      savedCarIds = savedCars.map((sp: any) => sp.carId);
    }

    // Filter cars based on savedCar parameter
    let finalCars = validCars;
    if (SavedCar !== undefined && userId) {
      if (SavedCar) {
        // Show only saved cars
        finalCars = validCars.filter((car: any) => savedCarIds.includes(car.id));
      } else {
        // Show only non-saved properties
        finalCars = validCars.filter((car: any) => !savedCarIds.includes(car.id));
      }
    }

    // Add owner information and saved status to cars
    const carsWithOwner = await Promise.all(
      finalCars.map(async (car: any) => {
        try {
          const carResponse = await mapCarResponse(car);
          const republishInfo = republishedCars.find((rp: any) => rp.carId === car.id);

          // Get original car owner
          const originalOwner = await userRepo.findOne({
            where: { id: car.userId },
            select: ['id', 'fullName', 'mobileNumber', 'email', 'userType', 'userProfileUrl'],
          });

          // Get republisher details if car is republished
          let republisher = null;
          if (republishInfo) {
            republisher = await userRepo.findOne({
              where: { id: republishInfo.republisherId },
              select: ['id', 'fullName', 'mobileNumber', 'email', 'userType', 'userProfileUrl'],
            });
          }

          // Determine the primary owner (republisher if republished, otherwise original owner)
          const primaryOwner = republisher || originalOwner;

          // Handle user profile image for primary owner
          // let userProfileImage =
          //   'https://static.vecteezy.com/system/resources/previews/000/439/863/non_2x/vector-users-icon.jpg';
          // if (primaryOwner?.userProfileUrl) {
          //   try {
          //     const presignedUrl = await generatePresignedUrl(primaryOwner.userProfileUrl);
          //     if (presignedUrl && presignedUrl.startsWith('http')) {
          //       userProfileImage = presignedUrl;
          //     }
          //   } catch (error) {
          //     console.error('Error generating presigned URL:', error);
          //   }
          // }

          const time = formateTime(car.createdAt);

          const result: any = {
            ...carResponse,
            carPrice: formatCarPrice(car.carPrice),
            time: time,
            // Primary owner details (republisher if republished, otherwise original owner)
            owner: {
              id: primaryOwner?.id,
              fullName: primaryOwner?.fullName,
              userType: primaryOwner?.userType,
              mobileNumber: primaryOwner?.mobileNumber,
              email: primaryOwner?.email,
              // userProfile: userProfileImage,
            },
            isSaved: userId ? savedCarIds.includes(car.id) : false,
            isRepublished: !!republishInfo,
            republishDetails: republishInfo
              ? {
                  republishId: republishInfo.id,
                  republisherId: republishInfo.republisherId,
                  status: republishInfo.status,
                  republishedAt: republishInfo.createdAt,
                }
              : null,
            // Original owner details (for republished cars)
            originalOwner:
              republishInfo && originalOwner
                ? {
                    id: originalOwner.id,
                    fullName: originalOwner.fullName,
                    userType: originalOwner.userType,
                    userProfileUrl: originalOwner.userProfileUrl,
                    mobileNumber: originalOwner.mobileNumber,
                  }
                : null,
          };

          // Add distance if available
          if (car.distance !== undefined) {
            result.distance = Math.round(car.distance * 10) / 10; // Round to 1 decimal place
          }

          return result;
        } catch (error) {
          console.error('Error processing car:', car.id, error);
          return null;
        }
      })
    );

    // Filter out any null values from failed processing
    const validCarsWithOwner = carsWithOwner.filter((car: any) => car !== null);

    // Calculate total inventory value
    const inventoryValue = finalCars.reduce((total: number, car: any) => {
      return total + (car.carPrice || 0);
    }, 0);

    const response: any = {
      message: 'Cars retrieved successfully',
      car: validCarsWithOwner,
      inventoryValue: inventoryValue.toString(),
      totalCount: finalCars.length,
      currentPage: page,
      totalPages: Math.ceil(finalCars.length / limit),
      hasMore: skip + finalCars.length < totalCount,
    };

    // Add locality search information if applicable
    if (locality && locality.trim()) {
      response.searchType = 'locality';
      response.searchLocation = searchLocation
        ? {
            id: searchLocation.id,
            state: searchLocation.state,
            city: searchLocation.city,
            locality: searchLocation.locality,
            stateImageUrl: searchLocation.stateImageUrl,
            cityImageUrl: searchLocation.cityImageUrl,
          }
        : null;
      if (searchCoordinates) {
        response.searchCoordinates = searchCoordinates;
      }
    }

    return res.status(200).json(response);
  } catch (error) {
    console.error('Error in searchCar:', error);
    return res.status(500).json({
      message: 'Server error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Test endpoint to debug search issues
 */
export const testSearch = async (req: Request, res: Response) => {
  try {
    console.log('🧪 Test search endpoint called');

    const carRepo = AppDataSource.getRepository(CarDetails);

    // Test 1: Basic cars
    const allCars = await carRepo.count();
    console.log('🧪 Total cars:', allCars);

    // Test 2: Active cars
    const activeCars = await carRepo.count({ where: { isActive: true } });
    console.log('🧪 Active cars:', activeCars);
  } catch (error) {
    console.error('❌ Error in testSearch:', error);
    return res.status(500).json({
      message: 'Test search failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
