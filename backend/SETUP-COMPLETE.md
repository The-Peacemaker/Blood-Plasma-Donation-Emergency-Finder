# BloodFinder Backend - Quick Start Guide

## 🎉 Setup Complete!

Your BloodFinder backend is fully configured and running! Here's everything that's working:

### ✅ What's Working:
- **MongoDB Database**: Connected to `mongodb://localhost:27017/blood_donation_db`
- **Express Server**: Running on `http://localhost:5000`
- **Real-time Features**: Socket.io enabled for live notifications
- **Authentication**: JWT-based auth with role management
- **API Routes**: All donor, recipient, and admin endpoints active
- **Security**: CORS, rate limiting, input validation enabled

### 🚀 Server Status:
```
🚀 BloodFinder Backend Server Started!
📍 Port: 5000
🌍 Environment: development
📊 Database: Connected
🔗 Frontend: http://localhost:3000
✅ MongoDB Connected Successfully
```

### 🌐 Test Your API:
**Open your browser and visit**: http://localhost:5000/api/health

You should see:
```json
{
  "success": true,
  "message": "Blood Donation API is running!",
  "timestamp": "2025-09-15T...",
  "environment": "development"
}
```

### 🔗 Available API Endpoints:

#### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update profile
- `PUT /api/auth/change-password` - Change password

#### Donor Features
- `GET /api/donor/dashboard` - Donor dashboard
- `PUT /api/donor/availability` - Update availability
- `GET /api/donor/emergency-requests` - View emergency requests
- `POST /api/donor/emergency-requests/:id/respond` - Respond to requests
- `GET /api/donor/donations` - Donation history

#### Recipient Features
- `GET /api/recipient/dashboard` - Recipient dashboard
- `GET /api/recipient/donors/search` - Search donors
- `POST /api/recipient/emergency-request` - Submit emergency request
- `GET /api/recipient/emergency-requests` - Manage requests

#### Admin Features
- `GET /api/admin/dashboard` - Admin dashboard with analytics
- `GET /api/admin/users` - Manage users
- `PUT /api/admin/users/:id/approval` - Approve/reject donors
- `GET /api/admin/analytics/donations` - Donation analytics

#### Emergency
- `GET /api/emergency/active` - Active emergency requests (public)
- `POST /api/emergency/broadcast` - Emergency broadcasts

### 🔌 Real-time Features:
- Emergency request notifications
- Donor response alerts
- Live availability updates
- Admin broadcasts

### 💻 How to Start/Stop:

**Start Server:**
```bash
cd backend
npm run dev
```

**Or use the batch file:**
```bash
start-server.bat
```

**Stop Server:**
Press `Ctrl+C` in the terminal

### 🔧 Configuration:
Your `.env` file is properly configured with:
- MongoDB URI: `mongodb://localhost:27017/blood_donation_db`
- JWT Secret: Secure key generated
- Port: 5000
- CORS: Enabled for `http://localhost:3000`

### 🎯 Frontend Integration:
Your frontend can now connect to:
- **API Base URL**: `http://localhost:5000/api`
- **Socket.io URL**: `http://localhost:5000`

### 📱 Example Frontend Integration:

```javascript
// API calls
const API_BASE = 'http://localhost:5000/api';

// User registration
const registerUser = async (userData) => {
  const response = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData)
  });
  return response.json();
};

// Socket.io connection
import io from 'socket.io-client';
const socket = io('http://localhost:5000', {
  auth: { token: localStorage.getItem('token') }
});

socket.on('new-emergency-request', (data) => {
  // Handle emergency notifications
});
```

### 🛠 Troubleshooting:

**If API is not accessible:**
1. Make sure server is running: `npm run dev`
2. Check MongoDB is running: `Get-Service MongoDB`
3. Verify port 5000 is available
4. Check firewall settings

**Common Issues:**
- MongoDB not started: Run `net start MongoDB`
- Port in use: Change PORT in `.env` file
- CORS errors: Verify FRONTEND_URL in `.env`

### 🎉 You're All Set!

Your BloodFinder backend is production-ready with:
- ✅ Comprehensive API endpoints
- ✅ Real-time notifications
- ✅ Secure authentication
- ✅ Database integration
- ✅ Input validation
- ✅ Error handling
- ✅ Rate limiting
- ✅ CORS configuration

**Happy coding! 🩸💻**
