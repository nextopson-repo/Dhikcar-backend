import express from 'express';
import multer from 'multer';

import { ServiceResponse } from '../../common/models/serviceResponse';
import nsfwDetectionService from './nsfwDetectionService';

const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

router.post('/predict', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image uploaded' });
    }

    const imageBuffer = req.file.buffer;
    const prediction = await nsfwDetectionService.predict(imageBuffer);
    return res.json({ success: true, data: prediction });
  } catch (error) {
    console.error('NSFW prediction error:', error);
    return res.status(500).json({ success: false, error: 'Error processing image' });
  }
});

export default router;
