import express from 'express';

import { EditUserProfile } from '@/api/controllers/profile/editProfile';
import { deleteUserAccount, getUserProfile, resendDeleteAccountOTP } from '@/api/controllers/profile/userprofile';

import { updateUserProfile } from '../../controllers/profile/updateProfile';

const router = express.Router();

// PUT /api/users/:id
router.post('/profile-update', updateUserProfile);
router.post('/get-userProfile', getUserProfile);
router.post('/profile-edit', EditUserProfile);
router.post('/delete-account', deleteUserAccount);
router.post('/resend-delete-otp', resendDeleteAccountOTP);

export default router;
