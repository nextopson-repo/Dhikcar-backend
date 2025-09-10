import { Request, Response } from 'express';

import { SuspendedUser } from '@/api/entity/SuspendedUser';
import { UserAuth } from '@/api/entity/UserAuth';
import { AppDataSource } from '@/server';

// Get all suspended users
export const getSuspendedUsers = async (req: Request, res: Response) => {
  try {
    const repo = AppDataSource.getRepository(SuspendedUser);
    const users = await repo.find({ order: { createdAt: 'DESC' } });
    return res.status(200).json({ message: 'Suspended users fetched', data: users });
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching suspended users', error });
  }
};

// Suspend a user
export const suspendUser = async (req: Request, res: Response) => {
  const { mobileNumber, reason } = req.body;
  if (!mobileNumber || !reason) {
    return res.status(400).json({ message: 'Mobile number and reason are required.' });
  }
  try {
    const repo = AppDataSource.getRepository(SuspendedUser);
    const userRepo = AppDataSource.getRepository(UserAuth);
    // Check if already suspended
    const already = await repo.findOne({ where: { mobileNumber } });
    if (already) {
      return res.status(400).json({ message: 'User already suspended.' });
    }
    // Try to find user by mobile
    const user = await userRepo.findOne({ where: { mobileNumber } });
    const suspended = repo.create({
      userId: user ? user.id : null,
      mobileNumber,
      email: user?.email || null,
      fullName: user?.fullName || null,
      reason,
    });
    await repo.save(suspended);
    return res.status(201).json({ message: 'User suspended successfully', data: suspended });
  } catch (error) {
    return res.status(500).json({ message: 'Error suspending user', error });
  }
};

// Unsuspend a user
export const unsuspendUser = async (req: Request, res: Response) => {
  const { mobileNumber } = req.body;
  if (!mobileNumber) {
    return res.status(400).json({ message: 'Mobile number is required.' });
  }
  try {
    const repo = AppDataSource.getRepository(SuspendedUser);
    const user = await repo.findOne({ where: { mobileNumber } });
    if (!user) {
      return res.status(404).json({ message: 'User not found in suspended list.' });
    }
    await repo.remove(user);
    return res.status(200).json({ message: 'User unsuspended successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Error unsuspending user', error });
  }
};
