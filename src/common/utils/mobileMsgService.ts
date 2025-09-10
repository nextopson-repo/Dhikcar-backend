import axios from 'axios';
import https from 'https';

import { ResponseStatus, ServiceResponse } from '@/common/models/serviceResponse';
import { env } from '@/common/utils/envConfig';

// MSG91 Configuration
const MSG91_AUTH_KEY = env.MSG91_AUTH_KEY;
const MSG91_SENDER_ID = env.MSG91_SENDER_ID;
const MSG91_TEMPLATE_ID = env.MSG91_TEMPLATE_ID;

// DVHosting Configuration (fallback)
const DVHOSTING_API_KEY = env.DVHOSTING_API_KEY;

if (!MSG91_AUTH_KEY) {
  throw new Error('MSG91 Auth key is not properly configured');
}

if (!DVHOSTING_API_KEY) {
  throw new Error('DVHosting API key is not properly configured');
}

// MSG91 SMS Service
const sendSMSViaMSG91 = async (mobileNumber: string, otp: string): Promise<ServiceResponse> => {
  try {
    const formattedNumber = `91${mobileNumber.replace(/\D/g, '')}`;

    if (mobileNumber.replace(/\D/g, '').length !== 10) {
      throw new Error('Invalid mobile number format. Must be 10 digits.');
    }

    const url = `https://control.msg91.com/api/v5/otp?mobile=${formattedNumber}&authkey=${MSG91_AUTH_KEY}&template_id=${MSG91_TEMPLATE_ID}`;
    const payload = {
      // flow_id: MSG91_TEMPLATE_ID,
      // sender: MSG91_SENDER_ID,
      // mobiles: formattedNumber,
      // // VAR1: 1234,
      OTP: otp,
    };

    const response = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
        Authkey: MSG91_AUTH_KEY,
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
      }),
    });

    if (response.data && response.data.type === 'success') {
      return new ServiceResponse(ResponseStatus.Success, 'OTP sent successfully via MSG91', null, 200);
    } else {
      const errorMessage = response.data?.message || 'MSG91 API failed';
      console.error('MSG91 API Error:', errorMessage);
      return new ServiceResponse(ResponseStatus.Failed, errorMessage, null, 500);
    }
  } catch (error) {
    console.error('Error sending SMS via MSG91:', error);
    return new ServiceResponse(
      ResponseStatus.Failed,
      error instanceof Error ? error.message : 'MSG91 service failed',
      null,
      500
    );
  }
};

// DVHosting SMS Service (fallback)
const sendSMSViaDVHosting = async (mobileNumber: string, otp: string): Promise<ServiceResponse> => {
  try {
    const formattedNumber = mobileNumber.replace(/\D/g, '');

    if (formattedNumber.length !== 10) {
      throw new Error('Invalid mobile number format. Must be 10 digits.');
    }

    const url = `https://dvhosting.in/api-sms-v3.php?api_key=${DVHOSTING_API_KEY}&number=${formattedNumber}&otp=${otp}`;

    console.log('Sending OTP via DVHosting to:', formattedNumber);
    console.log('Using URL:', url);

    const response = await axios.get(url, {
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
      }),
    });

    console.log('DVHosting API Response:', response.data);

    if (
      response.data &&
      response.data.return === true &&
      response.data.message &&
      (Array.isArray(response.data.message)
        ? response.data.message[0].toLowerCase().includes('success')
        : response.data.message.toLowerCase().includes('success'))
    ) {
      return new ServiceResponse(ResponseStatus.Success, 'OTP sent successfully via DVHosting', null, 200);
    } else {
      const errorMessage = response.data?.message?.[0] || response.data?.message || 'DVHosting API failed';
      console.error('DVHosting API Error:', errorMessage);
      return new ServiceResponse(ResponseStatus.Failed, errorMessage, null, 500);
    }
  } catch (error) {
    console.error('Error sending SMS via DVHosting:', error);
    return new ServiceResponse(
      ResponseStatus.Failed,
      error instanceof Error ? error.message : 'DVHosting service failed',
      null,
      500
    );
  }
};

export const sendMobileOTP = async (mobileNumber: string, otp: string): Promise<ServiceResponse> => {
  try {
    // Format mobile number (remove any non-digit characters)
    const formattedNumber = mobileNumber.replace(/\D/g, '');

    // Ensure mobile number is 10 digits
    if (formattedNumber.length !== 10) {
      throw new Error('Invalid mobile number format. Must be 10 digits.');
    }

    console.log('Attempting to send OTP to:', formattedNumber);

    // Try MSG91 first (primary service)
    console.log('Trying MSG91 service...');
    const msg91Result = await sendSMSViaMSG91(formattedNumber, otp);

    if (msg91Result.success) {
      console.log('MSG91 service successful');
      return msg91Result;
    }

    // If MSG91 fails, try DVHosting (fallback)
    console.log('MSG91 failed, trying DVHosting service...');
    const dvhostingResult = await sendSMSViaDVHosting(formattedNumber, otp);

    if (dvhostingResult.success) {
      console.log('DVHosting service successful');
      return dvhostingResult;
    }

    // If both services fail
    console.error('Both MSG91 and DVHosting services failed');
    return new ServiceResponse(
      ResponseStatus.Failed,
      'All SMS services are currently unavailable. Please try again later.',
      null,
      500
    );
  } catch (error) {
    console.error('Error in sendMobileOTP:', error);
    return new ServiceResponse(
      ResponseStatus.Failed,
      error instanceof Error ? error.message : 'Failed to send OTP',
      null,
      500
    );
  }
};

// https://control.msg91.com/api/v5/otp?mobile=${918319697083}&authkey=${416196Akw2T65mBzVE65cdc7c3P1}&template_id=${68aabcf3d0642c2b6c408f93}
