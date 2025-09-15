const axios = require('axios');

const testRegistration = async () => {
    try {
        console.log('🧪 Testing Registration API...');
        
        const userData = {
            name: "John Doe",
            email: "john.doe@example.com",
            password: "123456",
            phone: "9876543210",
            role: "donor",
            address: {
                street: "123 Main St",
                city: "New York",
                area: "Manhattan", // Added the required area field
                state: "NY",
                pincode: "100001" // Changed to 6 digits
            },
            medicalInfo: {
                bloodGroup: "A+",
                dateOfBirth: "1990-05-15",
                weight: 70,
                medicalConditions: [],
                medications: []
            }
        };

        console.log('📤 Sending registration request...');
        console.log('Data:', JSON.stringify(userData, null, 2));
        
        const response = await axios.post('http://localhost:5000/api/auth/register', userData, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ Registration successful!');
        console.log('Response:', response.data);
        
    } catch (error) {
        console.log('❌ Registration failed!');
        console.log('Error:', error.response?.data || error.message);
    }
};

testRegistration();
