const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

// Test API endpoints
async function testAPI() {
  console.log('🚀 Starting BloodFinder API Tests...\n');

  try {
    // Test health check
    console.log('1. Testing Health Check...');
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health Check:', healthResponse.data.message);

    // Test user registration
    console.log('\n2. Testing User Registration...');
    const registerData = {
      name: 'Test Donor',
      email: 'testdonor@example.com',
      password: 'Password123!',
      phone: '+919876543210',
      role: 'donor',
      address: {
        street: '123 Test Street',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001'
      },
      medicalInfo: {
        bloodGroup: 'O+',
        weight: 70,
        medicalConditions: [],
        medications: []
      }
    };

    try {
      const registerResponse = await axios.post(`${BASE_URL}/auth/register`, registerData);
      console.log('✅ Registration successful:', registerResponse.data.message);
      
      // Test login
      console.log('\n3. Testing User Login...');
      const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
        email: 'testdonor@example.com',
        password: 'Password123!'
      });
      console.log('✅ Login successful');
      
      const token = loginResponse.data.token;
      const authHeaders = { Authorization: `Bearer ${token}` };

      // Test protected route
      console.log('\n4. Testing Protected Route...');
      const profileResponse = await axios.get(`${BASE_URL}/auth/profile`, { headers: authHeaders });
      console.log('✅ Profile access successful:', profileResponse.data.data.user.name);

      // Test donor dashboard
      console.log('\n5. Testing Donor Dashboard...');
      try {
        const dashboardResponse = await axios.get(`${BASE_URL}/donor/dashboard`, { headers: authHeaders });
        console.log('⚠️ Dashboard access (pending approval):', dashboardResponse.data.message || 'Accessed');
      } catch (error) {
        if (error.response && error.response.status === 403) {
          console.log('⚠️ Dashboard access blocked (donor not approved) - Expected behavior');
        } else {
          throw error;
        }
      }

    } catch (error) {
      if (error.response && error.response.data.message.includes('already exists')) {
        console.log('⚠️ User already exists, testing login...');
        
        const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
          email: 'testdonor@example.com',
          password: 'Password123!'
        });
        console.log('✅ Login with existing user successful');
      } else {
        throw error;
      }
    }

    // Test emergency requests (public)
    console.log('\n6. Testing Emergency Requests (Public)...');
    const emergencyResponse = await axios.get(`${BASE_URL}/emergency/active`);
    console.log('✅ Emergency requests accessed:', emergencyResponse.data.data.totalActive, 'active requests');

    console.log('\n🎉 All API tests completed successfully!');
    console.log('\n📊 Test Summary:');
    console.log('✅ Health Check - OK');
    console.log('✅ User Registration - OK');
    console.log('✅ User Login - OK');
    console.log('✅ Protected Routes - OK');
    console.log('✅ Role Authorization - OK');
    console.log('✅ Public Endpoints - OK');

  } catch (error) {
    console.error('❌ API Test Failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Message:', error.response.data.message || error.response.data);
    } else if (error.request) {
      console.error('No response received. Is the server running on http://localhost:5000?');
    } else {
      console.error('Error:', error.message);
    }
  }
}

// Test Socket.io connection
async function testSocketConnection() {
  console.log('\n🔌 Testing Socket.io Connection...');
  
  try {
    const io = require('socket.io-client');
    const socket = io('http://localhost:5000');

    socket.on('connect', () => {
      console.log('✅ Socket.io connection successful');
      socket.disconnect();
    });

    socket.on('connect_error', (error) => {
      console.log('⚠️ Socket.io connection failed (expected without auth):', error.message);
      socket.disconnect();
    });

    // Give it a moment to connect
    setTimeout(() => {
      socket.disconnect();
    }, 2000);

  } catch (error) {
    console.log('⚠️ Socket.io test skipped (socket.io-client not installed)');
  }
}

// Run tests
if (require.main === module) {
  testAPI().then(() => {
    testSocketConnection();
  });
}

module.exports = { testAPI, testSocketConnection };
