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
      car.carPrice = Number(carPrice) || 0;
      car.carName = carName;
      car.brand = brand || '';
      car.model = model || '';
      car.variant = variant || '';
      car.fuelType = fuelType || 'Petrol';
      car.transmission = transmission || 'Manual';
      car.bodyType = bodyType || '';
      car.ownership = ownership || '1st';
      car.manufacturingYear = Number(manufacturingYear) || new Date().getFullYear();
      car.registrationYear = Number(registrationYear) || new Date().getFullYear();
      car.kmDriven = Number(kmDriven) || 0;
      car.seats = Number(seats) || 4;
      car.isSale = isSale || 'Sell';
      car.isActive = true;
      car.createdBy = 'temp-system';
      car.updatedBy = 'temp-system';
      car.isActive = true;

      // Generate description if not provided
      if (!car.description || car.description.trim() === '') {
        // Fallback to basic description if generation fails
        car.description = `Discover this ${car.model?.toLowerCase() || 'car'} located at ${car.address?.locality || ''}, ${car.address?.city || ''}.`;
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

      // Reload the car with relations to get the images
      const carWithImages = await CarDetails.findOne({
        where: { id: car.id },
        relations: ['carImages', 'address']
      });

      res.status(201).json({
        message: 'Temporary car created successfully',
        car: {
          id: carWithImages?.id,
          title: carWithImages?.title,
          description: carWithImages?.description,
          carName: carWithImages?.carName,
          brand: carWithImages?.brand,
          model: carWithImages?.model,
          variant: carWithImages?.variant,
          fuelType: carWithImages?.fuelType,
          transmission: carWithImages?.transmission,
          bodyType: carWithImages?.bodyType,
          ownership: carWithImages?.ownership,
          manufacturingYear: carWithImages?.manufacturingYear,
          registrationYear: carWithImages?.registrationYear,
          kmDriven: carWithImages?.kmDriven,
          seats: carWithImages?.seats,
          isSale: carWithImages?.isSale,
          carPrice: carWithImages?.carPrice,
          isActive: carWithImages?.isActive,
          userId: carWithImages?.userId,
          address: {
            state: carWithImages?.address?.state,
            city: carWithImages?.address?.city,
            locality: carWithImages?.address?.locality,
          },
          carImages: carWithImages?.carImages?.map((img) => ({
            id: img.id,
            imageKey: img.imageKey,
            imgClassifications: img.imgClassifications,
            accurencyPercent: img.accurencyPercent
          })) || []
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
      const { page = 1, limit = 10, minPrice, maxPrice, mobileNumber, brand, model, fuelType, transmission, bodyType, ownership } = req.query;

      let mobileUser: UserAuth | null = null;
      if (mobileNumber) {
        mobileUser = await UserAuth.findOne({
          where: { mobileNumber: mobileNumber as string, accountType: 'temporary' },
        });
        if (!mobileUser) {
          return res.status(404).json({ message: 'User not found' });
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
      const allCars = await CarDetails.find({
        where: carWhereConditions,
        relations: ['user', 'address', 'carImages'],
        order: { createdAt: 'DESC' },
      });

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
      const offset = (Number(page) - 1) * Number(limit);
      const take = Number(limit);

      // Apply pagination to filtered results
      const paginatedCars = filteredAllCars.slice(offset, offset + take);

      res.status(200).json({
        message: 'Cars retrieved successfully',
        cars: paginatedCars.map((car: any) => ({
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
          carImages: (car.carImages || []).map((img: any) => ({ id: img.id, imageKey: img.imageKey })),
          images: (car.carImages || []).map((img: any) => img.imageKey),
          user: car.user
            ? {
                id: car.user.id,
                fullName: car.user.fullName,
                userType: car.user.userType,
                accountType: car.user.accountType,
              }
            : null,
          createdAt: car.createdAt,
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

  // Get cars by temporary user
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
          carName: prop.carName,
          brand: prop.brand,
          model: prop.model,
          variant: prop.variant,
          fuelType: prop.fuelType,
          transmission: prop.transmission,
          bodyType: prop.bodyType,
          ownership: prop.ownership,
          manufacturingYear: prop.manufacturingYear,
          registrationYear: prop.registrationYear,
          kmDriven: prop.kmDriven,
          seats: prop.seats,
          isSale: prop.isSale,
          carPrice: prop.carPrice,
          isActive: prop.isActive,
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
      
      console.log('carId:', carId);

      const car = await CarDetails.findOne({
        where: { id: carId },
        relations: ['user'],
      });

      if (!car) {
        return res.status(404).json({ message: 'Property not found' });
      }

      if (car.user && car.user.accountType !== 'temporary') {
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
          }

        await car.save();

        createdCars.push({
          id: car.id,
          title: car.title,
        
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
      if (car.user && car.user.accountType !== 'temporary') {
        return res.status(403).json({ message: 'Can only generate descriptions for temporary cars' });
      }

      // Generate basic description
     car.updatedBy = 'temp-system';
     const createdCars =  await car.save();

      res.status(200).json({
        message: 'Car description generated successfully',
     createdCars    ,
      });
    } catch (error) {
      console.error('Error generating car description:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
}
