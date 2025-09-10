import axios from 'axios';
import fs from 'fs';

// Load test payload
const payload = JSON.parse(fs.readFileSync('./testing/payload.json', 'utf8'));

const BASE_URL = 'http://localhost:5000';

// Test configuration
const TEST_CONFIG = {
  timeout: 10000,
  retries: 3,
  delay: 1000
};

// Test results tracking
const testResults = {
  passed: 0,
  failed: 0,
  total: 0,
  details: []
};

// Utility functions
function logTest(testName, status, details = '') {
  const emoji = status === 'PASS' ? '✅' : '❌';
  console.log(`${emoji} ${testName}: ${status}${details ? ` - ${details}` : ''}`);
  
  testResults.total++;
  if (status === 'PASS') {
    testResults.passed++;
  } else {
    testResults.failed++;
  }
  
  testResults.details.push({
    name: testName,
    status,
    details,
    timestamp: new Date().toISOString()
  });
}

async function makeRequest(endpoint, method = 'GET', data = null, headers = {}) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      timeout: TEST_CONFIG.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...headers
      }
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    return { 
      success: false, 
      error: error.message, 
      status: error.response?.status,
      data: error.response?.data 
    };
  }
}

// Unit Tests
async function testServerHealth() {
  console.log('\n🏥 Testing Server Health...');
  
  const result = await makeRequest('/');
  if (result.success && result.status === 200) {
    logTest('Server Health Check', 'PASS', `Status: ${result.status}`);
  } else {
    logTest('Server Health Check', 'FAIL', `Status: ${result.status}, Error: ${result.error}`);
  }
}

async function testEndpointAvailability() {
  console.log('\n🔍 Testing Endpoint Availability...');
  
  const result = await makeRequest('/api/v1/property/create-update', 'POST', payload);
  if (result.success || result.status === 429) {
    logTest('Endpoint Availability', 'PASS', `Status: ${result.status}`);
  } else {
    logTest('Endpoint Availability', 'FAIL', `Status: ${result.status}, Error: ${result.error}`);
  }
}

async function testPayloadValidation() {
  console.log('\n📋 Testing Payload Validation...');
  
  // Test with valid payload
  const validResult = await makeRequest('/api/v1/property/create-update', 'POST', payload);
  if (validResult.success || validResult.status === 429) {
    logTest('Valid Payload', 'PASS', `Status: ${validResult.status}`);
  } else {
    logTest('Valid Payload', 'FAIL', `Status: ${validResult.status}`);
  }
  
  // Test with invalid payload (missing required fields)
  const invalidPayload = { userId: 'test' };
  const invalidResult = await makeRequest('/api/v1/property/create-update', 'POST', invalidPayload);
  if (invalidResult.status === 400) {
    logTest('Invalid Payload Validation', 'PASS', `Status: ${invalidResult.status}`);
  } else {
    logTest('Invalid Payload Validation', 'FAIL', `Expected 400, got ${invalidResult.status}`);
  }
}

async function testRateLimiting() {
  console.log('\n⏱️ Testing Rate Limiting...');
  
  const requests = [];
  for (let i = 0; i < 5; i++) {
    requests.push(makeRequest('/api/v1/property/create-update', 'POST', payload));
  }
  
  const results = await Promise.all(requests);
  const rateLimitedCount = results.filter(r => r.status === 429).length;
  
  if (rateLimitedCount > 0) {
    logTest('Rate Limiting', 'PASS', `${rateLimitedCount}/5 requests rate limited`);
  } else {
    logTest('Rate Limiting', 'FAIL', 'No rate limiting detected');
  }
}

async function testResponseFormat() {
  console.log('\n📄 Testing Response Format...');
  
  const result = await makeRequest('/api/v1/property/create-update', 'POST', payload);
  
  if (result.success) {
    // Check if response has expected structure
    const hasSuccess = 'success' in result.data;
    const hasMessage = 'message' in result.data;
    
    if (hasSuccess && hasMessage) {
      logTest('Response Format', 'PASS', 'Valid response structure');
    } else {
      logTest('Response Format', 'FAIL', 'Invalid response structure');
    }
  } else if (result.status === 429) {
    // Rate limited response should also have proper format
    const hasSuccess = 'success' in result.data;
    const hasMessage = 'message' in result.data;
    
    if (hasSuccess && hasMessage) {
      logTest('Rate Limited Response Format', 'PASS', 'Valid rate limited response structure');
    } else {
      logTest('Rate Limited Response Format', 'FAIL', 'Invalid rate limited response structure');
    }
  } else {
    logTest('Response Format', 'FAIL', `Unexpected status: ${result.status}`);
  }
}

async function testErrorHandling() {
  console.log('\n🚨 Testing Error Handling...');
  
  // Test with malformed JSON
  const malformedResult = await makeRequest('/api/v1/property/create-update', 'POST', 'invalid json');
  if (malformedResult.status === 400) {
    logTest('Malformed JSON Handling', 'PASS', `Status: ${malformedResult.status}`);
  } else {
    logTest('Malformed JSON Handling', 'FAIL', `Expected 400, got ${malformedResult.status}`);
  }
  
  // Test with wrong method
  const wrongMethodResult = await makeRequest('/api/v1/property/create-update', 'GET');
  if (wrongMethodResult.status === 404 || wrongMethodResult.status === 405) {
    logTest('Wrong Method Handling', 'PASS', `Status: ${wrongMethodResult.status}`);
  } else {
    logTest('Wrong Method Handling', 'FAIL', `Expected 404/405, got ${wrongMethodResult.status}`);
  }
}

async function testConcurrentRequests() {
  console.log('\n⚡ Testing Concurrent Requests...');
  
  const concurrentRequests = 10;
  const requests = [];
  
  for (let i = 0; i < concurrentRequests; i++) {
    requests.push(makeRequest('/api/v1/property/create-update', 'POST', payload));
  }
  
  const startTime = Date.now();
  const results = await Promise.all(requests);
  const endTime = Date.now();
  
  const successfulRequests = results.filter(r => r.success || r.status === 429).length;
  const averageResponseTime = (endTime - startTime) / concurrentRequests;
  
  if (successfulRequests === concurrentRequests) {
    logTest('Concurrent Requests', 'PASS', `${successfulRequests}/${concurrentRequests} successful, avg time: ${averageResponseTime.toFixed(2)}ms`);
  } else {
    logTest('Concurrent Requests', 'FAIL', `${successfulRequests}/${concurrentRequests} successful`);
  }
}

async function testPayloadSize() {
  console.log('\n📏 Testing Payload Size...');
  
  const payloadSize = JSON.stringify(payload).length;
  const payloadSizeKB = (payloadSize / 1024).toFixed(2);
  
  if (payloadSize < 5000) { // Less than 5KB
    logTest('Payload Size', 'PASS', `${payloadSizeKB} KB`);
  } else {
    logTest('Payload Size', 'FAIL', `${payloadSizeKB} KB (too large)`);
  }
}

async function testResponseTime() {
  console.log('\n⏱️ Testing Response Time...');
  
  const startTime = Date.now();
  const result = await makeRequest('/api/v1/property/create-update', 'POST', payload);
  const endTime = Date.now();
  
  const responseTime = endTime - startTime;
  
  if (responseTime < 5000) { // Less than 5 seconds
    logTest('Response Time', 'PASS', `${responseTime}ms`);
  } else {
    logTest('Response Time', 'FAIL', `${responseTime}ms (too slow)`);
  }
}

async function testDataIntegrity() {
  console.log('\n🔒 Testing Data Integrity...');
  
  const result = await makeRequest('/api/v1/property/create-update', 'POST', payload);
  
  if (result.success) {
    // Check if response contains expected data structure
    const hasProperty = 'property' in result.data;
    const hasSuccess = result.data.success === true;
    
    if (hasProperty && hasSuccess) {
      logTest('Data Integrity', 'PASS', 'Valid data structure returned');
    } else {
      logTest('Data Integrity', 'FAIL', 'Invalid data structure');
    }
  } else if (result.status === 429) {
    logTest('Data Integrity (Rate Limited)', 'PASS', 'Rate limited response handled correctly');
  } else {
    logTest('Data Integrity', 'FAIL', `Unexpected status: ${result.status}`);
  }
}

// Main test runner
async function runUnitTests() {
  console.log('🧪 Starting Unit Tests for Property API');
  console.log('='.repeat(60));
  
  const tests = [
    testServerHealth,
    testEndpointAvailability,
    testPayloadValidation,
    testRateLimiting,
    testResponseFormat,
    testErrorHandling,
    testConcurrentRequests,
    testPayloadSize,
    testResponseTime,
    testDataIntegrity
  ];
  
  for (const test of tests) {
    try {
      await test();
      await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.delay));
    } catch (error) {
      console.error(`❌ Test failed with error: ${error.message}`);
    }
  }
  
  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 UNIT TEST RESULTS SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📊 Total: ${testResults.total}`);
  console.log(`📈 Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(2)}%`);
  
  // Save detailed results
  const resultsFile = `testing/unit-test-results-${Date.now()}.json`;
  fs.writeFileSync(resultsFile, JSON.stringify({
    summary: {
      passed: testResults.passed,
      failed: testResults.failed,
      total: testResults.total,
      successRate: (testResults.passed / testResults.total) * 100
    },
    details: testResults.details,
    timestamp: new Date().toISOString()
  }, null, 2));
  
  console.log(`\n💾 Detailed results saved to: ${resultsFile}`);
  
  // Exit with appropriate code
  if (testResults.failed > 0) {
    console.log('\n❌ Some tests failed!');
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed!');
    process.exit(0);
  }
}

// Run the tests
runUnitTests().catch(console.error); 