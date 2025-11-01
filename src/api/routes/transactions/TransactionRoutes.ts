import { Router } from 'express';
import { createOrUpdateTransaction, listPackages, getPackageById, getOrderSummary, confirmTransactionStatus, listUserTransactions, initiatePayment, getPaymentStatus, refundPayment, getRefundStatus } from '@/api/controllers/transactions/TransactionController';
import { authenticate } from '@/api/middlewares/auth/Authenticate';

const router = Router();

const asyncHandler = (fn: any) => (req: any, res: any, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

router.get('/packages', asyncHandler(listPackages));
router.get('/packages/:id', asyncHandler(getPackageById));
router.post('/summary', authenticate, asyncHandler(getOrderSummary));
router.post('/create-update', authenticate, asyncHandler(createOrUpdateTransaction));
router.post('/confirm', authenticate, asyncHandler(confirmTransactionStatus));
router.post('/list', authenticate, asyncHandler(listUserTransactions));

// PhonePe Standard Checkout APIs
router.post('/payment/initiate', authenticate, asyncHandler(initiatePayment));
router.get('/payment/status/:merchantOrderId', authenticate, asyncHandler(getPaymentStatus));
router.post('/payment/refund', authenticate, asyncHandler(refundPayment));
router.get('/payment/refund/:merchantRefundId/status', authenticate, asyncHandler(getRefundStatus));

export default router;


