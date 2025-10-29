import express from 'express';

import { EditUserProfile, uploadProfileImage } from '@/api/controllers/profile/editProfile';
import { deleteUserAccount, getUserProfile, resendDeleteAccountOTP } from '@/api/controllers/profile/userprofile';

import { updateUserProfile } from '../../controllers/profile/updateProfile';
import { authenticate } from '@/api/middlewares/auth/Authenticate';

const router = express.Router();

// PUT /api/users/:id
router.post('/profile-update', authenticate, uploadProfileImage, EditUserProfile);
router.post('/get-userProfile', getUserProfile);
router.post('/profile-edit', authenticate, uploadProfileImage, EditUserProfile);
router.post('/delete-account', deleteUserAccount);
router.post('/resend-delete-otp', resendDeleteAccountOTP);

export default router;
