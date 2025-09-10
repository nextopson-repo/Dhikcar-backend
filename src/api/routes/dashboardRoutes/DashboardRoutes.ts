import { Router } from 'express';

import { analyticCar } from '@/api/controllers/Dashboard/AnalyticCar';
import { createCarEnquiry, getAllCarEnquiries } from '@/api/controllers/Dashboard/CarEnquiries';
import { createSavedCar, getSavedCars, removeSavedCar } from '@/api/controllers/Dashboard/DashboardController';

const router = Router();
router.post('/analytic-car', analyticCar);
router.post('/get-saved-cars', getSavedCars);
router.post('/create-saved-car', createSavedCar);
router.post('/create-car-enquiry', createCarEnquiry);
router.post('/get-all-car-enquiries', getAllCarEnquiries);
router.post('/remove-saved-car', removeSavedCar);

export default router;
