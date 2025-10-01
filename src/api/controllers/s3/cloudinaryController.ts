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


