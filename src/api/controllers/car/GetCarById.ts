import { Request, Response } from 'express';
import { Address } from '@/api/entity/Address';
import { CarDetails } from '@/api/entity/CarDetails';
import { CarImages } from '@/api/entity/CarImages';
import { Connections } from '@/api/entity/Connection';
import { SavedCar } from '@/api/entity/SavedCars';
import { UserAuth } from '@/api/entity/UserAuth';
import { AppDataSource } from '@/server';

// Interface for car image with presigned URL
interface CarImageWithUrl {
  id: string;
  imageKey: string;
  presignedUrl: string;
  imgClassifications: 'Left' | 'Right' | 'Front' | 'Back' | 'Door' | 'Roof' | 'Window' | 'Other';
  accuracyPercent: number | null;
}

// Type for car response
type CarResponseType = {
  id: string;
  userId: string;
  address: Address;
  title: string;
  description: string;
  // category: string;
  // subCategory: string;
  carName: string | null;
  isSale: 'Sell' | 'Buy' | null;
  carPrice: number;
  isSold: boolean;
  // conversion: string[] | null;
  // width: number | null;
  // height: number | null;
  // length: number | null;
  // groundHeight: number | null;
  // unit: string | null;
  isActive: boolean;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
  // workingWithDealer: boolean | null;
  carImages: CarImageWithUrl[];
  isSaved?: boolean;
  connectionStatus?: string | null;
};

// Helper to map images
async function mapCarImages(images: CarImages[]): Promise<CarImageWithUrl[]> {
  if (!images || !Array.isArray(images)) return [];

  return images
    .filter((img) => img && img.imageKey)
    .map((img) => ({
      id: img.id,
      imageKey: img.imageKey,
      presignedUrl: img.presignedUrl || 'https://via.placeholder.com/400x300?text=Image+Not+Available',
      imgClassifications: img.imgClassifications as CarImageWithUrl['imgClassifications'],
      accuracyPercent: img.accurencyPercent || 0,
    }));
}

// Map full car response
async function mapCarResponse(car: CarDetails): Promise<CarResponseType> {
  const carImages = await mapCarImages(car.carImages || []);
  return {
    ...car,
    carImages,
  };
}

/**
 * Get a single car by ID with complete details, images, and owner information
 */
export const getCarById = async (req: Request, res: Response) => {
  try {
    const { carId, userId } = req.body;

    if (!carId) {
      return res.status(400).json({ message: 'Car ID is required' });
    }

    const carRepo = AppDataSource.getRepository(CarDetails);
    const userRepo = AppDataSource.getRepository(UserAuth);
    const savedCarRepo = AppDataSource.getRepository(SavedCar);

    // Get car with relations
    const foundCar = await carRepo.findOne({
      where: { id: carId },
      relations: ['address', 'carImages'],
    });

    if (!foundCar) {
      return res.status(404).json({ message: 'Car not found' });
    }

    // Get owner details
    const user = await userRepo.findOne({
      where: { id: foundCar.userId },
      select: ['id', 'fullName', 'mobileNumber', 'email', 'userProfileUrl', 'userType'],
    });

    // Map car response
    const carResponse = await mapCarResponse(foundCar);

    // Check if saved by current user
    let isSaved = false;
    if (userId) {
      const savedCar = await savedCarRepo.findOne({
        where: { car: { id: foundCar.id }, user: { id: userId } },
      });
      isSaved = !!savedCar;
    }
    carResponse.isSaved = isSaved;

    // Connection status
    let connectionStatus: string | null = null;
    if (userId) {
      if (userId === foundCar.userId) {
        connectionStatus = '';
      } else {
        const connectionRepo = AppDataSource.getRepository(Connections);
        const connection = await connectionRepo.findOne({
          where: [
            { requesterId: userId, receiverId: foundCar.userId },
            { requesterId: foundCar.userId, receiverId: userId },
          ],
        });
        connectionStatus = connection ? 'connected' : null;
      }
    }
    carResponse.connectionStatus = connectionStatus;

    return res.status(200).json({
      message: 'Car retrieved successfully',
      car: carResponse,
      owner: {
        id: user?.id,
        fullName: user?.fullName,
        mobileNumber: user?.mobileNumber,
        email: user?.email,
        userType: user?.userType,
      },
      connectionStatus,
    });
  } catch (error) {
    console.error('Error in getCarById:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// import { Request, Response } from 'express';

// import { generatePresignedUrl } from '@/api/controllers/s3/awsControllers';
// import { Address } from '@/api/entity/Address';
// import { CarDetails } from '@/api/entity/CarDetails';
// import { CarImages } from '@/api/entity/CarImages';
// import { CarReport } from '@/api/entity/CarReport';
// import { Connections } from '@/api/entity/Connection';
// import { RepublishCarDetails } from '@/api/entity/RepublishCars';
// import { SavedCar } from '@/api/entity/SavedCars';
// import { UserAuth } from '@/api/entity/UserAuth';
// import { UserKyc } from '@/api/entity/userkyc';
// import { AppDataSource } from '@/server';

// // Interface for car image with presigned URL
// interface CarImageWithUrl {
//   id: string;
//   imageKey: string;
//   presignedUrl: string;
//   imgClassifications: 'Left' | 'Right' | 'Front' | 'Back' | 'Door' | 'Roof' | 'Window' | 'Other';
//   accuracyPercent: number | null;
// }
// // Type for car response with images that have presigned URLs
// type CarResponseType = {
//   id: string;
//   userId: string;
//   address: Address;
//   title: string;
//   description: string;
//   category: string;
//   subCategory: string;
//   carName: string | null;
//   isSale: 'Sell' | 'Buy' | null;
//   carPrice: number;
//   isSold: boolean;
//   conversion: string[] | null;
//   width: number | null;
//   height: number | null;
//   length: number | null;
//   groundHeight: number | null;
//   unit: string | null;
//   isActive: boolean;
//   createdBy: string;
//   updatedBy: string;
//   createdAt: Date;
//   updatedAt: Date;
//   workingWithDealer: boolean | null;
//   carImages: CarImageWithUrl[];
//   enquiries?: {
//     viewProperty: number;
//     calling: number;
//   };
//   ownerDetails?: {
//     name: string | null;
//     email: string | null;
//     mobileNumber: string | null;
//   };
//   isSaved?: boolean;
//   isRepublished?: boolean;
//   isReported?: boolean;
//   imRepublished?: boolean;
// };

// // Consistent mapping for a single property
// async function mapCarResponse(car: CarDetails): Promise<CarResponseType> {
//   try {
//     if (!car) {
//       console.error('Car is null or undefined in mapCarResponse');
//       throw new Error('Car is null or undefined');
//     }

//     const carImages = await mapCarImages(car.carImages || []);
//     return {
//       ...car,
//       carImages,
//     };
//   } catch (error) {
//     console.error('Error in mapCarResponse:', error);
//     return {
//       ...car,
//       carImages: [],
//     };
//   }
// }

// // Type for filtered car data based on subcategory requirements
// type FilteredCarData = {
//   id: string;
//   userId: string;
//   address: Address;
//   title: string;
//   description: string;
//   category: string;
//   subCategory: string;
//   isSale: 'Sell' | 'Buy' | null;
//   carPrice: number;
//   isSold: boolean;
//   carImages: CarImageWithUrl[];
//   createdBy: string;
//   updatedBy: string;
//   createdAt: Date;
//   updatedAt: Date;
//   // Optional fields that may be included based on subcategory
//   carName?: string | null;
//   length?: number | null;
//   width?: number | null;
//   height?: number | null;
//   groundHeight?: number | null;
//   isSaved?: boolean;
//   isRepublished?: boolean;
//   isReported?: boolean;
//   imRepublished?: boolean;
// };

// // Helper to map PropertyImages to CarImageWithUrl (with presigned URLs)
// async function mapCarImages(images: CarImages[]): Promise<CarImageWithUrl[]> {
//   try {
//     if (!images || !Array.isArray(images)) {
//       console.warn('Images is not an array or is null/undefined');
//       return [];
//     }

//     const mappedImages = await Promise.all(
//       images
//         .filter((img) => img && img.imageKey) // Ensure image and imageKey exist
//         .map(async (img) => {
//           try {
//             // Check if AWS environment variables are set
//             const bucketName = process.env.AWS_S3_BUCKET;
//             const region = process.env.AWS_REGION;

//             if (!bucketName || !region) {
//               console.warn('AWS environment variables not set, using fallback URL');
//               return {
//                 id: img.id,
//                 imageKey: img.imageKey,
//                 presignedUrl: img.presignedUrl || `https://via.placeholder.com/400x300?text=Image+Not+Available`,
//                 imgClassifications: img.imgClassifications as CarImageWithUrl['imgClassifications'],
//                 accuracyPercent: img.accurencyPercent || 0,
//               };
//             }

//             return {
//               id: img.id,
//               imageKey: img.imageKey,
//               presignedUrl: img.presignedUrl || (await generatePresignedUrl(img.imageKey)),
//               imgClassifications: img.imgClassifications as CarImageWithUrl['imgClassifications'],
//               accuracyPercent: img.accurencyPercent || 0,
//             };
//           } catch (error) {
//             console.error('Error generating presigned URL for image:', img.imageKey, error);
//             return {
//               id: img.id,
//               imageKey: img.imageKey,
//               presignedUrl: img.presignedUrl || 'https://via.placeholder.com/400x300?text=Image+Not+Available',
//               imgClassifications: img.imgClassifications as CarImageWithUrl['imgClassifications'],
//               accuracyPercent: img.accurencyPercent || 0,
//             };
//           }
//         })
//     );

//     return mappedImages.filter((img) => img !== null);
//   } catch (error) {
//     console.error('Error in mapCarImages:', error);
//     return [];
//   }
// }

// /**
//  * Get a single car by ID with complete details, images, and owner information
//  */
// export const getCarById = async (req: Request, res: Response) => {
//   try {
//     const { carId, userId, republishId } = req.body;

//     if (!carId) {
//       return res.status(400).json({ message: 'Car ID is required' });
//     }

//     const carRepo = AppDataSource.getRepository(CarDetails);
//     const carRepublishRepo = AppDataSource.getRepository(RepublishCarDetails);
//     const userRepo = AppDataSource.getRepository(UserAuth);
//     const savedCarRepo = AppDataSource.getRepository(SavedCar);
//     const reportCarRepo = AppDataSource.getRepository(CarReport);

//     let car: CarDetails;
//     let republishCar: RepublishCarDetails | null = null;

//     if (republishId) {
//       // Get the republished property record (without relations that don't exist)
//       republishCar = await carRepublishRepo.findOne({
//         where: { id: republishId },
//       });
//       if (!republishCar) {
//         return res.status(404).json({ message: 'Republished car not found' });
//       }
//       // Get the original property for republished properties
//       const originalCar = await carRepo.findOne({
//         where: { id: republishCar.carId },
//         relations: ['address', 'carImages'],
//       });
//       if (!originalCar) {
//         return res.status(404).json({ message: 'Original car not found' });
//       }
//       car = originalCar;
//     } else {
//       const foundCar = await carRepo.findOne({
//         where: { id: carId },
//         relations: ['address', 'carImages'],
//       });
//       if (!foundCar) {
//         return res.status(404).json({ message: 'Car not found' });
//       }
//       car = foundCar;
//     }

//     let user;
//     if (republishId) {
//       // For republished properties, get the republisher's details (the one who republished)
//       user = await userRepo.findOne({
//         where: { id: republishCar?.republisherId },
//         select: ['id', 'fullName', 'mobileNumber', 'email', 'userProfileUrl', 'userType'],
//       });
//     } else {
//       // For regular properties, get the original owner's details
//       user = await userRepo.findOne({
//         where: { id: car.userId },
//         select: ['id', 'fullName', 'mobileNumber', 'email', 'userProfileUrl', 'userType'],
//       });
//     }

//     const userKycRepo = AppDataSource.getRepository(UserKyc);
//     let userKyc;
//     if (republishId) {
//       userKyc = await userKycRepo.findOne({
//         where: { userId: republishCar?.republisherId },
//       });
//     } else {
//       userKyc = await userKycRepo.findOne({
//         where: { userId: car.userId },
//       });
//     }
//     console.log('User KYC:', userKyc);

//     // Get connection status if userId is provided
//     let connectionStatus = null;
//     if (republishId) {
//       connectionStatus = republishCar?.status;
//     } else {
//       if (userId) {
//         if (userId === car.userId) {
//           connectionStatus = '';
//         } else {
//           const connectionRepo = AppDataSource.getRepository(Connections);
//           const connection = await connectionRepo.findOne({
//             where: [
//               { requesterId: userId, receiverId: car.userId },
//               { requesterId: car.userId, receiverId: userId },
//             ],
//           });
//           connectionStatus = connection ? 'connected' : null;
//         }
//       }
//     }

//     // Handle user profile image
//     let userProfileImage =
//       'https://static.vecteezy.com/system/resources/previews/000/439/863/non_2x/vector-users-icon.jpg';
//     if (user?.userProfileUrl) {
//       try {
//         const presignedUrl = await generatePresignedUrl(user.userProfileUrl);
//         if (presignedUrl && presignedUrl.startsWith('http')) {
//           userProfileImage = presignedUrl;
//         }
//       } catch (error) {
//         console.error('Error generating presigned URL:', error);
//       }
//     }

//     const carResponse = await mapCarResponse(car);

//     // Check if car is saved by the current user
//     let isSaved = false;
//     if (userId) {
//       const savedCar = await savedCarRepo.findOne({
//         where: { carId: car.id, userId: userId },
//       });
//       isSaved = !!savedCar;
//     }

//     // Check if car is republished
//     let isRepublished = false;
//     if (republishId) {
//       isRepublished = true;
//     } else {
//       const republishedCar = await carRepublishRepo.findOne({
//         where: { carId: car.id },
//       });
//       isRepublished = !!republishedCar;
//     }

//     // Check if property is reported by the current user
//     let isReported = false;
//     if (userId) {
//       const reportedCar = await reportCarRepo.findOne({
//         where: { carDetails: car.id, reporterId: userId },
//       });
//       isReported = !!reportedCar;
//     }

//     let imRepublished = false;
//     if (republishId) {
//       const republishedCar = await carRepublishRepo.findOne({
//         where: { carId: car.id, republisherId: userId },
//       });
//       imRepublished = !!republishedCar;
//     }

//     // Add the boolean flags to the property response
//     carResponse.isSaved = isSaved;
//     carResponse.isRepublished = isRepublished;
//     carResponse.isReported = isReported;
//     carResponse.imRepublished = imRepublished;

//     // Filter property data based on subcategory requirements
//     const getFilteredCarData = (car: CarResponseType, subCategory: string): FilteredCarData => {
//       const baseData = {
//         id: car.id,
//         userId: car.userId,
//         address: car.address,
//         title: car.title,
//         description: car.description,
//         category: car.category,
//         subCategory: car.subCategory,
//         isSale: car.isSale,
//         carPrice: car.carPrice,
//         isSold: car.isSold,
//         carImages: car.carImages,
//         createdBy: car.createdBy,
//         updatedBy: car.updatedBy,
//         createdAt: car.createdAt,
//         updatedAt: car.updatedAt,
//         workingWithDealer: car.workingWithDealer,
//         isSaved: car.isSaved,
//         isRepublished: car.isRepublished,
//         isReported: car.isReported,
//         imRepublished: car.imRepublished,
//       };

//       switch (subCategory) {
//         case 'New':
//           return {
//             ...baseData,
//             length: car.length,
//             width: car.width,
//             height: car.height,
//           };

//         case 'Used':
//           return {
//             ...baseData,
//             length: car.length,
//             width: car.width,
//             height: car.height,
//             groundHeight: car.groundHeight,
//           };

//         case 'Brand':
//           return {
//             ...baseData,
//             length: car.length,
//             width: car.width,
//             height: car.height,
//             groundHeight: car.groundHeight,
//           };

//         case 'Model':
//           return {
//             ...baseData,
//             length: car.length,
//             width: car.width,
//             height: car.height,
//             groundHeight: car.groundHeight,
//           };

//         case 'Car Type':
//           return {
//             ...baseData,
//             length: car.length,
//             width: car.width,
//             height: car.height,
//             groundHeight: car.groundHeight,
//           };

//         default:
//           // Return all data for unknown subcategories
//           return {
//             ...baseData,
//             length: car.length,
//             width: car.width,
//             height: car.height,
//             groundHeight: car.groundHeight,
//           };
//       }
//     };

//     const filteredCarData = getFilteredCarData(carResponse, car.subCategory);

//     return res.status(200).json({
//       message: 'Car retrieved successfully',
//       car: filteredCarData,
//       owner: {
//         id: user?.id,
//         fullName: user?.fullName,
//         mobileNumber: user?.mobileNumber,
//         email: user?.email,
//         userProfile: userProfileImage,
//         userType: user?.userType,
//       },
//       connectionStatus,
//     });
//   } catch (error) {
//     console.error('Error in getCarById:', error);
//     return res.status(500).json({ message: 'Server error' });
//   }
// };
