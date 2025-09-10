import axios from 'axios';

import { ResponseStatus, ServiceResponse } from '@/common/models/serviceResponse';
import { env } from '@/common/utils/envConfig';

// Twilio Configuration
const TWILIO_ACCOUNT_SID = 'AC1fe2ae9b6425e020464a15fa85958a4b';
const TWILIO_AUTH_TOKEN = 'ace378ca40d2e17075b430ded701254d';
const TWILIO_FROM_NUMBER = '+19894410334';

if (!TWILIO_AUTH_TOKEN) {
  throw new Error('Twilio Auth Token is not properly configured');
}

export interface TwilioSmsOptions {
  to: string;
  body: string;
  from?: string;
}

export const sendTwilioSms = async (options: TwilioSmsOptions): Promise<ServiceResponse> => {
  try {
    const { to, body, from = TWILIO_FROM_NUMBER } = options;

    // Format phone number (ensure it starts with +)
    const formattedNumber = to.startsWith('+') ? to : `+${to}`;

    // Twilio API endpoint
    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;

    console.log('Sending SMS to:', formattedNumber);
    console.log('Using Twilio URL:', url);

    // Prepare form data
    const formData = new URLSearchParams();
    formData.append('To', formattedNumber);
    formData.append('From', from);
    formData.append('Body', body);

    // Make the API request with Basic Auth
    const response = await axios.post(url, formData, {
      auth: {
        username: TWILIO_ACCOUNT_SID,
        password: TWILIO_AUTH_TOKEN,
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    console.log('Twilio API Response:', response.data);

    // Check if the response indicates success
    if (response.data && response.data.sid) {
      return new ServiceResponse(
        ResponseStatus.Success,
        'SMS sent successfully',
        {
          messageSid: response.data.sid,
          status: response.data.status,
          to: response.data.to,
          from: response.data.from,
        } as any,
        200
      );
    } else {
      console.error('Twilio API Error:', response.data);
      return new ServiceResponse(ResponseStatus.Failed, 'Failed to send SMS', response.data as any, 500);
    }
  } catch (error: any) {
    console.error('Error sending Twilio SMS:', error);

    // Handle Twilio specific errors
    if (error.response?.data) {
      const twilioError = error.response.data;
      return new ServiceResponse(
        ResponseStatus.Failed,
        twilioError.message || 'Twilio API error',
        twilioError,
        error.response.status || 500
      );
    }

    return new ServiceResponse(
      ResponseStatus.Failed,
      error instanceof Error ? error.message : 'Failed to send SMS',
      null,
      500
    );
  }
};

export const sendTwilioOTP = async (mobileNumber: string, otp: string): Promise<ServiceResponse> => {
  const message = `Your OTP is: ${otp}. Please do not share this with anyone.`;

  return sendTwilioSms({
    to: mobileNumber,
    body: message,
  });
};

export const sendTwilioTestMessage = async (mobileNumber: string): Promise<ServiceResponse> => {
  return sendTwilioSms({
    to: mobileNumber,
    body: 'Hello from Twilio! This is a test message.',
  });
};
