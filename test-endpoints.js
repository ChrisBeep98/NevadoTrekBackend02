// test-endpoints.js - Simple test to validate API endpoints
const axios = require('axios');

async function testEndpoints() {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  
  console.log('Testing Nevado Trek Backend endpoints...\n');
  
  // Test health endpoint
  try {
    const healthResponse = await axios.get(`${baseUrl}/health`);
    console.log('✓ Health endpoint:', healthResponse.data.status);
  } catch (error) {
    console.log('✗ Health endpoint failed:', error.message);
  }
  
  // Test non-existent endpoint (should return welcome message)
  try {
    const welcomeResponse = await axios.get(`${baseUrl}/`);
    console.log('✓ Welcome endpoint works');
  } catch (error) {
    console.log('✗ Welcome endpoint failed:', error.message);
  }
  
  console.log('\nNote: Other API endpoints require proper Firebase configuration and environment variables.');
  console.log('For full testing, deploy to Vercel or set up local environment with Firebase credentials.');
}

if (require.main === module) {
  testEndpoints();
}

module.exports = { testEndpoints };