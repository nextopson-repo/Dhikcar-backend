# Bandwidth Testing Guide

This guide explains how to run bandwidth tests on the property creation endpoint to measure network performance and data transfer metrics.

## Overview

Bandwidth testing measures:
- **Data transfer volume** (bytes sent/received)
- **Network throughput** (bytes per second)
- **Request/response sizes** (payload analysis)
- **Bandwidth utilization** (percentage of available bandwidth)
- **Network efficiency** (data transfer optimization)

## Prerequisites

1. Make sure your server is running on `localhost:5000`
2. Ensure the property creation endpoint is accessible at `/api/v1/property/create-update`
3. Network connectivity is stable

## Available Bandwidth Testing Methods

### 1. Custom Node.js Bandwidth Test (Recommended)

This is a custom bandwidth testing script that provides detailed network metrics.

```bash
# Run the default bandwidth test (100 requests, 10 concurrent)
npm run bandwidth-test

# Run a quick bandwidth test (50 requests, 5 concurrent)
npm run bandwidth-test:quick

# Run a heavy bandwidth test (200 requests, 20 concurrent)
npm run bandwidth-test:heavy
```

### 2. Artillery Bandwidth Test

Artillery configuration specifically designed for bandwidth measurement.

```bash
# Run Artillery bandwidth test
npm run bandwidth-test:artillery
```

### 3. Direct Execution

You can also run tests directly from the testing folder:

```bash
# Navigate to testing folder
cd testing

# Run custom bandwidth tests
node bandwidth-test.js
node bandwidth-test.js --quick
node bandwidth-test.js --heavy

# Run Artillery bandwidth test
npx artillery run bandwidth-test-config.yml
```

## Bandwidth Test Configuration

### Custom Node.js Script (`testing/bandwidth-test.js`)

- **Default**: 100 total requests, 10 concurrent requests
- **Quick**: 50 total requests, 5 concurrent requests  
- **Heavy**: 200 total requests, 20 concurrent requests
- **Timeout**: 30 seconds per request
- **Delay**: 1 second between batches

### Artillery Configuration (`testing/bandwidth-test-config.yml`)

- **Warm up**: 30 seconds, 5 requests/second
- **Measurement**: 60 seconds, 10 requests/second
- **Stress**: 30 seconds, 20 requests/second
- **Cool down**: 15 seconds, 5 requests/second

## Metrics Measured

### 1. Data Transfer Metrics
- **Total Bytes Sent**: Complete data sent to server
- **Total Bytes Received**: Complete data received from server
- **Total Data Transferred**: Sum of sent and received data
- **Average Request Size**: Mean size of each request payload
- **Average Response Size**: Mean size of each response

### 2. Network Performance
- **Throughput**: Data transfer rate (bytes/second)
- **Bandwidth Utilization**: Percentage of available bandwidth used
- **Network Efficiency**: How efficiently data is transferred
- **Response Time**: Time taken for each request

### 3. Size Analysis
- **Payload Size**: Size of the JSON payload being sent
- **Response Size**: Size of server responses
- **Size Distribution**: Analysis of request/response size patterns

## Sample Output

```
🌐 Starting Bandwidth Test for Property Creation Endpoint
📊 Target: http://localhost:5000/api/v1/property/create-update
📈 Test Type: quick
📈 Total Requests: 50
⚡ Concurrent Requests: 5
⏱️  Delay Between Batches: 500ms
📦 Payload Size: 1.22 KB
============================================================
Request 1: SUCCESS - Status: 429, Time: 22ms, Size: 1248B → 44B
Request 2: SUCCESS - Status: 429, Time: 16ms, Size: 1248B → 44B
...

============================================================
🌐 BANDWIDTH TEST RESULTS
============================================================
✅ Successful Requests: 50
❌ Failed Requests: 0
📈 Success Rate: 100.00%
⏱️  Total Time: 4605ms
📊 Average Response Time: 6.28ms
⚡ Min Response Time: 4ms
🐌 Max Response Time: 22ms
📈 Requests per Second: 10.86

📊 BANDWIDTH METRICS
==============================
📤 Total Data Sent: 60.94 KB
📥 Total Data Received: 2.15 KB
📦 Total Data Transferred: 63.09 KB
📏 Average Request Size: 1.22 KB
📏 Average Response Size: 44 B
🚀 Throughput: 13.7 KB/s
📊 Bandwidth Utilization: 0.01%

📋 Status Code Distribution:
   429: 50 requests

💾 Detailed results saved to: testing/bandwidth-test-results-1753905783529.json
```

## Understanding Bandwidth Metrics

### 1. Data Transfer Analysis
- **Request Size**: How much data is being sent to the server
- **Response Size**: How much data the server is sending back
- **Total Transfer**: Complete data movement in both directions

### 2. Network Performance
- **Throughput**: How fast data is being transferred
- **Bandwidth Utilization**: How much of your network capacity is being used
- **Efficiency**: How well the network is performing

### 3. Size Optimization
- **Large Requests**: May indicate inefficient payload structure
- **Large Responses**: May indicate excessive data being returned
- **Size Patterns**: Help identify optimization opportunities

## Expected Results

### Typical Bandwidth Metrics
- **Payload Size**: ~1.2 KB for property creation requests
- **Response Size**: ~44 B for rate-limited responses, ~2-5 KB for successful responses
- **Throughput**: Varies based on network speed and server performance
- **Bandwidth Utilization**: Usually very low for API testing (< 1%)

### Performance Indicators
- **High Throughput**: Good network performance
- **Low Bandwidth Utilization**: Efficient data transfer
- **Consistent Response Sizes**: Stable API behavior
- **Fast Response Times**: Good server performance

## Monitoring During Bandwidth Test

While running the bandwidth test, you can monitor:

1. **Network Resources**: Bandwidth usage and network latency
2. **Server Performance**: Response times and data processing
3. **Data Transfer**: Request/response size patterns
4. **Network Bottlenecks**: Identify bandwidth limitations

## Troubleshooting

### Common Issues

1. **Low Throughput**: Check network speed and server performance
2. **High Bandwidth Utilization**: May indicate network congestion
3. **Inconsistent Response Sizes**: Check for varying response data
4. **Network Errors**: Verify connectivity and server availability

### Performance Tips

1. **Baseline Testing**: Establish normal bandwidth patterns
2. **Network Monitoring**: Watch for bandwidth spikes
3. **Size Optimization**: Look for ways to reduce payload/response sizes
4. **Load Testing**: Combine with load testing for comprehensive analysis

## Customization

You can modify the bandwidth test parameters in `testing/bandwidth-test.js`:

```javascript
const TOTAL_REQUESTS = 100;        // Total number of requests
const CONCURRENT_REQUESTS = 10;     // Concurrent requests per batch
const DELAY_BETWEEN_BATCHES = 1000; // Delay between batches (ms)
```

For Artillery, modify `testing/bandwidth-test-config.yml` to adjust phases and arrival rates.

## Results Analysis

The bandwidth test generates a detailed JSON report with:

- Data transfer statistics
- Network performance metrics
- Size distribution analysis
- Bandwidth utilization data

Use this data to:
- Identify network bottlenecks
- Optimize payload sizes
- Monitor bandwidth usage
- Plan network capacity requirements
- Improve API efficiency

## File Structure

```
testing/
├── bandwidth-test.js              # Custom bandwidth testing script
├── bandwidth-test-config.yml      # Artillery bandwidth configuration
├── bandwidth-test-results-*.json  # Detailed bandwidth results (generated)
└── BANDWIDTH_TESTING.md          # This bandwidth testing guide
```

## Integration with Load Testing

Bandwidth testing complements load testing by providing:

1. **Network Perspective**: Understanding data transfer patterns
2. **Size Analysis**: Identifying payload optimization opportunities
3. **Performance Correlation**: How network affects overall performance
4. **Capacity Planning**: Network requirements for scaling

## Best Practices

1. **Regular Testing**: Run bandwidth tests periodically
2. **Baseline Comparison**: Compare against established baselines
3. **Network Monitoring**: Monitor during peak usage times
4. **Optimization**: Use results to optimize payload sizes
5. **Documentation**: Keep detailed records of bandwidth patterns 