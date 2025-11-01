import axios from 'axios';
import { env } from './envConfig';

type AuthTokenResponse = {
  success: boolean;
  accessToken?: string;
  expiresIn?: number;
  raw?: any;
};

type CreatePaymentParams = {
  merchantOrderId: string;
  amount: number;
  redirectUrl: string;
  metaInfo?: {
    udf1?: string;
    udf2?: string;
    udf3?: string;
    udf4?: string;
    udf5?: string;
  };
};

type CreatePaymentResponse = {
  success: boolean;
  paymentUrl?: string;
  merchantOrderId?: string;
  raw?: any;
};

type OrderStatusResponse = {
  success: boolean;
  status?: string;
  raw?: any;
};

type RefundParams = {
  merchantRefundId: string;
  originalMerchantOrderId: string;
  amount: number;
};

type RefundResponse = {
  success: boolean;
  refundId?: string;
  raw?: any;
};

// Cache for access token
let cachedToken: string | null = null;
let tokenExpiry: number = 0;

/**
 * Fetch OAuth token from PhonePe
 */
export async function fetchPhonePeAuthToken(): Promise<AuthTokenResponse> {
  try {
    // Return cached token if still valid
    if (cachedToken && Date.now() < tokenExpiry) {
      return { success: true, accessToken: cachedToken };
    }

    const url = `${env.PHONEPE_BASE_URL}/v1/oauth/token`;
    const params = new URLSearchParams({
      client_id: env.PHONEPE_CLIENT_ID,
      client_version: env.PHONEPE_CLIENT_VERSION,
      client_secret: env.PHONEPE_CLIENT_SECRET,
      grant_type: 'client_credentials',
    });

    const resp = await axios.post(url, params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const data = resp.data;
    if (data?.access_token) {
      cachedToken = data.access_token;
      tokenExpiry = Date.now() + (data.expires_in || 3600) * 1000 - 60000; // refresh 1 min early
      return {
        success: true,
        accessToken: data.access_token,
        expiresIn: data.expires_in,
        raw: data,
      };
    }
    return { success: false, raw: data };
  } catch (error: any) {
    return { success: false, raw: error?.response?.data || error.message };
  }
}

/**
 * Create Payment URL using Standard Checkout
 */
export async function createPhonePePaymentUrl(params: CreatePaymentParams): Promise<CreatePaymentResponse> {
  try {
    const tokenResp = await fetchPhonePeAuthToken();
    if (!tokenResp.success || !tokenResp.accessToken) {
      return { success: false, raw: 'Failed to fetch auth token' };
    }

    const url = `${env.PHONEPE_BASE_URL}/checkout/v2/pay`;
    const payload = {
      merchantOrderId: params.merchantOrderId,
      amount: params.amount,
      expireAfter: 1200,
      metaInfo: params.metaInfo || {},
      paymentFlow: {
        type: 'PG_CHECKOUT',
        message: 'Payment for Dhikcar package',
        merchantUrls: {
          redirectUrl: params.redirectUrl,
        },
      },
    };

    const resp = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `O-Bearer ${tokenResp.accessToken}`,
      },
    });

    const data = resp.data;
    if (data?.data?.paymentUrl) {
      return {
        success: true,
        paymentUrl: data.data.paymentUrl,
        merchantOrderId: params.merchantOrderId,
        raw: data,
      };
    }
    return { success: false, raw: data };
  } catch (error: any) {
    return { success: false, raw: error?.response?.data || error.message };
  }
}

/**
 * Check Order Status
 */
export async function checkPhonePeOrderStatus(merchantOrderId: string): Promise<OrderStatusResponse> {
  try {
    const tokenResp = await fetchPhonePeAuthToken();
    if (!tokenResp.success || !tokenResp.accessToken) {
      return { success: false, raw: 'Failed to fetch auth token' };
    }

    const url = `${env.PHONEPE_BASE_URL}/checkout/v2/order/${merchantOrderId}/status`;
    const resp = await axios.get(url, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `O-Bearer ${tokenResp.accessToken}`,
      },
    });

    const data = resp.data;
    return {
      success: data?.success || false,
      status: data?.data?.status,
      raw: data,
    };
  } catch (error: any) {
    return { success: false, raw: error?.response?.data || error.message };
  }
}

/**
 * Initiate Refund
 */
export async function initiatePhonePeRefund(params: RefundParams): Promise<RefundResponse> {
  try {
    const tokenResp = await fetchPhonePeAuthToken();
    if (!tokenResp.success || !tokenResp.accessToken) {
      return { success: false, raw: 'Failed to fetch auth token' };
    }

    const url = `${env.PHONEPE_BASE_URL}/payments/v2/refund`;
    const payload = {
      merchantRefundId: params.merchantRefundId,
      originalMerchantOrderId: params.originalMerchantOrderId,
      amount: params.amount,
    };

    const resp = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `O-Bearer ${tokenResp.accessToken}`,
      },
    });

    const data = resp.data;
    return {
      success: data?.success || false,
      refundId: params.merchantRefundId,
      raw: data,
    };
  } catch (error: any) {
    return { success: false, raw: error?.response?.data || error.message };
  }
}

/**
 * Check Refund Status
 */
export async function checkPhonePeRefundStatus(merchantRefundId: string): Promise<OrderStatusResponse> {
  try {
    const tokenResp = await fetchPhonePeAuthToken();
    if (!tokenResp.success || !tokenResp.accessToken) {
      return { success: false, raw: 'Failed to fetch auth token' };
    }

    const url = `${env.PHONEPE_BASE_URL}/payments/v2/refund/${merchantRefundId}/status`;
    const resp = await axios.get(url, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `O-Bearer ${tokenResp.accessToken}`,
      },
    });

    const data = resp.data;
    return {
      success: data?.success || false,
      status: data?.data?.status,
      raw: data,
    };
  } catch (error: any) {
    return { success: false, raw: error?.response?.data || error.message };
  }
}
