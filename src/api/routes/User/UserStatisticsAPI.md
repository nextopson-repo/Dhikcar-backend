# User Statistics API Documentation

This document describes the User Statistics APIs for the NextDeal application.

## Base URL
```
/api/v1/user-statistics
```

## Endpoints

### 1. Get Total Users Count
**GET** `/total`

Returns the total number of users in the system.

**Response:**
```json
{
  "success": true,
  "message": "Total users count retrieved successfully",
  "data": {
    "totalUsers": 1250,
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

### 2. Get Active Users Count
**GET** `/active`

Returns the number of users who have been active in the last 30 days.

**Response:**
```json
{
  "success": true,
  "message": "Active users count retrieved successfully",
  "data": {
    "activeUsers": 850,
    "lastActivityThreshold": "2023-12-16T10:30:00.000Z",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

### 3. Get Inactive Users Count
**GET** `/inactive`

Returns the number of users who haven't been active in the last 30 days.

**Response:**
```json
{
  "success": true,
  "message": "Inactive users count retrieved successfully",
  "data": {
    "inactiveUsers": 400,
    "lastActivityThreshold": "2023-12-16T10:30:00.000Z",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

### 4. Get Online Users Count
**GET** `/online`

Returns the number of users currently connected via WebSocket.

**Response:**
```json
{
  "success": true,
  "message": "Online users count retrieved successfully",
  "data": {
    "onlineUsers": 45,
    "activeRooms": ["user123", "user456", "user789"],
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

### 5. Get Comprehensive User Statistics
**GET** `/statistics`

Returns comprehensive user statistics including breakdowns by user type, verification status, and activity periods.

**Response:**
```json
{
  "success": true,
  "message": "User statistics retrieved successfully",
  "data": {
    "totalUsers": 1250,
    "activeUsers": 850,
    "inactiveUsers": 400,
    "userTypeBreakdown": {
      "Agent": 200,
      "Owner": 300,
      "EndUser": 600,
      "Investor": 150
    },
    "verificationStatus": {
      "emailVerified": 1000,
      "mobileVerified": 950,
      "fullyVerified": 900,
      "notVerified": 350
    },
    "lastActivityBreakdown": {
      "last24Hours": 150,
      "last7Days": 400,
      "last30Days": 850,
      "last90Days": 1100,
      "olderThan90Days": 150
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 6. Get Active Users List
**GET** `/active/list`

Returns a paginated list of active users with their complete details.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Number of items per page (default: 10)
- `userType` (optional): Filter by user type (Agent, Owner, EndUser, Investor)

**Example Request:**
```
GET /api/v1/user-statistics/active/list?page=1&limit=20&userType=Agent
```

**Response:**
```json
{
  "success": true,
  "message": "Active users list retrieved successfully",
  "data": {
    "users": [
      {
        "id": "user123",
        "fullName": "John Doe",
        "email": "john@example.com",
        "mobileNumber": "+1234567890",
        "userType": "Agent",
        "isEmailVerified": true,
        "isMobileVerified": true,
        "isFullyVerified": true,
        "profileImg": "https://example.com/profile.jpg",
        "profileUrl": "https://example.com/profile.jpg",
        "isSignedUp": true,
        "googleId": "google123456",
        "createdAt": "2023-01-15T10:30:00.000Z",
        "lastActivity": "2024-01-15T09:30:00.000Z",
        "daysActive": 0
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 850,
      "totalPages": 43
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 7. Get Inactive Users List
**GET** `/inactive/list`

Returns a paginated list of inactive users with their complete details.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Number of items per page (default: 10)
- `userType` (optional): Filter by user type (Agent, Owner, EndUser, Investor)

**Example Request:**
```
GET /api/v1/user-statistics/inactive/list?page=1&limit=20&userType=EndUser
```

**Response:**
```json
{
  "success": true,
  "message": "Inactive users list retrieved successfully",
  "data": {
    "users": [
      {
        "id": "user456",
        "fullName": "Jane Smith",
        "email": "jane@example.com",
        "mobileNumber": "+1234567891",
        "userType": "EndUser",
        "isEmailVerified": true,
        "isMobileVerified": false,
        "isFullyVerified": false,
        "profileImg": "https://example.com/profile2.jpg",
        "profileUrl": "https://example.com/profile2.jpg",
        "isSignedUp": true,
        "googleId": null,
        "createdAt": "2023-01-15T10:30:00.000Z",
        "lastActivity": "2023-12-10T09:30:00.000Z",
        "daysInactive": 36
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 400,
      "totalPages": 20
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## User Data Fields

The user list endpoints return the following fields for each user:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique user identifier |
| `fullName` | string | User's full name (or "N/A" if not set) |
| `email` | string | User's email address (or "N/A" if not set) |
| `mobileNumber` | string | User's mobile number (or "N/A" if not set) |
| `userType` | string | User type (Agent, Owner, EndUser, Investor) |
| `isEmailVerified` | boolean | Whether email is verified |
| `isMobileVerified` | boolean | Whether mobile is verified |
| `isFullyVerified` | boolean | Whether both email and mobile are verified |
| `profileImg` | string/null | Profile image URL |
| `profileUrl` | string/null | Alias for profileImg |
| `isSignedUp` | boolean | Whether user has completed signup |
| `googleId` | string/null | Google OAuth ID if available |
| `createdAt` | string | Account creation timestamp |
| `lastActivity` | string | Last activity timestamp |
| `daysActive` | number/null | Days since last activity (for active users) |
| `daysInactive` | number/null | Days since last activity (for inactive users) |

## Error Responses

All endpoints return error responses in the following format:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message"
}
```

**Common HTTP Status Codes:**
- `200`: Success
- `400`: Bad Request
- `500`: Internal Server Error

## Usage Examples

### JavaScript/Node.js
```javascript
const axios = require('axios');

// Get total users
const getTotalUsers = async () => {
  try {
    const response = await axios.get('/api/v1/user-statistics/total');
    console.log('Total users:', response.data.data.totalUsers);
  } catch (error) {
    console.error('Error:', error.response.data);
  }
};

// Get active users with pagination
const getActiveUsers = async (page = 1, limit = 10) => {
  try {
    const response = await axios.get(`/api/v1/user-statistics/active/list?page=${page}&limit=${limit}`);
    console.log('Active users:', response.data.data.users);
  } catch (error) {
    console.error('Error:', error.response.data);
  }
};
```

### cURL Examples
```bash
# Get total users
curl -X GET "http://localhost:5000/api/v1/user-statistics/total"

# Get comprehensive statistics
curl -X GET "http://localhost:5000/api/v1/user-statistics/statistics"

# Get active users list with pagination
curl -X GET "http://localhost:5000/api/v1/user-statistics/active/list?page=1&limit=20"

# Get inactive users filtered by user type
curl -X GET "http://localhost:5000/api/v1/user-statistics/inactive/list?userType=Agent"

# Get all active agents
curl -X GET "http://localhost:5000/api/v1/user-statistics/active/list?userType=Agent&limit=50"
```

## Notes

1. **Activity Definition**: A user is considered "active" if they have been active in the last 30 days based on their `updatedAt` timestamp.

2. **Online Users**: Online users are determined by active WebSocket connections.

3. **Pagination**: List endpoints support pagination with configurable page size.

4. **Filtering**: User list endpoints support filtering by user type.

5. **Timestamps**: All responses include ISO 8601 timestamps.

6. **Data Privacy**: Sensitive user information is not exposed in the responses.

7. **Enhanced User Data**: All user list endpoints now include complete user information including fullName, email, mobileNumber, profileUrl, and verification status.

8. **Null Handling**: Fields that are null in the database are properly handled and returned as "N/A" for strings or null for other types. 