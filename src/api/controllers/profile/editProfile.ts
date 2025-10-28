import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import cloudinary from '@/api/controllers/s3/clodinaryConfig';

import { UserAuth } from '@/api/entity';
import { env } from '@/common/utils/envConfig';
import { sendEmailOTP } from '@/common/utils/mailService';
import { AppDataSource } from '@/server';

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!') as any, false);
    }
  }
});

// Export multer middleware for single file upload
export const uploadProfileImage = upload.single('profileImage');

export const EditUserProfile = async (req: Request, res: Response) => {
  const {userProfileUrl, email, fullName, mobileNumber, address, landmark, city, state, pin, socialMediaLinks } = req.body;

  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ message: 'User not authenticated' });
  }

  // Handle image upload if provided
  let uploadedImageUrl = null;
  if (req.file) {
    try {
      // Upload image to Cloudinary
      const result = await cloudinary.uploader.upload_stream(
        {
          resource_type: 'image',
          folder: 'user-profiles',
          public_id: `user-${userId}-${Date.now()}`,
          transformation: [
            { width: 500, height: 500, crop: 'fill', gravity: 'face' },
            { quality: 'auto', fetch_format: 'auto' }
          ]
        },
        (error, result) => {
          if (error) {
            console.error('Cloudinary upload error:', error);
            throw error;
          }
          return result;
        }
      ).end(req.file.buffer);

      // Wait for the upload to complete
      const uploadResult = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          {
            resource_type: 'image',
            folder: 'user-profiles',
            public_id: `user-${userId}-${Date.now()}`,
            transformation: [
              { width: 500, height: 500, crop: 'fill', gravity: 'face' },
              { quality: 'auto', fetch_format: 'auto' }
            ]
          },
          (error, result) => {
            if (error) {
              reject(error);
            } else {
              resolve(result);
            }
          }
        ).end(req.file!.buffer);
      });

      uploadedImageUrl = (uploadResult as any).secure_url;
    } catch (error) {
      console.error('Error uploading image:', error);
      return res.status(500).json({ message: 'Error uploading image' });
    }
  }

  try {
    const userRepo = AppDataSource.getRepository(UserAuth);
    const user = await userRepo.findOne({
      where: { id: userId },
      select: ["email", "id", "userProfileUrl", "mobileNumber", "fullName" ,  "userType","address","landmark","city", "state", "pin", "socialMediaLinks"],
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update fields
    if (userProfileUrl) {
      user.userProfileUrl = userProfileUrl;
    }

    // Update profile image if uploaded
    if (uploadedImageUrl) {
      user.userProfileUrl = uploadedImageUrl;
      user.profileImg = uploadedImageUrl;
    }

    if (email) {
      user.email = email;
    }

    if (mobileNumber) {
      user.mobileNumber = mobileNumber;
    }

    if (fullName) {
      user.fullName = fullName;
    }

    if (address) {
      user.address = address;
    }

    if (landmark) {
      user.landmark = landmark;
    }

    if (city) {
      user.city = city;
    }

    if (state) {
      user.state = state;
    }

    if (pin) {
      user.pin = pin;
    }

    if (socialMediaLinks) {
      user.socialMediaLinks = socialMediaLinks;
    }

    // Send email OTP if email is changed
    if (email && email !== user.email) {
      // Generate new email OTP
      user.generateEmailOTP();
      // Send OTP via email
      await sendEmailOTP(email, user.emailOTP!);
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        userType: user.userType || null,
        fullName: user.fullName,
        mobileNumber: user.mobileNumber,
        address: user.address,
        landmark: user.landmark,
        city: user.city,
        pin: user.pin,
        userProfileUrl: user.userProfileUrl,
        profileImg: user.profileImg,
        socialMediaLinks: user.socialMediaLinks,
      },
      env.ACCESS_SECRET_KEY,
      { expiresIn: '1d' }
    );

    await user.save();

    return res.json({
      message: 'User profile updated successfully',
      data: user,
      token: token,
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
