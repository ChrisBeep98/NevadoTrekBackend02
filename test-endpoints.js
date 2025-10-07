// test-endpoints.js - Simple test to validate API endpoints
const axios = require('axios');

async function testEndpoints() {
  const baseUrl = process.env.BASE_URL || 'https://nevado-trek-backend02-jka2-n53ctwb7m.vercel.app';
  
  console.log('Testing Nevado Trek Backend endpoints...\n');
  
  // Test health endpoint
  try {
    const healthResponse = await axios.get(`${baseUrl}/api/health`);
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

  // Test POST /api/admin/tours (create tour)
  try {
    const tourData = {
      tourId: "test-tour-1",
      name: {
        es: "Tour Nevado del Cocuy",
        en: "Nevado del Cocuy Tour"
      },
      shortDescription: {
        es: "Ascenso al Nevado del Cocuy",
        en: "Ascent to Nevado del Cocuy"
      },
      longDescription: {
        es: "Expedición de 5 días al Nevado del Cocuy, una de las montañas más emblemáticas de Colombia",
        en: "5-day expedition to Nevado del Cocuy, one of the most iconic mountains in Colombia"
      },
      pricingTiers: [
        {"pax": 1, "pricePerPerson": 1200000},
        {"pax": 2, "pricePerPerson": 1100000},
        {"pax": 3, "pricePerPerson": 1000000},
        {"pax": 4, "pricePerPerson": 950000}
      ],
      isActive: true,
      inclusions: [
        {"es": "Guías certificados", "en": "Certified guides"},
        {"es": "Equipo de alta montaña", "en": "Mountaineering equipment"},
        {"es": "Seguro de vida", "en": "Life insurance"}
      ]
    };

    const createTourResponse = await axios.post(`${baseUrl}/api/admin/tours`, tourData, {
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Secret-Key': 'IsutcY5bNP'
      }
    });
    console.log('✓ Admin Tour Creation:', createTourResponse.status === 200 ? 'Success' : 'Unexpected status');
  } catch (error) {
    console.log('✗ Admin Tour Creation failed:', error.response?.status, error.response?.data?.message || error.message);
  }

  // Test GET /api/tours (get all tours)
  try {
    const toursResponse = await axios.get(`${baseUrl}/api/tours`);
    const toursCount = Array.isArray(toursResponse.data) ? toursResponse.data.length : 0;
    console.log('✓ Get Tours:', toursCount, 'tours found');
  } catch (error) {
    console.log('✗ Get Tours failed:', error.response?.status, error.response?.data?.message || error.message);
  }

  // Test GET /api/getTour?tourId=test-tour-1 (get specific tour)
  try {
    const specificTourResponse = await axios.get(`${baseUrl}/api/getTour?tourId=test-tour-1`);
    const tourExists = specificTourResponse.data && Object.keys(specificTourResponse.data).length > 0;
    console.log('✓ Get Specific Tour:', tourExists ? 'Found' : 'Not found');
  } catch (error) {
    console.log('✗ Get Specific Tour failed:', error.response?.status, error.response?.data?.message || error.message);
  }

  console.log('\nTesting completed.');
}

if (require.main === module) {
  testEndpoints();
}

module.exports = { testEndpoints };
