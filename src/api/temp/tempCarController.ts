import { Request, Response } from 'express';

import { Address } from '../entity/Address';
import { CarDetails } from '../entity/CarDetails';
import { CarImages } from '../entity/CarImages';
import { UserAuth } from '../entity/UserAuth';

export class TempCarController {
  // Create temporary car
  static async createTempCar(req: Request, res: Response) {
    try {
      const {
        userId,
        title,
        description,
        category,
        subCategory,
        carPrice,
        addressState,
        addressCity,
        addressLocality,
        carName,
        isSale,
        // workingWithDealer,
        width,
        height,
        length,
        groundHeight,
        unit,
      } = req.body;

      // Verify the user is a temporary user
      const tempUser = await UserAuth.findOne({
        where: { id: userId, accountType: 'temporary' },
      });

      if (!tempUser) {
        return res.status(404).json({ message: 'Temporary user not found' });
      }

      // Create address
      const address = new Address();
      address.state = addressState;
      address.city = addressCity;
      address.locality = addressLocality;
      address.createdBy = 'temp-system';
      address.updatedBy = 'temp-system';
      await address.save();

      // Create car
      const car = new CarDetails();
      car.userId = userId;
      car.address = address;
      car.title = title;
      car.description = description;
      car.category = category;
      car.subCategory = subCategory;
      car.carPrice = carPrice || 0;
      car.carName = carName;
      car.isSale = isSale;
      // car.workingWithDealer = workingWithDealer;
      car.width = width;
      car.height = height;
      car.length = length;
      car.groundHeight = groundHeight;
      car.unit = unit;
      car.isActive = true;
      car.createdBy = 'temp-system';
      car.updatedBy = 'temp-system';
      car.isActive = true;

      // Generate description if not provided
      if (!car.description || car.description.trim() === '') {
        try {
          const generatedContent = await CarTitleAndDescription.generate(car, title);
          car.description = generatedContent.description;
        } catch (descriptionError) {
          console.error('Error generating description:', descriptionError);
          // Fallback to basic description if generation fails
          car.description = `Discover this ${car.subCategory?.toLowerCase() || 'car'} located at ${car.address?.locality || ''}, ${car.address?.city || ''}.`;
        }
      }

      await car.save();

      // Handle image uploads if any
      if (req.files && Array.isArray(req.files)) {
        for (const file of req.files) {
          const carImage = new CarImages();
          carImage.imageKey = file.filename || file.path;
          carImage.carId = car.id;
          carImage.createdBy = 'temp-system';
          carImage.updatedBy = 'temp-system';
          await carImage.save();
        }
      }

      // Handle imageKeys from form data (for pre-uploaded images)
      if (req.body.imageKeys) {
        const imageKeys = Array.isArray(req.body.imageKeys) ? req.body.imageKeys : [req.body.imageKeys];

        for (const imageKey of imageKeys) {
          if (imageKey && imageKey.trim()) {
            const carImage = new CarImages();
            carImage.imageKey = imageKey.trim();
            carImage.carId = car.id;
            carImage.createdBy = 'temp-system';
            carImage.updatedBy = 'temp-system';
            await carImage.save();
          }
        }
      }

      res.status(201).json({
        message: 'Temporary car created successfully',
        car: {
          id: car.id,
          title: car.title,
          category: car.category,
          subCategory: car.subCategory,
          carPrice: car.carPrice,
          userId: car.userId,
        },
      });
    } catch (error) {
      console.error('Error creating temporary car:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Get all cars (real + temporary for visitors, only real for logged users)
  static async getAllCars(req: Request, res: Response) {
    try {
      const { user } = req; // From auth middleware
      const { page = 1, limit = 10, category, subCategory, minPrice, maxPrice, mobileNumber } = req.query;

      if (mobileNumber) {
        const user = await UserAuth.findOne({
          where: { mobileNumber: mobileNumber as string, accountType: 'temporary' },
        });
        if (!user) {
          return res.status(404).json({ message: 'User not found' });
        }
      }
      // Build where conditions for car
      const carWhereConditions: any = {};

      // Apply filters

      if (mobileNumber) {
        carWhereConditions.userId = user?.id;
      }

      if (category) {
        carWhereConditions.category = category;
      }

      if (subCategory) {
        carWhereConditions.subCategory = subCategory;
      }

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
      const allCars = await CarDetails.find({
        where: carWhereConditions,
        relations: ['user', 'address', 'carImages'],
        order: { createdAt: 'DESC' },
      });

      // Filter by user account type
      const filteredAllCars = allCars.filter((car) => {
        if (user) {
          // If user is logged in, show only real cars
          return car.user.accountType === 'real';
        } else {
          // For visitors, show both real and temporary cars
          return ['real', 'temporary'].includes(car.user.accountType);
        }
      });

      // Calculate pagination
      const total = filteredAllCars.length;
      const offset = (Number(page) - 1) * Number(limit);
      const take = Number(limit);

      // Apply pagination to filtered results
      const paginatedCars = filteredAllCars.slice(offset, offset + take);

      res.status(200).json({
        message: 'Cars retrieved successfully',
        cars: paginatedCars.map((prop: any) => ({
          id: prop.id,
          title: prop.title,
          description: prop.description,
          category: prop.category,
          subCategory: prop.subCategory,
          carPrice: prop.carPrice,
          carpetArea: prop.carpetArea,
          totalBathrooms: prop.totalBathrooms,
          totalRooms: prop.totalRooms,
          address: {
            state: prop.address?.state,
            city: prop.address?.city,
            locality: prop.address?.locality,
          },
          images: prop.carImages?.map((img: any) => img.imageKey) || [],
          user: {
            id: prop.user.id,
            fullName: prop.user.fullName,
            userType: prop.user.userType,
            accountType: prop.user.accountType,
          },
          createdAt: prop.createdAt,
        })),
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: total,
          totalPages: Math.ceil(total / Number(limit)),
          hasMore: offset + take < total,
        },
      });
    } catch (error) {
      console.error('Error fetching cars:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Get properties by temporary user
  static async getTempUserCars(req: Request, res: Response) {
    try {
      const { userId } = req.params;

      const cars = await CarDetails.find({
        where: { userId },
        relations: ['user', 'address', 'carImages'],
      });

      res.status(200).json({
        message: 'Temporary user cars retrieved successfully',
        cars: cars.map((prop) => ({
          id: prop.id,
          title: prop.title,
          description: prop.description,
          category: prop.category,
          subCategory: prop.subCategory,
          carPrice: prop.carPrice,
          address: {
            state: prop.address?.state,
            city: prop.address?.city,
            locality: prop.address?.locality,
          },
          images: prop.carImages?.map((img) => img.imageKey) || [],
          createdAt: prop.createdAt,
        })),
      });
    } catch (error) {
      console.error('Error fetching temporary user cars:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Delete temporary car
  static async deleteTempCar(req: Request, res: Response) {
    try {
      const { carId } = req.params;

      const car = await CarDetails.findOne({
        where: { id: carId },
        relations: ['user'],
      });

      if (!car) {
        return res.status(404).json({ message: 'Property not found' });
      }

      if (car.user.accountType !== 'temporary') {
        return res.status(403).json({ message: 'Can only delete temporary cars' });
      }

      // Delete car images
      await CarImages.delete({ carId: car.id });

      // Delete the car
      await CarDetails.delete({ id: car.id });

      res.status(200).json({
        message: 'Temporary car deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting temporary car:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Bulk create temporary cars
  static async bulkCreateTempCars(req: Request, res: Response) {
    try {
      const { cars } = req.body;

      if (!Array.isArray(cars)) {
        return res.status(400).json({ message: 'Cars must be an array' });
      }

      const createdCars = [];

      for (const carData of cars) {
        const { userId, ...carFields } = carData;

        // Verify the user is a temporary user
        const tempUser = await UserAuth.findOne({
          where: { id: userId, accountType: 'temporary' },
        });

        if (!tempUser) {
          continue; // Skip if user not found or not temporary
        }

        // Create address
        const address = new Address();
        address.state = carFields.addressState || 'Temporary State';
        address.city = carFields.addressCity || 'Temporary City';
        address.locality = carFields.addressLocality || 'Temporary Locality';
        address.createdBy = 'temp-system';
        address.updatedBy = 'temp-system';
        await address.save();

        // Create car
        const car = new CarDetails();
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
          try {
            const generatedContent = await CarTitleAndDescription.generate(car, car.title);
            car.description = generatedContent.description;
          } catch (descriptionError) {
            console.error('Error generating description for car:', car.title, descriptionError);
            // Fallback to basic description if generation fails
            car.description = `Discover this ${car.subCategory?.toLowerCase() || 'car'} located at ${car.address?.locality || ''}, ${car.address?.city || ''}.`;
          }
        }

        await car.save();

        createdCars.push({
          id: car.id,
          title: car.title,
          category: car.category,
          subCategory: car.subCategory,
          carPrice: car.carPrice,
        });
      }

      res.status(201).json({
        message: 'Bulk temporary cars created successfully',
        createdCars,
        totalCreated: createdCars.length,
      });
    } catch (error) {
      console.error('Error creating bulk temporary cars:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Generate description for existing car
  static async generateCarDescription(req: Request, res: Response) {
    try {
      const { carId } = req.params;

      const car = await CarDetails.findOne({
        where: { id: carId },
        relations: ['address', 'user'],
      });

      if (!car) {
        return res.status(404).json({ message: 'Car not found' });
      }

      // Verify the user is a temporary user
      if (car.user.accountType !== 'temporary') {
        return res.status(403).json({ message: 'Can only generate descriptions for temporary cars' });
      }

      try {
        const generatedContent = await CarTitleAndDescription.generate(car, car.title);

        // Update the car with the generated description
        car.description = generatedContent.description;
        car.updatedBy = 'temp-system';
        await car.save();

        res.status(200).json({
          message: 'Car description generated successfully',
          car: {
            id: car.id,
            title: car.title,
            description: car.description,
            category: car.category,
            subCategory: car.subCategory,
          },
        });
      } catch (generationError) {
        console.error('Error generating description:', generationError);
        res.status(500).json({
          message: 'Failed to generate description',
          error: 'Description generation service unavailable',
        });
      }
    } catch (error) {
      console.error('Error generating car description:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
}
