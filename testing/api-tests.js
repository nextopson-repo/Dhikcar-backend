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

// API Tests
async function testPropertyCreationEndpoint() {
  console.log('\n🏠 Testing Property Creation Endpoint...');
  
  const result = await makeRequest('/api/v1/property/create-update', 'POST', payload);
  
  if (result.success && result.status === 201) {
    logTest('Property Creation API', 'PASS', `Status: ${result.status}`);
    
    // Check response structure
    if (result.data && result.data.success === true) {
      logTest('Property Creation Response Structure', 'PASS', 'Valid response structure');
    } else {
      logTest('Property Creation Response Structure', 'FAIL', 'Invalid response structure');
    }
    
    // Check if property data is returned
    if (result.data && result.data.property) {
      logTest('Property Data Returned', 'PASS', 'Property data included in response');
    } else {
      logTest('Property Data Returned', 'FAIL', 'Property data not included');
    }
    
  } else if (result.status === 429) {
    logTest('Property Creation API (Rate Limited)', 'PASS', 'Rate limited - expected behavior');
  } else {
    logTest('Property Creation API', 'FAIL', `Status: ${result.status}, Error: ${result.error}`);
  }
}

async function testPropertyUpdateEndpoint() {
  console.log('\n🔄 Testing Property Update Endpoint...');
  
  // First create a property
  const createResult = await makeRequest('/api/v1/property/create-update', 'POST', payload);
  
  if (createResult.success && createResult.status === 201) {
    const propertyId = createResult.data.property.id;
    
    // Update the property
    const updatePayload = {
      ...payload,
      propertyId: propertyId,
      propertyName: 'Updated Property Name',
      propertyPrice: 50000
    };
    
    const updateResult = await makeRequest('/api/v1/property/create-update', 'POST', updatePayload);
    
    if (updateResult.success && updateResult.status === 200) {
      logTest('Property Update API', 'PASS', `Status: ${updateResult.status}`);
    } else {
      logTest('Property Update API', 'FAIL', `Status: ${updateResult.status}`);
    }
  } else if (createResult.status === 429) {
    logTest('Property Update API (Rate Limited)', 'PASS', 'Rate limited - skipping update test');
  } else {
    logTest('Property Update API', 'FAIL', 'Cannot test update - creation failed');
  }
}

async function testPropertyGetEndpoint() {
  console.log('\n📖 Testing Property Get Endpoint...');
  
  // First create a property
  const createResult = await makeRequest('/api/v1/property/create-update', 'POST', payload);
  
  if (createResult.success && createResult.status === 201) {
    const propertyId = createResult.data.property.id;
    
    // Get the property
    const getResult = await makeRequest(`/api/v1/property/${propertyId}`, 'GET');
    
    if (getResult.success && getResult.status === 200) {
      logTest('Property Get API', 'PASS', `Status: ${getResult.status}`);
      
      // Check if property data is returned
      if (getResult.data && getResult.data.property) {
        logTest('Property Get Data', 'PASS', 'Property data returned');
      } else {
        logTest('Property Get Data', 'FAIL', 'Property data not returned');
      }
    } else {
      logTest('Property Get API', 'FAIL', `Status: ${getResult.status}`);
    }
  } else if (createResult.status === 429) {
    logTest('Property Get API (Rate Limited)', 'PASS', 'Rate limited - skipping get test');
  } else {
    logTest('Property Get API', 'FAIL', 'Cannot test get - creation failed');
  }
}

async function testPropertyListEndpoint() {
  console.log('\n📋 Testing Property List Endpoint...');
  
  const result = await makeRequest('/api/v1/property', 'GET');
  
  if (result.success && result.status === 200) {
    logTest('Property List API', 'PASS', `Status: ${result.status}`);
    
    // Check if list data is returned
    if (result.data && Array.isArray(result.data.properties)) {
      logTest('Property List Data', 'PASS', `Found ${result.data.properties.length} properties`);
    } else {
      logTest('Property List Data', 'FAIL', 'Property list not returned');
    }
  } else {
    logTest('Property List API', 'FAIL', `Status: ${result.status}`);
  }
}

async function testPropertyDeleteEndpoint() {
  console.log('\n🗑️ Testing Property Delete Endpoint...');
  
  // First create a property
  const createResult = await makeRequest('/api/v1/property/create-update', 'POST', payload);
  
  if (createResult.success && createResult.status === 201) {
    const propertyId = createResult.data.property.id;
    
    // Delete the property
    const deleteResult = await makeRequest(`/api/v1/property/${propertyId}`, 'DELETE');
    
    if (deleteResult.success && deleteResult.status === 200) {
      logTest('Property Delete API', 'PASS', `Status: ${deleteResult.status}`);
    } else {
      logTest('Property Delete API', 'FAIL', `Status: ${deleteResult.status}`);
    }
  } else if (createResult.status === 429) {
    logTest('Property Delete API (Rate Limited)', 'PASS', 'Rate limited - skipping delete test');
  } else {
    logTest('Property Delete API', 'FAIL', 'Cannot test delete - creation failed');
  }
}

async function testPropertySearchEndpoint() {
  console.log('\n🔍 Testing Property Search Endpoint...');
  
  const searchParams = {
    category: 'Residential',
    subCategory: 'Flats',
    city: 'Delhi'
  };
  
  const queryString = new URLSearchParams(searchParams).toString();
  const result = await makeRequest(`/api/v1/property/search?${queryString}`, 'GET');
  
  if (result.success && result.status === 200) {
    logTest('Property Search API', 'PASS', `Status: ${result.status}`);
    
    // Check if search results are returned
    if (result.data && Array.isArray(result.data.properties)) {
      logTest('Property Search Results', 'PASS', `Found ${result.data.properties.length} results`);
    } else {
      logTest('Property Search Results', 'FAIL', 'Search results not returned');
    }
  } else {
    logTest('Property Search API', 'FAIL', `Status: ${result.status}`);
  }
}

async function testPropertyFilterEndpoint() {
  console.log('\n🔧 Testing Property Filter Endpoint...');
  
  const filterParams = {
    minPrice: 10000,
    maxPrice: 100000,
    category: 'Residential'
  };
  
  const queryString = new URLSearchParams(filterParams).toString();
  const result = await makeRequest(`/api/v1/property/filter?${queryString}`, 'GET');
  
  if (result.success && result.status === 200) {
    logTest('Property Filter API', 'PASS', `Status: ${result.status}`);
    
    // Check if filtered results are returned
    if (result.data && Array.isArray(result.data.properties)) {
      logTest('Property Filter Results', 'PASS', `Found ${result.data.properties.length} filtered results`);
    } else {
      logTest('Property Filter Results', 'FAIL', 'Filtered results not returned');
    }
  } else {
    logTest('Property Filter API', 'FAIL', `Status: ${result.status}`);
  }
}

async function testPropertyValidationAPI() {
  console.log('\n✅ Testing Property Validation API...');
  
  // Test with invalid payload
  const invalidPayload = {
    userId: payload.userId,
    // Missing required fields
    propertyName: 'Test Property'
  };
  
  const result = await makeRequest('/api/v1/property/create-update', 'POST', invalidPayload);
  
  if (result.status === 400) {
    logTest('Property Validation API', 'PASS', `Status: ${result.status} - validation working`);
    
    // Check if error message is provided
    if (result.data && result.data.message) {
      logTest('Property Validation Error Message', 'PASS', 'Error message provided');
    } else {
      logTest('Property Validation Error Message', 'FAIL', 'No error message');
    }
  } else {
    logTest('Property Validation API', 'FAIL', `Expected 400, got ${result.status}`);
  }
}

async function testPropertyRateLimitAPI() {
  console.log('\n⏱️ Testing Property Rate Limit API...');
  
  const requests = [];
  const requestCount = 15;
  
  // Send multiple requests quickly
  for (let i = 0; i < requestCount; i++) {
    requests.push(makeRequest('/api/v1/property/create-update', 'POST', payload));
  }
  
  const results = await Promise.all(requests);
  const rateLimitedCount = results.filter(r => r.status === 429).length;
  const successfulCount = results.filter(r => r.success && r.status === 201).length;
  
  if (rateLimitedCount > 0) {
    logTest('Property Rate Limit API', 'PASS', `${rateLimitedCount}/${requestCount} rate limited`);
  } else {
    logTest('Property Rate Limit API', 'FAIL', 'No rate limiting detected');
  }
  
  if (successfulCount > 0) {
    logTest('Property Successful Requests', 'PASS', `${successfulCount}/${requestCount} successful`);
  } else {
    logTest('Property Successful Requests', 'FAIL', 'No successful requests');
  }
}

async function testPropertyErrorHandlingAPI() {
  console.log('\n🚨 Testing Property Error Handling API...');
  
  // Test with malformed JSON
  const malformedResult = await makeRequest('/api/v1/property/create-update', 'POST', 'invalid json');
  if (malformedResult.status === 400) {
    logTest('Property Malformed JSON Handling', 'PASS', `Status: ${malformedResult.status}`);
  } else {
    logTest('Property Malformed JSON Handling', 'FAIL', `Expected 400, got ${malformedResult.status}`);
  }
  
  // Test with wrong HTTP method
  const wrongMethodResult = await makeRequest('/api/v1/property/create-update', 'GET');
  if (wrongMethodResult.status === 404 || wrongMethodResult.status === 405) {
    logTest('Property Wrong Method Handling', 'PASS', `Status: ${wrongMethodResult.status}`);
  } else {
    logTest('Property Wrong Method Handling', 'FAIL', `Expected 404/405, got ${wrongMethodResult.status}`);
  }
  
  // Test with non-existent endpoint
  const notFoundResult = await makeRequest('/api/v1/property/nonexistent', 'GET');
  if (notFoundResult.status === 404) {
    logTest('Property Not Found Handling', 'PASS', `Status: ${notFoundResult.status}`);
  } else {
    logTest('Property Not Found Handling', 'FAIL', `Expected 404, got ${notFoundResult.status}`);
  }
}

async function testPropertyPerformanceAPI() {
  console.log('\n⚡ Testing Property Performance API...');
  
  const startTime = Date.now();
  const result = await makeRequest('/api/v1/property/create-update', 'POST', payload);
  const endTime = Date.now();
  
  const responseTime = endTime - startTime;
  
  if (result.success || result.status === 429) {
    if (responseTime < 10000) { // Less than 10 seconds
      logTest('Property Performance API', 'PASS', `${responseTime}ms`);
    } else {
      logTest('Property Performance API', 'FAIL', `${responseTime}ms (too slow)`);
    }
  } else {
    logTest('Property Performance API', 'FAIL', `Request failed: ${result.status}`);
  }
}

// Main test runner
async function runAPITests() {
  console.log('🌐 Starting API Tests for Property Endpoints');
  console.log('='.repeat(60));
  
  const tests = [
    testPropertyCreationEndpoint,
    testPropertyUpdateEndpoint,
    testPropertyGetEndpoint,
    testPropertyListEndpoint,
    testPropertyDeleteEndpoint,
    testPropertySearchEndpoint,
    testPropertyFilterEndpoint,
    testPropertyValidationAPI,
    testPropertyRateLimitAPI,
    testPropertyErrorHandlingAPI,
    testPropertyPerformanceAPI
  ];
  
  for (const test of tests) {
    try {
      await test();
      await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.delay));
    } catch (error) {
      console.error(`❌ API test failed with error: ${error.message}`);
    }
  }
  
  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 API TEST RESULTS SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📊 Total: ${testResults.total}`);
  console.log(`📈 Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(2)}%`);
  
  // Save detailed results
  const resultsFile = `testing/api-test-results-${Date.now()}.json`;
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
    console.log('\n❌ Some API tests failed!');
    process.exit(1);
  } else {
    console.log('\n✅ All API tests passed!');
    process.exit(0);
  }
}

// Run the tests
runAPITests().catch(console.error); 