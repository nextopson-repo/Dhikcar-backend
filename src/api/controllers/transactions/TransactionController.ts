import { Request, Response } from 'express';
import { Transaction } from '@/api/entity/Transactions';
import { v4 as uuidv4 } from 'uuid';
import {
  createPhonePePaymentUrl,
  checkPhonePeOrderStatus,
  initiatePhonePeRefund,
  checkPhonePeRefundStatus,
} from '@/common/utils/phonepeService';
import { env } from '@/common/utils/envConfig';

type PackageItem = {
  id: string;
  name: string;
  months: number;
  activeDays: number;
  adsCount: number;
  price: number;
  features?: string[];
  featuredDays?: number;
};

// Static catalog to match the UI (prices in INR)
const PACKAGE_CATALOG: PackageItem[] = [
  { id: 'P-3M-1', name: '1 Ad', months: 3, activeDays: 90, adsCount: 1, price: 399 },
  { id: 'P-3M-5', name: '5 Ads', months: 3, activeDays: 90, adsCount: 5, price: 1750 },
  { id: 'P-3M-10', name: '10 Ads', months: 3, activeDays: 90, adsCount: 10, price: 2999 },
  { id: 'P-4M-50F30', name: '50 Ads with 30 Days Featured', months: 4, activeDays: 120, adsCount: 50, price: 12499, featuredDays: 30 },
  { id: 'P-6M-125', name: '125 Ads', months: 6, activeDays: 180, adsCount: 125, price: 24999 },
  { id: 'P-6M-250', name: '250 Ads', months: 6, activeDays: 180, adsCount: 250, price: 37499 },
  { id: 'P-6M-500', name: '500 Ads', months: 6, activeDays: 180, adsCount: 500, price: 49999 },
];

export const listPackages = async (req: Request, res: Response) => {
  return res.status(200).json({ status: 'success', data: PACKAGE_CATALOG });
};

export const getPackageById = async (req: Request, res: Response) => {
  const pkg = PACKAGE_CATALOG.find((p) => p.id === req.params.id);
  if (!pkg) return res.status(404).json({ status: 'error', message: 'Package not found' });
  return res.status(200).json({ status: 'success', data: pkg });
};

export const getOrderSummary = async (req: Request, res: Response) => {
  const { packageId, quantity = 1 } = req.body || {};
  const pkg = PACKAGE_CATALOG.find((p) => p.id === packageId);
  if (!pkg) return res.status(400).json({ status: 'error', message: 'Invalid packageId' });
  const qty = Math.max(1, Number(quantity) || 1);
  const price = pkg.price * qty;
  const gst = 0;
  const total = price + gst;
  return res.status(200).json({
    status: 'success',
    data: {
      package: pkg,
      quantity: qty,
      price,
      gst,
      total,
    },
  });
};

export const createOrUpdateTransaction = async (req: Request, res: Response) => {
  try {
    const {
      transactionId,
      transactionStatus = 'PENDING',
      transactionDate,
      // direct values (backward compat)
      packageName,
      packagePrice,
      activeDays,
      packageQuantity = 1,
      // or derive from catalog
      packageId,
      quantity,
    } = req.body || {};

    const authUserId = (req as any).user?.id as string | undefined;

    let resolvedPackageName = packageName;
    let resolvedPackagePrice = typeof packagePrice !== 'undefined' ? Number(packagePrice) : undefined;
    let resolvedActiveDays = typeof activeDays !== 'undefined' ? Number(activeDays) : undefined;
    let resolvedQuantity = Number(quantity ?? packageQuantity ?? 1) || 1;

    if (packageId) {
      const pkg = PACKAGE_CATALOG.find((p) => p.id === packageId);
      if (!pkg) return res.status(400).json({ status: 'error', message: 'Invalid packageId' });
      resolvedPackageName = pkg.name;
      resolvedPackagePrice = pkg.price;
      resolvedActiveDays = pkg.activeDays;
    }

    if (!authUserId || !resolvedPackageName || typeof resolvedPackagePrice === 'undefined' || typeof resolvedActiveDays === 'undefined') {
      return res.status(400).json({ status: 'error', message: 'Missing required fields' });
    }

    const txnId = transactionId || `txn_${uuidv4()}`;

    let record = await Transaction.findOne({ where: { transactionId: txnId } });

    if (record) {
      record.transactionStatus = transactionStatus;
      record.transactionDate = transactionDate ? new Date(transactionDate) : new Date();
      record.packageName = resolvedPackageName;
      record.packagePrice = Number(resolvedPackagePrice);
      record.activeDays = Number(resolvedActiveDays);
      record.packageQuantity = Number(resolvedQuantity) || 1;
      record.updatedBy = 'api';
      await record.save();
    } else {
      record = Transaction.create({
        userId: authUserId,
        transactionId: txnId,
        transactionStatus,
        transactionDate: transactionDate ? new Date(transactionDate) : new Date(),
        packageName: resolvedPackageName,
        packagePrice: Number(resolvedPackagePrice),
        activeDays: Number(resolvedActiveDays),
        packageQuantity: Number(resolvedQuantity) || 1,
        createdBy: 'api',
        updatedBy: 'api',
      });
      await record.save();
    }

    // Demo PhonePe placeholder response
    return res.status(200).json({
      status: 'success',
      message: 'Transaction saved (demo PhonePe flow placeholder)',
      data: {
        id: record.id,
        transactionId: record.transactionId,
        transactionStatus: record.transactionStatus,
        amount: record.packagePrice * record.packageQuantity,
        mockPaymentGateway: 'phonepe-demo',
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      status: 'error',
      message: error?.message || 'Internal Server Error',
    });
  }
};

export const confirmTransactionStatus = async (req: Request, res: Response) => {
  try {
    const { transactionId, status } = req.body || {};
    if (!transactionId || !status) {
      return res.status(400).json({ status: 'error', message: 'transactionId and status are required' });
    }
    const record = await Transaction.findOne({ where: { transactionId } });
    if (!record) return res.status(404).json({ status: 'error', message: 'Transaction not found' });
    record.transactionStatus = String(status).toUpperCase();
    record.updatedBy = 'api';
    await record.save();
    return res.status(200).json({ status: 'success', data: { transactionId: record.transactionId, transactionStatus: record.transactionStatus } });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error?.message || 'Internal Server Error' });
  }
};

export const listUserTransactions = async (req: Request, res: Response) => {
  try {
    const authUserId = (req as any).user?.id as string | undefined;
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt((req.query.limit as string) || '10', 10)));
    if (!authUserId) return res.status(401).json({ status: 'error', message: 'Unauthorized' });

    const skip = (page - 1) * limit;
    const [items, total] = await Transaction.findAndCount({
      where: { userId: authUserId },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    } as any);

    return res.status(200).json({
      status: 'success',
      data: items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error?.message || 'Internal Server Error' });
  }
};

export const initiatePayment = async (req: Request, res: Response) => {
  try {
    const authUserId = (req as any).user?.id as string | undefined;
    if (!authUserId) return res.status(401).json({ status: 'error', message: 'Unauthorized' });

    const { packageId, quantity = 1, metaInfo } = req.body || {};
    const pkg = PACKAGE_CATALOG.find((p) => p.id === packageId);
    if (!pkg) return res.status(400).json({ status: 'error', message: 'Invalid packageId' });
    const qty = Math.max(1, Number(quantity) || 1);
    const amount = pkg.price * qty; // amount in INR

    const merchantOrderId = `order_${uuidv4()}`;

    // upsert local record as PENDING
    const record = Transaction.create({
      userId: authUserId,
      transactionId: merchantOrderId,
      transactionStatus: 'PENDING',
      transactionDate: new Date(),
      packageName: pkg.name,
      packagePrice: pkg.price,
      activeDays: pkg.activeDays,
      packageQuantity: qty,
      createdBy: 'api',
      updatedBy: 'api',
    });
    await record.save();

    const redirectUrl = `${env.PHONEPE_REDIRECT_BASE_URL}/payments/callback?orderId=${merchantOrderId}`;

    const paymentResp = await createPhonePePaymentUrl({
      merchantOrderId,
      amount,
      redirectUrl,
      metaInfo,
    });

    if (!paymentResp.success || !paymentResp.paymentUrl) {
      return res.status(502).json({ status: 'error', message: 'Failed to create payment URL', data: paymentResp.raw });
    }

    return res.status(200).json({
      status: 'success',
      data: { merchantOrderId, paymentUrl: paymentResp.paymentUrl, amount },
    });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error?.message || 'Internal Server Error' });
  }
};

export const getPaymentStatus = async (req: Request, res: Response) => {
  try {
    const authUserId = (req as any).user?.id as string | undefined;
    if (!authUserId) return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    const { merchantOrderId } = req.params as any;
    if (!merchantOrderId) return res.status(400).json({ status: 'error', message: 'merchantOrderId is required' });

    const statusResp = await checkPhonePeOrderStatus(merchantOrderId);
    const paymentStatus = statusResp?.status;
    const success = statusResp?.success === true;

    const record = await Transaction.findOne({ where: { transactionId: merchantOrderId } });
    if (record) {
      record.transactionStatus = success && paymentStatus === 'SUCCESS' ? 'SUCCESS' : paymentStatus || 'PENDING';
      record.updatedBy = 'api';
      await record.save();
    }

    return res.status(200).json({ status: 'success', data: { paymentStatus, success, raw: statusResp.raw } });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error?.message || 'Internal Server Error' });
  }
};

export const refundPayment = async (req: Request, res: Response) => {
  try {
    const authUserId = (req as any).user?.id as string | undefined;
    if (!authUserId) return res.status(401).json({ status: 'error', message: 'Unauthorized' });

    const { merchantRefundId, originalMerchantOrderId, amount } = req.body || {};
    if (!merchantRefundId || !originalMerchantOrderId || !amount) {
      return res.status(400).json({ status: 'error', message: 'merchantRefundId, originalMerchantOrderId, and amount are required' });
    }

    const refundResp = await initiatePhonePeRefund({
      merchantRefundId,
      originalMerchantOrderId,
      amount: Number(amount),
    });

    if (!refundResp.success) {
      return res.status(502).json({ status: 'error', message: 'Failed to initiate refund', data: refundResp.raw });
    }

    return res.status(200).json({ status: 'success', data: { merchantRefundId, refundInitiated: true } });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error?.message || 'Internal Server Error' });
  }
};

export const getRefundStatus = async (req: Request, res: Response) => {
  try {
    const authUserId = (req as any).user?.id as string | undefined;
    if (!authUserId) return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    const { merchantRefundId } = req.params as any;
    if (!merchantRefundId) return res.status(400).json({ status: 'error', message: 'merchantRefundId is required' });

    const statusResp = await checkPhonePeRefundStatus(merchantRefundId);
    return res.status(200).json({ status: 'success', data: { refundStatus: statusResp.status, success: statusResp.success, raw: statusResp.raw } });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error?.message || 'Internal Server Error' });
  }
};


