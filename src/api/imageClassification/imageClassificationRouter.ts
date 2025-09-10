import express from 'express';
import multer from 'multer';

import { ServiceResponse } from '../../common/models/serviceResponse';
import imageClassificationService from './imageClassificationService';

const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

router.post('/predict/room', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image uploaded' });
    }

    const imageBuffer = req.file.buffer;
    const prediction = await imageClassificationService.predictRoom(imageBuffer);
    return res.json({ success: true, data: prediction });
  } catch (error) {
    console.error('Prediction error (room):', error);
    return res.status(500).json({ success: false, error: 'Error processing image' });
  }
});

export default router;
