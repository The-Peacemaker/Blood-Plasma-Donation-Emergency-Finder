document.addEventListener('DOMContentLoaded', () => {
    // Mobile menu toggle
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');
    if (mobileMenuButton) {
        mobileMenuButton.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
        });
    }

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

    // Dummy donor login
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            localStorage.setItem('donorLoggedIn', 'true');
            authSection.classList.add('hidden');
            dashboardSection.classList.remove('hidden');
        });
    }

    // Check if donor is logged in
    if (localStorage.getItem('donorLoggedIn') === 'true' && authSection) {
        authSection.classList.add('hidden');
        dashboardSection.classList.remove('hidden');
    }

    // Donor logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('donorLoggedIn');
            authSection.classList.remove('hidden');
            dashboardSection.classList.add('hidden');
        });
    }

    // Search page: Dummy search results
    const searchForm = document.getElementById('search-form');
    const donorResultsContainer = document.getElementById('donor-results-container');
    const donorResultsTbody = document.getElementById('donor-results-tbody');
    const noResultsMessage = document.getElementById('no-results-message');
    const emergencyRequestSection = document.getElementById('emergency-request-section');

    const dummyDonors = [
        { name: 'Arjun Sharma', bloodGroup: 'O+', city: 'Delhi', phone1: '9876543210', phone2: '9876543211' },
        { name: 'Priya Patel', bloodGroup: 'A+', city: 'Mumbai', phone1: '9876543212', phone2: '' },
        { name: 'Rohan Singh', bloodGroup: 'B+', city: 'Bengaluru', phone1: '9876543214', phone2: '9876543215' },
        { name: 'Sneha Reddy', bloodGroup: 'AB+', city: 'Hyderabad', phone1: '9876543216', phone2: '' },
        { name: 'Vikram Kumar', bloodGroup: 'O-', city: 'Chennai', phone1: '9876543218', phone2: '9876543219' },
        { name: 'Anjali Mehta', bloodGroup: 'A+', city: 'Ahmedabad', phone1: '9876543220', phone2: '' },
        { name: 'Karan Gupta', bloodGroup: 'B+', city: 'Pune', phone1: '9876543222', phone2: '9876543223' },
        { name: 'Isha Das', bloodGroup: 'O+', city: 'Kolkata', phone1: '9876543224', phone2: '' },
        { name: 'Amit Verma', bloodGroup: 'A+', city: 'Delhi', phone1: '9876543226', phone2: '' },
        { name: 'Neha Desai', bloodGroup: 'B-', city: 'Mumbai', phone1: '9876543228', phone2: '9876543229' },
    ];

    if (searchForm) {
        searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const bloodGroup = document.getElementById('search-blood-group').value;
            const city = document.getElementById('search-city').value;
            
            const results = dummyDonors.filter(donor => {
                const cityMatch = donor.city === city;
                const bloodGroupMatch = (bloodGroup === 'ALL' || donor.bloodGroup === bloodGroup);
                return cityMatch && bloodGroupMatch;
            });

            donorResultsTbody.innerHTML = '';
            if (results.length > 0) {
                results.forEach((donor, index) => {
                    const row = `
                        <tr class="result-row border-t border-gray-200" style="animation-delay: ${index * 100}ms">
                            <td class="p-4">${donor.name}</td>
                            <td class="p-4"><span class="font-semibold text-red-600">${donor.bloodGroup}</span></td>
                            <td class="p-4">${donor.city}</td>
                            <td class="p-4">${donor.phone1}${donor.phone2 ? `<br>${donor.phone2}` : ''}</td>
                        </tr>
                    `;
                    donorResultsTbody.innerHTML += row;
                });
                donorResultsContainer.classList.remove('hidden');
                noResultsMessage.classList.add('hidden');
                emergencyRequestSection.classList.add('hidden');
            } else {
                donorResultsContainer.classList.add('hidden');
                noResultsMessage.classList.remove('hidden');
                emergencyRequestSection.classList.remove('hidden');
            }
        });
    }

    // Emergency request form submission
    const emergencyForm = document.getElementById('emergency-form');
    const toast = document.getElementById('toast');

    if (emergencyForm) {
        emergencyForm.addEventListener('submit', (e) => {
            e.preventDefault();
            toast.classList.remove('hidden');
            setTimeout(() => {
                toast.classList.add('hidden');
            }, 3000);
            emergencyForm.reset();
        });
    }

    // Admin page: Login and tabs
    const adminLoginForm = document.getElementById('admin-login-form');
    const adminLoginSection = document.getElementById('admin-login-section');
    const adminDashboardSection = document.getElementById('admin-dashboard-section');
    const adminLogoutBtn = document.getElementById('admin-logout-btn');

    // Dummy admin login
    if (adminLoginForm) {
        adminLoginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('admin-email').value;
            const password = document.getElementById('admin-password').value;
            if (email === 'admin@demo.com' && password === 'password') {
                localStorage.setItem('adminLoggedIn', 'true');
                adminLoginSection.classList.add('hidden');
                adminDashboardSection.classList.remove('hidden');
            } else {
                alert('Invalid credentials');
            }
        });
    }

    // Check if admin is logged in
    if (localStorage.getItem('adminLoggedIn') === 'true' && adminLoginSection) {
        adminLoginSection.classList.add('hidden');
        adminDashboardSection.classList.remove('hidden');
    }

    // Admin logout
    if (adminLogoutBtn) {
        adminLogoutBtn.addEventListener('click', () => {
            localStorage.removeItem('adminLoggedIn');
            adminLoginSection.classList.remove('hidden');
            adminDashboardSection.classList.add('hidden');
        });
    }

    // Admin dashboard tabs
    const tabs = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('text-red-600', 'border-red-600'));
            tab.classList.add('text-red-600', 'border-red-600');

            tabContents.forEach(content => content.classList.add('hidden'));
            const contentId = tab.id.replace('-tab', '-content');
            document.getElementById(contentId).classList.remove('hidden');
        });
    });

    // Intersection Observer for card animations
    const cards = document.querySelectorAll('.card');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                setTimeout(() => {
                    entry.target.classList.add('is-visible');
                }, index * 150); // Stagger the animation
            }
        });
    }, {
        threshold: 0.1
    });

    cards.forEach(card => {
        observer.observe(card);
    });
});
