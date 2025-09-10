import { Request, Response } from 'express';

import { UserAuth } from '@/api/entity';
import { AppDataSource } from '@/server';

export const updateUserProfile = async (req: Request, res: Response) => {
  const { userId, fullName, email, userType, userProfileKey, socialMediaLinks, address, landmark, city, pin } =
    req.body;
  console.log('Received update request body:', req.body);
  try {
    const userRepo = AppDataSource.getRepository(UserAuth);
    const user = await userRepo.findOne({ where: { id: userId } });
    if (!user) {
      console.log('❌ User not found for id:', userId);
      return res.status(404).json({ message: 'User not found' });
    }
    if (fullName) user.fullName = fullName;
    if (email) user.email = email;
    if (userType) user.userType = userType;
    if (userProfileKey) user.userProfileKey = userProfileKey;
    if (socialMediaLinks) user.socialMediaLinks = socialMediaLinks;
    if (address) user.address = address;
    if (landmark) user.landmark = landmark;
    if (city) user.city = city;
    if (pin) user.pin = pin;
    await user.save();
    return res.json({ message: 'Profile updated', user });
  } catch (error) {
    console.error('❌ Error in updateUserProfile:', error);
    return res.status(500).json({ message: 'Error updating profile', error });
  }
};
