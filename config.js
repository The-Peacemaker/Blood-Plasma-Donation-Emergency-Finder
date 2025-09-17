// Environment configuration for BloodFinder API
const API_CONFIG = {
    // Detect environment and set appropriate API URL
    getBaseURL() {
        // Check if we're in development (localhost)
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return 'http://localhost:5000/api';
        }
        
        // Check if we're on Netlify with serverless functions
        if (window.location.hostname.includes('netlify.app')) {
            return `${window.location.origin}/.netlify/functions`;
        }
        
        // For production, you can set your deployed backend URL here
        // Replace this with your actual backend deployment URL (e.g., Heroku, Railway, etc.)
        return process.env.REACT_APP_API_URL || `${window.location.origin}/api`;
    },

    // Socket.io URL for real-time features
    getSocketURL() {
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return 'http://localhost:5000';
        }
        
        // For production, set your backend Socket.io URL
        return process.env.REACT_APP_SOCKET_URL || window.location.origin;
    }
};

// Export for use in api-client.js
window.API_CONFIG = API_CONFIG;