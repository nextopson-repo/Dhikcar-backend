import { Router } from 'express';
import multer from 'multer';
import cloudinary from '../controllers/s3/clodinaryConfig';

import { TempAuthController } from './tempAuthController';
import { TempCarController } from './tempCarController';

const router = Router();

// Configure multer to store files in memory (no local disk writes)
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// Temporary Auth Routes
router.post('/signup/send-otp', TempAuthController.sendSignupOTP);
router.post('/signup/verify-otp', TempAuthController.verifySignupOTP);
router.post('/login/send-otp', TempAuthController.sendLoginOTP);
router.post('/login/verify-otp', TempAuthController.verifyLoginOTP);
router.post('/signup', TempAuthController.createTempUser);
router.post('/login', TempAuthController.loginTempUser);
router.get('/users', TempAuthController.getTempUsers);
router.delete('/users/:userId', TempAuthController.deleteTempUser);
router.delete('/users/:userId/alternative', TempAuthController.deleteTempUserAlternative);
router.delete('/users/:userId/robust', TempAuthController.deleteTempUserRobust);
router.delete('/users/:userId/targeted', TempAuthController.deleteTempUserTargeted);
router.delete('/users/:userId/final', TempAuthController.deleteTempUserFinal);
router.delete('/users/:userId/ultimate', TempAuthController.deleteTempUserUltimate);
router.post('/handle-real-signup', TempAuthController.handleRealUserSignup);
router.post('/bulk-users', TempAuthController.bulkCreateTempUsers);

// Temporary Property Routes
router.post('/cars', upload.array('images', 10), TempCarController.createTempCar as any);
router.get('/cars', TempCarController.getAllCars);
router.get('/cars/user/:userId', TempCarController.getTempUserCars);
router.delete('/cars/:carId', TempCarController.deleteTempCar);
router.post('/bulk-cars', TempCarController.bulkCreateTempCars);

// Image Upload Route with Rekognition (placeholder) - direct upload to Cloudinary
router.post('/upload-car-images-with-rekognition', upload.single('file'), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const file = req.file as Express.Multer.File;
    const uploadResult: any = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'dhikcar/cars', resource_type: 'auto' },
        (error, result) => {
          if (error) return reject(error);
          return resolve(result);
        }
      );
      stream.end(file.buffer);
    });

    res.status(200).json({
      message: 'Image uploaded successfully',
      data: {
        url: uploadResult?.secure_url,
        key: uploadResult?.public_id,
        imgClassifications: 'Other',
        accurencyPercent: 100,
      },
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
