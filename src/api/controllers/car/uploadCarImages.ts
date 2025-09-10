import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { AppDataSource } from '@/server';
import { CarImages } from '@/api/entity/CarImages';
// import watermarkService from '@/api/services/watermarkService';
import cloudinary from '../s3/clodinaryConfig';

interface UploadRequest extends Request {
  body: {
    carId?: string;
    userId: string;
  };
  file?: Express.Multer.File;
}

interface UploadResponse {
  status: 'success' | 'error';
  message: string;
  data?: {
    url: string;
    key: string;
    watermarkResult?: any;
  };
}

function generateUniqueKey(originalname: string): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return `${timestamp}-${random}-${originalname}`;
}

export const uploadCarImagesController = async (req: UploadRequest, res: Response<UploadResponse>) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        message: 'No file uploaded.',
      });
    }

    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        status: 'error',
        message: 'userId is required in request body.',
      });
    }

    const imageBuffer = req.file.buffer;
    const originalName = req.file.originalname;
    const tempFileName = `temp-${Date.now()}-${originalName}`;
    const tempFilePath = path.join(__dirname, '../../temp', tempFileName);

    // Create temp folder if it doesn't exist
    if (!fs.existsSync(path.dirname(tempFilePath))) {
      fs.mkdirSync(path.dirname(tempFilePath), { recursive: true });
    }

    // Save image temporarily
    fs.writeFileSync(tempFilePath, imageBuffer);

    // Apply watermark if enabled
    let finalFilePath = tempFilePath;
    let watermarkResult = null;

    try {
      // watermarkResult = await watermarkService.addWatermark(imageBuffer);
      finalFilePath = path.join(__dirname, '../../temp', `watermarked-${Date.now()}-${originalName}`);
      // fs.writeFileSync(finalFilePath, watermarkResult.watermarkedBuffer);
    } catch (watermarkError) {
      console.error('Watermarking failed, using original image:', watermarkError);
      watermarkResult = { watermarkApplied: false };
    }

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(finalFilePath, {
      folder: 'nextdeal/car-images',
      public_id: generateUniqueKey(originalName).split('.')[0],
    });

    // Clean up temp files
    fs.unlinkSync(tempFilePath);
    if (finalFilePath !== tempFilePath) {
      fs.unlinkSync(finalFilePath);
    }

    // Save image info to database
    const propertyImageRepo = AppDataSource.getRepository(CarImages);
    const propertyImage = new CarImages();
    propertyImage.imageKey = result.public_id;
    propertyImage.presignedUrl = result.secure_url;
    propertyImage.createdBy = userId;
    propertyImage.updatedBy = userId;

    await propertyImageRepo.save(propertyImage);

    // Send response
    return res.status(200).json({
      status: 'success',
      message: 'Image uploaded successfully',
      data: {
        url: result.secure_url,
        key: result.public_id,
        watermarkResult,
      },
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    return res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Server error',
    });
  }
};

// import imageClassificationService from '@/api/imageClassification/imageClassificationService';
// import nsfwDetectionService from '@/api/nsfw/nsfwDetectionService';
// import contactDetectionService from '@/api/contactDetection/contactDetectionService';
// import { AppDataSource } from '@/server';
// import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
// import { Request, Response } from 'express';
// import watermarkService from '@/api/services/watermarkService';
// import { CarImages } from '@/api/entity/CarImages';

// // const upload = multer({ storage: multer.memoryStorage() });

// interface UploadRequest extends Request {
//   body: {
//     carId?: string;
//     forClassify?: string;
//     userId: string;
//   };
//   file?: Express.Multer.File;
// }

// interface UploadResponse {
//   status: 'success' | 'error';
//   message: string;
//   data?: {
//     url: string;
//     key: string;
//     imgClassifications?: string;
//     accurencyPercent?: string;
//     nsfwResult?: any;
//     classificationResult?: any;
//     contactDetectionResult?: any;
//     watermarkResult?: any;
//     detectedItems?: {
//       phoneNumbers: string[];
//       emailAddresses: string[];
//       socialMediaHandles: string[];
//     };
//   };
//   detectedItems?: {
//     phoneNumbers: string[];
//     emailAddresses: string[];
//     socialMediaHandles: string[];
//   };
// }

// const s3 = new S3Client({
//   credentials: {
//     accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
//     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
//   },
//   region: process.env.AWS_REGION,
// });

// function generateUniqueKey(originalname: string): string {
//   const timestamp = Date.now();
//   const random = Math.floor(Math.random() * 10000);
//   return `${timestamp}-${random}-${originalname}`;
// }

// export const uploadCarImagesController = async (req: UploadRequest, res: Response<UploadResponse>) => {
//   try {
//     if (!req.file) {
//       return res.status(400).json({
//         status: 'error',
//         message: 'No file uploaded.',
//       });
//     }

//     const { carId, userId } = req.body;

//     if (!userId) {
//       return res.status(400).json({
//         status: 'error',
//         message: 'userId is required in request body.',
//       });
//     }

//     const bucketName = process.env.AWS_S3_BUCKET;
//     const imageBuffer = req.file.buffer;
//     const contentType = req.file.mimetype;

//     if (!bucketName) {
//       throw new Error('AWS_S3_BUCKET environment variable is not set');
//     }

//     const key = `car-images/${carId || 'temp'}/${generateUniqueKey(req.file.originalname)}`;

//     let nsfwResult = null;
//     try {
//       nsfwResult = await nsfwDetectionService.predict(imageBuffer);

//       if (nsfwDetectionService.isEnabled() && nsfwResult.isAdult) {
//         return res.status(400).json({
//           status: 'error',
//           message: 'Image contains inappropriate content and cannot be uploaded',
//         });
//       }
//     } catch (nsfwError) {
//       console.error('NSFW detection failed:', nsfwError);
//       nsfwResult = {
//         label: 'neutral',
//         confidence: '0.00% (detection failed)',
//         isAdult: false,
//       };
//     }

//     let contactDetectionResult = null;
//     try {
//       contactDetectionResult = await contactDetectionService.detectContactInfo(imageBuffer);

//       if (contactDetectionService.isEnabled() && contactDetectionResult.hasContactInfo) {
//         return res.status(400).json({
//           status: 'error',
//           message: 'Image contains contact information (phone numbers, email addresses, etc.) and cannot be uploaded for security reasons.',
//           detectedItems: contactDetectionResult.detectedItems,
//         });
//       }
//     } catch (contactError) {
//       console.error('Contact detection failed:', contactError);
//       contactDetectionResult = {
//         hasContactInfo: false,
//         detectedItems: {
//           phoneNumbers: [],
//           emailAddresses: [],
//           socialMediaHandles: [],
//         },
//         confidence: '0.00% (detection failed)',
//       };
//     }

//     let watermarkedImageBuffer = imageBuffer;
//     let watermarkResult = null;
//     try {
//       watermarkResult = await watermarkService.addWatermark(imageBuffer);
//       watermarkedImageBuffer = watermarkResult.watermarkedBuffer;
//     } catch (watermarkError) {
//       console.error('Watermarking failed, using original image:', watermarkError);
//     }

//     const command = new PutObjectCommand({
//       Bucket: bucketName,
//       Key: key,
//       Body: watermarkedImageBuffer,
//       ContentType: contentType,
//     });

//     await s3.send(command);

//     const url = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

//     let classificationResult = null;
//     try {
//       if (!imageClassificationService.isEnabled()) {
//         classificationResult = {
//           label: 'Other',
//           confidence: '0.00% (classification disabled)',
//         };
//       } else if (!imageClassificationService.isModelLoaded()) {
//         classificationResult = {
//           label: 'Other',
//           confidence: '0.00% (model not loaded)',
//         };
//       } else {
//         classificationResult = await imageClassificationService.predictRoom(imageBuffer);
//       }
//     } catch (classificationError) {
//       console.error('Interior classification failed:', classificationError);
//       classificationResult = {
//         label: 'Other',
//         confidence: '0.00% (classification failed)',
//       };
//     }

//     const propertyImageRepo = AppDataSource.getRepository(CarImages);
//     const propertyImage = new CarImages();
//     propertyImage.imageKey = key;
//     propertyImage.presignedUrl = url;
//     propertyImage.createdBy = userId;
//     propertyImage.updatedBy = userId;

//     if (classificationResult) {
//       const labelToSave = classificationResult.label || 'Other';
//       propertyImage.imgClassifications = labelToSave;

//       const confidenceMatch = classificationResult.confidence.match(/(\d+\.?\d*)/);
//       if (confidenceMatch) {
//         const confidence = Number(confidenceMatch[1]);
//         if (!isNaN(confidence)) {
//           propertyImage.accurencyPercent = confidence;
//         }
//       }
//     } else {
//       propertyImage.imgClassifications = 'Other';
//       propertyImage.accurencyPercent = 0;
//     }

//     const image = await propertyImageRepo.save(propertyImage);

//     return res.status(200).json({
//       status: 'success',
//       message: 'Image uploaded and processed successfully',
//       data: {
//         url,
//         key,
//         imgClassifications: image.imgClassifications,
//         accurencyPercent: image.accurencyPercent?.toString(),
//         nsfwResult,
//         classificationResult,
//         contactDetectionResult,
//         watermarkResult,
//       },
//     });
//   } catch (error) {
//     console.error('Error processing image:', error);
//     return res.status(500).json({
//       status: 'error',
//       message: error instanceof Error ? error.message : 'Server error',
//     });
//   }
// };

// export const checkModelStatusController = async (req: UploadRequest, res: Response) => {
//   try {
//     const modelInfo = imageClassificationService.getModelInfo();
//     const nsfwInfo = nsfwDetectionService.getServiceInfo();
//     const contactInfo = contactDetectionService.getServiceInfo();
//     const isLoaded = imageClassificationService.isModelLoaded();

//     // const { ModelLoader } = await import('@/ml-models/modelLoader');
//     // const modelLoader = ModelLoader.getInstance();
//     // const modelStatus = modelLoader.getModelStatus();

//     return res.status(200).json({
//       status: 'success',
//       data: {
//         imageClassification: {
//           modelLoaded: isLoaded,
//           modelInfo,
//           confidenceThreshold: modelInfo.confidenceThreshold * 100 + '%',
//           mainClasses: modelInfo.mainClasses,
//           fallbackClass: modelInfo.fallbackClass,
//         },
//         nsfwDetection: nsfwInfo,
//         contactDetection: contactInfo,
//         watermarkService: watermarkService.getServiceStatus(),
//         // modelLoader: modelStatus,
//         environment: {
//           IMAGE_CLASSIFICATION_ENABLED: process.env.IMAGE_CLASSIFICATION_ENABLED,
//           NSFW_DETECTION_ENABLED: process.env.NSFW_DETECTION_ENABLED,
//           CONTACT_DETECTION_ENABLED: process.env.CONTACT_DETECTION_ENABLED,
//           ROOM_CLASSIFICATION_CONFIDENCE_THRESHOLD: process.env.ROOM_CLASSIFICATION_CONFIDENCE_THRESHOLD,
//           IMAGE_COMPRESSION_ENABLED: process.env.IMAGE_COMPRESSION_ENABLED,
//           IMAGE_COMPRESSION_QUALITY: process.env.IMAGE_COMPRESSION_QUALITY,
//           ROOM_CLASSIFICATION_MODEL_PATH: process.env.ROOM_CLASSIFICATION_MODEL_PATH,
//           NSFW_DETECTION_MODEL_PATH: process.env.NSFW_DETECTION_MODEL_PATH,
//           IMAGE_WATERMARK_ENABLED: process.env.IMAGE_WATERMARK_ENABLED,
//         },
//       },
//     });
//   } catch (error) {
//     console.error('Error checking model status:', error);
//     return res.status(500).json({
//       status: 'error',
//       message: error instanceof Error ? error.message : 'Server error',
//     });
//   }
// };

// export const testContactDetectionController = async (req: UploadRequest, res: Response) => {
//   try {
//     if (!req.file) {
//       return res.status(400).json({
//         status: 'error',
//         message: 'No image uploaded for contact detection',
//       });
//     }

//     const contactResult = await contactDetectionService.detectContactInfo(req.file.buffer);

//     return res.status(200).json({
//       status: 'success',
//       data: {
//         hasContactInfo: contactResult.hasContactInfo,
//         detectedItems: contactResult.detectedItems,
//         confidence: contactResult.confidence,
//       },
//     });
//   } catch (error) {
//     console.error('Error in contact detection test:', error);
//     return res.status(500).json({
//       status: 'error',
//       message: error instanceof Error ? error.message : 'Server error',
//     });
//   }
// };

// export const testWatermarkController = async (req: UploadRequest, res: Response) => {
//   try {
//     if (!req.file) {
//       return res.status(400).json({
//         status: 'error',
//         message: 'No image uploaded for watermarking test',
//       });
//     }

//     const originalBuffer = req.file.buffer;
//     const watermarkResult = await watermarkService.addWatermark(originalBuffer);
//     const originalMetadata = await watermarkService.getImageMetadata(originalBuffer);
//     const watermarkedMetadata = await watermarkService.getImageMetadata(watermarkResult.watermarkedBuffer);
//     const watermarkPath = watermarkService.getWatermarkPath();
//     const watermarkExists = watermarkService.isWatermarkFileExists();

//     return res.status(200).json({
//       status: 'success',
//       data: {
//         originalSize: originalBuffer.length,
//         watermarkedSize: watermarkResult.watermarkedBuffer.length,
//         watermarkApplied: watermarkResult.watermarkApplied,
//         originalDimensions: {
//           width: originalMetadata.width,
//           height: originalMetadata.height,
//           format: originalMetadata.format,
//         },
//         watermarkedDimensions: {
//           width: watermarkedMetadata.width,
//           height: watermarkedMetadata.height,
//           format: watermarkedMetadata.format,
//         },
//         watermarkEnabled: process.env.IMAGE_WATERMARK_ENABLED !== 'false',
//         watermarkFileExists: watermarkExists,
//         watermarkPath: watermarkPath,
//         watermarkResult: watermarkResult,
//       },
//     });
//   } catch (error) {
//     console.error('Error in watermark test:', error);
//     return res.status(500).json({
//       status: 'error',
//       message: error instanceof Error ? error.message : 'Server error',
//     });
//   }
// };
