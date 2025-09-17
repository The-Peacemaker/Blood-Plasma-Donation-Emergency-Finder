// BloodFinder API Client
class BloodFinderAPI {
    constructor() {
        // Use environment-aware configuration
        this.baseURL = window.API_CONFIG ? window.API_CONFIG.getBaseURL() : 'http://localhost:5000/api';
        this.token = localStorage.getItem('bloodfinder_token');
    }

    // Helper method to make HTTP requests
    async makeRequest(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...(this.token && { 'Authorization': `Bearer ${this.token}` })
            },
            ...options
        };

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Something went wrong');
            }

            return data;
        } catch (error) {
            console.error('API Request failed:', error);
            throw error;
        }
    }

    // Authentication methods
    async register(userData) {
        const response = await this.makeRequest('/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData)
        });

        if (response.success && response.token) {
            this.setToken(response.token);
        }

        return response;
    }

    async login(credentials) {
        const response = await this.makeRequest('/auth/login', {
            method: 'POST',
            body: JSON.stringify(credentials)
        });

        if (response.success && response.token) {
            this.setToken(response.token);
        }

        return response;
    }

    async adminLogin(credentials) {
        const response = await this.makeRequest('/auth/admin-login', {
            method: 'POST',
            body: JSON.stringify(credentials)
        });

        if (response.success && response.token) {
            this.setToken(response.token);
        }

        return response;
    }

    async getProfile() {
        return await this.makeRequest('/auth/profile');
    }

    async updateProfile(profileData) {
        return await this.makeRequest('/auth/profile', {
            method: 'PUT',
            body: JSON.stringify(profileData)
        });
    }

    // Donor methods
    async getDonorDashboard() {
        return await this.makeRequest('/donor/dashboard');
    }

    async updateAvailability(availabilityData) {
        return await this.makeRequest('/donor/availability', {
            method: 'PUT',
            body: JSON.stringify(availabilityData)
        });
    }

    async getEmergencyRequests(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return await this.makeRequest(`/donor/emergency-requests?${queryString}`);
    }

    async respondToEmergency(requestId, responseData) {
        return await this.makeRequest(`/donor/emergency-requests/${requestId}/respond`, {
            method: 'POST',
            body: JSON.stringify(responseData)
        });
    }

    async getDonationHistory(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return await this.makeRequest(`/donor/donations?${queryString}`);
    }

    // Recipient methods
    async getRecipientDashboard() {
        return await this.makeRequest('/recipient/dashboard');
    }

    async searchDonors(searchParams) {
        const queryString = new URLSearchParams(searchParams).toString();
        return await this.makeRequest(`/recipient/donors/search?${queryString}`);
    }

    async submitEmergencyRequest(requestData) {
        return await this.makeRequest('/recipient/emergency-request', {
            method: 'POST',
            body: JSON.stringify(requestData)
        });
    }

    async getMyEmergencyRequests(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return await this.makeRequest(`/recipient/emergency-requests?${queryString}`);
    }

    async selectDonor(requestId, donorData) {
        return await this.makeRequest(`/recipient/emergency-requests/${requestId}/select-donor`, {
            method: 'POST',
            body: JSON.stringify(donorData)
        });
    }

    // Admin methods
    async getAdminDashboard() {
        return await this.makeRequest('/admin/dashboard');
    }

    async getUsers(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return await this.makeRequest(`/admin/users?${queryString}`);
    }

    async approveUser(userId, action, notes = '') {
        return await this.makeRequest(`/admin/users/${userId}/approval`, {
            method: 'PUT',
            body: JSON.stringify({ action, notes })
        });
    }

    async getAllEmergencyRequests(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return await this.makeRequest(`/admin/emergency-requests?${queryString}`);
    }

    // Emergency methods (public)
    async getActiveEmergencies() {
        return await this.makeRequest('/emergency/active');
    }

    // Utility methods
    setToken(token) {
        this.token = token;
        localStorage.setItem('bloodfinder_token', token);
    }

    removeToken() {
        this.token = null;
        localStorage.removeItem('bloodfinder_token');
    }

    logout() {
        this.removeToken();
        // Clear any other stored user data
        localStorage.removeItem('donorLoggedIn');
        localStorage.removeItem('adminLoggedIn');
        localStorage.removeItem('user_role');
        localStorage.removeItem('user_data');
    }

    isAuthenticated() {
        return !!this.token;
    }

    // Health check
    async checkHealth() {
        try {
            const response = await fetch(`${this.baseURL.replace('/api', '')}/api/health`);
            return await response.json();
        } catch (error) {
            console.error('Health check failed:', error);
            return { success: false, message: 'Backend not accessible' };
        }
    }
}

// Create a global instance
window.bloodFinderAPI = new BloodFinderAPI();

// Utility functions for UI
class UIHelper {
    static showLoading(element) {
        element.innerHTML = '<div class="flex justify-center items-center"><div class="animate-spin rounded-full h-6 w-6 border-b-2 border-red-500"></div></div>';
    }

    static showError(message, containerId = null) {
        const errorHtml = `
            <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                <strong>Error:</strong> ${message}
            </div>
        `;
        
        if (containerId) {
            document.getElementById(containerId).innerHTML = errorHtml;
        } else {
            // Show as toast notification
            this.showToast(message, 'error');
        }
    }

    static showSuccess(message, containerId = null) {
        const successHtml = `
            <div class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
                <strong>Success:</strong> ${message}
            </div>
        `;
        
        if (containerId) {
            document.getElementById(containerId).innerHTML = successHtml;
        } else {
            this.showToast(message, 'success');
        }
    }

    static showToast(message, type = 'info') {
        const toastId = 'toast-' + Date.now();
        const bgColor = type === 'error' ? 'bg-red-500' : type === 'success' ? 'bg-green-500' : 'bg-blue-500';
        
        const toast = document.createElement('div');
        toast.id = toastId;
        toast.className = `fixed top-4 right-4 ${bgColor} text-white px-6 py-3 rounded shadow-lg z-50 transition-opacity duration-300`;
        toast.innerHTML = message;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => {
                if (document.getElementById(toastId)) {
                    document.body.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }

    static formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    static formatDateTime(dateString) {
        return new Date(dateString).toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}

// Make UIHelper globally available
window.UIHelper = UIHelper;

// Auto-check backend connectivity on load
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const health = await bloodFinderAPI.checkHealth();
        if (health.success) {
            console.log('✅ Backend connected successfully');
        } else {
            console.warn('⚠️ Backend health check failed');
        }
    } catch (error) {
        console.error('❌ Backend connection failed:', error);
    }
});
