import { Router } from 'express';
import multer from 'multer';
import path from 'path';

import { TempAuthController } from './tempAuthController';
import { TempCarController } from './tempCarController';

const router = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

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
router.post('/cars', upload.array('images', 10), TempCarController.createTempCar);
router.get('/cars', TempCarController.getAllCars);
router.get('/cars/user/:userId', TempCarController.getTempUserCars);
router.delete('/cars/:carId', TempCarController.deleteTempCar);
router.post('/bulk-cars', TempCarController.bulkCreateTempCars);

// Image Upload Route with Rekognition
router.post('/upload-car-images-with-rekognition', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // For now, just return the file info
    // You can integrate with AWS Rekognition here later
    res.status(200).json({
      message: 'Image uploaded successfully',
      data: {
        url: `/uploads/${req.file.filename}`,
        key: req.file.filename,
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
