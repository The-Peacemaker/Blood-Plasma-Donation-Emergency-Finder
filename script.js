document.addEventListener('DOMContentLoaded', async () => {
    // Check if API client is available
    if (typeof bloodFinderAPI === 'undefined') {
        console.error('API client not loaded. Make sure api-client.js is included.');
        return;
    }

    // Test backend connectivity
    try {
        const health = await bloodFinderAPI.checkHealth();
        console.log('Backend status:', health);
    } catch (error) {
        console.error('Backend connection failed:', error);
        UIHelper.showError('Unable to connect to server. Some features may not work.');
    }

    // Mobile menu toggle
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');
    if (mobileMenuButton) {
        mobileMenuButton.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
        });
    }

    // Check for existing authentication
    await checkAuthStatus();

    // Donor page: Login/Register toggle
    const showLoginBtn = document.getElementById('show-login-btn');
    const showRegisterBtn = document.getElementById('show-register-btn');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const authSection = document.getElementById('auth-section');
    const dashboardSection = document.getElementById('dashboard-section');
    const logoutBtn = document.getElementById('logout-btn');

    if (showLoginBtn) {
        showLoginBtn.addEventListener('click', () => {
            loginForm.classList.remove('hidden');
            registerForm.classList.add('hidden');
            showLoginBtn.classList.add('text-red-500', 'border-red-500');
            showRegisterBtn.classList.remove('text-red-500', 'border-red-500');
        });
    }

    if (showRegisterBtn) {
        showRegisterBtn.addEventListener('click', () => {
            registerForm.classList.remove('hidden');
            loginForm.classList.add('hidden');
            showRegisterBtn.classList.add('text-red-500', 'border-red-500');
            showLoginBtn.classList.remove('text-red-500', 'border-red-500');
        });
    }

    // Real donor login with backend API
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            
            try {
                UIHelper.showLoading(submitBtn);
                
                const formData = new FormData(loginForm);
                const credentials = {
                    email: formData.get('email'),
                    password: formData.get('password')
                };

                console.log('Attempting login with:', credentials.email);
                const response = await bloodFinderAPI.login(credentials);
                console.log('Login response:', response);
                
                if (response.success) {
                    // Store user data
                    localStorage.setItem('user_data', JSON.stringify(response.data.user));
                    localStorage.setItem('user_role', response.data.user.role);
                    
                    UIHelper.showSuccess('Login successful!');
                    
                    // Show dashboard based on role
                    await showUserDashboard(response.data.user);
                    
                } else {
                    UIHelper.showError(response.message || 'Login failed');
                }
                
            } catch (error) {
                console.error('Login error:', error);
                UIHelper.showError(error.message || 'Login failed. Please try again.');
            } finally {
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            }
        });
    }

    // Real donor registration with backend API
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const submitBtn = registerForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            
            try {
                UIHelper.showLoading(submitBtn);
                
                const formData = new FormData(registerForm);
                
                // Extract form data with proper field names
                const userData = {
                    name: formData.get('name'),
                    email: formData.get('email'),
                    password: formData.get('password'),
                    phone: formData.get('phone'),
                    role: 'donor', // Default role for donor registration
                    address: {
                        street: '', // Not captured in current form
                        city: formData.get('city') || '',
                        area: formData.get('address') || '', // Frontend "Area" field maps to backend "area"
                        state: formData.get('state') || '',
                        pincode: formData.get('pincode') || ''
                    },
                    medicalInfo: {
                        bloodGroup: formData.get('bloodGroup'),
                        dateOfBirth: formData.get('dob'), // Backend expects dateOfBirth
                        weight: parseInt(formData.get('weight')) || 0,
                        medicalConditions: [],
                        medications: []
                    }
                };

                console.log('Registration data:', userData);

                // Age validation if DOB is provided
                const dobValue = formData.get('dob');
                if (dobValue) {
                    const dob = new Date(dobValue);
                    const today = new Date();
                    let age = today.getFullYear() - dob.getFullYear();
                    const monthDiff = today.getMonth() - dob.getMonth();
                    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
                        age--;
                    }

                    if (age < 18) {
                        UIHelper.showError("Donor must be at least 18 years old.");
                        return;
                    }
                    
                    if (age > 65) {
                        UIHelper.showError("Donor must be under 65 years old.");
                        return;
                    }
                }

                // Validate required fields
                if (!userData.name || !userData.email || !userData.password || !userData.phone) {
                    UIHelper.showError('Please fill in all required fields (Name, Email, Password, Phone)');
                    return;
                }

                if (!userData.medicalInfo.bloodGroup) {
                    UIHelper.showError('Please select your blood group');
                    return;
                }

                // Email validation
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(userData.email)) {
                    UIHelper.showError('Please enter a valid email address');
                    return;
                }

                // Password validation
                if (userData.password.length < 6) {
                    UIHelper.showError('Password must be at least 6 characters long');
                    return;
                }

                console.log('Sending registration request...');
                const response = await bloodFinderAPI.register(userData);
                console.log('Registration response:', response);
                
                if (response.success) {
                    // Store user data
                    localStorage.setItem('user_data', JSON.stringify(response.data.user));
                    localStorage.setItem('user_role', response.data.user.role);
                    
                    UIHelper.showSuccess('Registration successful! Welcome to BloodFinder.');
                    
                    // Show dashboard
                    await showUserDashboard(response.data.user);
                    
                } else {
                    UIHelper.showError(response.message || 'Registration failed');
                }
                
            } catch (error) {
                console.error('Registration error:', error);
                UIHelper.showError(error.message || 'Registration failed. Please try again.');
            } finally {
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            }
        });
    }

    // Logout functionality
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            bloodFinderAPI.logout();
            
            // Reset UI
            if (authSection && dashboardSection) {
                authSection.classList.remove('hidden');
                dashboardSection.classList.add('hidden');
            }
            
            // Clear forms
            if (loginForm) loginForm.reset();
            if (registerForm) registerForm.reset();
            
            UIHelper.showSuccess('Logged out successfully!');
        });
    }

    // Initialize other features
    initializeSearchFunctionality();
    initializeAdminPanel();
    initializeAnimations();
});

// Check authentication status on page load
async function checkAuthStatus() {
    const userData = localStorage.getItem('user_data');
    const userRole = localStorage.getItem('user_role');
    
    if (userData && userRole) {
        try {
            const user = JSON.parse(userData);
            
            // Verify token is still valid
            const profile = await bloodFinderAPI.getUserProfile();
            if (profile.success) {
                await showUserDashboard(user);
            } else {
                // Token expired, clear storage
                bloodFinderAPI.logout();
            }
        } catch (error) {
            console.log('Auto-login failed:', error);
            bloodFinderAPI.logout();
        }
    }
}

// Show user dashboard based on role
async function showUserDashboard(user) {
    const authSection = document.getElementById('auth-section');
    const dashboardSection = document.getElementById('dashboard-section');
    
    if (authSection && dashboardSection) {
        authSection.classList.add('hidden');
        dashboardSection.classList.remove('hidden');
        
        // Update dashboard with user data
        await updateDashboardContent(user);
    }
    
    // Show admin access button for admin users
    if (user.role === 'admin') {
        showAdminAccess();
    }
}

// Update dashboard content with real data
async function updateDashboardContent(user) {
    // Update user info
    const userNameElements = document.querySelectorAll('[data-user-name]');
    const userEmailElements = document.querySelectorAll('[data-user-email]');
    const userRoleElements = document.querySelectorAll('[data-user-role]');
    
    userNameElements.forEach(el => el.textContent = user.name);
    userEmailElements.forEach(el => el.textContent = user.email);
    userRoleElements.forEach(el => el.textContent = user.role.charAt(0).toUpperCase() + user.role.slice(1));
    
    // Load dashboard statistics
    try {
        if (user.role === 'donor') {
            await loadDonorStats(user._id);
        } else if (user.role === 'recipient') {
            await loadRecipientStats(user._id);
        } else if (user.role === 'admin') {
            await loadAdminStats();
        }
    } catch (error) {
        console.error('Failed to load dashboard stats:', error);
    }
}

// Initialize search functionality
function initializeSearchFunctionality() {
    const searchForm = document.getElementById('search-form');
    
    if (searchForm) {
        searchForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = searchForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            
            try {
                UIHelper.showLoading(submitBtn);
                
                const formData = new FormData(searchForm);
                const searchParams = {
                    bloodGroup: formData.get('bloodGroup'),
                    location: formData.get('location'),
                    urgency: formData.get('urgency') || 'medium'
                };

                const response = await bloodFinderAPI.searchDonors(searchParams);
                
                if (response.success) {
                    displaySearchResults(response.data.donors);
                } else {
                    UIHelper.showError('No donors found matching your criteria');
                }
                
            } catch (error) {
                UIHelper.showError('Search failed. Please try again.');
            } finally {
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            }
        });
    }
}

// Initialize admin panel
function initializeAdminPanel() {
    // Only run on admin page
    if (!window.location.pathname.includes('admin.html')) return;
    
    console.log('Initializing admin panel...');
    
    const adminLoginForm = document.getElementById('admin-login-form');
    if (adminLoginForm) {
        adminLoginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('admin-email').value;
            const password = document.getElementById('admin-password').value;
            
            try {
                const response = await bloodFinderAPI.login({ email, password });
                
                if (response.success && response.data.user.role === 'admin') {
                    localStorage.setItem('user_data', JSON.stringify(response.data.user));
                    localStorage.setItem('user_role', response.data.user.role);
                    
                    document.getElementById('admin-login-section').classList.add('hidden');
                    document.getElementById('admin-dashboard-section').classList.remove('hidden');
                    
                    await loadAdminStats();
                } else {
                    UIHelper.showError('Invalid admin credentials');
                }
            } catch (error) {
                UIHelper.showError('Admin login failed');
            }
        });
    }
}

// Initialize animations
function initializeAnimations() {
    const cards = document.querySelectorAll('.card');
    if (cards.length > 0) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry, index) => {
                if (entry.isIntersecting) {
                    setTimeout(() => {
                        entry.target.classList.add('is-visible');
                    }, index * 150);
                }
            });
        }, { threshold: 0.1 });

        cards.forEach(card => observer.observe(card));
    }
}

// Load donor statistics
async function loadDonorStats(donorId) {
    try {
        const profile = await bloodFinderAPI.getDonorProfile(donorId);
        if (profile.success) {
            const donor = profile.data.donor;
            
            const donationCountEl = document.getElementById('donation-count');
            if (donationCountEl) {
                donationCountEl.textContent = donor.donationHistory?.length || 0;
            }
            
            const bloodGroupEl = document.getElementById('user-blood-group');
            if (bloodGroupEl) {
                bloodGroupEl.textContent = donor.medicalInfo?.bloodGroup || 'Not specified';
            }
            
            const availabilityEl = document.getElementById('availability-status');
            if (availabilityEl) {
                availabilityEl.textContent = donor.availability?.isAvailable ? 'Available' : 'Not Available';
                availabilityEl.className = donor.availability?.isAvailable ? 'text-green-600' : 'text-red-600';
            }
        }
    } catch (error) {
        console.error('Failed to load donor stats:', error);
    }
}

// Load admin statistics
async function loadAdminStats() {
    try {
        const stats = await bloodFinderAPI.getAdminStats();
        if (stats.success) {
            const data = stats.data;
            
            const totalUsersEl = document.getElementById('total-users');
            const totalDonorsEl = document.getElementById('total-donors');
            
            if (totalUsersEl) totalUsersEl.textContent = data.totalUsers || 0;
            if (totalDonorsEl) totalDonorsEl.textContent = data.totalDonors || 0;
        }
    } catch (error) {
        console.error('Failed to load admin stats:', error);
    }
}

// Display search results
function displaySearchResults(donors) {
    const searchResults = document.getElementById('search-results');
    if (!searchResults) return;
    
    searchResults.innerHTML = '';
    
    if (donors.length === 0) {
        searchResults.innerHTML = '<p class="text-gray-600 text-center py-8">No donors found matching your criteria.</p>';
        return;
    }
    
    const resultsHTML = donors.map(donor => `
        <div class="bg-white rounded-lg shadow-md p-6 border-l-4 border-red-500">
            <div class="flex justify-between items-start mb-4">
                <div>
                    <h3 class="text-lg font-semibold text-gray-800">${donor.name}</h3>
                    <p class="text-gray-600">${donor.medicalInfo.bloodGroup} Blood Group</p>
                </div>
                <div class="text-right">
                    <span class="inline-block px-3 py-1 rounded-full text-sm font-medium ${
                        donor.availability.isAvailable 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                    }">
                        ${donor.availability.isAvailable ? 'Available' : 'Not Available'}
                    </span>
                </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                <div>
                    <p><strong>Location:</strong> ${donor.address.city}, ${donor.address.state}</p>
                    <p><strong>Phone:</strong> ${donor.phone}</p>
                </div>
            </div>
        </div>
    `).join('');
    
    searchResults.innerHTML = resultsHTML;
}

// Show admin access
function showAdminAccess() {
    const adminButton = document.getElementById('admin-access-btn');
    if (adminButton) {
        adminButton.classList.remove('hidden');
        adminButton.addEventListener('click', () => {
            window.location.href = '/admin.html';
        });
    }
}

// UI Helper functions
const UIHelper = {
    showLoading: (button) => {
        button.textContent = 'Loading...';
        button.disabled = true;
    },
    
    showSuccess: (message) => {
        console.log('Success:', message);
        alert('Success: ' + message);
    },
    
    showError: (message) => {
        console.error('Error:', message);
        alert('Error: ' + message);
    }
};
