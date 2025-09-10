import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { UserAuth } from '@/api/entity';
import { env } from '@/common/utils/envConfig';
import { sendEmailOTP } from '@/common/utils/mailService';
import { AppDataSource } from '@/server';

export const EditUserProfile = async (req: Request, res: Response) => {
  const { userId, userProfileKey, email, fullName, mobileNumber, address, landmark, city, pin, socialMediaLinks } =
    req.body;

  if (!userId) {
    return res.status(400).json({ message: 'userId is required in request body' });
  }

  try {
    const userRepo = AppDataSource.getRepository(UserAuth);
    const user = await userRepo.findOne({
      where: { id: userId },
      // select: ["email", "id", "userProfileKey", "mobileNumber", "fullName" , "profileImg", "userType"],
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update fields
    if (userProfileKey) {
      user.userProfileKey = userProfileKey;
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
        userProfileKey: user.userProfileKey,
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
