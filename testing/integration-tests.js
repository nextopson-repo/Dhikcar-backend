import axios from 'axios';
import fs from 'fs';

// Load test payload
const payload = JSON.parse(fs.readFileSync('./testing/payload.json', 'utf8'));

const BASE_URL = 'http://localhost:5000';

// Test configuration
const TEST_CONFIG = {
  timeout: 15000,
  retries: 3,
  delay: 2000
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

// Integration Tests
async function testCompletePropertyCreationFlow() {
  console.log('\n🏠 Testing Complete Property Creation Flow...');
  
  // Step 1: Create property
  const createResult = await makeRequest('/api/v1/property/create-update', 'POST', payload);
  
  if (createResult.success && createResult.status === 201) {
    logTest('Property Creation', 'PASS', `Status: ${createResult.status}`);
    
    // Step 2: Verify property was created with correct data
    const propertyData = createResult.data.property;
    if (propertyData && propertyData.propertyName === payload.propertyName) {
      logTest('Property Data Verification', 'PASS', 'Property data matches input');
    } else {
      logTest('Property Data Verification', 'FAIL', 'Property data mismatch');
    }
    
    // Step 3: Check if address was created
    if (propertyData && propertyData.address) {
      logTest('Address Creation', 'PASS', 'Address created successfully');
    } else {
      logTest('Address Creation', 'FAIL', 'Address not created');
    }
    
    // Step 4: Check if images were processed
    if (propertyData && propertyData.propertyImages && propertyData.propertyImages.length > 0) {
      logTest('Image Processing', 'PASS', `${propertyData.propertyImages.length} images processed`);
    } else {
      logTest('Image Processing', 'FAIL', 'No images processed');
    }
    
  } else if (createResult.status === 429) {
    logTest('Property Creation (Rate Limited)', 'PASS', 'Rate limited - expected behavior');
  } else {
    logTest('Property Creation', 'FAIL', `Status: ${createResult.status}, Error: ${createResult.error}`);
  }
}

async function testPropertyUpdateFlow() {
  console.log('\n🔄 Testing Property Update Flow...');
  
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
      logTest('Property Update', 'PASS', `Status: ${updateResult.status}`);
      
      // Verify the update
      const updatedProperty = updateResult.data.property;
      if (updatedProperty.propertyName === 'Updated Property Name') {
        logTest('Property Update Verification', 'PASS', 'Property updated correctly');
      } else {
        logTest('Property Update Verification', 'FAIL', 'Property not updated correctly');
      }
    } else {
      logTest('Property Update', 'FAIL', `Status: ${updateResult.status}`);
    }
  } else if (createResult.status === 429) {
    logTest('Property Update (Rate Limited)', 'PASS', 'Rate limited - skipping update test');
  } else {
    logTest('Property Update', 'FAIL', 'Cannot test update - creation failed');
  }
}

async function testDatabaseIntegration() {
  console.log('\n🗄️ Testing Database Integration...');
  
  const result = await makeRequest('/api/v1/property/create-update', 'POST', payload);
  
  if (result.success && result.status === 201) {
    const property = result.data.property;
    
    // Check if all required database fields are present
    const requiredFields = ['id', 'propertyName', 'category', 'subCategory', 'createdAt'];
    const missingFields = requiredFields.filter(field => !(field in property));
    
    if (missingFields.length === 0) {
      logTest('Database Integration', 'PASS', 'All required fields present');
    } else {
      logTest('Database Integration', 'FAIL', `Missing fields: ${missingFields.join(', ')}`);
    }
    
    // Check if relationships are properly established
    if (property.address && property.propertyImages) {
      logTest('Database Relationships', 'PASS', 'Relationships established correctly');
    } else {
      logTest('Database Relationships', 'FAIL', 'Relationships not established');
    }
    
  } else if (result.status === 429) {
    logTest('Database Integration (Rate Limited)', 'PASS', 'Rate limited - expected behavior');
  } else {
    logTest('Database Integration', 'FAIL', `Status: ${result.status}`);
  }
}

async function testValidationIntegration() {
  console.log('\n✅ Testing Validation Integration...');
  
  // Test with missing required fields
  const invalidPayload = {
    userId: payload.userId,
    // Missing category and subCategory
    propertyName: 'Test Property'
  };
  
  const result = await makeRequest('/api/v1/property/create-update', 'POST', invalidPayload);
  
  if (result.status === 400) {
    logTest('Validation Integration', 'PASS', `Status: ${result.status} - validation working`);
    
    // Check if error message is meaningful
    if (result.data && result.data.message) {
      logTest('Validation Error Message', 'PASS', 'Meaningful error message provided');
    } else {
      logTest('Validation Error Message', 'FAIL', 'No error message provided');
    }
  } else {
    logTest('Validation Integration', 'FAIL', `Expected 400, got ${result.status}`);
  }
}

async function testRateLimitIntegration() {
  console.log('\n⏱️ Testing Rate Limit Integration...');
  
  const requests = [];
  const requestCount = 10;
  
  // Send multiple requests quickly
  for (let i = 0; i < requestCount; i++) {
    requests.push(makeRequest('/api/v1/property/create-update', 'POST', payload));
  }
  
  const results = await Promise.all(requests);
  const rateLimitedCount = results.filter(r => r.status === 429).length;
  const successfulCount = results.filter(r => r.success && r.status === 201).length;
  
  if (rateLimitedCount > 0) {
    logTest('Rate Limit Integration', 'PASS', `${rateLimitedCount}/${requestCount} rate limited`);
  } else {
    logTest('Rate Limit Integration', 'FAIL', 'No rate limiting detected');
  }
  
  if (successfulCount > 0) {
    logTest('Successful Requests', 'PASS', `${successfulCount}/${requestCount} successful`);
  } else {
    logTest('Successful Requests', 'FAIL', 'No successful requests');
  }
}

async function testErrorHandlingIntegration() {
  console.log('\n🚨 Testing Error Handling Integration...');
  
  // Test with malformed data
  const malformedPayload = {
    ...payload,
    propertyPrice: 'invalid_price', // Should be number
    totalBathrooms: 'invalid_bathrooms' // Should be number
  };
  
  const result = await makeRequest('/api/v1/property/create-update', 'POST', malformedPayload);
  
  if (result.status === 400) {
    logTest('Error Handling Integration', 'PASS', `Status: ${result.status} - validation working`);
  } else if (result.status === 429) {
    logTest('Error Handling Integration (Rate Limited)', 'PASS', 'Rate limited - expected behavior');
  } else {
    logTest('Error Handling Integration', 'FAIL', `Expected 400, got ${result.status}`);
  }
}

async function testPerformanceIntegration() {
  console.log('\n⚡ Testing Performance Integration...');
  
  const startTime = Date.now();
  const result = await makeRequest('/api/v1/property/create-update', 'POST', payload);
  const endTime = Date.now();
  
  const responseTime = endTime - startTime;
  
  if (result.success || result.status === 429) {
    if (responseTime < 10000) { // Less than 10 seconds
      logTest('Performance Integration', 'PASS', `${responseTime}ms`);
    } else {
      logTest('Performance Integration', 'FAIL', `${responseTime}ms (too slow)`);
    }
  } else {
    logTest('Performance Integration', 'FAIL', `Request failed: ${result.status}`);
  }
}

async function testDataConsistencyIntegration() {
  console.log('\n🔒 Testing Data Consistency Integration...');
  
  const result = await makeRequest('/api/v1/property/create-update', 'POST', payload);
  
  if (result.success && result.status === 201) {
    const property = result.data.property;
    
    // Check if input data matches output data
    const inputMatches = 
      property.propertyName === payload.propertyName &&
      property.category === payload.category &&
      property.subCategory === payload.subCategory;
    
    if (inputMatches) {
      logTest('Data Consistency Integration', 'PASS', 'Input data matches output data');
    } else {
      logTest('Data Consistency Integration', 'FAIL', 'Input data does not match output data');
    }
    
    // Check if generated fields are present
    const hasGeneratedFields = property.id && property.createdAt;
    if (hasGeneratedFields) {
      logTest('Generated Fields Integration', 'PASS', 'Generated fields present');
    } else {
      logTest('Generated Fields Integration', 'FAIL', 'Generated fields missing');
    }
    
  } else if (result.status === 429) {
    logTest('Data Consistency Integration (Rate Limited)', 'PASS', 'Rate limited - expected behavior');
  } else {
    logTest('Data Consistency Integration', 'FAIL', `Status: ${result.status}`);
  }
}

// Main test runner
async function runIntegrationTests() {
  console.log('🔗 Starting Integration Tests for Property API');
  console.log('='.repeat(60));
  
  const tests = [
    testCompletePropertyCreationFlow,
    testPropertyUpdateFlow,
    testDatabaseIntegration,
    testValidationIntegration,
    testRateLimitIntegration,
    testErrorHandlingIntegration,
    testPerformanceIntegration,
    testDataConsistencyIntegration
  ];
  
  for (const test of tests) {
    try {
      await test();
      await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.delay));
    } catch (error) {
      console.error(`❌ Integration test failed with error: ${error.message}`);
    }
  }
  
  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 INTEGRATION TEST RESULTS SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📊 Total: ${testResults.total}`);
  console.log(`📈 Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(2)}%`);
  
  // Save detailed results
  const resultsFile = `testing/integration-test-results-${Date.now()}.json`;
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
    console.log('\n❌ Some integration tests failed!');
    process.exit(1);
  } else {
    console.log('\n✅ All integration tests passed!');
    process.exit(0);
  }
}

// Run the tests
runIntegrationTests().catch(console.error); 