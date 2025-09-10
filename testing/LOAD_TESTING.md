# Load Testing Guide

This guide explains how to run load tests on the property creation endpoint using the provided payload.

## Prerequisites

1. Make sure your server is running on `localhost:5000`
2. Ensure the property creation endpoint is accessible at `/api/v1/property/create-update`

## Available Load Testing Methods

### 1. Custom Node.js Load Test (Recommended)

This is a custom load testing script that provides detailed metrics and is more reliable.

```bash
# Run the default load test (100 requests, 10 concurrent)
npm run load-test

# Run a quick load test (50 requests, 5 concurrent)
npm run load-test:quick

# Run a heavy load test (200 requests, 20 concurrent)
npm run load-test:heavy
```

### 2. Artillery Load Test

Artillery is a popular load testing tool with more advanced features.

```bash
# Run Artillery load test
npm run load-test:artillery
```

### 3. Direct Execution

You can also run tests directly from the testing folder:

```bash
# Navigate to testing folder
cd testing

# Run custom tests
node load-test.js
node load-test.js --quick
node load-test.js --heavy

# Run Artillery test
npx artillery run load-test-config.yml
```

## Load Test Configuration

### Custom Node.js Script (`testing/load-test.js`)

- **Default**: 100 total requests, 10 concurrent requests
- **Quick**: 50 total requests, 5 concurrent requests  
- **Heavy**: 200 total requests, 20 concurrent requests
- **Timeout**: 30 seconds per request
- **Delay**: 1 second between batches

### Artillery Configuration (`testing/load-test-config.yml`)

- **Warm up**: 60 seconds, 10 requests/second
- **Sustained load**: 120 seconds, 20 requests/second
- **Peak load**: 60 seconds, 50 requests/second
- **Cool down**: 30 seconds, 5 requests/second

## Test Payload

The load test uses the payload from `testing/payload.json` which includes:

- Property details (name, location, price, etc.)
- Image keys for property images
- Amenities and specifications
- User ID and other metadata

## Expected Results

The load test will provide:

- **Success Rate**: Percentage of successful requests
- **Response Times**: Average, minimum, and maximum response times
- **Throughput**: Requests per second
- **Status Code Distribution**: Breakdown of HTTP status codes
- **Error Details**: Detailed error information for failed requests

## Sample Output

```
🚀 Starting Load Test for Property Creation Endpoint
📊 Target: http://localhost:5000/api/v1/property/create-update
📈 Total Requests: 100
⚡ Concurrent Requests: 10
============================================================
Request 1: SUCCESS - Status: 201, Time: 245ms
Request 2: SUCCESS - Status: 201, Time: 198ms
...

============================================================
📊 LOAD TEST RESULTS
============================================================
✅ Successful Requests: 95
❌ Failed Requests: 5
📈 Success Rate: 95.00%
⏱️  Total Time: 15420ms
📊 Average Response Time: 234.56ms
⚡ Min Response Time: 156ms
🐌 Max Response Time: 892ms
📈 Requests per Second: 6.48

📋 Status Code Distribution:
   201: 90 requests
   400: 3 requests
   500: 2 requests

💾 Detailed results saved to: testing/load-test-results-1703123456789.json
```

## File Structure

```
testing/
├── README.md                    # Testing folder documentation
├── load-test.js                 # Custom load testing script
├── load-test-config.yml         # Artillery configuration
├── payload.json                 # Test payload data
├── LOAD_TESTING.md             # This testing guide
├── LOAD_TEST_RESULTS.md        # Results summary
└── load-test-results-*.json    # Detailed results (generated)
```

## Monitoring During Load Test

While running the load test, you can monitor:

1. **Server Resources**: CPU, memory, and disk usage
2. **Database Performance**: Query execution times and connection pool
3. **Network**: Bandwidth usage and latency
4. **Application Logs**: Error rates and response times

## Troubleshooting

### Common Issues

1. **Connection Refused**: Ensure the server is running on port 5000
2. **Timeout Errors**: Check if the server is under heavy load
3. **Rate Limiting**: The server may have rate limiting enabled
4. **Database Issues**: Check database connection and performance

### Performance Tips

1. **Start Small**: Begin with fewer requests and gradually increase
2. **Monitor Resources**: Watch server CPU and memory usage
3. **Check Logs**: Review application logs for errors
4. **Database**: Ensure database can handle the load

## Customization

You can modify the load test parameters in `testing/load-test.js`:

```javascript
const TOTAL_REQUESTS = 100;        // Total number of requests
const CONCURRENT_REQUESTS = 10;     // Concurrent requests per batch
const DELAY_BETWEEN_BATCHES = 1000; // Delay between batches (ms)
```

For Artillery, modify `testing/load-test-config.yml` to adjust phases and arrival rates.

## Results Analysis

The load test generates a detailed JSON report with:

- Summary statistics
- Response time distribution
- Error details
- Status code breakdown

Use this data to:
- Identify performance bottlenecks
- Optimize server configuration
- Plan capacity requirements
- Monitor performance trends 