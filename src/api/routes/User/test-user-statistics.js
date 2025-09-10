// Test file for User Statistics APIs
// Run this with Node.js to test the endpoints

const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api/v1/user-statistics';

// Test configuration
const testConfig = {
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
};

// Test functions
async function testGetTotalUsers() {
  try {
    console.log('🧪 Testing GET /total...');
    const response = await axios.get(`${BASE_URL}/total`, testConfig);
    console.log('✅ Total Users Response:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Error testing total users:', error.response?.data || error.message);
  }
}

async function testGetActiveUsers() {
  try {
    console.log('🧪 Testing GET /active...');
    const response = await axios.get(`${BASE_URL}/active`, testConfig);
    console.log('✅ Active Users Response:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Error testing active users:', error.response?.data || error.message);
  }
}

async function testGetInactiveUsers() {
  try {
    console.log('🧪 Testing GET /inactive...');
    const response = await axios.get(`${BASE_URL}/inactive`, testConfig);
    console.log('✅ Inactive Users Response:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Error testing inactive users:', error.response?.data || error.message);
  }
}

async function testGetOnlineUsers() {
  try {
    console.log('🧪 Testing GET /online...');
    const response = await axios.get(`${BASE_URL}/online`, testConfig);
    console.log('✅ Online Users Response:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Error testing online users:', error.response?.data || error.message);
  }
}

async function testGetUserStatistics() {
  try {
    console.log('🧪 Testing GET /statistics...');
    const response = await axios.get(`${BASE_URL}/statistics`, testConfig);
    console.log('✅ User Statistics Response:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Error testing user statistics:', error.response?.data || error.message);
  }
}

async function testGetActiveUsersList() {
  try {
    console.log('🧪 Testing GET /active/list...');
    const response = await axios.get(`${BASE_URL}/active/list?page=1&limit=5`, testConfig);
    console.log('✅ Active Users List Response:', response.data);

    // Check if user data includes enhanced fields
    if (response.data.data.users && response.data.data.users.length > 0) {
      const user = response.data.data.users[0];
      console.log('📋 Sample User Data Fields:');
      console.log('  - ID:', user.id);
      console.log('  - Full Name:', user.fullName);
      console.log('  - Email:', user.email);
      console.log('  - Mobile:', user.mobileNumber);
      console.log('  - User Type:', user.userType);
      console.log('  - Profile URL:', user.profileUrl);
      console.log('  - Is Fully Verified:', user.isFullyVerified);
      console.log('  - Days Active:', user.daysActive);
    }

    return response.data;
  } catch (error) {
    console.error('❌ Error testing active users list:', error.response?.data || error.message);
  }
}

async function testGetInactiveUsersList() {
  try {
    console.log('🧪 Testing GET /inactive/list...');
    const response = await axios.get(`${BASE_URL}/inactive/list?page=1&limit=5`, testConfig);
    console.log('✅ Inactive Users List Response:', response.data);

    // Check if user data includes enhanced fields
    if (response.data.data.users && response.data.data.users.length > 0) {
      const user = response.data.data.users[0];
      console.log('📋 Sample Inactive User Data Fields:');
      console.log('  - ID:', user.id);
      console.log('  - Full Name:', user.fullName);
      console.log('  - Email:', user.email);
      console.log('  - Mobile:', user.mobileNumber);
      console.log('  - User Type:', user.userType);
      console.log('  - Profile URL:', user.profileUrl);
      console.log('  - Is Fully Verified:', user.isFullyVerified);
      console.log('  - Days Inactive:', user.daysInactive);
    }

    return response.data;
  } catch (error) {
    console.error('❌ Error testing inactive users list:', error.response?.data || error.message);
  }
}

async function testGetActiveUsersListWithFilter() {
  try {
    console.log('🧪 Testing GET /active/list with userType filter...');
    const response = await axios.get(`${BASE_URL}/active/list?page=1&limit=5&userType=Agent`, testConfig);
    console.log('✅ Active Users List (Filtered) Response:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Error testing active users list with filter:', error.response?.data || error.message);
  }
}

async function testGetInactiveUsersListWithFilter() {
  try {
    console.log('🧪 Testing GET /inactive/list with userType filter...');
    const response = await axios.get(`${BASE_URL}/inactive/list?page=1&limit=5&userType=EndUser`, testConfig);
    console.log('✅ Inactive Users List (Filtered) Response:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Error testing inactive users list with filter:', error.response?.data || error.message);
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting User Statistics API Tests...\n');

  await testGetTotalUsers();
  console.log('');

  await testGetActiveUsers();
  console.log('');

  await testGetInactiveUsers();
  console.log('');

  await testGetOnlineUsers();
  console.log('');

  await testGetUserStatistics();
  console.log('');

  await testGetActiveUsersList();
  console.log('');

  await testGetInactiveUsersList();
  console.log('');

  await testGetActiveUsersListWithFilter();
  console.log('');

  await testGetInactiveUsersListWithFilter();
  console.log('');

  console.log('✅ All tests completed!');
}

// Export for use in other files
module.exports = {
  testGetTotalUsers,
  testGetActiveUsers,
  testGetInactiveUsers,
  testGetOnlineUsers,
  testGetUserStatistics,
  testGetActiveUsersList,
  testGetInactiveUsersList,
  testGetActiveUsersListWithFilter,
  testGetInactiveUsersListWithFilter,
  runAllTests,
};

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}
