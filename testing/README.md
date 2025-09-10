# Testing Folder

This folder contains all load testing and bandwidth testing related files and configurations for the NextDeal backend API.

## Files Overview

### Load Testing Scripts
- **`load-test.js`** - Custom Node.js load testing script with detailed metrics
- **`load-test-config.yml`** - Artillery configuration for advanced load testing

### Bandwidth Testing Scripts
- **`bandwidth-test.js`** - Custom Node.js bandwidth testing script with network metrics
- **`bandwidth-test-config.yml`** - Artillery configuration for bandwidth testing

### Test Data
- **`payload.json`** - Sample payload for property creation endpoint testing

### Documentation
- **`LOAD_TESTING.md`** - Comprehensive guide for running load tests
- **`LOAD_TEST_RESULTS.md`** - Summary of load testing results and findings

### Results
- **`load-test-results-*.json`** - Detailed load test results (generated during testing)
- **`bandwidth-test-results-*.json`** - Detailed bandwidth test results (generated during testing)

## Quick Start

### Run Load Tests
```bash
# From project root
npm run load-test              # Default test (100 requests)
npm run load-test:quick        # Quick test (50 requests)
npm run load-test:heavy        # Heavy test (200 requests)
npm run load-test:artillery    # Artillery test (4 phases)
```

### Run Bandwidth Tests
```bash
# From project root
npm run bandwidth-test              # Default bandwidth test (100 requests)
npm run bandwidth-test:quick        # Quick bandwidth test (50 requests)
npm run bandwidth-test:heavy        # Heavy bandwidth test (200 requests)
npm run bandwidth-test:artillery    # Artillery bandwidth test (4 phases)
```

### Run Tests Directly
```bash
# From testing folder
# Load tests
node load-test.js
node load-test.js --quick
node load-test.js --heavy

# Bandwidth tests
node bandwidth-test.js
node bandwidth-test.js --quick
node bandwidth-test.js --heavy

# Artillery tests
npx artillery run load-test-config.yml
npx artillery run bandwidth-test-config.yml
```

## Test Configuration

### Custom Node.js Scripts
- **Default**: 100 requests, 10 concurrent, 1s delay
- **Quick**: 50 requests, 5 concurrent, 0.5s delay
- **Heavy**: 200 requests, 20 concurrent, 2s delay

### Artillery Scripts
- **Warm up**: 30-60s, 5-10 req/s
- **Sustained**: 60-120s, 10-20 req/s
- **Peak**: 30-60s, 20-50 req/s
- **Cool down**: 15-30s, 5 req/s

## Target Endpoint
- **URL**: `http://localhost:5000/api/v1/property/create-update`
- **Method**: POST
- **Content-Type**: application/json

## Expected Results

### Load Testing
- Success rate: ~97% (with rate limiting)
- Average response time: ~1.8 seconds
- Rate limiting: ~100-150 requests per minute

### Bandwidth Testing
- Data transfer metrics
- Request/response size analysis
- Network throughput measurement
- Bandwidth utilization percentage

## File Structure
```
testing/
├── README.md                    # This file
├── load-test.js                 # Custom load testing script
├── load-test-config.yml         # Artillery load test configuration
├── bandwidth-test.js            # Custom bandwidth testing script
├── bandwidth-test-config.yml    # Artillery bandwidth test configuration
├── payload.json                 # Test payload data
├── LOAD_TESTING.md             # Load testing guide
├── LOAD_TEST_RESULTS.md        # Load testing results summary
├── .gitignore                  # Git ignore for generated files
├── load-test-results-*.json    # Load test results (generated)
└── bandwidth-test-results-*.json # Bandwidth test results (generated)
```

## Bandwidth Testing Features

### Metrics Measured
- **Total Data Sent/Received**: Complete data transfer volume
- **Average Request/Response Size**: Per-request data analysis
- **Network Throughput**: Data transfer rate (bytes/second)
- **Bandwidth Utilization**: Percentage of available bandwidth used
- **Request/Response Size Distribution**: Detailed size analysis

### Network Analysis
- **Payload Size**: Size of the JSON payload being sent
- **Response Size**: Size of server responses
- **Network Efficiency**: How efficiently data is transferred
- **Bandwidth Bottlenecks**: Identify network limitations

## Notes
- All tests use the same payload from `payload.json`
- Results are automatically saved to JSON files
- Rate limiting is active on the endpoint
- Tests can be run from project root using npm scripts
- Bandwidth tests provide detailed network performance metrics 