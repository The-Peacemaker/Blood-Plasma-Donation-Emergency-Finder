// Netlify Function - Health Check Example
// This is a basic example of how to implement your API as Netlify Functions

exports.handler = async (event, context) => {
    // Enable CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    };

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: '',
        };
    }

    // Health check endpoint
    if (event.path === '/health' || event.path === '/.netlify/functions/health') {
        return {
            statusCode: 200,
            headers: {
                ...headers,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                success: true,
                message: 'Blood Donation API is running on Netlify!',
                timestamp: new Date().toISOString(),
                environment: 'production'
            }),
        };
    }

    // Default response for unmatched routes
    return {
        statusCode: 404,
        headers: {
            ...headers,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            success: false,
            message: 'Endpoint not found',
        }),
    };
};