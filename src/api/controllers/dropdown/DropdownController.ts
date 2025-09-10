import 'reflect-metadata';

import express, { Request, Response } from 'express';
import { getRepository, IsNull, Like, Not } from 'typeorm';

import { CarDetails } from '@/api/entity/CarDetails';
import { CarRequirement } from '@/api/entity/CarRequirement';
import { DropdownOptions } from '@/api/entity/DropdownOptions';
import { Location } from '@/api/entity/Location';
import { AppDataSource } from '@/server';

interface City {
  name: string;
  image: string;
  isPopular: boolean;
  localities: string[];
  isActive: boolean;
}

interface State {
  state: string;
  image: string;
  isPopular: boolean;
  cities: { [key: string]: City };
  isActive: boolean;
}

interface GroupedLocations {
  [key: string]: State;
}

const app = express();
app.use(express.json());

export const uploadLocationDropdown = async (req: Request, res: Response) => {
  try {
    // Get pagination parameters from query
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50; // Default 50 items per page
    const offset = (page - 1) * limit;

    const dropdownRepo = AppDataSource.getRepository(Location);

    // Get total count for pagination
    const totalCount = await dropdownRepo.count();

    // Get paginated locations
    const locations = await dropdownRepo.find({
      order: { state: 'ASC', city: 'ASC' },
      skip: offset,
      take: limit,
    });

    // Group locations by state
    const groupedLocations = locations.reduce((acc: GroupedLocations, location) => {
      if (!acc[location.state]) {
        acc[location.state] = {
          state: location.state,
          image: location.stateImageUrl || '',
          isPopular: true,
          cities: {},
          isActive: location.isActive,
        };
      }

      if (!acc[location.state].cities[location.city]) {
        acc[location.state].cities[location.city] = {
          name: location.city,
          image: location.cityImageUrl || '',
          isPopular: true,
          localities: [],
          isActive: location.isActive,
        };
      }

      if (location.locality) {
        acc[location.state].cities[location.city].localities.push(location.locality);
      }

      return acc;
    }, {});

    // Convert to array format and sort localities
    const formattedLocations = Object.values(groupedLocations).map((state) => ({
      ...state,
      cities: Object.values(state.cities).map((city) => ({
        ...city,
        localities: [...new Set(city.localities)].sort(),
      })),
    }));

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.status(200).json({
      data: formattedLocations,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        limit,
        hasNextPage,
        hasPrevPage,
        nextPage: hasNextPage ? page + 1 : null,
        prevPage: hasPrevPage ? page - 1 : null,
      },
    });
  } catch (error) {
    console.error('Error in uploadLocationDropdown:', error);
    res.status(500).json({
      message: 'Error retrieving location options',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

export const getAllCities = async (req: Request, res: Response) => {
  try {
    const locationRepo = AppDataSource.getRepository(Location);

    // Get all unique cities using TypeORM find method
    const locations = await locationRepo.find({
      select: ['city', 'isActive', 'state', 'id', 'cityImageUrl'],
      where: {
        city: Not(IsNull()),
        isActive: true,
      },
      order: {
        city: 'ASC',
      },
    });

    // Remove duplicates based on city name while preserving all fields
    const cityMap = new Map();
    locations.forEach((location) => {
      if (location.city && location.city.trim() !== '' && !cityMap.has(location.city)) {
        cityMap.set(location.city, {
          city: location.city,
          isActive: location.isActive,
          state: location.state,
          id: location.id,
          cityImageUrl: location.cityImageUrl,
        });
      }
    });

    const uniqueCities = Array.from(cityMap.values());

    res.status(200).json(uniqueCities);
  } catch (error) {
    console.error('Error in getAllCities:', error);
    res.status(500).json({
      message: 'Error retrieving cities',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

export const uploadCarDetailsDropdown = async (_req: Request, res: Response) => {
  try {
    const dropdownRepo = AppDataSource.getRepository(DropdownOptions);
    const options = await dropdownRepo.find({
      select: ['state', 'city', 'locality'],
    });
    res.status(200).json(options);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving dropdown options', error });
  }
};

export const userRequirements = async (_req: Request, res: Response) => {
  try {
    const dropdownRepo = AppDataSource.getRepository(DropdownOptions);
    const options = await dropdownRepo.find({
      select: ['lookingFor', 'needFor', 'furnishingType', 'BHKType'],
    });
    res.status(200).json(options);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving user requirements', error });
  }
};

export const imageFilter = async (_req: Request, res: Response) => {
  try {
    const dropdownRepo = AppDataSource.getRepository(DropdownOptions);
    const options = await dropdownRepo.find({
      select: ['images'],
    });
    res.status(200).json(options);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving image options', error });
  }
};

// Get all unique states
export const getStates = async (req: Request, res: Response) => {
  try {
    const locationRepo = AppDataSource.getRepository(Location);
    const locations = await locationRepo.find({ select: ['state', 'isActive'] });

    // Only keep locations where isActive is true
    const activeStates = locations
      .filter((loc) => loc.isActive === true)
      .map((loc) => loc.state)
      .filter(Boolean);

    // Remove duplicates and sort
    const uniqueStates = [...new Set(activeStates)].sort();

    res.status(200).json(uniqueStates);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch states' });
  }
};

// Get cities for a selected state
export const getCities = async (req: Request, res: Response) => {
  try {
    const { state } = req.body;
    if (!state) {
      const locationRepo = AppDataSource.getRepository(Location);
      const locations = await locationRepo.find({
        where: { city: Not(IsNull()), isActive: true },
        select: ['city', 'state', 'isActive'],
      });
      const cityList = [...new Set(locations.map((loc) => loc.city))]
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
      return res.status(200).json(cityList);
    }

    const locationRepo = AppDataSource.getRepository(Location);
    const locations = await locationRepo.find({
      where: { state, isActive: true },
      select: ['city', 'isActive'],
    });

    const cityList = [...new Set(locations.map((loc) => loc.city))].filter(Boolean).sort((a, b) => a.localeCompare(b));

    res.status(200).json(cityList);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch cities' });
  }
};

// Get localities for a selected city
export const getLocalities = async (req: Request, res: Response) => {
  try {
    const { state, city, search } = req.body;
    if (!city) {
      return res.status(400).json({ message: 'City is required' });
    }

    const locationRepo = AppDataSource.getRepository(Location);

    // Build where conditions
    const whereConditions: any = {
      city,
      isActive: true,
    };

    // Add state filter if provided
    if (state) {
      whereConditions.state = state;
    }

    // Add search filter if provided
    if (search) {
      whereConditions.locality = Like(`%${search}%`);
    }

    const locations = await locationRepo.find({
      where: whereConditions,
      select: ['locality', 'isActive'],
    });

    const localityList = [...new Set(locations.map((loc) => loc.locality))]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
    res.status(200).json(localityList);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving localities', error });
  }
};

// Get popular cities
export const getPopularCities = async (req: Request, res: Response) => {
  try {
    const locationRepo = AppDataSource.getRepository(Location);
    const locations = await locationRepo.find({
      select: ['id', 'state', 'city', 'cityImageUrl', 'isActive'],
      order: { isActive: 'DESC', city: 'ASC' },
    });

    // Remove duplicates and create city objects with images
    const cityMap = new Map();
    locations.forEach((location) => {
      if (location.city && !cityMap.has(location.city)) {
        cityMap.set(location.city, {
          id: location.city,
          name: location.city,
          state: location.state,
          city: location.city,
          image: location.cityImageUrl || 'https://via.placeholder.com/300',
          isActive: location.isActive,
        });
      }
    });

    // Convert to array and sort: active cities first, then alphabetically
    const popularCities = Array.from(cityMap.values()).sort((a, b) => {
      // First sort by isActive (active cities first)
      if (a.isActive !== b.isActive) {
        return a.isActive ? -1 : 1;
      }
      // Then sort alphabetically by city name
      return a.name.localeCompare(b.name);
    });

    res.status(200).json(popularCities);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch popular cities' });
  }
};

// property filter data
export const getCarFilterData = async (req: Request, res: Response) => {
  try {
    // Handle cases where req.body is undefined, null, or malformed
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Invalid request body. Expected a JSON object.',
        error: 'Request body is missing or malformed',
      });
    }

    const { filterFor } = req.body;

    // If no filterFor provided, return default static options
    if (!filterFor) {
      const defaultResponse = {
        carTypes: [
          { label: 'SUV', value: 'suv', icon: 'suv', selectedIcon: 'suv' },
          { label: 'Sedan', value: 'sedan', icon: 'sedan', selectedIcon: 'sedan' },
          { label: 'Hatchback', value: 'hatchback', icon: 'hatchback', selectedIcon: 'hatchback' },
          { label: 'Coupe', value: 'coupe', icon: 'coupe', selectedIcon: 'coupe' },
          { label: 'MUV', value: 'muv', icon: 'muv', selectedIcon: 'muv' },
        ],
        priceRange: {
          min: 50000,
          max: 500000,
          step: 1,
        },
      };

      return res.status(200).json({
        success: true,
        message: 'Default filter data retrieved successfully',
        data: defaultResponse,
      });
    }

    // if (filterFor === 'carDetails') {
    //   // Get Property repository
    //   const carDetailsRepo = AppDataSource.getRepository(CarDetails);

    //   // Build where conditions
    //   const whereConditions: any = {
    //     // isActive: true,
    //     // isSold: false
    //   };

    //   // Add isSale filter if provided
    //   if (isSale && ['Sell', 'Rent', 'Lease'].includes(isSale)) {
    //     whereConditions.isSale = isSale;
    //   }

    //   // Get all active, non-sold properties with optional isSale filter
    //   const allProperties = await carDetailsRepo.find({
    //     where: whereConditions,
    //     select: [
    //       'subCategory',
    //       'furnishing',
    //       'bhks',
    //       'constructionStatus',
    //       'propertyFacing',
    //       'ageOfTheProperty',
    //       'propertyPrice',
    //       'amenities',
    //     ],
    //   });

    //   Extract unique values using Set
    //   const propertyTypes = [
    //     'Flats',
    //     'Builder Floors',
    //     'House Villas',
    //     'Plots',
    //     'Farmhouses',
    //     'Hotels',
    //     'Lands',
    //     'Office Spaces',
    //     'Hostels',
    //     'Shops Showrooms',
    //   ];
    //   const furnishingTypes = [...new Set(allProperties.map((p) => p.furnishing))].filter(Boolean);
    //   const bhkTypes = [...new Set(allProperties.map((p) => p.bhks))].filter(Boolean);
    //   const constructionStatus = [...new Set(allProperties.map((p) => p.constructionStatus))].filter(Boolean);
    //   const propertyFacing = [...new Set(allProperties.map((p) => p.propertyFacing))].filter(Boolean);
    //   const ageOfProperty = [...new Set(allProperties.map((p) => p.ageOfTheProperty))].filter(Boolean);

    //   Get price range - filter out NULL and invalid prices, return prices in thousands for frontend compatibility
    //   const prices = allProperties
    //     .map((p) => p.propertyPrice)
    //     .filter((price) => price !== null && price !== undefined && price > 0 && !isNaN(price));

    //   let minPrice = 1000000;
    //   let maxPrice = 100000000;

    //   if (prices.length > 0) {
    //     minPrice = Math.min(...prices);
    //     maxPrice = Math.max(...prices);
    //   }

    //   Ensure minimum price is at least 1000 in thousands (1L in actual price)
    //   const adjustedMinPrice = Math.max(minPrice, 1000000);
    //   const adjustedMaxPrice = Math.max(maxPrice, adjustedMinPrice + 1000000);

    //   Flatten and get unique amenities
    //   const allAmenities = allProperties
    //     .map((p) => p.amenities)
    //     .filter(Boolean)
    //     .flat()
    //     .filter((amenity, index, arr) => arr.indexOf(amenity) === index)
    //     .sort();

    //   // Format the response
    //   const response = {
    //     carTypes: carTypes.map((ct) => ({
    //       label: ct,
    //       value: ct,
    //     })),
    //     priceRange: {
    //       min: Math.max(1, Math.floor(adjustedMinPrice / 1000)), // Ensure minimum is at least 1000 in thousands
    //       max: Math.ceil(adjustedMaxPrice / 1000),
    //       step: Math.max(1, Math.floor(adjustedMaxPrice / 100000)), // Dynamic step based on max price
    //     },
    //     listedBy: [
    //       { label: 'Owner', value: 'Owner' },
    //       { label: 'Dealer', value: 'Dealer' },
    //       { label: 'EndUser', value: 'EndUser' },
    //     ],
    //     needForOptions: [
    //       { label: 'Sell', value: 'Sell' },
    //       { label: 'Buy', value: 'Buy' },
    //     ],
    //     furnishingTypes: furnishingTypes.map((ft) => ({
    //       label: ft,
    //       value: ft,
    //     })),
    //     bhkTypes: bhkTypes
    //       .map((bt) => {
    //         // Clean the BHK value to ensure proper formatting
    //         let cleanBhk = bt;
    //         // Remove any existing "BHK" text and trim
    //         cleanBhk = cleanBhk.replace(/BHK/gi, '').trim();
    //         // If it's a number, format as "X BHK", otherwise use as is
    //         const isNumber = !isNaN(Number(cleanBhk));
    //         const formattedBhk = isNumber ? `${cleanBhk} BHK` : bt;

    //         return {
    //           label: formattedBhk,
    //           value: formattedBhk,
    //           numericValue: isNumber ? Number(cleanBhk) : 0,
    //         };
    //       })
    //       .filter((bhk) => {
    //         // Filter out invalid BHK values (0 or negative)
    //         if (bhk.numericValue <= 0) return false;
    //         // Filter out non-numeric BHK values that don't make sense
    //         if (bhk.numericValue === 0 && !bhk.label.includes('BHK')) return false;
    //         return true;
    //       })
    //       .sort((a, b) => a.numericValue - b.numericValue) // Sort numerically
    //       .map((bhk) => ({
    //         label: bhk.label,
    //         value: bhk.value,
    //       })),
    //     constructionStatus: constructionStatus.map((cs) => ({
    //       label: cs,
    //       value: cs,
    //     })),
    //     propertyFacing: propertyFacing.map((pf) => ({
    //       label: pf,
    //       value: pf,
    //     })),
    //     ageOfProperty: ageOfProperty.map((ap) => ({
    //       label: ap,
    //       value: ap,
    //     })),
    //     amenities: allAmenities.map((amenity) => ({
    //       label: amenity,
    //       value: amenity,
    //     })),
    //     RERAStatus: [
    //       { label: 'Approved', value: 'Approved' },
    //       { label: 'Not Approved', value: 'Not Approved' },
    //     ],
    //   };

    //   return res.status(200).json({
    //     success: true,
    //     message: 'Property filter data retrieved successfully',
    //     data: response,
    //   });
    // }

    // if (filterFor === 'requirement') {
    //   // Get PropertyRequirement repository
    //   const requirementRepo = AppDataSource.getRepository(PropertyRequirement);

    //   // Build where conditions for requirements
    //   const whereConditions: any = {
    //     isFound: false,
    //   };

    //   // Add needFor filter if isSale is provided (map isSale to needFor format)
    //   if (isSale && ['Sell', 'Rent', 'Lease'].includes(isSale)) {
    //     const needForMap: { [key: string]: string } = {
    //       Sell: 'sale',
    //       Rent: 'rent',
    //       Lease: 'lease',
    //     };
    //     whereConditions.needFor = needForMap[isSale];
    //   }

    //   // Get all unfound requirements with optional needFor filter
    //   const allRequirements = await requirementRepo.find({
    //     where: whereConditions,
    //     select: ['category', 'subCategory', 'bhkRequired', 'furnishing', 'minBudget', 'maxBugdget'],
    //   });

    //   // Extract unique values using Set
    //   const categories = [...new Set(allRequirements.map((r) => r.category))].filter(Boolean);
    //   const subCategories = [...new Set(allRequirements.map((r) => r.subCategory))].filter(Boolean);
    //   const bhkRequirements = [...new Set(allRequirements.map((r) => r.bhkRequired))].filter(Boolean);
    //   const furnishingRequirements = [...new Set(allRequirements.map((r) => r.furnishing))].filter(Boolean);

    //   // Get budget range - filter out invalid budgets, return budgets in thousands for frontend compatibility
    //   const budgets = allRequirements
    //     .map((r) => ({
    //       min: parseFloat(r.minBudget || '0'),
    //       max: parseFloat(r.maxBugdget || '0'),
    //     }))
    //     .filter((b) => !isNaN(b.min) && !isNaN(b.max) && b.min > 0 && b.max > 0 && b.max >= b.min);

    //   let minBudget = 1000000; // Default minimum in actual price (1L)
    //   let maxBudget = 100000000; // Default maximum in actual price (10Cr)

    //   if (budgets.length > 0) {
    //     minBudget = Math.min(...budgets.map((b) => b.min));
    //     maxBudget = Math.max(...budgets.map((b) => b.max));
    //   }

    //   // Ensure minimum budget is at least 1000 in thousands (1L in actual price)
    //   const adjustedMinBudget = Math.max(minBudget, 1000000); // At least 1,000,000 (1L)
    //   const adjustedMaxBudget = Math.max(maxBudget, adjustedMinBudget + 1000000); // At least 1L more than min

    //   // Format the response using the same structure as property
    //   const response = {
    //     propertyTypes: subCategories.map((subCat) => ({
    //       label: subCat,
    //       value: subCat,
    //     })),
    //     priceRange: {
    //       min: Math.max(1, Math.floor(adjustedMinBudget / 1000)), // Ensure minimum is at least 1000 in thousands
    //       max: Math.ceil(adjustedMaxBudget / 1000),
    //       step: Math.max(1, Math.floor(adjustedMaxBudget / 100000)),
    //     },
    //     listedBy: [
    //       { label: 'Owner', value: 'Owner' },
    //       { label: 'Agent', value: 'Agent' },
    //       { label: 'EndUser', value: 'EndUser' },
    //     ],
    //     needForOptions: [
    //       { label: 'Sell', value: 'Sell' },
    //       { label: 'Rent', value: 'Rent' },
    //       { label: 'Lease', value: 'Lease' },
    //     ],
    //     furnishingTypes: furnishingRequirements.map((furn) => ({
    //       label: furn,
    //       value: furn,
    //     })),
    //     bhkTypes: bhkRequirements
    //       .map((bhk) => {
    //         // Clean the BHK value to ensure proper formatting
    //         let cleanBhk = bhk;
    //         // Remove any existing "BHK" text and trim
    //         cleanBhk = cleanBhk.replace(/BHK/gi, '').trim();
    //         // If it's a number, format as "X BHK", otherwise use as is
    //         const isNumber = !isNaN(Number(cleanBhk));
    //         const formattedBhk = isNumber ? `${cleanBhk} BHK` : bhk;

    //         return {
    //           label: formattedBhk,
    //           value: formattedBhk,
    //           numericValue: isNumber ? Number(cleanBhk) : 0,
    //         };
    //       })
    //       .filter((bhk) => {
    //         // Filter out invalid BHK values (0 or negative)
    //         if (bhk.numericValue <= 0) return false;
    //         // Filter out non-numeric BHK values that don't make sense
    //         if (bhk.numericValue === 0 && !bhk.label.includes('BHK')) return false;
    //         return true;
    //       })
    //       .sort((a, b) => a.numericValue - b.numericValue) // Sort numerically
    //       .map((bhk) => ({
    //         label: bhk.label,
    //         value: bhk.value,
    //       })),
    //   };

    //   return res.status(200).json({
    //     success: true,
    //     message: 'Requirement filter data retrieved successfully',
    //     data: response,
    //   });
    // }

    // If filterFor is not recognized, return error
    return res.status(400).json({
      success: false,
      message: 'Invalid filterFor parameter. Use "car" or "requirement"',
    });
  } catch (error) {
    console.error('Error in getCarFilterData:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving filter data',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
