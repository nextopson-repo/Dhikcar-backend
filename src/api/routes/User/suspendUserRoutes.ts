import express from 'express';

import { getSuspendedUsers, suspendUser, unsuspendUser } from '@/api/controllers/User/suspendUserController';

const router = express.Router();

router.get('/list', getSuspendedUsers);
router.post('/', suspendUser);
router.post('/unsuspend', unsuspendUser);

export default router;
