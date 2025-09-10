import { Request, Response } from 'express';
import cloudinary from './clodinaryConfig';
import fs from 'fs';

// Upload image
export const generateUploadUrl = async (req: Request, res: Response) => {
  try {
    const { imageUrl } = req.body;

    if (!imageUrl) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide imageUrl',
      });
    }

    // Download image temporarily
    const response = await fetch(imageUrl);
    const buffer = Buffer.from(await response.arrayBuffer());
    const tempFilePath = `./temp-${Date.now()}.jpg`;
    fs.writeFileSync(tempFilePath, buffer);

    const result = await cloudinary.uploader.upload(tempFilePath, {
      folder: 'nextdeal',
    });

    fs.unlinkSync(tempFilePath); // Clean up temp file

    return res.status(200).json({
      status: 'success',
      message: 'Upload URL generated successfully',
      data: {
        url: result.secure_url,
        key: result.public_id,
        expiresIn: 0, // Cloudinary URLs are permanent unless deleted
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to upload image',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Get document (just return Cloudinary URL)
export const getDocumentFromBucket = async (req: Request, res: Response) => {
  try {
    const { key } = req.body;
    if (!key)
      return res.status(400).json({ status: 'error', message: 'Key is required' });

    const url = cloudinary.url(key, { secure: true });

    res.status(200).json({
      status: 'success',
      message: 'Document URL generated successfully',
      data: { url, key, expiresIn: 0 },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Internal Server Error',
    });
  }
};

// Delete object
export const deleteObjectFromBucket = async (req: Request, res: Response) => {
  try {
    const { key } = req.body;
    if (!key)
      return res.status(400).json({ status: 'error', message: 'Key is required' });

    await cloudinary.uploader.destroy(key);

    res.status(200).json({
      status: 'success',
      message: 'Object deleted successfully',
      data: { key },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Internal Server Error',
    });
  }
};


// awsControllers.ts
// import {
//   DeleteObjectCommand,
//   GetObjectCommand,
//   GetObjectCommandInput,
//   PutObjectCommand,
//   S3Client,
// } from '@aws-sdk/client-s3';
// import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
// import axios from 'axios';
// import { Request, Response } from 'express';

// // import nsfwDetectionService from '../../nsfw/nsfwDetectionService';

// // Define types for better type safety
// interface GenerateUploadUrlRequest {
//   key: string;
//   contentType: string;
//   expDate?: number; // Optional, we'll provide a default
//   imageUrl: string;
// }

// interface GenerateUploadUrlResponse {
//   status: 'success' | 'error';
//   message: string;
//   data?: {
//     url: string;
//     key: string;
//     expiresIn: number;
//     nsfwDetails?: {
//       label: string;
//       confidence: string;
//     };
//   };
// }

// const s3 = new S3Client({
//   credentials: {
//     accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
//     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
//   },
//   region: process.env.AWS_REGION,
// });

// const DEFAULT_EXPIRATION = 3600; // 1 hour in seconds

// const generateUrlForUploading = async (
//   bucketName: string,
//   key: string,
//   expDate: number,
//   type: string
// ): Promise<string> => {
//   const command = new PutObjectCommand({
//     Bucket: bucketName,
//     Key: key,
//     ContentType: type,
//   });

//   return getSignedUrl(s3, command, { expiresIn: expDate });
// };

// export const generateUploadUrl = async (req: Request, res: Response<GenerateUploadUrlResponse>) => {
//   try {
//     const { key, contentType, expDate = DEFAULT_EXPIRATION, imageUrl } = req.body as GenerateUploadUrlRequest;
//     const bucketName = process.env.AWS_S3_BUCKET;

//     if (!bucketName) {
//       throw new Error('AWS_S3_BUCKET environment variable is not set');
//     }

//     if (!key || !contentType || !imageUrl) {
//       return res.status(400).json({
//         status: 'error',
//         message: 'Please provide key, contentType, and imageUrl.',
//       });
//     }

//     // Validate content type
//     if (!contentType.match(/^[a-zA-Z]+\/[a-zA-Z0-9\-\+\.]+$/)) {
//       return res.status(400).json({
//         status: 'error',
//         message: 'Invalid content type format',
//       });
//     }

//     // Check if the content type is an image
//     if (!contentType.startsWith('image/')) {
//       return res.status(400).json({
//         status: 'error',
//         message: 'Only image files are allowed',
//       });
//     }

//     try {
//       // Download the image
//       const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
//       // const imageBuffer = Buffer.from(response.data);
//       // Check for NSFW content
//       // const nsfwResult = await nsfwDetectionService.predict(imageBuffer);

//       // if (nsfwResult.isAdult) {
//       //   return res.status(400).json({
//       //     status: 'error',
//       //     message: 'Image contains inappropriate content',
//       //     data: {
//       //       url: '',
//       //       key,
//       //       expiresIn: expDate,
//       //       nsfwDetails: {
//       //         label: nsfwResult.label,
//       //         confidence: nsfwResult.confidence
//       //       }
//       //     }
//       //   });
//       // }

//       const url = await generateUrlForUploading(bucketName, key, expDate, contentType);

//       return res.status(200).json({
//         status: 'success',
//         message: 'Upload URL generated successfully',
//         data: {
//           url,
//           key,
//           expiresIn: expDate,
//         },
//       });
//     } catch (error) {
//       console.error('Error processing image:', error);
//       return res.status(500).json({
//         status: 'error',
//         message: 'Failed to process image for NSFW content',
//       });
//     }
//   } catch (error) {
//     console.error('Error generating upload URL:', error);
//     return res.status(500).json({
//       status: 'error',
//       message: error instanceof Error ? error.message : 'Server error',
//     });
//   }
// };

// export const generatePresignedUrl = async (key: string): Promise<string> => {
//   const bucketName = process.env.AWS_S3_BUCKET;

//   if (!bucketName) {
//     throw new Error('AWS_S3_BUCKET environment variable is not set');
//   }

//   const params: GetObjectCommandInput = {
//     Bucket: bucketName,
//     Key: key,
//   };

//   const command = new GetObjectCommand(params);
//   return getSignedUrl(s3, command, { expiresIn: DEFAULT_EXPIRATION });
// };

// export const getDocumentFromBucket = async (req: Request, res: Response) => {
//   try {
//     const { key } = req.body;

//     if (!key) {
//       return res.status(400).json({
//         status: 'error',
//         message: 'Please provide the document key',
//       });
//     }

//     const presignedUrl = await generatePresignedUrl(key);

//     return res.status(200).json({
//       status: 'success',
//       message: 'Document URL generated successfully',
//       data: {
//         url: presignedUrl,
//         key,
//         expiresIn: DEFAULT_EXPIRATION,
//       },
//     });
//   } catch (error) {
//     console.error('Error retrieving document:', error);
//     return res.status(500).json({
//       status: 'error',
//       message: error instanceof Error ? error.message : 'Internal Server Error',
//     });
//   }
// };

// export const deleteObjectFromBucket = async (req: Request, res: Response) => {
//   try {
//     const { key } = req.body;

//     if (!key) {
//       return res.status(400).json({
//         status: 'error',
//         message: 'Please provide the object key to delete',
//       });
//     }

//     const bucketName = process.env.AWS_S3_BUCKET;

//     if (!bucketName) {
//       throw new Error('AWS_S3_BUCKET environment variable is not set');
//     }

//     const command = new DeleteObjectCommand({
//       Bucket: bucketName,
//       Key: key,
//     });

//     await s3.send(command);

//     return res.status(200).json({
//       status: 'success',
//       message: 'Object deleted successfully',
//       data: {
//         key,
//       },
//     });
//   } catch (error) {
//     console.error('Error deleting object:', error);
//     return res.status(500).json({
//       status: 'error',
//       message: error instanceof Error ? error.message : 'Internal Server Error',
//     });
//   }
// };
