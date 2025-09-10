import axios from 'axios';
import fs from 'fs';

// Load test payload
const payload = JSON.parse(fs.readFileSync('./testing/payload.json', 'utf8'));

const BASE_URL = 'http://localhost:5000';

async function makeRequest(endpoint, method = 'POST', data = null) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    return { success: true, status: response.status, data: response.data };
  } catch (error) {
    return { 
      success: false, 
      status: error.response?.status,
      data: error.response?.data 
    };
  }
}

async function testRateLimitTier(endpoint, tierName, expectedLimit, delay = 1000) {
  console.log(`\n🧪 Testing ${tierName} Rate Limiter`);
  console.log(`📊 Endpoint: ${endpoint}`);
  console.log(`📈 Expected Limit: ${expectedLimit} requests`);
  console.log('='.repeat(50));
  
  const results = [];
  
  // Send requests up to the limit + 2 extra
  for (let i = 1; i <= expectedLimit + 2; i++) {
    const result = await makeRequest(endpoint, 'POST', payload);
    results.push(result);
    
    console.log(`Request ${i}: ${result.success ? '✅ SUCCESS' : '❌ RATE LIMITED'} (${result.status})`);
    
    if (result.status === 429) {
      console.log(`   Message: ${result.data?.message || 'Rate limited'}`);
      console.log(`   Retry After: ${result.data?.retryAfter || 'N/A'} seconds`);
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  const successfulRequests = results.filter(r => r.success && r.status !== 429).length;
  const rateLimitedRequests = results.filter(r => r.status === 429).length;
  
  console.log('\n📊 Results Summary:');
  console.log(`✅ Successful: ${successfulRequests}`);
  console.log(`⏱️  Rate Limited: ${rateLimitedRequests}`);
  console.log(`📈 Total: ${results.length}`);
  
  if (successfulRequests <= expectedLimit && rateLimitedRequests > 0) {
    console.log('✅ Rate limiting working correctly!');
  } else {
    console.log('❌ Rate limiting not working as expected');
  }
  
  return { successfulRequests, rateLimitedRequests, total: results.length };
}

async function runRateLimitTests() {
  console.log('🚀 Testing Production-Ready Rate Limiting System');
  console.log('='.repeat(60));
  
  const tests = [
    {
      endpoint: '/api/v1/property/create-update',
      tierName: 'Property Creation',
      expectedLimit: 5
    },
    {
      endpoint: '/api/v1/property/search-property',
      tierName: 'Search',
      expectedLimit: 50
    },
    {
      endpoint: '/api/v1/property/getAll',
      tierName: 'Standard',
      expectedLimit: 30
    },
    {
      endpoint: '/api/v1/property/delete-property',
      tierName: 'Strict',
      expectedLimit: 10
    }
  ];
  
  const results = {};
  
  for (const test of tests) {
    results[test.tierName] = await testRateLimitTier(
      test.endpoint, 
      test.tierName, 
      test.expectedLimit
    );
    
    // Wait between tests to avoid interference
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 RATE LIMITING TEST SUMMARY');
  console.log('='.repeat(60));
  
  Object.entries(results).forEach(([tier, result]) => {
    console.log(`${tier}:`);
    console.log(`  ✅ Successful: ${result.successfulRequests}`);
    console.log(`  ⏱️  Rate Limited: ${result.rateLimitedRequests}`);
    console.log(`  📈 Total: ${result.total}`);
  });
  
  // Save results
  const resultsFile = `testing/rate-limit-test-results-${Date.now()}.json`;
  fs.writeFileSync(resultsFile, JSON.stringify({
    summary: results,
    timestamp: new Date().toISOString(),
    tests: tests
  }, null, 2));
  
  console.log(`\n💾 Detailed results saved to: ${resultsFile}`);
}

// Run the tests
runRateLimitTests().catch(console.error); 