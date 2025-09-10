const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api/v1/notification';
const TEST_USER_ID = 'd33379d7-2c1c-4e5d-8f8e-522a3decf778'; // Replace with actual user ID

async function testNotificationBundling() {
  try {
    console.log('🧪 Testing Notification Bundling System...\n');

    // Step 1: Create multiple duplicate notifications
    console.log('📝 Creating duplicate notifications...');
    
    const duplicateNotifications = [
      {
        userId: TEST_USER_ID,
        message: 'You have a new property enquiry for Test Property 1',
        type: 'enquiry',
        user: 'Test Property 1',
        button: 'View Enquiry',
        property: {
          title: 'Test Property 1',
          price: '₹5000000',
          location: 'Test Location 1',
          image: ''
        },
        status: 'Enquiry',
        actionId: 'test_property_1',
        sound: 'default',
        vibration: 'default'
      },
      {
        userId: TEST_USER_ID,
        message: 'You have a new property enquiry for Test Property 1',
        type: 'enquiry',
        user: 'Test Property 1',
        button: 'View Enquiry',
        property: {
          title: 'Test Property 1',
          price: '₹5000000',
          location: 'Test Location 1',
          image: ''
        },
        status: 'Enquiry',
        actionId: 'test_property_1_2',
        sound: 'default',
        vibration: 'default'
      },
      {
        userId: TEST_USER_ID,
        message: 'You have a new property enquiry for Test Property 1',
        type: 'enquiry',
        user: 'Test Property 1',
        button: 'View Enquiry',
        property: {
          title: 'Test Property 1',
          price: '₹5000000',
          location: 'Test Location 1',
          image: ''
        },
        status: 'Enquiry',
        actionId: 'test_property_1_3',
        sound: 'default',
        vibration: 'default'
      }
    ];

    // Create the duplicate notifications
    for (const notification of duplicateNotifications) {
      try {
        await axios.post(`${BASE_URL}/create-notification`, notification);
        console.log(`✅ Created notification: ${notification.message}`);
      } catch (error) {
        console.error(`❌ Failed to create notification: ${error.message}`);
      }
    }

    // Step 2: Fetch notifications to see duplicates
    console.log('\n📋 Fetching notifications (before cleanup)...');
    try {
      const response = await axios.get(`${BASE_URL}/fetch-notifications?userId=${TEST_USER_ID}&page=1&limit=20`);
      console.log(`📊 Found ${response.data.notifications.length} notifications`);
      
      // Count duplicates
      const enquiryNotifications = response.data.notifications.filter(n => n.type === 'enquiry');
      console.log(`📈 Enquiry notifications: ${enquiryNotifications.length}`);
    } catch (error) {
      console.error(`❌ Failed to fetch notifications: ${error.message}`);
    }

    // Step 3: Trigger manual cleanup
    console.log('\n🧹 Triggering manual cleanup...');
    try {
      await axios.post(`${BASE_URL}/manual-cleanup/${TEST_USER_ID}`);
      console.log('✅ Manual cleanup completed');
    } catch (error) {
      console.error(`❌ Failed to trigger cleanup: ${error.message}`);
    }

    // Step 4: Fetch notifications again to see bundled result
    console.log('\n📋 Fetching notifications (after cleanup)...');
    try {
      const response = await axios.get(`${BASE_URL}/fetch-notifications?userId=${TEST_USER_ID}&page=1&limit=20`);
      console.log(`📊 Found ${response.data.notifications.length} notifications after cleanup`);
      
      // Check for bundled notifications
      const bundledNotifications = response.data.notifications.filter(n => n.isBundled);
      console.log(`📦 Bundled notifications: ${bundledNotifications.length}`);
      
      if (bundledNotifications.length > 0) {
        console.log('\n📦 Bundled notification details:');
        bundledNotifications.forEach((notification, index) => {
          console.log(`  ${index + 1}. ${notification.message}`);
          console.log(`     Bundle count: ${notification.bundleCount}`);
          console.log(`     Bundle key: ${notification.bundleKey}`);
        });
      }
    } catch (error) {
      console.error(`❌ Failed to fetch notifications after cleanup: ${error.message}`);
    }

    console.log('\n✅ Notification bundling test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testNotificationBundling();
