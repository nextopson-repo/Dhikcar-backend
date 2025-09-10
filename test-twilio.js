#!/usr/bin/env node

/**
 * Simple test script for Twilio SMS functionality
 * Run with: node test-twilio.js
 */

import dotenv from 'dotenv';
import axios from 'axios';

// Load environment variables
dotenv.config();

// Twilio Configuration
const TWILIO_ACCOUNT_SID = 'AC1fe2ae9b6425e020464a15fa85958a4b';
const TWILIO_AUTH_TOKEN = 'ace378ca40d2e17075b430ded701254d';
const TWILIO_FROM_NUMBER = '+19894410334';

async function testTwilioSms() {
  console.log('🧪 Testing Twilio SMS Service...\n');

  const testPhoneNumber = '+918319697083';
  const testMessage = 'I Love you!';

  try {
    console.log('📱 Sending test SMS...');
    console.log(`To: ${testPhoneNumber}`);
    console.log(`From: ${TWILIO_FROM_NUMBER}`);
    console.log(`Message: ${testMessage}\n`);

    // Twilio API endpoint
    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    
    // Prepare form data
    const formData = new URLSearchParams();
    formData.append('To', testPhoneNumber);
    formData.append('From', TWILIO_FROM_NUMBER);
    formData.append('Body', testMessage);

    // Make the API request with Basic Auth
    const response = await axios.post(url, formData, {
      auth: {
        username: TWILIO_ACCOUNT_SID,
        password: TWILIO_AUTH_TOKEN
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    console.log('✅ SMS sent successfully!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    console.log('');
    console.log('📊 Message Details:');
    console.log('- Message SID:', response.data.sid);
    console.log('- Status:', response.data.status);
    console.log('- To:', response.data.to);
    console.log('- From:', response.data.from);
    console.log('- Body:', response.data.body);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Error response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Run the test
testTwilioSms()
  .then(() => {
    console.log('\n🎉 Twilio SMS test completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test failed:', error);
    process.exit(1);
  });
