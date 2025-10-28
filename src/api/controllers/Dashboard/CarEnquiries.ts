import { Request, Response } from 'express';

import { CarDetails } from '@/api/entity/CarDetails';
import { CarEnquiry } from '@/api/entity/CarEnquiry';
// import { Property } from '@/api/entity/Car';
// import { PropertyEnquiry } from '@/api/entity/CarEnquiry';
import { UserAuth } from '@/api/entity/UserAuth';
import { AppDataSource } from '@/server';

// import { generatePresignedUrl } from '../s3/cloudinaryController';

// type CarResponseType = {
//   id: string;
//   userId: string;
//   address: Address;
//   category: string;
//   subCategory: string;
// };

// Create a car enquiry

export const createCarEnquiry = async (req: Request, res: Response) => {
  try {
    const { carId, userId, Calling, ownerId } = req.body;

    if (!carId || !userId) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }

    const carEnquiryRepo = AppDataSource.getRepository(CarEnquiry);
    const carRepo = AppDataSource.getRepository(CarDetails);

    // Fetch car details
    const carDetails = await carRepo.findOne({ where: { id: carId } });

    if (!carDetails) {
      return res.status(404).json({ message: 'Car not found' });
    }

    if (carDetails.userId === userId) {
      return res.status(403).json({ message: 'You cannot create an enquiry for your own car' });
    }
    const carEnquiry = carEnquiryRepo.create({
      carId,
      userId,
      ownerId: ownerId ? ownerId : carDetails.userId,
      calling: Calling ? Calling : false,
    });
    const newCarEnquiry = await carEnquiryRepo.save(carEnquiry);

    // Prepare notifications array for bundle processing
    // const notificationsToSend = [];

    // Notification for property owner
    // if (carDetails) {
    //   notificationsToSend.push({
    //     userId: carDetails.userId,
    //     message: `You have a new property enquiry for ${carDetails.propertyName || carDetails.projectName}`,
    //     mediakey: carDetails.propertyImages?.[0]?.imageKey,
    //     type: NotificationType.ENQUIRY,
    //     user: carDetails.propertyName || carDetails.projectName || '',
    //     button: 'View Enquiry',
    //     property: {
    //       title: carDetails.title || carDetails.propertyName || carDetails.projectName || '',
    //       price: carDetails.propertyPrice ? `₹${carDetails.propertyPrice}` : '',
    //       location: carDetails.address?.locality || '',
    //       image: carDetails.propertyImages?.[0]?.imageKey || ''
    //     },
    //     status: 'Enquiry',
    //     actionId: newCarEnquiry.carId
    //   });
    // }

    // Notification for review (if ownerId is different from userId and property owner)
    // if (ownerId && ownerId !== userId && carDetails.userId !== userId && carEnquiry.calling) {
    //   notificationsToSend.push({
    //     userId: ownerId,
    //     message: `You have a new property enquiry for ${carDetails.propertyName || carDetails.projectName}`,
    //     mediakey: carDetails.propertyImages?.[0]?.imageKey,
    //     type: NotificationType.ENQUIRY,
    //     user: carDetails.propertyName || carDetails.projectName || '',
    //     button: 'review',
    //     property: {
    //       title: carDetails.title || carDetails.propertyName || carDetails.projectName || '',
    //       price: carDetails.propertyPrice ? `₹${carDetails.propertyPrice}` : '',
    //       location: carDetails.address?.locality || '',
    //       image: carDetails.propertyImages?.[0]?.imageKey || ''
    //     },
    //     status: 'Enquiry',
    //     actionId: newCarEnquiry.carId
    //   });
    // }

    // Send all notifications in bundle (this will group similar notifications)
    // if (notificationsToSend.length > 0) {
    //   const bundleResult = await bundleNotification(notificationsToSend, 30); // 30 minute window
    //   console.log('📦 Property enquiry notifications sent:', bundleResult.summary);

    //   // Log what happened with the notifications
    //   bundleResult.results.forEach(result => {
    //     if (result.success) {
    //       if (result.action === 'created') {
    //         console.log(`✅ Created ${result.notification?.isBundled ? 'bundled' : 'individual'} notification for user ${result.userId}`);
    //       } else if (result.action === 'updated') {
    //         console.log(`🔄 Updated bundled notification for user ${result.userId} (now has ${result.notification?.bundleCount} total enquiries)`);
    //       }
    //     } else {
    //       console.log(`❌ Failed to send notification to user ${result.userId}: ${result.error}`);
    //     }
    //   });
    // }

    res.status(201).json({
      message: 'Car enquiry created successfully',
      enquiry: newCarEnquiry,
      carDetails,
      // notificationSummary: notificationsToSend.length > 0 ? 'Notifications sent via bundle system' : 'No notifications sent'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error creating car enquiry' });
  }
};

// Get all car enquiries for a user
export const getAllCarEnquiries = async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    const { page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    const carEnquiryRepo = AppDataSource.getRepository(CarEnquiry);
    // const carRepo = AppDataSource.getRepository(CarDetails);
    const userRepo = AppDataSource.getRepository(UserAuth);

    // Fetch all car enquiries for the user (without pagination yet)
    const allEnquiries = await carEnquiryRepo.find({
      where: { userId },
      relations: ['car'],
      order: { createdAt: 'DESC' },
    });

    // ✅ Deduplicate: keep only the latest enquiry per carDetails
    const uniqueEnquiryMap = new Map<string, CarEnquiry>();
    for (const enquiry of allEnquiries) {
      if (!uniqueEnquiryMap.has(enquiry.carDetails.id)) {
        uniqueEnquiryMap.set(enquiry.carDetails.id, enquiry);
      }
    }
    const uniqueEnquiries = Array.from(uniqueEnquiryMap.values());

    // Pagination after deduplication
    const totalCount = uniqueEnquiries.length;
    const paginatedEnquiries = uniqueEnquiries.slice(skip, skip + Number(limit));

    // Format response
    const formatted = await Promise.all(
      paginatedEnquiries.map(async (enquiry) => {
        const Dealer = await userRepo.findOne({
          where: { id: enquiry?.ownerId },
        });
        // const DealerAvatar = Dealer?.userProfileUrl
        //   ? await generatePresignedUrl(Dealer.userProfileUrl)
        //   : 'https://static.vecteezy.com/system/resources/previews/000/439/863/non_2x/vector-users-icon.jpg';

        return {
          id: enquiry.id,
          DealerName: Dealer?.fullName,
          DealerRole: Dealer?.userType,
          // DealerAvatar,
          mobileNumber: Dealer?.mobileNumber,
          timeAgo: timeAgo(enquiry.createdAt),
          carId: enquiry.carDetails?.id,
          // carType: enquiry.carDetails?.category || '',
          carTitle: enquiry.carDetails?.title || '',
          calling: enquiry.calling,
        };
      })
    );

    const totalPages = Math.ceil(totalCount / Number(limit));

    return res.status(200).json({
      message: 'Car enquiries retrieved successfully',
      carEnquiries: formatted,
      count: formatted.length,
      totalCount,
      currentPage: Number(page),
      totalPages,
      hasMore: skip + formatted.length < totalCount,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error retrieving car enquiries' });
  }
};

// Helper to format time ago
function timeAgo(date: Date): string {
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return `just now`;
  if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;
  return `${Math.floor(diff / 604800)} week${Math.floor(diff / 604800) > 1 ? 's' : ''} ago`;
}
