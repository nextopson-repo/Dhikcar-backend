import { testTwilioSms } from './src/common/utils/twillow/testTwilioSms.js';

testTwilioSms()
  .then(() => {
    console.log('🎉 TypeScript Twilio SMS test completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 TypeScript test failed:', error);
    process.exit(1);
  });
