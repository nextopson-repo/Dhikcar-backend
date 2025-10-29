import { Request, Response } from 'express';
import { Between } from 'typeorm';

import { CarDetails } from '@/api/entity/CarDetails';
import { CarEnquiry } from '@/api/entity/CarEnquiry';
import { CarRequirement } from '@/api/entity/CarRequirement';
import { SavedCar } from '@/api/entity/SavedCars';
import { UserAuth } from '@/api/entity/UserAuth';
import { ErrorHandler } from '@/api/middlewares/error';
import { AppDataSource } from '@/server';

// Custom type for request user based on UserAuth entity
type RequestUser = {
  id: string;
  userType: 'Dealer' | 'Owner' | 'EndUser';
  email: string;
  mobileNumber: string;
  isAdmin?: boolean;
  fullName?: string;
  isEmailVerified?: boolean;
  isMobileVerified?: boolean;
};

export interface CarRequest extends Omit<Request, 'user'> {
  body: {
    userId?: string;
    // Analytics filter fields
    dateRangeType?: 'lastMonth' | 'last3Months' | 'lastYear' | 'custom';
    fromDate?: string; // ISO string, required if dateRangeType is 'custom'
    toDate?: string; // ISO string, required if dateRangeType is 'custom'
  };
  user?: RequestUser;
}

export const analyticCar = async (req: CarRequest, res: Response) => {
  try {
    const { userId, dateRangeType, fromDate, toDate } = req.body;

    if (!userId) {
      throw new ErrorHandler('User ID is required', 400);
    }

    // Validate date range type
    if (!dateRangeType || !['lastMonth', 'last3Months', 'lastYear', 'custom'].includes(dateRangeType)) {
      throw new ErrorHandler('Valid dateRangeType is required', 400);
    }

    // Date range calculation with proper timezone handling
    let startDate: Date, endDate: Date, prevStartDate: Date, prevEndDate: Date;
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today

    switch (dateRangeType) {
      case 'lastMonth': {
        // Last month: from 1st of last month to end of last month
        endDate = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);
        startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1, 0, 0, 0, 0);

        // Previous period: month before last month
        prevEndDate = new Date(startDate.getTime() - 1);
        prevStartDate = new Date(today.getFullYear(), today.getMonth() - 2, 1, 0, 0, 0, 0);
        break;
      }
      case 'last3Months': {
        // Last 3 months: from 3 months ago to today
        endDate = today;
        startDate = new Date(today.getFullYear(), today.getMonth() - 3, today.getDate(), 0, 0, 0, 0);

        // Previous period: 3 months before that
        const periodDuration = endDate.getTime() - startDate.getTime();
        prevEndDate = new Date(startDate.getTime() - 1);
        prevStartDate = new Date(startDate.getTime() - periodDuration);
        break;
      }
      case 'lastYear': {
        // Last year: from 1 year ago to today
        endDate = today;
        startDate = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate(), 0, 0, 0, 0);

        // Previous period: year before that
        const periodDuration = endDate.getTime() - startDate.getTime();
        prevEndDate = new Date(startDate.getTime() - 1);
        prevStartDate = new Date(startDate.getTime() - periodDuration);
        break;
      }
      case 'custom': {
        if (!fromDate || !toDate) {
          throw new ErrorHandler('Custom date range requires fromDate and toDate', 400);
        }

        // Parse dates and ensure they're in the correct timezone
        startDate = new Date(fromDate);
        startDate.setHours(0, 0, 0, 0);

        endDate = new Date(toDate);
        endDate.setHours(23, 59, 59, 999);

        // Calculate previous period of same duration
        const periodDuration = endDate.getTime() - startDate.getTime();
        prevEndDate = new Date(startDate.getTime() - 1);
        prevStartDate = new Date(startDate.getTime() - periodDuration);
        break;
      }
      default: {
        throw new ErrorHandler('Invalid dateRangeType', 400);
      }
    }

    // Helper to get metrics for a period
    const getMetrics = async (start: Date, end: Date) => {
      const carRepo = AppDataSource.getRepository(CarDetails);
      const requirementRepo = AppDataSource.getRepository(CarRequirement);
      const savedCarRepo = AppDataSource.getRepository(SavedCar);
      const carEnquiryRepo = AppDataSource.getRepository(CarEnquiry);
      const userRepo = AppDataSource.getRepository(UserAuth);

      // Get user details
      const user = await userRepo.findOne({ where: { id: userId } });
      if (!user) {
        throw new ErrorHandler('User not found', 404);
      }

      // Properties/Listings created in the period
      const cars = await carRepo.find({
        where: {
          userId,
          createdAt: Between(start, end),
        },
        relations: ['address'],
      });

      // Get ALL cars owned by user (for sold cars and other calculations)
      const allUserCars = await carRepo.find({
        where: { userId },
        select: ['id', 'title', 'createdAt', 'carPrice', 'isActive', 'isSold', 'updatedAt'],
      });

      // Property Requirements created in the period
      const requirements = await requirementRepo.find({
        where: {
          userId,
          createdAt: Between(start, end),
        },
        relations: ['addressId'],
      });

      // const userCarIds = allUserCars.map((p) => p.id);

      // Property Views (Saved Cars) for user's cars in the period
      const savedCars = await savedCarRepo.find({
        where: {
          ownerId: userId,
          createdAt: Between(start, end),
        },
      });

      // Car Enquiries (Conversions) for user's cars in the period
      const carEnquiries = await carEnquiryRepo.find({
        where: {
          ownerId: userId,
          createdAt: Between(start, end),
        },
      });

      // Calculate metrics
      let totalInventoryValue = 0;
      let soldInventoryValue = 0;
      let totalConversions = 0;
      let dealsClosed = 0;
      let activeListings = 0;

      // Process cars created in the period for inventory
      for (const car of cars) {
        totalInventoryValue += car.carPrice || 0;
      }

      // Process ALL user cars for sold cars and active listings (regardless of creation date)
      for (const car of allUserCars) {
        // Count active listings from all cars
        if (car.isActive && !car.isSold) {
          activeListings++;
        }

        if (car.isSold) {
          // Check if the car was sold in the current period
          // We'll consider a car "sold in period" if it was updated (marked as sold) in the period
          if (car.updatedAt && car.updatedAt >= start && car.updatedAt <= end) {
            soldInventoryValue += car.carPrice || 0;
            dealsClosed++;
          }
        }
      }

      // Calculate total inventory value from ALL active cars (not just created in period)
      const totalInventoryValueFromAllCars = allUserCars
        .filter((car) => car.isActive && !car.isSold)
        .reduce((sum, car) => sum + (car.carPrice || 0), 0);

      // Calculate conversions from car enquiries
      totalConversions = carEnquiries.length;

      // Calculate total views from saved cars
      const totalViews = savedCars.length;

      return {
        carCount: cars.length,
        requirementCount: requirements.length,
        activeListings,
        totalInventoryValue: totalInventoryValueFromAllCars,
        soldInventoryValue,
        totalViews,
        conversionCount: totalConversions,
        dealsClosed,
        userType: user.userType,
        userEmail: user.email,
        userMobile: user.mobileNumber,
      };
    };

    // Get current and previous period metrics
    const [current, previous] = await Promise.all([
      getMetrics(startDate, endDate),
      getMetrics(prevStartDate, prevEndDate),
    ]);

    // Helper for percent change calculation
    const percentChange = (curr: number, prev: number) => {
      if (prev === 0) return curr === 0 ? 0 : 100;
      return Math.round(((curr - prev) / prev) * 100 * 100) / 100; // Round to 2 decimal places
    };

    // Build response
    const result = {
      user: {
        id: userId,
        type: current.userType,
        email: current.userEmail,
        mobile: current.userMobile,
      },
      listings: {
        value: current.carCount,
        percentChange: percentChange(current.carCount, previous.carCount),
        active: current.activeListings,
      },
      requirements: {
        value: current.requirementCount,
        percentChange: percentChange(current.requirementCount, previous.requirementCount),
      },
      inventoryValue: {
        value: current.totalInventoryValue,
        percentChange: percentChange(current.totalInventoryValue, previous.totalInventoryValue),
      },
      soldInventoryValue: {
        value: current.soldInventoryValue,
        percentChange: percentChange(current.soldInventoryValue, previous.soldInventoryValue),
      },
      views: {
        value: current.totalViews,
        percentChange: percentChange(current.totalViews, previous.totalViews),
      },
      conversions: {
        value: current.conversionCount,
        percentChange: percentChange(current.conversionCount, previous.conversionCount),
      },
      dealsClosed: {
        value: current.dealsClosed,
        percentChange: percentChange(current.dealsClosed, previous.dealsClosed),
      },
      period: {
        from: startDate,
        to: endDate,
        type: dateRangeType,
      },
    };

    return res.status(200).json({
      message: 'Analytic cars retrieved successfully',
      result,
    });
  } catch (error: any) {
    console.error('Analytics error:', error);
    return res.status(error.statusCode || 500).json({
      message: error.message || 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
};
