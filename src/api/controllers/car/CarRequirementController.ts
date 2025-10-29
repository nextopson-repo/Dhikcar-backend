import { Request, Response } from 'express';
import { In, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';

import { Address } from '@/api/entity/Address';
import { CarRequirement } from '@/api/entity/CarRequirement';
import { UserAuth } from '@/api/entity/UserAuth';
import { RequirementEnquiry } from '@/api/entity/RequirementEnquiry';
import { AppDataSource } from '@/server';
import { BaseController } from '../baseController';

const formatTimeStamp = (timeStamp: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - timeStamp.getTime();

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (seconds < 60) {
    return 'just now';
  } else if (minutes < 60) {
    return `${minutes}min`;
  } else if (hours < 24) {
    return `${hours}h`;
  } else if (days < 7) {
    return `${days}d`;
  } else if (weeks < 4) {
    return `${weeks}w`;
  } else if (months < 12) {
    return `${months}m`;
  } else if (years < 1000) {
    return `${years}y`;
  } else {
    return '1000y+';
  }
};

const formatBudget = (min: number | undefined | null, max: number | undefined | null) => {
  const formatAmount = (amount: number) => {
    if (amount >= 10000000) return `${(amount / 10000000).toFixed(0)} Cr`;
    if (amount >= 100000) return `${(amount / 100000).toFixed(0)} L`;
    if (amount >= 1000) return `${(amount / 1000).toFixed(0)} K`;
    return amount.toString();
  };

  if (min && max) {
    return `₹${formatAmount(min)} - ₹${formatAmount(max)}`;
  } else if (max) {
    return `Upto ₹${formatAmount(max)}`;
  } else if (min) {
    return `From ₹${formatAmount(min)}`;
  }
  return 'Budget not specified';
};

/**
 * Create or Update Car Requirement
 */
export const createOrUpdateCarRequirement = async (req: Request, res: Response) => {
  try {
    const {
      userId,
      requirementId,
      city,
      locality,
      state,
      carName,
      brand,
      model,
      variant,
      fuelType,
      transmission,
      bodyType,
      ownership,
      manufacturingYear,
      registrationYear,
      isSale,
      minPrice,
      maxPrice,
      maxKmDriven,
      seats,
      description,
    } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }

    const requirementRepo = AppDataSource.getRepository(CarRequirement);
    const addressRepo = AppDataSource.getRepository(Address);
    const userRepo = AppDataSource.getRepository(UserAuth);

    const user = await userRepo.findOne({
      where: { id: userId },
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'User not found' });
    }

    // Update existing requirement
    if (requirementId) {
      const existingRequirement = await requirementRepo.findOne({
        where: { id: requirementId },
        relations: ['address'],
      });

      if (!existingRequirement) {
        return res.status(400).json({ success: false, message: 'Car requirement not found' });
      }

      if (existingRequirement.userId !== userId) {
        return res.status(403).json({ success: false, message: 'Not authorized to update this requirement' });
      }

      // Update address if provided
      if (existingRequirement.address && (city || locality || state)) {
        existingRequirement.address.state = state || existingRequirement.address.state;
        existingRequirement.address.city = city || existingRequirement.address.city;
        existingRequirement.address.locality = locality || existingRequirement.address.locality;
        await addressRepo.save(existingRequirement.address);
      }

      // Update requirement fields
      Object.assign(existingRequirement, {
        carName: carName !== undefined ? carName : existingRequirement.carName,
        brand: brand !== undefined ? brand : existingRequirement.brand,
        model: model !== undefined ? model : existingRequirement.model,
        variant: variant !== undefined ? variant : existingRequirement.variant,
        fuelType: fuelType !== undefined ? fuelType : existingRequirement.fuelType,
        transmission: transmission !== undefined ? transmission : existingRequirement.transmission,
        bodyType: bodyType !== undefined ? bodyType : existingRequirement.bodyType,
        ownership: ownership !== undefined ? ownership : existingRequirement.ownership,
        manufacturingYear: manufacturingYear !== undefined ? manufacturingYear : existingRequirement.manufacturingYear,
        registrationYear: registrationYear !== undefined ? registrationYear : existingRequirement.registrationYear,
        isSale: isSale !== undefined ? isSale : existingRequirement.isSale,
        minPrice: minPrice !== undefined ? minPrice : existingRequirement.minPrice,
        maxPrice: maxPrice !== undefined ? maxPrice : existingRequirement.maxPrice,
        maxKmDriven: maxKmDriven !== undefined ? maxKmDriven : existingRequirement.maxKmDriven,
        seats: seats !== undefined ? seats : existingRequirement.seats,
        description: description !== undefined ? description : existingRequirement.description,
        updatedBy: userId,
      });

      const updatedRequirement = await requirementRepo.save(existingRequirement);
      return res.status(200).json({
        success: true,
        message: 'Car requirement updated successfully',
        data: updatedRequirement,
      });
    }

    // Create new requirement
    if (!city || !locality) {
      return res.status(400).json({ success: false, message: 'City and locality are required' });
    }

    const addressInfo = await addressRepo.findOne({
      where: { city, locality },
    });

    const newAddress = addressRepo.create({
      state: state || addressInfo?.state || '',
      city,
      locality,
    });
    await addressRepo.save(newAddress);

    const newCarRequirement = requirementRepo.create({
      userId,
      carName,
      brand,
      model,
      variant,
      fuelType,
      transmission,
      bodyType,
      ownership,
      manufacturingYear,
      registrationYear,
      isSale,
      minPrice,
      maxPrice,
      maxKmDriven,
      seats,
      description,
      address: newAddress,
      createdBy: userId,
    });

    const savedRequirement = await requirementRepo.save(newCarRequirement);

    return res.status(201).json({
      success: true,
      message: 'Car requirement created successfully',
      data: savedRequirement,
    });
  } catch (error) {
    console.error('Error in createOrUpdateCarRequirement:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Get all car requirements with filtering
 */
export const getAllCarRequirements = async (req: Request, res: Response) => {
  try {
    const {  sort, filter = {}, location = {}, connectionType } = req.body;
    const { page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const requirementRepo = AppDataSource.getRepository(CarRequirement);
    const userRepo = AppDataSource.getRepository(UserAuth);

    // if (!userId) {
    //   return res.status(400).json({ success: false, message: 'User ID is required' });
    // }

    // Build where conditions
    const whereConditions: any = {
      isFound: false,
    };

    // Location filter
    if (location.state || location.city || location.locality) {
      whereConditions.address = {};
      if (location.state) {
        whereConditions.address.state = location.state;
      }
      if (location.city) {
        whereConditions.address.city = location.city;
      }
      if (location.locality) {
        whereConditions.address.locality = location.locality;
      }
    }

    // Price range filter
    if (filter.priceRange) {
      if (filter.priceRange.min) {
        whereConditions.minPrice = MoreThanOrEqual(filter.priceRange.min);
      }
      if (filter.priceRange.max) {
        whereConditions.maxPrice = LessThanOrEqual(filter.priceRange.max);
      }
    }

    // Sale/Buy filter
    if (filter.isSale) {
      whereConditions.isSale = filter.isSale;
    }

    // Car filters
    if (filter.brands && filter.brands.length > 0) {
      whereConditions.brand = In(filter.brands);
    }
    if (filter.models && filter.models.length > 0) {
      whereConditions.model = In(filter.models);
    }
    if (filter.fuelTypes && filter.fuelTypes.length > 0) {
      whereConditions.fuelType = In(filter.fuelTypes);
    }
    if (filter.transmissions && filter.transmissions.length > 0) {
      whereConditions.transmission = In(filter.transmissions);
    }
    if (filter.bodyTypes && filter.bodyTypes.length > 0) {
      whereConditions.bodyType = In(filter.bodyTypes);
    }

    // Filter by poster user type if provided
    if (connectionType) {
      const usersOfType = await userRepo.find({ where: { userType: connectionType } });
      const userIdsOfType = usersOfType.map((u) => u.id);
      if (userIdsOfType.length === 0) {
        return res.status(200).json({
          success: true,
          message: 'Car requirements retrieved successfully',
          data: [],
          count: 0,
          totalCount: 0,
          currentPage: Number(page),
          totalPages: 0,
          hasMore: false,
        });
      }
      whereConditions.userId = In(userIdsOfType);
    }

    // Build order conditions
    const orderConditions: any = {};
    if (sort === 'oldToNew') {
      orderConditions.createdAt = 'ASC';
    } else if (sort === 'newToOld') {
      orderConditions.createdAt = 'DESC';
    } else if (sort === 'priceLowToHigh') {
      orderConditions.minPrice = 'ASC';
    } else if (sort === 'priceHighToLow') {
      orderConditions.maxPrice = 'DESC';
    } else {
      orderConditions.createdAt = 'DESC';
    }

    // Get total count for pagination
    const totalCount = await requirementRepo.count({
      where: whereConditions,
      relations: ['address'],
    });

    // Find requirements with relations
    const requirements = await requirementRepo.find({
      where: whereConditions,
      relations: ['address'],
      order: orderConditions,
      skip: skip,
      take: Number(limit),
    });

    const requirementsWithUserDetails = await Promise.all(
      requirements.map(async (requirement) => {
        let user = null;
        if (requirement.userId) {
          user = await userRepo.findOne({ where: { id: requirement.userId } });
        }
        return {
          requirementId: requirement.id,
          carName: requirement.carName,
          brand: requirement.brand,
          model: requirement.model,
          variant: requirement.variant,
          fuelType: requirement.fuelType,
          transmission: requirement.transmission,
          bodyType: requirement.bodyType,
          ownership: requirement.ownership,
          manufacturingYear: requirement.manufacturingYear,
          registrationYear: requirement.registrationYear,
          isSale: requirement.isSale,
          minPrice: requirement.minPrice,
          maxPrice: requirement.maxPrice,
          maxKmDriven: requirement.maxKmDriven,
          seats: requirement.seats,
          description: requirement.description,
          isFound: requirement.isFound,
          enquiryCount: Array.isArray(requirement.enquiryIds) ? requirement.enquiryIds.length : 0,
          budget: formatBudget(requirement.minPrice, requirement.maxPrice),
          address: requirement.address
            ? {
                city: requirement.address.city,
                state: requirement.address.state,
                locality: requirement.address.locality,
              }
            : null,
          createdAt: formatTimeStamp(requirement.createdAt),
          user: {
            fullName: user?.fullName,
            mobileNumber: user?.mobileNumber,
            email: user?.email,
            userType: user?.userType,
            id: user?.id,
          },
        };
      })
    );

    const totalPages = Math.ceil(totalCount / Number(limit));
    const currentPage = Number(page);
    const hasMore = skip + requirements.length < totalCount;

    return res.status(200).json({
      success: true,
      message: 'Car requirements retrieved successfully',
      data: requirementsWithUserDetails,
      count: requirements.length,
      totalCount,
      currentPage,
      totalPages,
      hasMore,
    });
  } catch (error) {
    console.error('Error in getAllCarRequirements:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Get car requirements for a specific user
 */
export const getUserCarRequirements = async (req: Request, res: Response) => {
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

    const requirementRepo = AppDataSource.getRepository(CarRequirement);
    const userRepo = AppDataSource.getRepository(UserAuth);
    const requirementEnquiryRepo = AppDataSource.getRepository(RequirementEnquiry);

    // Validate user exists
    const user = await userRepo.findOne({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Get total count
    const totalCount = await requirementRepo.count({
      where: { userId },
    });

    // Get requirements
    const requirements = await requirementRepo.find({
      where: { userId },
      relations: ['address'],
      order: { createdAt: 'DESC' },
      skip,
      take: Number(limit),
    });

    if (requirements.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No car requirements found',
        requirements: [],
        totalCount: 0,
        currentPage: Number(page),
        totalPages: 0,
        hasMore: false,
      });
    }

    // Process requirements
    const requirementsWithDetails = await Promise.all(
      requirements.map(async (requirement) => {
        const enquiries = await requirementEnquiryRepo.find({
          where: { requirementId: requirement.id },
          relations: ['user'],
        }).catch(() => []); // Handle case where table doesn't exist

        const formatBudgetAmount = (min: number | undefined | null, max: number | undefined | null) => {
          const formatAmount = (amount: number) => {
            if (amount >= 10000000) return `${(amount / 10000000).toFixed(0)} Cr`;
            if (amount >= 100000) return `${(amount / 100000).toFixed(0)} L`;
            if (amount >= 1000) return `${(amount / 1000).toFixed(0)} K`;
            return amount.toString();
          };

          if (min && max) {
            return `₹${formatAmount(min)} - ₹${formatAmount(max)}`;
          } else if (max) {
            return `Upto ₹${formatAmount(max)}`;
          } else if (min) {
            return `From ₹${formatAmount(min)}`;
          }
          return 'Budget not specified';
        };

        const additionalRequirements = [];
        if (requirement.isSale) {
          additionalRequirements.push(requirement.isSale === 'Sell' ? 'For Sale' : 'For Buy');
        }
        if (requirement.brand) {
          additionalRequirements.push(`${requirement.brand} ${requirement.model || ''}`.trim());
        }
        if (requirement.fuelType) {
          additionalRequirements.push(requirement.fuelType);
        }
        if (requirement.transmission) {
          additionalRequirements.push(requirement.transmission);
        }

        const viewCount = enquiries.length * 1000;
        const interactionCount = enquiries.length * 50;

        const formatCount = (count: number) => {
          if (count >= 1000000) return `${(count / 1000000).toFixed(1)} M`;
          if (count >= 1000) return `${(count / 1000).toFixed(0)} K`;
          return count.toString();
        };

        return {
          id: requirement.id,
          carName: requirement.carName,
          brand: requirement.brand,
          model: requirement.model,
          variant: requirement.variant,
          fuelType: requirement.fuelType,
          transmission: requirement.transmission,
          bodyType: requirement.bodyType,
          ownership: requirement.ownership,
          manufacturingYear: requirement.manufacturingYear,
          registrationYear: requirement.registrationYear,
          isSale: requirement.isSale,
          minPrice: requirement.minPrice,
          maxPrice: requirement.maxPrice,
          maxKmDriven: requirement.maxKmDriven,
          seats: requirement.seats,
          description: requirement.description,
          isFound: requirement.isFound,
          location: requirement.address
            ? `${requirement.address.city}, ${requirement.address.state}`
            : 'Location not specified',
          additionalRequirements,
          budget: formatBudgetAmount(requirement.minPrice, requirement.maxPrice),
          address: requirement.address
            ? {
                city: requirement.address.city,
                state: requirement.address.state,
                locality: requirement.address.locality,
              }
            : null,
          enquiries: {
            count: enquiries.length,
            details: enquiries.map((enquiry) => ({
              id: enquiry.id,
              userId: enquiry.userId,
              message: enquiry.message,
              createdAt: enquiry.createdAt,
              user: enquiry.user
                ? {
                    name: enquiry.user.fullName,
                    email: enquiry.user.email,
                    mobileNumber: enquiry.user.mobileNumber,
                    userType: enquiry.user.userType,
                    timeStamp: formatTimeStamp(enquiry.createdAt),
                  }
                : null,
            })),
          },
          stats: {
            views: `${formatCount(viewCount)}`,
            interactions: `${formatCount(interactionCount)}`,
          },
          createdAt: requirement.createdAt,
          updatedAt: requirement.updatedAt,
        };
      })
    );

    const totalPages = Math.ceil(totalCount / Number(limit));

    return res.status(200).json({
      success: true,
      message: 'Car requirements retrieved successfully',
      requirements: requirementsWithDetails,
      totalCount,
      currentPage: Number(page),
      totalPages,
      hasMore: skip + requirements.length < totalCount,
    });
  } catch (error) {
    console.error('Error in getUserCarRequirements:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Get car requirement by ID
 */
export const getCarRequirementById = async (req: Request, res: Response) => {
  try {
    const { requirementId } = req.body;

    if (!requirementId) {
      return res.status(400).json({
        success: false,
        message: 'Requirement ID is required',
      });
    }

    const requirementRepo = AppDataSource.getRepository(CarRequirement);
    const userRepo = AppDataSource.getRepository(UserAuth);
    const requirementEnquiryRepo = AppDataSource.getRepository(RequirementEnquiry);

    const requirement = await requirementRepo.findOne({
      where: { id: requirementId },
      relations: ['address'],
    });

    if (!requirement) {
      return res.status(404).json({
        success: false,
        message: 'Car requirement not found',
      });
    }

    const user = await userRepo.findOne({
      where: { id: requirement.userId },
    });

    const enquiries = await requirementEnquiryRepo.find({
      where: { requirementId },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    }).catch(() => []); // Handle case where table doesn't exist

    return res.status(200).json({
      success: true,
      message: 'Car requirement retrieved successfully',
      data: {
        id: requirement.id,
        carName: requirement.carName,
        brand: requirement.brand,
        model: requirement.model,
        variant: requirement.variant,
        fuelType: requirement.fuelType,
        transmission: requirement.transmission,
        bodyType: requirement.bodyType,
        ownership: requirement.ownership,
        manufacturingYear: requirement.manufacturingYear,
        registrationYear: requirement.registrationYear,
        isSale: requirement.isSale,
        minPrice: requirement.minPrice,
        maxPrice: requirement.maxPrice,
        maxKmDriven: requirement.maxKmDriven,
        seats: requirement.seats,
        description: requirement.description,
        isFound: requirement.isFound,
        budget: formatBudget(requirement.minPrice, requirement.maxPrice),
        address: requirement.address
          ? {
              city: requirement.address.city,
              state: requirement.address.state,
              locality: requirement.address.locality,
            }
          : null,
        user: user
          ? {
              id: user.id,
              fullName: user.fullName,
              email: user.email,
              mobileNumber: user.mobileNumber,
              userType: user.userType,
            }
          : null,
        enquiries: enquiries.map((enquiry) => ({
          id: enquiry.id,
          userId: enquiry.userId,
          message: enquiry.message,
          createdAt: enquiry.createdAt,
          user: enquiry.user
            ? {
                name: enquiry.user.fullName,
                email: enquiry.user.email,
                mobileNumber: enquiry.user.mobileNumber,
                userType: enquiry.user.userType,
              }
            : null,
        })),
        createdAt: requirement.createdAt,
        updatedAt: requirement.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error in getCarRequirementById:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Update car requirement found status
 */
export const updateCarRequirementFoundStatus = async (req: Request, res: Response) => {
  try {
    const { userId, requirementId, isFound } = req.body;

    if (!userId || !requirementId || isFound === undefined) {
      return res.status(400).json({
        success: false,
        message: 'userId, requirementId and isFound are required',
      });
    }

    const userRepo = AppDataSource.getRepository(UserAuth);
    const requirementRepo = AppDataSource.getRepository(CarRequirement);

    const user = await userRepo.findOne({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const requirement = await requirementRepo.findOne({
      where: { id: requirementId },
    });

    if (!requirement) {
      return res.status(404).json({
        success: false,
        message: 'Car requirement not found',
      });
    }

    if (requirement.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this requirement',
      });
    }

    requirement.isFound = isFound;
    requirement.updatedBy = userId;
    await requirementRepo.save(requirement);

    return res.status(200).json({
      success: true,
      message: 'Car requirement found status updated successfully',
      data: requirement,
    });
  } catch (error) {
    console.error('Error in updateCarRequirementFoundStatus:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Delete car requirement
 */
export const deleteCarRequirement = async (req: Request, res: Response) => {
  try {
    const { userId, requirementId } = req.body;

    if (!userId || !requirementId) {
      return res.status(400).json({
        success: false,
        message: 'userId and requirementId are required',
      });
    }

    const userRepo = AppDataSource.getRepository(UserAuth);
    const requirementRepo = AppDataSource.getRepository(CarRequirement);

    const user = await userRepo.findOne({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const requirement = await requirementRepo.findOne({
      where: { id: requirementId },
    });

    if (!requirement) {
      return res.status(404).json({
        success: false,
        message: 'Car requirement not found',
      });
    }

    if (!user.isAdmin && requirement.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this requirement',
      });
    }

    await requirementRepo.delete(requirementId);

    return res.status(200).json({
      success: true,
      message: 'Car requirement deleted successfully',
    });
  } catch (error) {
    console.error('Error in deleteCarRequirement:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

