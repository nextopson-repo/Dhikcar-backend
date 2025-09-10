import express from 'express';

import {
  getAllKYCSubmissions,
  getKYCStatistics,
  getPendingKYCSubmissions,
  updateKYCStatus,
} from '@/api/controllers/KYC/adminKycController';
import { createUpdateKyc, GetKycStatus, resetKycAttempts } from '@/api/controllers/KYC/kycController';

const Router = express.Router();

// User KYC routes
Router.post('/kyc-process', createUpdateKyc);
Router.post('/kyc-status', GetKycStatus);
Router.post('/reset-attempts', resetKycAttempts);

// Admin KYC routes
Router.get('/admin/submissions', getAllKYCSubmissions);
Router.get('/admin/pending', getPendingKYCSubmissions);
Router.post('/admin/update-status', updateKYCStatus);
Router.get('/admin/statistics', getKYCStatistics);

export default Router;
