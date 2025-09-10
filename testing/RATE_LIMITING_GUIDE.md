# Production-Ready Rate Limiting Guide

## Overview

This guide explains the production-ready rate limiting system implemented for the NextDeal Property API. The system uses multiple tiers of rate limiting with shorter time windows for better security and performance.

## Rate Limiting Tiers

### 1. **Strict Rate Limiter** (Most Restrictive)
- **Window**: 1 minute (60,000ms)
- **Limit**: 10 requests per minute
- **Use Case**: Critical operations (delete, update, status changes)
- **Endpoints**:
  - `DELETE /property` - Property deletion
  - `POST /update-is-sold` - Property status updates
  - `POST /update-property-status` - Property status changes
  - `POST /update-working-with-agent` - Agent updates
  - `POST /delete-user-requirements` - Requirement deletion
  - `POST /delete-user-requirements-enquiry` - Enquiry deletion

### 2. **Property Creation Rate Limiter** (Specific)
- **Window**: 1 minute (60,000ms)
- **Limit**: 5 property creations per minute
- **Use Case**: Property creation/update operations
- **Endpoints**:
  - `POST /create-update` - Property creation and updates

### 3. **Upload Rate Limiter** (File Operations)
- **Window**: 1 minute (60,000ms)
- **Limit**: 3 uploads per minute
- **Use Case**: File upload operations
- **Endpoints**:
  - `POST /upload-property-images` - Image uploads
  - `POST /upload-property-images-with-rekognition` - AI image processing
  - `POST /test-rekognition-analysis` - AI analysis tests
  - `POST /test-image-compression` - Image compression tests
  - `POST /test-nsfw-detection` - NSFW detection tests
  - `POST /test-contact-detection` - Contact detection tests

### 4. **Search Rate Limiter** (High Volume)
- **Window**: 1 minute (60,000ms)
- **Limit**: 50 searches per minute
- **Use Case**: Search and filter operations
- **Endpoints**:
  - `POST /search-property` - Property search
  - `POST /get-property-filter-data` - Filter data retrieval

### 5. **Burst Rate Limiter** (Short Window)
- **Window**: 15 seconds (15,000ms)
- **Limit**: 5 requests per 15 seconds
- **Use Case**: Status check operations
- **Endpoints**:
  - `GET /check-model-status` - Model status checks
  - `GET /check-rekognition-status` - Rekognition status checks

### 6. **Standard Rate Limiter** (Default)
- **Window**: 1 minute (60,000ms)
- **Limit**: 30 requests per minute
- **Use Case**: General API operations
- **Endpoints**:
  - `POST /get-property-by-id` - Property retrieval
  - `POST /getAll` - Property listing
  - `POST /trending-property` - Trending properties
  - `POST /trending-subcategories` - Trending categories
  - `POST /subcategory-trending-details` - Category details
  - `GET /get-slides` - Slide data
  - `POST /get-user-properties` - User properties
  - `POST /get-user-properties-by-ids` - Multiple properties
  - `POST /get-property-leands` - Property leads
  - `POST /share-property-email-notification` - Email notifications
  - `POST /create-update-requirement` - Requirement creation
  - `POST /get-user-requirements` - User requirements
  - `POST /get-all-requirements` - All requirements
  - `POST /create-user-requirements-enquiry` - Requirement enquiries
  - `POST /get-user-requirements-enquiry` - User enquiries
  - `POST /get-requirement-enquiries` - All enquiries
  - `POST /create-requirement-enquiry` - Enquiry creation
  - `POST /offering-property` - Property offerings

## Configuration

### Environment Variables

```bash
# Default Rate Limiting
COMMON_RATE_LIMIT_WINDOW_MS="60000" # 1 minute window
COMMON_RATE_LIMIT_MAX_REQUESTS="30" # 30 requests per minute

# Specific Rate Limits
PROPERTY_CREATION_RATE_LIMIT="5" # 5 property creations per minute
SEARCH_RATE_LIMIT="50" # 50 searches per minute
UPLOAD_RATE_LIMIT="3" # 3 uploads per minute
BURST_RATE_LIMIT="5" # 5 requests per 15 seconds
STRICT_RATE_LIMIT="10" # 10 requests per minute
STANDARD_RATE_LIMIT="30" # 30 requests per minute

# Rate Limiting Windows
RATE_LIMIT_WINDOW_STANDARD="60000" # 1 minute
RATE_LIMIT_WINDOW_BURST="15000" # 15 seconds
RATE_LIMIT_WINDOW_STRICT="60000" # 1 minute
```

### Production Recommendations

#### 1. **Development Environment**
```bash
# More lenient limits for development
STANDARD_RATE_LIMIT="100"
STRICT_RATE_LIMIT="50"
PROPERTY_CREATION_RATE_LIMIT="20"
```

#### 2. **Production Environment**
```bash
# Stricter limits for production
STANDARD_RATE_LIMIT="30"
STRICT_RATE_LIMIT="10"
PROPERTY_CREATION_RATE_LIMIT="5"
UPLOAD_RATE_LIMIT="3"
```

#### 3. **High-Traffic Production**
```bash
# Very strict limits for high-traffic production
STANDARD_RATE_LIMIT="20"
STRICT_RATE_LIMIT="5"
PROPERTY_CREATION_RATE_LIMIT="3"
UPLOAD_RATE_LIMIT="2"
```

## Security Features

### 1. **Enhanced Key Generation**
- Uses IP + User-Agent for better rate limiting
- Prevents simple IP spoofing
- More granular rate limiting per client

### 2. **Security Headers**
- Disabled legacy headers for security
- Standard headers enabled
- Proper rate limit headers included

### 3. **Custom Error Responses**
- Structured JSON error responses
- Includes retry-after information
- Timestamp for debugging

### 4. **Memory Store**
- Currently uses in-memory store
- Consider Redis for production scaling
- Distributed rate limiting support

## Response Format

### Rate Limited Response
```json
{
  "success": false,
  "message": "Rate limit exceeded. Please wait before making more requests.",
  "retryAfter": 60,
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### Headers Included
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1640995200
Retry-After: 60
```

## Testing Rate Limits

### 1. **Quick Test**
```bash
# Test property creation rate limit
for i in {1..10}; do
  curl -X POST http://localhost:5000/api/v1/property/create-update \
    -H "Content-Type: application/json" \
    -d @testing/payload.json
  echo "Request $i"
  sleep 1
done
```

### 2. **Burst Test**
```bash
# Test burst rate limiting
for i in {1..10}; do
  curl -X GET http://localhost:5000/api/v1/property/check-model-status &
done
wait
```

### 3. **Search Test**
```bash
# Test search rate limiting
for i in {1..60}; do
  curl -X POST http://localhost:5000/api/v1/property/search-property \
    -H "Content-Type: application/json" \
    -d '{"category": "Residential"}'
  echo "Search request $i"
  sleep 1
done
```

## Monitoring and Analytics

### 1. **Rate Limit Metrics**
- Track rate limit hits per endpoint
- Monitor rate limit patterns
- Identify potential abuse

### 2. **Performance Impact**
- Monitor response times under rate limiting
- Track memory usage
- Monitor CPU usage

### 3. **User Experience**
- Track user impact of rate limiting
- Monitor retry patterns
- Analyze user behavior

## Best Practices

### 1. **Client-Side Handling**
```javascript
// Handle rate limiting in client code
async function makeRequest(endpoint, data) {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      console.log(`Rate limited. Retry after ${retryAfter} seconds`);
      // Implement exponential backoff
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      return makeRequest(endpoint, data);
    }
    
    return response.json();
  } catch (error) {
    console.error('Request failed:', error);
  }
}
```

### 2. **Server-Side Monitoring**
```javascript
// Monitor rate limit hits
app.use((req, res, next) => {
  res.on('finish', () => {
    if (res.statusCode === 429) {
      console.log(`Rate limit hit: ${req.ip} - ${req.path}`);
      // Log to monitoring system
    }
  });
  next();
});
```

### 3. **Configuration Management**
```javascript
// Environment-based configuration
const rateLimitConfig = {
  development: {
    standard: 100,
    strict: 50,
    propertyCreation: 20
  },
  production: {
    standard: 30,
    strict: 10,
    propertyCreation: 5
  }
};
```

## Troubleshooting

### 1. **Common Issues**

#### Rate Limits Too Strict
```bash
# Increase limits temporarily
export STANDARD_RATE_LIMIT="50"
export STRICT_RATE_LIMIT="20"
```

#### Rate Limits Too Lenient
```bash
# Decrease limits for security
export STANDARD_RATE_LIMIT="20"
export STRICT_RATE_LIMIT="5"
```

### 2. **Debugging**
```bash
# Check current rate limit status
curl -I http://localhost:5000/api/v1/property/getAll

# Monitor rate limit headers
curl -v http://localhost:5000/api/v1/property/getAll
```

### 3. **Performance Tuning**
- Monitor memory usage
- Consider Redis for distributed rate limiting
- Adjust limits based on server capacity
- Implement rate limit bypass for trusted clients

## Migration Guide

### From Old Rate Limiting
1. **Update imports** in route files
2. **Replace old rate limiters** with new tiered system
3. **Update environment variables**
4. **Test all endpoints** with new limits
5. **Monitor performance** and adjust as needed

### Testing Checklist
- [ ] All endpoints have appropriate rate limiting
- [ ] Rate limit responses are properly formatted
- [ ] Headers are correctly set
- [ ] Error messages are user-friendly
- [ ] Performance impact is acceptable
- [ ] Security is maintained

## Conclusion

This production-ready rate limiting system provides:

- **Multiple tiers** for different use cases
- **Shorter time windows** for better security
- **Enhanced security** with IP + User-Agent tracking
- **Proper error responses** with retry information
- **Easy configuration** via environment variables
- **Scalable architecture** ready for Redis integration

The system is designed to protect your API while maintaining good user experience and providing clear feedback when limits are exceeded. 