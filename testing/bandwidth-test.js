import axios from 'axios';
import fs from 'fs';
import { performance } from 'perf_hooks';

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
  statusCodes: {},
  bandwidthData: {
    totalBytesSent: 0,
    totalBytesReceived: 0,
    averageRequestSize: 0,
    averageResponseSize: 0,
    throughput: 0,
    bandwidthUtilization: 0
  }
};

// Calculate payload size
const payloadSize = JSON.stringify(payload).length;

async function makeRequest(requestId) {
  const startTime = performance.now();
  const requestStartTime = Date.now();
  
  try {
    const response = await axios.post(`${BASE_URL}${ENDPOINT}`, payload, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 30000, // 30 second timeout
      maxRedirects: 0,
      validateStatus: () => true // Accept all status codes
    });
    
    const responseTime = Date.now() - requestStartTime;
    const performanceTime = performance.now() - startTime;
    
    results.responseTimes.push(responseTime);
    results.successful++;
    
    const statusCode = response.status;
    results.statusCodes[statusCode] = (results.statusCodes[statusCode] || 0) + 1;
    
    // Calculate bandwidth metrics
    const requestSize = payloadSize;
    const responseSize = JSON.stringify(response.data).length;
    
    results.bandwidthData.totalBytesSent += requestSize;
    results.bandwidthData.totalBytesReceived += responseSize;
    
    console.log(`Request ${requestId}: SUCCESS - Status: ${statusCode}, Time: ${responseTime}ms, Size: ${requestSize}B → ${responseSize}B`);
    
  } catch (error) {
    const responseTime = Date.now() - requestStartTime;
    const performanceTime = performance.now() - startTime;
    
    results.responseTimes.push(responseTime);
    results.failed++;
    
    const statusCode = error.response?.status || 'NETWORK_ERROR';
    results.statusCodes[statusCode] = (results.statusCodes[statusCode] || 0) + 1;
    
    // Calculate bandwidth for failed requests
    const requestSize = payloadSize;
    const responseSize = error.response?.data ? JSON.stringify(error.response.data).length : 0;
    
    results.bandwidthData.totalBytesSent += requestSize;
    results.bandwidthData.totalBytesReceived += responseSize;
    
    results.errors.push({
      requestId,
      error: error.message,
      statusCode: error.response?.status,
      responseTime
    });
    
    console.log(`Request ${requestId}: FAILED - Status: ${statusCode}, Time: ${responseTime}ms, Size: ${requestSize}B → ${responseSize}B, Error: ${error.message}`);
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function calculateBandwidthMetrics() {
  const totalRequests = results.successful + results.failed;
  
  if (totalRequests > 0) {
    results.bandwidthData.averageRequestSize = results.bandwidthData.totalBytesSent / totalRequests;
    results.bandwidthData.averageResponseSize = results.bandwidthData.totalBytesReceived / totalRequests;
  }
  
  // Calculate throughput (bytes per second)
  const totalTimeSeconds = (Date.now() - global.testStartTime) / 1000;
  if (totalTimeSeconds > 0) {
    results.bandwidthData.throughput = (results.bandwidthData.totalBytesSent + results.bandwidthData.totalBytesReceived) / totalTimeSeconds;
  }
  
  // Estimate bandwidth utilization (assuming typical network speeds)
  const totalDataTransferred = results.bandwidthData.totalBytesSent + results.bandwidthData.totalBytesReceived;
  const totalTimeSeconds2 = (Date.now() - global.testStartTime) / 1000;
  if (totalTimeSeconds2 > 0) {
    results.bandwidthData.bandwidthUtilization = (totalDataTransferred * 8) / (1000000000 * totalTimeSeconds2); // Assuming 1Gbps connection
  }
}

async function runBandwidthTest() {
  console.log('🌐 Starting Bandwidth Test for Property Creation Endpoint');
  console.log(`📊 Target: ${BASE_URL}${ENDPOINT}`);
  console.log(`📈 Test Type: ${testType === 'default' ? 'Default' : testType.replace('--', '')}`);
  console.log(`📈 Total Requests: ${TOTAL_REQUESTS}`);
  console.log(`⚡ Concurrent Requests: ${CONCURRENT_REQUESTS}`);
  console.log(`⏱️  Delay Between Batches: ${DELAY_BETWEEN_BATCHES}ms`);
  console.log(`📦 Payload Size: ${formatBytes(payloadSize)}`);
  console.log('='.repeat(60));
  
  global.testStartTime = Date.now();
  
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
  
  const totalTime = Date.now() - global.testStartTime;
  
  // Calculate bandwidth metrics
  calculateBandwidthMetrics();
  
  // Calculate statistics
  const avgResponseTime = results.responseTimes.reduce((a, b) => a + b, 0) / results.responseTimes.length;
  const minResponseTime = Math.min(...results.responseTimes);
  const maxResponseTime = Math.max(...results.responseTimes);
  const successRate = (results.successful / TOTAL_REQUESTS) * 100;
  
  console.log('\n' + '='.repeat(60));
  console.log('🌐 BANDWIDTH TEST RESULTS');
  console.log('='.repeat(60));
  console.log(`✅ Successful Requests: ${results.successful}`);
  console.log(`❌ Failed Requests: ${results.failed}`);
  console.log(`📈 Success Rate: ${successRate.toFixed(2)}%`);
  console.log(`⏱️  Total Time: ${totalTime}ms`);
  console.log(`📊 Average Response Time: ${avgResponseTime.toFixed(2)}ms`);
  console.log(`⚡ Min Response Time: ${minResponseTime}ms`);
  console.log(`🐌 Max Response Time: ${maxResponseTime}ms`);
  console.log(`📈 Requests per Second: ${(TOTAL_REQUESTS / (totalTime / 1000)).toFixed(2)}`);
  
  console.log('\n📊 BANDWIDTH METRICS');
  console.log('='.repeat(30));
  console.log(`📤 Total Data Sent: ${formatBytes(results.bandwidthData.totalBytesSent)}`);
  console.log(`📥 Total Data Received: ${formatBytes(results.bandwidthData.totalBytesReceived)}`);
  console.log(`📦 Total Data Transferred: ${formatBytes(results.bandwidthData.totalBytesSent + results.bandwidthData.totalBytesReceived)}`);
  console.log(`📏 Average Request Size: ${formatBytes(results.bandwidthData.averageRequestSize)}`);
  console.log(`📏 Average Response Size: ${formatBytes(results.bandwidthData.averageResponseSize)}`);
  console.log(`🚀 Throughput: ${formatBytes(results.bandwidthData.throughput)}/s`);
  console.log(`📊 Bandwidth Utilization: ${(results.bandwidthData.bandwidthUtilization * 100).toFixed(2)}%`);
  
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
  const resultsFile = `testing/bandwidth-test-results-${Date.now()}.json`;
  fs.writeFileSync(resultsFile, JSON.stringify({
    testType: testType === 'default' ? 'default' : testType.replace('--', ''),
    configuration: {
      totalRequests: TOTAL_REQUESTS,
      concurrentRequests: CONCURRENT_REQUESTS,
      delayBetweenBatches: DELAY_BETWEEN_BATCHES,
      payloadSize: payloadSize
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
    bandwidth: {
      totalBytesSent: results.bandwidthData.totalBytesSent,
      totalBytesReceived: results.bandwidthData.totalBytesReceived,
      totalBytesTransferred: results.bandwidthData.totalBytesSent + results.bandwidthData.totalBytesReceived,
      averageRequestSize: results.bandwidthData.averageRequestSize,
      averageResponseSize: results.bandwidthData.averageResponseSize,
      throughput: results.bandwidthData.throughput,
      bandwidthUtilization: results.bandwidthData.bandwidthUtilization
    },
    statusCodes: results.statusCodes,
    errors: results.errors,
    responseTimes: results.responseTimes
  }, null, 2));
  
  console.log(`\n💾 Detailed results saved to: ${resultsFile}`);
}

// Run the bandwidth test
runBandwidthTest().catch(console.error); 