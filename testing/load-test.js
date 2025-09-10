import axios from 'axios';
import fs from 'fs';

// Load the payload from the JSON file
const payload = JSON.parse(fs.readFileSync('./testing/payload.json', 'utf8'));

const BASE_URL = 'http://localhost:5000';
const ENDPOINT = '/api/v1/property/create-update';

// Parse command line arguments
const args = process.argv.slice(2);
const testType = args[0] || 'default';

// Configure test parameters based on type
let TOTAL_REQUESTS, CONCURRENT_REQUESTS, DELAY_BETWEEN_BATCHES;

switch (testType) {
  case '--quick':
    TOTAL_REQUESTS = 50;
    CONCURRENT_REQUESTS = 5;
    DELAY_BETWEEN_BATCHES = 500;
    break;
  case '--heavy':
    TOTAL_REQUESTS = 200;
    CONCURRENT_REQUESTS = 20;
    DELAY_BETWEEN_BATCHES = 2000;
    break;
  default:
    TOTAL_REQUESTS = 100;
    CONCURRENT_REQUESTS = 10;
    DELAY_BETWEEN_BATCHES = 1000;
}

const results = {
  successful: 0,
  failed: 0,
  errors: [],
  responseTimes: [],
  statusCodes: {}
};

async function makeRequest(requestId) {
  const startTime = Date.now();
  
  try {
    const response = await axios.post(`${BASE_URL}${ENDPOINT}`, payload, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 30000 // 30 second timeout
    });
    
    const responseTime = Date.now() - startTime;
    results.responseTimes.push(responseTime);
    results.successful++;
    
    const statusCode = response.status;
    results.statusCodes[statusCode] = (results.statusCodes[statusCode] || 0) + 1;
    
    console.log(`Request ${requestId}: SUCCESS - Status: ${statusCode}, Time: ${responseTime}ms`);
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    results.responseTimes.push(responseTime);
    results.failed++;
    
    const statusCode = error.response?.status || 'NETWORK_ERROR';
    results.statusCodes[statusCode] = (results.statusCodes[statusCode] || 0) + 1;
    
    results.errors.push({
      requestId,
      error: error.message,
      statusCode: error.response?.status,
      responseTime
    });
    
    console.log(`Request ${requestId}: FAILED - Status: ${statusCode}, Time: ${responseTime}ms, Error: ${error.message}`);
  }
}

async function runLoadTest() {
  console.log('🚀 Starting Load Test for Property Creation Endpoint');
  console.log(`📊 Target: ${BASE_URL}${ENDPOINT}`);
  console.log(`📈 Test Type: ${testType === 'default' ? 'Default' : testType.replace('--', '')}`);
  console.log(`📈 Total Requests: ${TOTAL_REQUESTS}`);
  console.log(`⚡ Concurrent Requests: ${CONCURRENT_REQUESTS}`);
  console.log(`⏱️  Delay Between Batches: ${DELAY_BETWEEN_BATCHES}ms`);
  console.log('='.repeat(60));
  
  const startTime = Date.now();
  
  for (let i = 0; i < TOTAL_REQUESTS; i += CONCURRENT_REQUESTS) {
    const batch = [];
    const batchSize = Math.min(CONCURRENT_REQUESTS, TOTAL_REQUESTS - i);
    
    for (let j = 0; j < batchSize; j++) {
      batch.push(makeRequest(i + j + 1));
    }
    
    await Promise.all(batch);
    
    if (i + CONCURRENT_REQUESTS < TOTAL_REQUESTS) {
      console.log(`⏳ Batch completed. Waiting ${DELAY_BETWEEN_BATCHES}ms before next batch...`);
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
    }
  }
  
  const totalTime = Date.now() - startTime;
  
  // Calculate statistics
  const avgResponseTime = results.responseTimes.reduce((a, b) => a + b, 0) / results.responseTimes.length;
  const minResponseTime = Math.min(...results.responseTimes);
  const maxResponseTime = Math.max(...results.responseTimes);
  const successRate = (results.successful / TOTAL_REQUESTS) * 100;
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 LOAD TEST RESULTS');
  console.log('='.repeat(60));
  console.log(`✅ Successful Requests: ${results.successful}`);
  console.log(`❌ Failed Requests: ${results.failed}`);
  console.log(`📈 Success Rate: ${successRate.toFixed(2)}%`);
  console.log(`⏱️  Total Time: ${totalTime}ms`);
  console.log(`📊 Average Response Time: ${avgResponseTime.toFixed(2)}ms`);
  console.log(`⚡ Min Response Time: ${minResponseTime}ms`);
  console.log(`🐌 Max Response Time: ${maxResponseTime}ms`);
  console.log(`📈 Requests per Second: ${(TOTAL_REQUESTS / (totalTime / 1000)).toFixed(2)}`);
  
  console.log('\n📋 Status Code Distribution:');
  Object.entries(results.statusCodes).forEach(([code, count]) => {
    console.log(`   ${code}: ${count} requests`);
  });
  
  if (results.errors.length > 0) {
    console.log('\n❌ Error Details (first 5):');
    results.errors.slice(0, 5).forEach(error => {
      console.log(`   Request ${error.requestId}: ${error.error}`);
    });
  }
  
  // Save results to file
  const resultsFile = `testing/load-test-results-${Date.now()}.json`;
  fs.writeFileSync(resultsFile, JSON.stringify({
    testType: testType === 'default' ? 'default' : testType.replace('--', ''),
    configuration: {
      totalRequests: TOTAL_REQUESTS,
      concurrentRequests: CONCURRENT_REQUESTS,
      delayBetweenBatches: DELAY_BETWEEN_BATCHES
    },
    summary: {
      totalRequests: TOTAL_REQUESTS,
      successful: results.successful,
      failed: results.failed,
      successRate,
      totalTime,
      avgResponseTime,
      minResponseTime,
      maxResponseTime,
      requestsPerSecond: TOTAL_REQUESTS / (totalTime / 1000)
    },
    statusCodes: results.statusCodes,
    errors: results.errors,
    responseTimes: results.responseTimes
  }, null, 2));
  
  console.log(`\n💾 Detailed results saved to: ${resultsFile}`);
}

// Run the load test
runLoadTest().catch(console.error); 