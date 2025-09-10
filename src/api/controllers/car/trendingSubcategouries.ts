import { Request, Response } from 'express';
import { Between } from 'typeorm';

import { CarDetails } from '@/api/entity/CarDetails';
import { CarEnquiry } from '@/api/entity/CarEnquiry';
import { AppDataSource } from '@/server';

const VALID_SUBCATEGORIES = ['New', 'Used', 'Brand', 'Model', 'Car Types'] as const;

// Required subcategories that must always be present
const REQUIRED_SUBCATEGORIES: SubCategoryType[] = ['New', 'Used', 'Car Types'];

type SubCategoryType = (typeof VALID_SUBCATEGORIES)[number];

interface TrendingSubCategoriesRequest {
  city?: string;
  limit?: number;
}

interface TrendingSubCategoryResponse {
  subCategory: SubCategoryType;
  enquiryCount: number;
  totalProperties: number;
  averageEnquiriesPerProperty: number;
  percentageGrowth?: number;
  lastWeekEnquiryCount?: number;
}

export const getTrendingSubCategories = async (req: Request, res: Response) => {
  try {
    const { city, limit = 5 }: TrendingSubCategoriesRequest = req.body;

    const sanitizedLimit = Math.min(10, Math.max(1, Number(limit) || 5));

    const currentDate = new Date();
    const endDate = currentDate;
    const startDate = new Date(currentDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format',
      });
    }

    if (startDate > endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date cannot be after end date',
      });
    }

    const carEnquiryRepo = AppDataSource.getRepository(CarEnquiry);
    const carRepo = AppDataSource.getRepository(CarDetails);

    const enquiryWhereConditions: any = {
      createdAt: Between(startDate, endDate),
    };

    const enquiries = await carEnquiryRepo.find({
      where: enquiryWhereConditions,
      relations: ['car'],
    });

    const validEnquiries = enquiries.filter((enquiry) => {
      if (!enquiry.carDetails || !VALID_SUBCATEGORIES.includes(enquiry.carDetails.subCategory as SubCategoryType)) {
        return false;
      }

      if (city && enquiry.carDetails.address) {
        const carCity = enquiry.carDetails.address.city?.toLowerCase();
        const searchCity = city.toLowerCase();
        if (carCity && !carCity.includes(searchCity) && !searchCity.includes(carCity)) {
          return false;
        }
      }

      return true;
    });

    const subcategoryStats = new Map<
      SubCategoryType,
      {
        enquiryCount: number;
        propertyIds: Set<string>;
        enquiries: CarEnquiry[];
      }
    >();

    validEnquiries.forEach((enquiry: CarEnquiry) => {
      const subCategory = enquiry.carDetails.subCategory as SubCategoryType;

      if (!subcategoryStats.has(subCategory)) {
        subcategoryStats.set(subCategory, {
          enquiryCount: 0,
          propertyIds: new Set(),
          enquiries: [],
        });
      }

      const stats = subcategoryStats.get(subCategory)!;
      stats.enquiryCount++;
      stats.propertyIds.add(enquiry.carId);
      stats.enquiries.push(enquiry);
    });

    const activePropertiesBySubcategory = new Map<SubCategoryType, number>();

    for (const subCategory of VALID_SUBCATEGORIES) {
      const whereCondition: any = {
        subCategory: subCategory,
        isActive: true,
      };

      if (city) {
        whereCondition.address = {
          city: city,
        };
      }

      const activeProperties = await carRepo.count({
        where: whereCondition,
        relations: city ? ['address'] : [],
      });

      activePropertiesBySubcategory.set(subCategory, activeProperties);
    }

    const trendingSubCategories: TrendingSubCategoryResponse[] = [];

    // Process subcategories with actual data
    for (const [subCategory, stats] of subcategoryStats) {
      const activePropertiesCount = activePropertiesBySubcategory.get(subCategory) || 0;

      const totalProperties = stats.propertyIds.size;
      const averageEnquiriesPerProperty = totalProperties > 0 ? stats.enquiryCount / totalProperties : 0;

      const previousPeriodStart = new Date(startDate.getTime() - (endDate.getTime() - startDate.getTime()));
      const previousPeriodEnd = startDate;

      const previousPeriodEnquiries = await carEnquiryRepo.find({
        where: {
          createdAt: Between(previousPeriodStart, previousPeriodEnd),
          carDetails: {
            subCategory: subCategory,
          },
        },
        relations: ['car'],
      });

      const previousPeriodCount = previousPeriodEnquiries.length;
      const percentageGrowth =
        previousPeriodCount > 0
          ? ((stats.enquiryCount - previousPeriodCount) / previousPeriodCount) * 100
          : stats.enquiryCount > 0
            ? 100
            : 0;

      trendingSubCategories.push({
        subCategory,
        enquiryCount: stats.enquiryCount,
        totalProperties: activePropertiesCount,
        averageEnquiriesPerProperty: Math.round(averageEnquiriesPerProperty * 100) / 100,
        percentageGrowth: Math.round(percentageGrowth * 100) / 100,
        lastWeekEnquiryCount: previousPeriodCount,
      });
    }

    // Ensure required subcategories are always present with default values
    for (const requiredSubCategory of REQUIRED_SUBCATEGORIES) {
      const existingEntry = trendingSubCategories.find((item) => item.subCategory === requiredSubCategory);

      if (!existingEntry) {
        const activePropertiesCount = activePropertiesBySubcategory.get(requiredSubCategory) || 0;

        trendingSubCategories.push({
          subCategory: requiredSubCategory,
          enquiryCount: 0,
          totalProperties: activePropertiesCount,
          averageEnquiriesPerProperty: 0,
          percentageGrowth: 0,
          lastWeekEnquiryCount: 0,
        });
      }
    }

    // Sort by enquiry count and ensure we have at least the required subcategories
    const sortedSubCategories = trendingSubCategories.sort((a, b) => b.enquiryCount - a.enquiryCount);

    // Ensure required subcategories are always in the top results
    const requiredSubCategoriesInTop = sortedSubCategories.filter((item) =>
      REQUIRED_SUBCATEGORIES.includes(item.subCategory)
    );

    const otherSubCategories = sortedSubCategories.filter((item) => !REQUIRED_SUBCATEGORIES.includes(item.subCategory));

    // Combine required subcategories with other top subcategories
    const topTrendingSubCategories = [
      ...requiredSubCategoriesInTop,
      ...otherSubCategories.slice(0, sanitizedLimit - requiredSubCategoriesInTop.length),
    ].slice(0, sanitizedLimit);

    // Ensure we always have at least the required subcategories
    if (topTrendingSubCategories.length === 0) {
      for (const requiredSubCategory of REQUIRED_SUBCATEGORIES) {
        const activePropertiesCount = activePropertiesBySubcategory.get(requiredSubCategory) || 0;

        topTrendingSubCategories.push({
          subCategory: requiredSubCategory,
          enquiryCount: 0,
          totalProperties: activePropertiesCount,
          averageEnquiriesPerProperty: 0,
          percentageGrowth: 0,
          lastWeekEnquiryCount: 0,
        });
      }
    }

    const totalEnquiries = validEnquiries.length;
    const totalPropertiesInvolved = new Set(validEnquiries.map((e: CarEnquiry) => e.carId)).size;

    return res.status(200).json({
      success: true,
      message: 'Trending subcategories retrieved successfully',
      data: {
        trendingSubCategories: topTrendingSubCategories,
        summary: {
          totalEnquiries,
          totalPropertiesInvolved,
          dateRange: {
            from: startDate.toISOString(),
            to: endDate.toISOString(),
          },
          periodInDays: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
        },
      },
    });
  } catch (error) {
    console.error('Error in getTrendingSubCategories:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error:
        process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : undefined,
    });
  }
};

export const getSubCategoryTrendingDetails = async (req: Request, res: Response) => {
  try {
    const { subCategory, fromDate, toDate } = req.body;

    if (!subCategory || !VALID_SUBCATEGORIES.includes(subCategory as SubCategoryType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid subcategory. Must be one of: ${VALID_SUBCATEGORIES.join(', ')}`,
      });
    }

    const currentDate = new Date();
    const endDate = toDate ? new Date(toDate) : currentDate;
    const startDate = fromDate ? new Date(fromDate) : new Date(currentDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format',
      });
    }

    const carEnquiryRepo = AppDataSource.getRepository(CarEnquiry);
    const carRepo = AppDataSource.getRepository(CarDetails);

    const enquiries = await carEnquiryRepo.find({
      where: {
        createdAt: Between(startDate, endDate),
        carDetails: {
          subCategory: subCategory,
        },
      },
      relations: ['car'],
    });

    const properties = await carRepo.find({
      where: {
        subCategory: subCategory,
        isActive: true,
      },
    });

    const dailyTrends = new Map<string, number>();
    enquiries.forEach((enquiry: CarEnquiry) => {
      const dateKey = enquiry.createdAt.toISOString().split('T')[0];
      dailyTrends.set(dateKey, (dailyTrends.get(dateKey) || 0) + 1);
    });

    const trendingDetails = {
      subCategory: subCategory as SubCategoryType,
      totalEnquiries: enquiries.length,
      totalProperties: properties.length,
      averageEnquiriesPerProperty: properties.length > 0 ? enquiries.length / properties.length : 0,
      dailyTrends: Array.from(dailyTrends.entries())
        .map(([date, count]) => ({
          date,
          enquiryCount: count,
        }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      dateRange: {
        from: startDate.toISOString(),
        to: endDate.toISOString(),
      },
    };

    return res.status(200).json({
      success: true,
      message: 'Subcategory trending details retrieved successfully',
      data: trendingDetails,
    });
  } catch (error) {
    console.error('Error in getSubCategoryTrendingDetails:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error:
        process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : undefined,
    });
  }
};
