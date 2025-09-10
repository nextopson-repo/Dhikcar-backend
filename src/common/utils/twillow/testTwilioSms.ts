import { sendTwilioSms, sendTwilioTestMessage } from './twilioSmsService';

async function testTwilioSms() {
  console.log('🧪 Testing Twilio SMS Service...\n');

  // Test parameters from the curl command
  const testPhoneNumber = '+919770949466';
  const testMessage = 'Hello from Twilio!';

  try {
    console.log('📱 Sending test SMS...');
    console.log(`To: ${testPhoneNumber}`);
    console.log(`Message: ${testMessage}\n`);

    // Test 1: Send custom message
    const result1 = await sendTwilioSms({
      to: testPhoneNumber,
      body: testMessage,
    });

    console.log('✅ Test 1 - Custom Message Result:');
    console.log('Success:', result1.success);
    console.log('Message:', result1.message);
    console.log('Response Object:', result1.responseObject);
    console.log('Status Code:', result1.statusCode);
    console.log('');

    // Test 2: Send test message using helper function
    console.log('📱 Sending test message using helper function...');
    const result2 = await sendTwilioTestMessage(testPhoneNumber);

    console.log('✅ Test 2 - Helper Function Result:');
    console.log('Success:', result2.success);
    console.log('Message:', result2.message);
    console.log('Response Object:', result2.responseObject);
    console.log('Status Code:', result2.statusCode);
    console.log('');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

export { testTwilioSms };
