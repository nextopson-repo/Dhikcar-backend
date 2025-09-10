// import { PropertyImages } from '@/api/entity/PropertyImages';
// import awsRekognitionService from '@/api/rekognition/awsRekognitionService';
// import nsfwDetectionService from '@/api/nsfw/nsfwDetectionService';
// import contactDetectionService from '@/api/contactDetection/contactDetectionService';
// import watermarkService from '@/api/services/watermarkService';
// import { AppDataSource } from '@/server';
// import { Request, Response } from 'express';
// import multer from 'multer';

// // Configure multer for memory storage
// const upload = multer({ storage: multer.memoryStorage() });

// // Define types for better type safety
// interface UploadRequest extends Request {
//   body: {
//     propertyId?: string;
//     quality?: string;
//     userId: string;
//   };
//   file?: Express.Multer.File;
// }

// interface UploadResponse {
//   status: 'success' | 'error';
//   message: string;
//   data?: {
//     url?: string;
//     key?: string;
//     imgClassifications?: string;
//     accurencyPercent?: string;
//     compressionRatio?: string;
//     originalSize?: string;
//     compressedSize?: string;
//     labels?: any[];
//     moderationLabels?: any[];
//     rekognitionResult?: any;
//     nsfwResult?: any;
//     contactDetectionResult?: any;
//     watermarkResult?: any;
//   };
//   detectedItems?: {
//     phoneNumbers: string[];
//     emailAddresses: string[];
//     socialMediaHandles: string[];
//   };
// }

// // Generate unique key using timestamp and random number
// function generateUniqueKey(originalname: string): string {
//   const timestamp = Date.now();
//   const random = Math.floor(Math.random() * 10000);
//   return `${timestamp}-${random}-${originalname}`;
// }

// export const uploadPropertyImagesWithRekognitionController = async (req: UploadRequest, res: Response<UploadResponse>) => {
//   try {
//     // Check if file exists in the request
//     if (!req.file) {
//       return res.status(400).json({
//         status: 'error',
//         message: 'No file uploaded.',
//       });
//     }

//     const { propertyId, quality, userId } = req.body;

//     // Check if userId is provided
//     if (!userId) {
//       return res.status(400).json({
//         status: 'error',
//         message: 'userId is required in request body.',
//       });
//     }

//     const imageBuffer = req.file.buffer;
//     const contentType = req.file.mimetype;

//     // Check if AWS Rekognition is enabled and configured
//     if (!awsRekognitionService.isEnabled()) {
//       return res.status(500).json({
//         status: 'error',
//         message: 'AWS Rekognition service is disabled. Please enable it in environment variables.',
//       });
//     }

//     if (!awsRekognitionService.isConfigured()) {
//       return res.status(500).json({
//         status: 'error',
//         message: 'AWS Rekognition service not configured. Please check AWS credentials.',
//       });
//     }

//     // Step 1: Analyze image with AWS Rekognition
//     let rekognitionResult;
//     try {
//       rekognitionResult = await awsRekognitionService.analyzeImage(imageBuffer);
//     } catch (rekognitionError) {
//       console.error('AWS Rekognition analysis failed:', rekognitionError);
//       return res.status(500).json({
//         status: 'error',
//         message: 'Image analysis failed. Please try again.',
//       });
//     }

//     // Check for inappropriate content
//     if (rekognitionResult.isInappropriate) {
//       return res.status(400).json({
//         status: 'error',
//         message: 'Image contains inappropriate content and cannot be uploaded',
//       });
//     }

//     // Check for contact information
//     if (rekognitionResult.hasContactInfo) {
//       return res.status(400).json({
//         status: 'error',
//         message: 'Image contains contact information (phone numbers, email addresses, etc.) and cannot be uploaded for security reasons.',
//       });
//     }

//     // Additional NSFW check using dedicated NSFW detection service
//     let nsfwResult = null;
//     try {
//       nsfwResult = await nsfwDetectionService.predict(imageBuffer);

//       if (nsfwResult.isAdult) {
//         return res.status(400).json({
//           status: 'error',
//           message: 'Image contains inappropriate content and cannot be uploaded',
//         });
//       }
//     } catch (nsfwError) {
//       console.error('NSFW detection failed:', nsfwError);
//       // Continue with upload even if NSFW detection fails
//       nsfwResult = {
//         label: 'neutral',
//         confidence: '0.00% (detection failed)',
//         isAdult: false
//       };
//     }

//     // Additional contact detection check using dedicated contact detection service
//     let contactDetectionResult = null;
//     try {
//       contactDetectionResult = await contactDetectionService.detectContactInfo(imageBuffer);

//       if (contactDetectionResult.hasContactInfo) {
//         return res.status(400).json({
//           status: 'error',
//           message: 'Image contains contact information (phone numbers, email addresses, etc.) and cannot be uploaded for security reasons.',
//           detectedItems: contactDetectionResult.detectedItems
//         });
//       }
//     } catch (contactError) {
//       console.error('Contact detection failed:', contactError);
//       // Continue with upload even if contact detection fails
//       contactDetectionResult = {
//         hasContactInfo: false,
//         detectedItems: {
//           phoneNumbers: [],
//           emailAddresses: [],
//           socialMediaHandles: []
//         },
//         confidence: '0.00% (detection failed)'
//       };
//     }

//     // Add watermark to the image
//     let watermarkedImageBuffer = imageBuffer;
//     let watermarkResult = null;
//     try {
//       watermarkResult = await watermarkService.addWatermark(imageBuffer);
//       watermarkedImageBuffer = watermarkResult.watermarkedBuffer;
//     } catch (watermarkError) {
//       console.error('Watermarking failed, using original image:', watermarkError);
//     }

//     // Step 2: Compress image
//     let compressionResult;
//     try {
//       const compressionQuality = quality ? parseInt(quality) : parseInt(process.env.IMAGE_COMPRESSION_QUALITY || '80');
//       compressionResult = await awsRekognitionService.compressImage(watermarkedImageBuffer, compressionQuality);
//     } catch (compressionError) {
//       console.error('Image compression failed:', compressionError);
//       return res.status(500).json({
//         status: 'error',
//         message: 'Image compression failed. Please try again.',
//       });
//     }

//     // Step 3: Upload compressed image to S3
//     let compressedUrl;
//     let key;
//     try {
//       key = `property-images/${propertyId || 'temp'}/${generateUniqueKey(req.file!.originalname)}`;
//       compressedUrl = await awsRekognitionService.uploadCompressedImage(
//         compressionResult.compressedBuffer,
//         key,
//         contentType
//       );
//     } catch (uploadError) {
//       console.error('S3 upload failed:', uploadError);
//       return res.status(500).json({
//         status: 'error',
//         message: 'Failed to upload image to S3. Please try again.',
//       });
//     }

//     // Step 4: Save to database
//     try {
//       const propertyImageRepo = AppDataSource.getRepository(PropertyImages);
//       const propertyImage = new PropertyImages();
//       propertyImage.imageKey = key;
//       propertyImage.presignedUrl = compressedUrl;
//       propertyImage.createdBy = userId;
//       propertyImage.updatedBy = userId;

//       // Set classification based on Rekognition results
//       if (rekognitionResult.roomType) {
//         propertyImage.imgClassifications = rekognitionResult.roomType;
//         if (rekognitionResult.confidence) {
//           propertyImage.accurencyPercent = Math.round(rekognitionResult.confidence);
//         }
//       } else {
//         propertyImage.imgClassifications = 'Other';
//         propertyImage.accurencyPercent = 0;
//       }

//       const savedImage = await propertyImageRepo.save(propertyImage);

//       return res.status(200).json({
//         status: 'success',
//         message: 'Image uploaded and processed successfully with AWS Rekognition',
//         data: {
//           url: compressedUrl,
//           key,
//           imgClassifications: savedImage.imgClassifications,
//           accurencyPercent: savedImage.accurencyPercent?.toString(),
//           compressionRatio: `${compressionResult.compressionRatio.toFixed(2)}%`,
//           originalSize: `${(compressionResult.originalSize / 1024).toFixed(2)} KB`,
//           compressedSize: `${(compressionResult.compressedSize / 1024).toFixed(2)} KB`,
//           labels: rekognitionResult.labels,
//           moderationLabels: rekognitionResult.moderationLabels,
//           rekognitionResult,
//           nsfwResult,
//           contactDetectionResult,
//           watermarkResult
//         },
//       });
//     } catch (dbError) {
//       console.error('Database save failed:', dbError);
//       return res.status(500).json({
//         status: 'error',
//         message: 'Failed to save image data. Please try again.',
//       });
//     }

//   } catch (error) {
//     console.error('Error processing image with Rekognition:', error);
//     return res.status(500).json({
//       status: 'error',
//       message: error instanceof Error ? error.message : 'Server error',
//     });
//   }
// };

// // Debug endpoint to check Rekognition service status
// export const checkRekognitionStatusController = async (req: UploadRequest, res: Response) => {
//   try {
//     const configInfo = awsRekognitionService.getConfigInfo();
//     const nsfwInfo = nsfwDetectionService.getServiceInfo();
//     const contactInfo = contactDetectionService.getServiceInfo();

//     return res.status(200).json({
//       status: 'success',
//       data: {
//         configured: configInfo.configured,
//         enabled: configInfo.enabled,
//         region: configInfo.region,
//         bucket: configInfo.bucket,
//         minConfidence: configInfo.minConfidence,
//         maxLabels: configInfo.maxLabels,
//         compressionEnabled: configInfo.compressionEnabled,
//         compressionQuality: configInfo.compressionQuality,
//         nsfwDetection: nsfwInfo,
//         contactDetection: contactInfo,
//         watermarkService: watermarkService.getServiceStatus(),
//         roomTypeMapping: {
//           'Bathroom': ['bathroom', 'toilet', 'shower', 'bathtub', 'sink', 'mirror'],
//           'Bedroom': ['bedroom', 'bed', 'mattress', 'pillow', 'nightstand', 'dresser'],
//           'Kitchen': ['kitchen', 'stove', 'refrigerator', 'microwave', 'sink', 'counter'],
//           'Livingroom': ['living room', 'sofa', 'couch', 'tv', 'coffee table', 'fireplace'],
//           'Dining': ['dining room', 'dining table', 'chair', 'table', 'restaurant'],
//           'Balcony': ['balcony', 'terrace', 'outdoor', 'patio', 'deck'],
//           'Other': ['room', 'interior', 'furniture', 'appliance']
//         },
//         inappropriateLabels: [
//           'Explicit Nudity', 'Violence', 'Visually Disturbing', 'Rude Gestures',
//           'Drugs', 'Tobacco', 'Alcohol', 'Gambling', 'Hate Symbols'
//         ],
//         contactLabels: [
//           'Phone', 'Mobile', 'Call', 'Contact', 'Email', 'Address', 'Number',
//           'WhatsApp', 'Telegram', 'Social Media', 'Instagram', 'Facebook', 'Twitter',
//           'LinkedIn', 'YouTube', 'TikTok', 'Handle', 'Username', 'Profile'
//         ],
//         environment: {
//           AWS_REKOGNITION_ENABLED: process.env.AWS_REKOGNITION_ENABLED,
//           AWS_REKOGNITION_MIN_CONFIDENCE: process.env.AWS_REKOGNITION_MIN_CONFIDENCE,
//           AWS_REKOGNITION_MAX_LABELS: process.env.AWS_REKOGNITION_MAX_LABELS,
//           IMAGE_COMPRESSION_ENABLED: process.env.IMAGE_COMPRESSION_ENABLED,
//           IMAGE_COMPRESSION_QUALITY: process.env.IMAGE_COMPRESSION_QUALITY,
//           CONTACT_DETECTION_ENABLED: process.env.CONTACT_DETECTION_ENABLED,
//           NSFW_DETECTION_ENABLED: process.env.NSFW_DETECTION_ENABLED,
//           CONTACT_DETECTION_USE_AWS: process.env.CONTACT_DETECTION_USE_AWS,
//           IMAGE_WATERMARK_ENABLED: process.env.IMAGE_WATERMARK_ENABLED
//         }
//       }
//     });
//   } catch (error) {
//     console.error('Error checking Rekognition status:', error);
//     return res.status(500).json({
//       status: 'error',
//       message: error instanceof Error ? error.message : 'Server error',
//     });
//   }
// };

// // Test endpoint for Rekognition analysis only
// export const testRekognitionAnalysisController = async (req: UploadRequest, res: Response) => {
//   try {
//     if (!req.file) {
//       return res.status(400).json({
//         status: 'error',
//         message: 'No image uploaded for analysis'
//       });
//     }

//     const rekognitionResult = await awsRekognitionService.analyzeImage(req.file.buffer);

//     return res.status(200).json({
//       status: 'success',
//       data: {
//         roomType: rekognitionResult.roomType,
//         confidence: rekognitionResult.confidence,
//         isInappropriate: rekognitionResult.isInappropriate,
//         labels: rekognitionResult.labels,
//         moderationLabels: rekognitionResult.moderationLabels
//       }
//     });

//   } catch (error) {
//     console.error('Error in Rekognition analysis test:', error);
//     return res.status(500).json({
//       status: 'error',
//       message: error instanceof Error ? error.message : 'Server error',
//     });
//   }
// };

// // Test endpoint for image compression only
// export const testImageCompressionController = async (req: UploadRequest, res: Response) => {
//   try {
//     if (!req.file) {
//       return res.status(400).json({
//         status: 'error',
//         message: 'No image uploaded for compression'
//       });
//     }

//     const { quality } = req.body;
//     const compressionQuality = quality ? parseInt(quality) : parseInt(process.env.IMAGE_COMPRESSION_QUALITY || '80');

//     const compressionResult = await awsRekognitionService.compressImage(req.file.buffer, compressionQuality);

//     return res.status(200).json({
//       status: 'success',
//       data: {
//         originalSize: `${(compressionResult.originalSize / 1024).toFixed(2)} KB`,
//         compressedSize: `${(compressionResult.compressedSize / 1024).toFixed(2)} KB`,
//         compressionRatio: `${compressionResult.compressionRatio.toFixed(2)}%`,
//         quality: compressionQuality
//       }
//     });

//   } catch (error) {
//     console.error('Error in image compression test:', error);
//     return res.status(500).json({
//       status: 'error',
//       message: error instanceof Error ? error.message : 'Server error',
//     });
//   }
// };

// // Test endpoint for NSFW detection only
// export const testNsfwDetectionController = async (req: UploadRequest, res: Response) => {
//   try {
//     if (!req.file) {
//       return res.status(400).json({
//         status: 'error',
//         message: 'No image uploaded for NSFW detection'
//       });
//     }

//     const nsfwResult = await nsfwDetectionService.predict(req.file.buffer);

//     return res.status(200).json({
//       status: 'success',
//       data: {
//         isAdult: nsfwResult.isAdult,
//         label: nsfwResult.label,
//         confidence: nsfwResult.confidence
//       }
//     });

//   } catch (error) {
//     console.error('Error in NSFW detection test:', error);
//     return res.status(500).json({
//       status: 'error',
//       message: error instanceof Error ? error.message : 'Server error',
//     });
//   }
// };

// // Test endpoint for contact detection only
// export const testContactDetectionController = async (req: UploadRequest, res: Response) => {
//   try {
//     if (!req.file) {
//       return res.status(400).json({
//         status: 'error',
//         message: 'No image uploaded for contact detection'
//       });
//     }

//     const contactResult = await contactDetectionService.detectContactInfo(req.file.buffer);

//     return res.status(200).json({
//       status: 'success',
//       data: {
//         hasContactInfo: contactResult.hasContactInfo,
//         detectedItems: contactResult.detectedItems,
//         confidence: contactResult.confidence
//       }
//     });

//   } catch (error) {
//     console.error('Error in contact detection test:', error);
//     return res.status(500).json({
//       status: 'error',
//       message: error instanceof Error ? error.message : 'Server error',
//     });
//   }
// };
