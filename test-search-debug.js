import axios from 'axios';

async function testSearch() {
  try {
    console.log('🔍 Testing search API...');
    
    const searchRequest = {
      subCategory: "All",
      city: "Lucknow",
      isSale: "Rent",
      page: 1,
      limit: 10,
      sort: "newest",
      userId: "c7610542-51c4-4d12-a7ca-60d7780bf7fe",
      userType: "EndUser"
    };

    console.log('📤 Request:', JSON.stringify(searchRequest, null, 2));

    const response = await axios.post('http://192.168.1.5:5000/api/v1/property/search-property', searchRequest, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'NextDealApp/1.0'
      }
    });

    console.log('📥 Response Status:', response.status);
    console.log('📥 Response Data:', JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.error('❌ Error:', error.response ? {
      status: error.response.status,
      data: error.response.data
    } : error.message);
  }
}

async function testDebugEndpoint() {
  try {
    console.log('\n🧪 Testing debug endpoint...');
    
    const response = await axios.post('http://192.168.1.5:5000/api/v1/property/test-search', {}, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'NextDealApp/1.0'
      }
    });

    console.log('📥 Debug Response Status:', response.status);
    console.log('📥 Debug Response Data:', JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.error('❌ Debug Error:', error.response ? {
      status: error.response.status,
      data: error.response.data
    } : error.message);
  }
}

// Run both tests
testSearch().then(() => {
  return testDebugEndpoint();
});
