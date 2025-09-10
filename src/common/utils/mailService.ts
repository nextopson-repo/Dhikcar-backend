import nodemailer from 'nodemailer';

import { env } from '@/common/utils/envConfig';

// Create a transporter using SMTP
const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

export const sendEmailOTP = async (email: string, otp: string) => {
  try {
    const mailOptions = {
      from: env.SMTP_FROM,
      to: email,
      subject: 'Your OTP for Verification from Nextdeal',
      html: `
      <div style="font-family: 'Amazon Ember', 'Helvetica Neue', 'Helvetica', 'Arial', sans-serif; line-height: 1.5; background-color: #f7f7f7; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #dddddd;">
          <div style="background-color: #232F3E; padding: 20px;">
              <p style="color: #ffffff; font-size: 24px; font-weight: bold; margin: 0; text-align: center;">Nextdeal</p>
          </div>
          <div style="padding: 20px 30px;">
            <h1 style="font-size: 24px; font-weight: 500; color: #111111;">Verify your identity</h1>
            <p style="font-size: 14px; color: #111111;">Hello,</p>
            <p style="font-size: 14px; color: #111111;">
              We received a request to verify your sign-in attempt. Please enter the following code to complete your sign in.
            </p>
            <div style="text-align: center; margin: 20px 0;">
              <p style="font-size: 14px; color: #555555; margin-bottom: 5px;">Verification code</p>
              <p style="font-size: 32px; font-weight: bold; color: #111111; margin: 0; letter-spacing: 2px;">${otp}</p>
              <p style="font-size: 12px; color: #777777;">(This code will expire 10 minutes after it was sent.)</p>
            </div>
            <p style="font-size: 14px; color: #111111;">
              If you did not initiate this request, you can safely ignore this email.
            </p>
            <p style="font-size: 14px; color: #111111;">
              If you have any questions, concerns, or require assistance, please do not hesitate to contact <a href="#" style="color: #0066c0; text-decoration: none;">Nextdeal Support</a>.
            </p>
            <hr style="border: 0; border-top: 1px solid #eeeeee; margin: 20px 0;">
            <p style="font-size: 12px; color: #555555;">
              Nextdeal will never email you and ask you to disclose or verify your password, credit card, or banking account number. If you receive a suspicious email with a link to update your account information, do not click on the link. Instead, report the e-mail to Nextdeal for investigation.
            </p>
          </div>
          <div style="background-color: #f7f7f7; padding: 20px; text-align: center; font-size: 12px; color: #555555; border-top: 1px solid #dddddd;">
              <p style="margin: 0;">
                  Nextdeal, Inc. is a subsidiary of Nextopson.com, Inc. Nextdeal.com is a registered trademark of Nextopson.com, Inc. This message was produced and distributed by Nextopson Services, Inc.
              </p>
          </div>
        </div>
      </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent: %s', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

export const sendEmailNotification = async (email: any, subject: string, body: any) => {
  try {
    const mailOptions = {
      from: env.SMTP_FROM,
      to: email,
      subject: subject,
      html: body,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent: %s', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};
