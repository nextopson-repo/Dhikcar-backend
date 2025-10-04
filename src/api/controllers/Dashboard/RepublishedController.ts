import { Request, Response } from 'express';

import { CarDetails } from '@/api/entity/CarDetails';
import { CarEnquiry } from '@/api/entity/CarEnquiry';
import { CarImages } from '@/api/entity/CarImages';
import { NotificationType } from '@/api/entity/Notifications';
import { RepublishCarDetails } from '@/api/entity/RepublishCars';
import { UserAuth } from '@/api/entity/UserAuth';
import { delayedEmailService } from '@/common/utils/delayedEmailService';
import { AppDataSource } from '@/server';

import { bundleNotification } from '../notification/NotificationController';

// Controller: Create Republisher
export const createRepublisher = async (req: Request, res: Response) => {
  const { userId: republisherId, carId } = req.body;

  try {
    if (!republisherId || !carId) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required: republisherId, carId',
      });
    }

    const carRepo = AppDataSource.getRepository(CarDetails);
    const userRepo = AppDataSource.getRepository(UserAuth);
    const republisherRepo = AppDataSource.getRepository(RepublishCarDetails);

    // Check if car exists
    const car = await carRepo.findOne({ where: { id: carId } });
    if (!car) {
      return res.status(400).json({
        success: false,
        message: 'Invalid carId — car does not exist',
      });
    }

    // Check if republisher exists
    const republisher = await userRepo.findOne({ where: { id: republisherId } });
    if (!republisher) {
      return res.status(400).json({
        success: false,
        message: 'Invalid republisherId — republisher does not exist',
      });
    }

    // Check if republish request already exists
    const existingRequest = await republisherRepo.findOne({
      where: { carId, republisherId },
    });

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: 'A republish request already exists for this car',
      });
    }

    const newRepublisher = republisherRepo.create({
      republisherId,
      ownerId: car.userId,
      carId,
      status: 'Pending',
    });

    const owner = await userRepo.findOne({ where: { id: car.userId } });

    const saved = await republisherRepo.save(newRepublisher);

    if (car && republisher) {
      await bundleNotification([
        {
          userId: car.userId,
          message: `Your car ${car.carName} has received a republish request from ${republisher.fullName}`,
          imageKey: car.carImages?.[0]?.imageKey,
          type: NotificationType.REPUBLISH,
          user: republisher.fullName,
          button: 'Approve',
          car: {
            title: car.title || car.carName || '',
            price: car.carPrice ? `₹${car.carPrice}` : '',
            location: car.address?.locality || '',
            image: car.carImages?.[0]?.imageKey || '',
          },
          status: 'Pending',
          actionId: car.id, // For navigation to CarDetails screen
        },
      ]);
    }

    // Add to bundled email for owner notification
    if (owner?.email) {
      delayedEmailService.addToBundledEmail(
        owner.email,
        {
          type: 'republish_create',
          carId: car.id,
          carName: car.carName || car.title || 'Car',
          carPrice: car.carPrice,
          carLocation: car.address?.locality || car.address?.city || '',
          carImage: car.carImages?.[0]?.imageKey || '',
          republisherName: republisher.fullName,
          timestamp: new Date(),
          republishId: saved.id,
        },
        30 // 30 minutes delay
      );
    }

    return res.status(201).json({
      success: true,
      message: 'Republish request created successfully',
      republisher: saved,
    });
  } catch (error) {
    console.error('Error in createRepublisher:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: errorMessage,
    });
  }
};

// get Republish Request list
export const republishRequest = async (req: Request, res: Response) => {
  const { ownerId, page = 1, limit = 10, status = 'Pending' } = req.body;
  const skip = (Number(page) - 1) * Number(limit);

  try {
    if (!ownerId) {
      return res.status(400).json({
        success: false,
        message: 'ownerId is required',
      });
    }

    const republisherRepo = AppDataSource.getRepository(RepublishCarDetails);
    const carRepo = AppDataSource.getRepository(CarDetails);
    const userRepo = AppDataSource.getRepository(UserAuth);

    // Create where condition with status filter
    const whereCondition = {
      ownerId,
      status: status,
    };

    const [republishRequests, total] = await Promise.all([
      republisherRepo.find({
        where: whereCondition,
        skip,
        take: Number(limit),
        order: { createdAt: 'DESC' },
      }),
      republisherRepo.count({ where: whereCondition }),
    ]);

    if (!republishRequests.length) {
      return res.status(200).json({
        success: true,
        message: 'No republish requests found',
        requests: [],
        total: 0,
        currentPage: Number(page),
        totalPages: 0,
      });
    }

    const requestsWithDetails = await Promise.all(
      republishRequests.map(async (republisher) => {
        const [requester, car] = await Promise.all([
          userRepo.findOne({
            where: { id: republisher.republisherId },
            select: ['id', 'fullName', 'email', 'mobileNumber', 'userProfileUrl'],
          }),
          carRepo.findOne({
            where: { id: republisher.carId },
            relations: ['address', 'carImages'],
          }),
        ]);

        return {
          id: republisher.id,
          status: republisher.status,
          requester: {
            id: requester?.id,
            name: requester?.fullName,
            email: requester?.email,
            mobileNumber: requester?.mobileNumber,
            requestTimeStamp: republisher.createdAt,
            profileImage: requester?.userProfileUrl,
          },
          car: {
            id: car?.id,
            name: car?.title || car?.carName,
            price: car?.carPrice,
            location: car?.address?.locality,
            images: car?.carImages?.map((img: any) => img.imageKey),
            isSale: car?.isSale,
            address: car?.address,
            category: car?.category,
            // subCategory: car?.subCategory,
          },
        };
      })
    );

    const totalPages = Math.ceil(total / Number(limit));

    return res.status(200).json({
      success: true,
      message: 'Republish requests found',
      requests: requestsWithDetails,
      total,
      currentPage: Number(page),
      totalPages,
      hasMore: skip + republishRequests.length < total,
    });
  } catch (error) {
    console.error('Error in republishRequest:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ success: false, message: 'Server error', error: errorMessage });
  }
};

// Status Update
export const statusUpdate = async (req: Request, res: Response) => {
  const { carId, status, ownerId } = req.body;

  try {
    // Log incoming request for debugging
    console.log('Status update request:', { carId, status, ownerId });

    // Validate required fields
    if (!carId || !status || !ownerId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: carId, status, and ownerId are required',
      });
    }

    // Validate status value
    if (!['Accepted', 'Rejected', 'Pending', 'Success'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be one of: Accepted, Rejected, Pending, Success',
      });
    }

    const republisherRepo = AppDataSource.getRepository(RepublishCarDetails);
    const carRepo = AppDataSource.getRepository(CarDetails);
    const userRepo = AppDataSource.getRepository(UserAuth);

    // Check if owner exists
    const owner = await userRepo.findOne({ where: { id: ownerId } });
    if (!owner) {
      return res.status(404).json({
        success: false,
        message: 'Owner not found',
      });
    }

    // First check if car exists
    const car = await carRepo.findOne({
      where: { id: carId },
    });

    if (!car) {
      return res.status(404).json({
        success: false,
        message: 'Car not found',
      });
    }

    // Find the republish request - allow updating any status, not just Pending
    const republisher = await republisherRepo.findOne({
      where: {
        carId: carId,
        ownerId: ownerId,
      },
    });

    console.log('Found republish request:', republisher);

    if (!republisher) {
      return res.status(404).json({
        success: false,
        message: 'No republish request found for this car and owner',
      });
    }

    // Get republisher details for email notification
    const republisherUser = await userRepo.findOne({ where: { id: republisher.republisherId } });

    // Update status
    republisher.status = status;
    const updated = await republisherRepo.save(republisher);

    // Get updated car details with relations
    const updatedCar = await carRepo.findOne({
      where: { id: updated.carId },
      relations: ['address', 'carImages'],
    });

    // Send bundled email notification to republisher about status update
    if (republisherUser?.email) {
      const emailType =
        status === 'Accepted' ? 'republish_approve' : status === 'Rejected' ? 'republish_reject' : 'republish_update';

      delayedEmailService.addToBundledEmail(
        republisherUser.email,
        {
          type: emailType,
          carId: car.id,
          carName: car.carName || car.title || 'Car',
          carPrice: car.carPrice,
          carLocation: car.address?.locality || car.address?.city || '',
          carImage: car.carImages?.[0]?.imageKey || '',
          ownerName: owner.fullName,
          timestamp: new Date(),
          republishId: republisher.id,
        },
        30 // 30 minutes delay
      );
    }

    return res.status(200).json({
      success: true,
      message: `Status updated to ${status} successfully`,
      republisher: updated,
      car: updatedCar,
    });
  } catch (error) {
    console.error('Error in statusUpdate:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: errorMessage,
    });
  }
};

export const CarRepublisherList = async (req: Request, res: Response) => {
  const { carId } = req.body;

  try {
    if (!carId) {
      return res.status(400).json({
        success: false,
        message: 'carId is required',
      });
    }

    const carRepo = AppDataSource.getRepository(CarDetails);
    const republisherRepo = AppDataSource.getRepository(RepublishCarDetails);
    const userRepo = AppDataSource.getRepository(UserAuth);
    const carImagesRepo = AppDataSource.getRepository(CarImages);

    const [car, republishers] = await Promise.all([
      carRepo.findOne({
        where: { id: carId },
        relations: ['address', 'carImages'],
      }),
      republisherRepo.find({
        where: { carId },
        order: { createdAt: 'DESC' },
      }),
    ]);

    if (!car) {
      return res.status(404).json({ success: false, message: 'Car not found' });
    }

    const republishersWithDetails = await Promise.all(
      republishers.map(async (republisher) => {
        const requester = await userRepo.findOne({
          where: { id: republisher.republisherId },
          select: ['id', 'fullName', 'email', 'mobileNumber'],
        });

        return {
          id: republisher.id,
          status: republisher.status,
          requester: {
            id: requester?.id,
            name: requester?.fullName,
            email: requester?.email,
            mobileNumber: requester?.mobileNumber,
          },
          createdAt: republisher.createdAt,
        };
      })
    );

    const images = await carImagesRepo.find({
      where: { carId },
    });

    return res.status(200).json({
      success: true,
      message: 'Car republisher list retrieved successfully',
      car,
      images,
      republishers: republishersWithDetails,
    });
  } catch (error) {
    console.error('Error in CarRepublisherList:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ success: false, message: 'Server error', error: errorMessage });
  }
};

// Get user republished properties
export const getUserRepublishedCars = async (req: Request, res: Response) => {
  const { page = 1, limit = 10, userId } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  try {
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required',
      });
    }

    const republisherRepo = AppDataSource.getRepository(RepublishCarDetails);
    const carRepo = AppDataSource.getRepository(CarDetails);
    const userRepo = AppDataSource.getRepository(UserAuth);
    const enquiryRepo = AppDataSource.getRepository(CarEnquiry);

    const [republishRequests, total] = await Promise.all([
      republisherRepo.find({
        where: { ownerId: userId as string },
        skip,
        take: Number(limit),
        order: { createdAt: 'DESC' },
      }),
      republisherRepo.count({ where: { republisherId: userId as string, status: 'Accepted' } }),
    ]);

    if (!republishRequests.length) {
      return res.status(200).json({
        success: true,
        message: 'No republish requests found',
        requests: [],
        total: 0,
        currentPage: Number(page),
        totalPages: 0,
      });
    }

    const requestsWithDetails = await Promise.all(
      republishRequests.map(async (request) => {
        const [car, requester, enquiries] = await Promise.all([
          carRepo.findOne({
            where: { id: request.carId },
            relations: ['address', 'carImages'],
          }),
          userRepo.findOne({
            where: { id: request.republisherId },
            select: ['id', 'fullName', 'email', 'mobileNumber'],
          }),
          enquiryRepo.find({
            where: { carId: request.carId },
          }),
        ]);

        const getTimeAgo = (date: Date) => {
          const now = new Date();
          const diffTime = Math.abs(now.getTime() - date.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          if (diffDays === 1) return '1 day ago';
          if (diffDays < 7) return `${diffDays} days ago`;
          if (diffDays < 14) return '1 week ago';
          if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
          if (diffDays < 60) return '1 month ago';
          return `${Math.ceil(diffDays / 30)} months ago`;
        };

        const formatPrice = (price: number) => {
          if (price >= 10000000) {
            return `₹ ${(price / 10000000).toFixed(1)} Cr`;
          } else if (price >= 100000) {
            return `₹ ${(price / 100000).toFixed(1)} L`;
          } else if (price >= 1000) {
            return `₹ ${(price / 1000).toFixed(1)} K`;
          }
          return `₹ ${price}`;
        };

        return {
          id: request.id,
          status: request.status,
          timeAgo: getTimeAgo(request.createdAt),
          requester: {
            id: requester?.id,
            name: requester?.fullName || 'Unknown User',
            email: requester?.email,
            mobileNumber: requester?.mobileNumber,
            message: `${requester?.fullName || 'Someone'} has requested to republish this car.`,
          },
          car: {
            id: car?.id,
            name: car?.carName || 'Unnamed Car',
            category: car?.category,
            // subCategory: car?.subCategory,
            price: car?.carPrice ? formatPrice(car.carPrice) : 'Price not available',
            location: car?.address ? `${car.address.locality}, ${car.address.city}` : 'Location not available',
            address: car?.address,
            images: car?.carImages || [],
            primaryImage: car?.carImages?.[0]?.imageKey || null,
            isSale: car?.isSale,
          },
          enquiries: {
            viewProperty: enquiries.length,
            calling: enquiries.filter((enquiry) => enquiry.calling).length,
          },
          createdAt: request.createdAt,
          updatedAt: request.updatedAt,
        };
      })
    );

    const totalPages = Math.ceil(total / Number(limit));

    return res.status(200).json({
      success: true,
      message: 'Republish requests retrieved successfully',
      requests: requestsWithDetails,
      total,
      currentPage: Number(page),
      totalPages,
      hasMore: skip + republishRequests.length < total,
    });
  } catch (error) {
    console.error('Error in getUserRepublishedCars:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: errorMessage,
    });
  }
};

// get Car list user republished
export const getCarListUserRepublished = async (req: Request, res: Response) => {
  const { userId } = req.body;
  const { page = 1, limit = 10 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  try {
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required',
      });
    }

    const republisherRepo = AppDataSource.getRepository(RepublishCarDetails);
    const carRepo = AppDataSource.getRepository(CarDetails);
    const enquiryRepo = AppDataSource.getRepository(CarEnquiry);

    const [republishRequests, total] = await Promise.all([
      republisherRepo.find({
        where: { republisherId: userId },
        skip,
        take: Number(limit),
        order: { createdAt: 'DESC' },
      }),
      republisherRepo.count({ where: { republisherId: userId as string } }),
    ]);

    if (!republishRequests.length) {
      return res.status(200).json({
        success: true,
        message: 'No republish requests found',
        requests: [],
        total: total,
        currentPage: Number(page),
        totalPages: 0,
      });
    }

    // Helper functions
    const formatPrice = (price: number) => {
      if (price >= 1e7) return `${(price / 1e7).toFixed(1)} Cr`;
      if (price >= 1e5) return `${(price / 1e5).toFixed(1)} L`;
      if (price >= 1e3) return `${(price / 1e3).toFixed(1)} K`;
      return price?.toString() || '';
    };

    // const formatArea = (area: number) => {
    //   if (area >= 1e6) return `${(area / 1e6).toFixed(1)} M`;
    //   if (area >= 1e3) return `${(area / 1e3).toFixed(1)} K`;
    //   return area?.toString() || '';
    // };

    const getTimeAgo = (date: Date) => {
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - date.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays === 1) return '1 day ago';
      if (diffDays < 7) return `${diffDays} days ago`;
      if (diffDays < 14) return '1 week ago';
      if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
      if (diffDays < 60) return '1 month ago';
      return `${Math.ceil(diffDays / 30)} months ago`;
    };

    const requestsWithDetails = await Promise.all(
      republishRequests.map(async (request) => {
        // const [car, enquiries] = await Promise.all([
        const [car] = await Promise.all([
          carRepo.findOne({
            where: { id: request.carId },
            relations: ['address', 'carImages'],
          }),
          enquiryRepo.find({
            where: { carId: request.carId },
          }),
        ]);

        return {
          id: request.id,
          status: request.status,
          timeAgo: getTimeAgo(request.createdAt),
          car: {
            id: car?.id,
            name: car?.title || car?.carName || 'Unnamed Car',
            category: car?.category,
            // subCategory: car?.subCategory,
            price: car?.carPrice ? formatPrice(car.carPrice) : 'Price not available',
            location: car?.address ? `${car.address.locality}, ${car.address.city}` : 'Location not available',
            address: car?.address,
            images: car?.carImages || [],
            primaryImage: car?.carImages?.[0]?.imageKey || null,
            isSale: car?.isSale,
          },
          // enquiries: {
          //   viewProperty: enquiries.length,
          //   calling: enquiries.filter((enquiry) => enquiry.calling).length,
          // },
          createdAt: request.createdAt,
          updatedAt: request.updatedAt,
        };
      })
    );

    const totalPages = Math.ceil(total / Number(limit));

    return res.status(200).json({
      success: true,
      message: 'Car list user republished retrieved successfully',
      requests: requestsWithDetails,
      total,
      currentPage: Number(page),
      totalPages,
      hasMore: skip + republishRequests.length < total,
    });
  } catch (error) {
    console.error('Error in getCarListUserRepublished:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: errorMessage,
    });
  }
};

//  remove from republished
export const removeFromRepublished = async (req: Request, res: Response) => {
  const { republishId } = req.body;

  try {
    if (!republishId) {
      return res.status(400).json({
        success: false,
        message: 'republishId is required',
      });
    }

    const republisherRepo = AppDataSource.getRepository(RepublishCarDetails);
    const republisher = await republisherRepo.findOne({ where: { id: republishId } });

    if (!republisher) {
      return res.status(404).json({
        success: false,
        message: 'Republish request not found',
      });
    }

    await republisherRepo.delete(republisher.id);

    return res.status(200).json({
      success: true,
      message: 'Republish request removed successfully',
    });
  } catch (error) {
    console.error('Error in removeFromRepublished:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: errorMessage,
    });
  }
};

// requiest owner mark as sold
export const requestOwnerMarkAsSold = async (req: Request, res: Response) => {
  const { republishId } = req.body;

  try {
    if (!republishId) {
      return res.status(400).json({
        success: false,
        message: 'republishId is required',
      });
    }

    const republisherRepo = AppDataSource.getRepository(RepublishCarDetails);
    const carRepo = AppDataSource.getRepository(CarDetails);
    const userRepo = AppDataSource.getRepository(UserAuth);

    const republishCar = await republisherRepo.findOne({
      where: { id: republishId },
      relations: ['car'],
    });

    if (!republishCar) {
      return res.status(404).json({
        success: false,
        message: 'Republish request not found',
      });
    }

    // Check if republisher has already made 3 mark as sold requests
    if (republishCar.markAsSoldRequests >= 3) {
      return res.status(400).json({
        success: false,
        message: 'Maximum limit of 3 mark as sold requests reached for this car',
      });
    }

    const car = await carRepo.findOne({
      where: { id: republishCar.carId },
      relations: ['address', 'carImages'],
    });

    if (!car) {
      return res.status(404).json({
        success: false,
        message: 'Car not found',
      });
    }

    const owner = await userRepo.findOne({ where: { id: car.userId } });
    const republisher = await userRepo.findOne({ where: { id: republishCar.republisherId } });

    if (!owner || !republisher) {
      return res.status(404).json({
        success: false,
        message: 'Owner or republisher not found',
      });
    }

    // Increment mark as sold requests count
    republishCar.markAsSoldRequests += 1;
    await republisherRepo.save(republishCar);

    // Add to bundled email for owner notification about mark as sold request
    if (owner?.email) {
      delayedEmailService.addToBundledEmail(
        owner.email,
        {
          type: 'republish_update',
          carId: car.id,
          carName: car.carName || car.title || 'Car',
          carPrice: car.carPrice,
          carLocation: car.address?.locality || car.address?.city || '',
          carImage: car.carImages?.[0]?.imageKey || '',
          republisherName: republisher.fullName,
          timestamp: new Date(),
          republishId: republishCar.id,
        },
        30 // 30 minutes delay
      );
    }

    // Send mobile notification
    if (owner.id) {
      await bundleNotification([
        {
          userId: owner.id,
          message: `${republisher.fullName} has requested to mark your car ${car.carName || car.title} as sold.`,
          imageKey: car.carImages?.[0]?.imageKey || '',
          type: NotificationType.REPUBLISH,
          user: republisher.fullName,
          button: 'Review Request',
          car: {
            title: car.carName || car.title || '',
            price: car.carPrice ? `₹${car.carPrice.toLocaleString()}` : '',
            location: car.address?.locality || '',
            image: car.carImages?.[0]?.imageKey || '',
          },
          status: 'Pending',
          actionId: car.id, // For navigation to CarDetails screen
        },
      ]);
    }

    return res.status(200).json({
      success: true,
      message: 'Mark as sold request sent successfully to car owner',
      requestCount: republishCar.markAsSoldRequests,
      remainingRequests: 3 - republishCar.markAsSoldRequests,
    });
  } catch (error) {
    console.error('Error in requestOwnerMarkAsSold:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: errorMessage,
    });
  }
};

//  conform republish request to sold true or false
export const conformRepublishRequest = async (req: Request, res: Response) => {
  const { carId, isSold, ownerId } = req.body;

  try {
    if (!carId || !ownerId) {
      return res.status(400).json({
        success: false,
        message: 'carId and ownerId are required',
      });
    }

    if (typeof isSold !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isSold must be a boolean value (true or false)',
      });
    }

    const republisherRepo = AppDataSource.getRepository(RepublishCarDetails);
    const carRepo = AppDataSource.getRepository(CarDetails);
    const userRepo = AppDataSource.getRepository(UserAuth);

    const republishRequest = await republisherRepo.findOne({
      where: { carId, ownerId },
      relations: ['car'],
    });

    if (!republishRequest) {
      return res.status(404).json({
        success: false,
        message: 'Republish request not found',
      });
    }

    const car = await carRepo.findOne({
      where: { id: carId },
      relations: ['address', 'carImages'],
    });

    if (!car) {
      return res.status(404).json({
        success: false,
        message: 'Car not found',
      });
    }

    const owner = await userRepo.findOne({ where: { id: car.userId } });
    const republisher = await userRepo.findOne({ where: { id: republishRequest.republisherId } });

    if (!owner || !republisher) {
      return res.status(404).json({
        success: false,
        message: 'Owner or republisher not found',
      });
    }

    // Update car isSold status
    car.isSold = isSold;
    await carRepo.save(car);

    // Add to bundled email for republisher notification about car status update
    if (republisher?.email) {
      const emailType = isSold ? 'republish_approve' : 'republish_update';

      delayedEmailService.addToBundledEmail(
        republisher.email,
        {
          type: emailType,
          carId: car.id,
          carName: car.carName || car.title || 'Car',
          carPrice: car.carPrice,
          carLocation: car.address?.locality || car.address?.city || '',
          carImage: car.carImages?.[0]?.imageKey || '',
          ownerName: owner.fullName,
          timestamp: new Date(),
          republishId: republishRequest.id,
        },
        30 // 30 minutes delay
      );
    }

    // Send mobile notification to republisher
    if (republisher.id) {
      const statusText = isSold ? 'marked as SOLD' : 'marked as AVAILABLE';
      await bundleNotification([
        {
          userId: republisher.id,
          message: `Car ${car.carName || car.title} has been ${statusText} by the owner.`,
          imageKey: car.carImages?.[0]?.imageKey || '',
          type: NotificationType.REPUBLISH,
          user: owner.fullName,
          button: 'View Car',
          car: {
            title: car.carName || car.title || '',
            price: car.carPrice ? `₹${car.carPrice.toLocaleString()}` : '',
            location: car.address?.locality || '',
            image: car.carImages?.[0]?.imageKey || '',
          },
          status: isSold ? 'Sold' : 'Available',
          actionId: car.id, // For navigation to CarDetails screen
        },
      ]);
    }

    const statusText = isSold ? 'marked as SOLD' : 'marked as AVAILABLE';
    return res.status(200).json({
      success: true,
      message: `Car has been ${statusText} successfully`,
      car: {
        id: car.id,
        name: car.carName || car.title,
        isSold: car.isSold,
        price: car.carPrice,
        location: car.address?.locality || car.address?.city,
      },
    });
  } catch (error) {
    console.error('Error in conformRepublishRequest:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: errorMessage,
    });
  }
};
