import { delayedEmailService } from './delayedEmailService';

/**
 * Test script for delayed email service
 * Run this to test the bundled email functionality
 */

async function testDelayedEmailService() {
  console.log('🧪 Testing Delayed Email Service...\n');

  // Test 1: Add multiple items to bundled email
  console.log('📧 Test 1: Adding items to bundled email...');

  const testEmail = 'test@example.com';

  // Add first item
  const jobId1 = delayedEmailService.addToBundledEmail(
    testEmail,
    {
      type: 'republish_create',
      propertyId: 'prop-123',
      propertyName: 'Sunset Villa',
      propertyPrice: 25000000,
      propertyLocation: 'Mumbai, Maharashtra',
      propertyImage: 'https://example.com/image1.jpg',
      republisherName: 'John Doe',
      timestamp: new Date(),
      republishId: 'repub-123',
    },
    1 // 1 minute delay for testing
  );

  console.log(`✅ Added first item with job ID: ${jobId1}`);

  // Add second item to same email
  const jobId2 = delayedEmailService.addToBundledEmail(
    testEmail,
    {
      type: 'republish_approve',
      propertyId: 'prop-456',
      propertyName: 'Ocean View Apartment',
      propertyPrice: 15000000,
      propertyLocation: 'Pune, Maharashtra',
      propertyImage: 'https://example.com/image2.jpg',
      ownerName: 'Jane Smith',
      timestamp: new Date(),
      republishId: 'repub-456',
    },
    1 // 1 minute delay for testing
  );

  console.log(`✅ Added second item with job ID: ${jobId2}`);

  // Add third item to same email
  const jobId3 = delayedEmailService.addToBundledEmail(
    testEmail,
    {
      type: 'republish_reject',
      propertyId: 'prop-789',
      propertyName: 'Garden House',
      propertyPrice: 8500000,
      propertyLocation: 'Bangalore, Karnataka',
      propertyImage: 'https://example.com/image3.jpg',
      ownerName: 'Bob Wilson',
      timestamp: new Date(),
      republishId: 'repub-789',
    },
    1 // 1 minute delay for testing
  );

  console.log(`✅ Added third item with job ID: ${jobId3}`);

  // Test 2: Check pending jobs
  console.log('\n📋 Test 2: Checking pending jobs...');
  const pendingJobs = delayedEmailService.getPendingJobs();
  console.log(`📊 Total pending jobs: ${delayedEmailService.getJobCount()}`);
  console.log('📋 Pending jobs:', pendingJobs);

  // Test 3: Add item to different email
  console.log('\n📧 Test 3: Adding item to different email...');
  const jobId4 = delayedEmailService.addToBundledEmail(
    'another@example.com',
    {
      type: 'republish_update',
      propertyId: 'prop-999',
      propertyName: 'Mountain Retreat',
      propertyPrice: 12000000,
      propertyLocation: 'Dehradun, Uttarakhand',
      propertyImage: 'https://example.com/image4.jpg',
      republisherName: 'Alice Johnson',
      timestamp: new Date(),
      republishId: 'repub-999',
    },
    1 // 1 minute delay for testing
  );

  console.log(`✅ Added item to different email with job ID: ${jobId4}`);

  // Test 4: Final job count
  console.log('\n📊 Test 4: Final job count...');
  console.log(`📊 Total pending jobs: ${delayedEmailService.getJobCount()}`);
  const finalPendingJobs = delayedEmailService.getPendingJobs();
  console.log('📋 Final pending jobs:', finalPendingJobs);

  console.log('\n✅ Test completed! Emails will be sent in 1 minute...');
  console.log('💡 Check your email inbox and server logs for results.');
}

// Export for use in other files
export { testDelayedEmailService };

// Run test if this file is executed directly
if (require.main === module) {
  testDelayedEmailService().catch(console.error);
}
