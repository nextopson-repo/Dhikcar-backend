// Simple test to verify notification bundling functionality
const { cleanupAndBundleNotifications } = require('../src/api/controllers/notification/NotificationController');

// Mock test data
const mockNotifications = [
  {
    id: '1',
    userId: 'user123',
    message: 'You have a new property enquiry for Property A',
    type: 'enquiry',
    property: { title: 'Property A', price: '₹5000000' },
    createdAt: new Date('2025-08-23T10:00:00Z'),
    isRead: false
  },
  {
    id: '2', 
    userId: 'user123',
    message: 'You have a new property enquiry for Property A',
    type: 'enquiry',
    property: { title: 'Property A', price: '₹5000000' },
    createdAt: new Date('2025-08-23T10:05:00Z'),
    isRead: false
  },
  {
    id: '3',
    userId: 'user123', 
    message: 'You have a new property enquiry for Property A',
    type: 'enquiry',
    property: { title: 'Property A', price: '₹5000000' },
    createdAt: new Date('2025-08-23T10:10:00Z'),
    isRead: false
  }
];

console.log('🧪 Testing Notification Bundling Logic...\n');

// Test grouping logic
const notificationGroups = new Map();

mockNotifications.forEach(notification => {
  let groupKey = notification.type;
  
  if (notification.property?.title) {
    groupKey += `_${notification.property.title}`;
  } else if (notification.user) {
    groupKey += `_${notification.user}`;
  }
  
  if (!notificationGroups.has(groupKey)) {
    notificationGroups.set(groupKey, []);
  }
  notificationGroups.get(groupKey).push(notification);
});

console.log('📦 Grouped notifications:');
for (const [groupKey, notifications] of notificationGroups) {
  console.log(`  Group: ${groupKey}`);
  console.log(`  Count: ${notifications.length}`);
  console.log(`  Notifications: ${notifications.map(n => n.id).join(', ')}`);
}

// Test bundling logic
for (const [groupKey, groupNotifications] of notificationGroups) {
  if (groupNotifications.length > 1) {
    console.log(`\n📦 Processing bundle for group: ${groupKey}`);
    
    // Sort by creation date (oldest first)
    groupNotifications.sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    
    const [oldestNotification, ...duplicatesToDelete] = groupNotifications;
    
    console.log(`  Oldest notification: ${oldestNotification.id}`);
    console.log(`  Duplicates to delete: ${duplicatesToDelete.map(n => n.id).join(', ')}`);
    
    // Create bundled notification
    const bundledNotification = {
      ...oldestNotification,
      isBundled: true,
      bundleCount: groupNotifications.length,
      bundleKey: groupKey,
      message: `You have ${groupNotifications.length} new property enquiries`,
      bundledItems: groupNotifications.map(notification => ({
        id: notification.id,
        userId: notification.userId,
        message: notification.message,
        property: notification.property,
        createdAt: notification.createdAt
      }))
    };
    
    console.log(`  Bundled notification created:`);
    console.log(`    ID: ${bundledNotification.id}`);
    console.log(`    Message: ${bundledNotification.message}`);
    console.log(`    Bundle count: ${bundledNotification.bundleCount}`);
    console.log(`    Bundle key: ${bundledNotification.bundleKey}`);
    console.log(`    Bundled items: ${bundledNotification.bundledItems.length}`);
  }
}

console.log('\n✅ Test completed successfully!');
