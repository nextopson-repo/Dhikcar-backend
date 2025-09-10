# Notification Bundling System

## Overview

The notification bundling system automatically detects and groups duplicate notifications to provide a cleaner, more organized notification experience similar to social media platforms like Instagram and Facebook.

## Features

### Automatic Duplicate Detection
- Detects notifications with the same type and property/user
- Groups them into a single bundled notification
- Preserves all individual notification data in the `bundledItems` array

### Smart Bundling Logic
- Groups notifications by type (enquiry, review, boost, follow, etc.)
- For property-related notifications, groups by property title
- For user-related notifications, groups by user name
- Maintains chronological order (oldest notification becomes the bundle)

### Bundle Information
- `isBundled`: Boolean flag indicating if notification is bundled
- `bundleCount`: Number of notifications in the bundle
- `bundleKey`: Unique identifier for the bundle group
- `bundledItems`: Array containing all individual notifications

## API Endpoints

### Manual Cleanup
```http
POST /api/v1/notification/manual-cleanup/:userId
```
Triggers manual cleanup and bundling of duplicate notifications for a specific user.

### Fetch Notifications (Enhanced)
```http
GET /api/v1/notification/fetch-notifications?userId=:userId&page=:page&limit=:limit
```
Automatically triggers cleanup on the first page load and returns bundled notifications.

### Bundle Details
```http
GET /api/v1/notification/bundle-details/:notificationId
```
Returns detailed information about a bundled notification including all individual items.

## Frontend Integration

### Notification Screen Updates
- Enhanced UI to display bundled notifications
- Shows bundle count and individual notification details
- Cleanup button in header for manual bundling
- Improved styling for bundled notification cards

### Bundle Display Features
- Property details for property-related bundles
- Individual notification messages
- Bundle count badges
- "View All" action buttons

## Database Schema

### New Fields Added to Notifications Table
```sql
-- Bundled notification fields
isBundled BOOLEAN DEFAULT FALSE
bundleCount INT DEFAULT 1
bundledItems JSON NULL
bundleKey VARCHAR(255) NULL
```

## Usage Examples

### Creating Duplicate Notifications
```javascript
// Multiple enquiries for the same property
const notifications = [
  {
    userId: "user123",
    message: "You have a new property enquiry for Property A",
    type: "enquiry",
    property: { title: "Property A", price: "₹5000000" }
  },
  {
    userId: "user123", 
    message: "You have a new property enquiry for Property A",
    type: "enquiry",
    property: { title: "Property A", price: "₹5000000" }
  }
];
```

### After Bundling
```javascript
// Single bundled notification
{
  id: "bundle123",
  userId: "user123",
  message: "You have 2 new property enquiries",
  type: "enquiry",
  isBundled: true,
  bundleCount: 2,
  bundleKey: "enquiry_Property A",
  bundledItems: [
    // Original notifications preserved here
  ]
}
```

## Testing

### Manual Testing
1. Create multiple duplicate notifications
2. Use the cleanup button in the notification screen
3. Verify notifications are bundled correctly

### Automated Testing
Run the test script:
```bash
node testing/test-notification-bundling.js
```

## Benefits

1. **Reduced Clutter**: Eliminates duplicate notifications
2. **Better UX**: Cleaner notification feed
3. **Data Preservation**: All original notification data is maintained
4. **Social Media Style**: Familiar bundling pattern like Instagram/Facebook
5. **Automatic**: Works transparently without user intervention

## Configuration

### Bundle Window
- Default: 30 minutes for real-time bundling
- Manual cleanup: Processes all unread notifications

### Grouping Criteria
- Type + Property Title (for property notifications)
- Type + User Name (for user notifications)
- Type only (for general notifications)

## Future Enhancements

1. **Time-based Bundling**: Group notifications within time windows
2. **Smart Messages**: Dynamic bundle messages based on content
3. **Bundle Actions**: Bulk actions for bundled notifications
4. **Analytics**: Track bundling effectiveness and user engagement
