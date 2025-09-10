# User Statistics API

This directory contains the User Statistics API implementation for the NextDeal application.

## Structure

```
src/api/routes/User/
├── UserStatisticsController.ts    # Controller with all business logic
├── UserStatisticsRoutes.ts        # Route definitions
├── UserStatisticsAPI.md          # Comprehensive API documentation
├── test-user-statistics.js       # Test file for API endpoints
└── README.md                     # This file
```

## Files Overview

### 1. UserStatisticsController.ts
Contains all the business logic for user statistics:
- `getTotalUsers()` - Get total user count
- `getActiveUsers()` - Get active users count (last 30 days)
- `getInactiveUsers()` - Get inactive users count
- `getOnlineUsers()` - Get currently online users via WebSocket
- `getUserStatistics()` - Get comprehensive statistics
- `getActiveUsersList()` - Get paginated active users list
- `getInactiveUsersList()` - Get paginated inactive users list

### 2. UserStatisticsRoutes.ts
Defines all the API endpoints:
- `GET /total` - Total users count
- `GET /active` - Active users count
- `GET /inactive` - Inactive users count
- `GET /online` - Online users count
- `GET /statistics` - Comprehensive statistics
- `GET /active/list` - Active users list with pagination
- `GET /inactive/list` - Inactive users list with pagination

### 3. UserStatisticsAPI.md
Complete API documentation with:
- Endpoint descriptions
- Request/response examples
- Error handling
- Usage examples
- cURL commands

### 4. test-user-statistics.js
Test file to verify API functionality:
- Individual test functions for each endpoint
- Complete test suite
- Error handling examples

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/user-statistics/total` | Get total users count |
| GET | `/api/v1/user-statistics/active` | Get active users count |
| GET | `/api/v1/user-statistics/inactive` | Get inactive users count |
| GET | `/api/v1/user-statistics/online` | Get online users count |
| GET | `/api/v1/user-statistics/statistics` | Get comprehensive statistics |
| GET | `/api/v1/user-statistics/active/list` | Get active users list |
| GET | `/api/v1/user-statistics/inactive/list` | Get inactive users list |

## Features

### 1. User Activity Tracking
- **Active Users**: Users active in last 30 days
- **Inactive Users**: Users not active in last 30 days
- **Online Users**: Currently connected via WebSocket

### 2. Comprehensive Statistics
- Total user count
- User type breakdown (Agent, Owner, EndUser, Investor)
- Verification status breakdown
- Activity period breakdown (24h, 7d, 30d, 90d, 90d+)

### 3. Pagination & Filtering
- Configurable page size
- Page-based pagination
- User type filtering
- Proper pagination metadata

### 4. Data Privacy
- Sensitive information excluded from responses
- Only necessary user fields exposed
- Secure data handling

## Usage Examples

### Get Total Users
```bash
curl -X GET "http://localhost:3000/api/v1/user-statistics/total"
```

### Get Active Users with Pagination
```bash
curl -X GET "http://localhost:3000/api/v1/user-statistics/active/list?page=1&limit=20"
```

### Get Statistics for Agents Only
```bash
curl -X GET "http://localhost:3000/api/v1/user-statistics/active/list?userType=Agent"
```

### Get Comprehensive Statistics
```bash
curl -X GET "http://localhost:3000/api/v1/user-statistics/statistics"
```

## Testing

Run the test file to verify all endpoints:

```bash
# Install axios if not already installed
npm install axios

# Run tests
node src/api/routes/User/test-user-statistics.js
```

## Integration

The API is integrated into the main server at:
```typescript
// In server.ts
app.use('/api/v1/user-statistics', UserStatisticsRoutes);
```

## Error Handling

All endpoints include:
- Proper HTTP status codes
- Descriptive error messages
- Consistent error response format
- Try-catch error handling

## Performance Considerations

- Database queries optimized with proper indexing
- Pagination to handle large datasets
- Efficient TypeORM queries
- Minimal data transfer

## Security

- Input validation
- SQL injection prevention via TypeORM
- No sensitive data exposure
- Proper error handling without information leakage

## Dependencies

- Express.js for routing
- TypeORM for database operations
- Socket.IO for online user tracking
- UserAuth entity for user data

## Future Enhancements

Potential improvements:
1. Caching for frequently accessed statistics
2. Real-time statistics updates via WebSocket
3. Advanced filtering options
4. Export functionality for reports
5. Analytics dashboard integration 