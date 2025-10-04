import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { AppDataSource } from '@/server';
import { CarImages } from '@/api/entity/CarImages';
// import watermarkService from '@/api/services/watermarkService';
import cloudinary from '../s3/clodinaryConfig';

// Use CommonJS-compatible path resolution
const __dirname = path.resolve();

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
      // For now, just use the original image without watermarking
      watermarkResult = { watermarkApplied: false };
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

