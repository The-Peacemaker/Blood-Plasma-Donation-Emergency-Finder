# BloodFinder Backend API

A comprehensive backend system for blood donation and emergency finder platform built with Node.js, Express.js, MongoDB, and Socket.io.

## 🚀 Features

### Authentication & Authorization
- JWT-based authentication
- Role-based access control (Admin, Donor, Recipient)
- Password hashing with bcryptjs
- Protected routes with middleware
- Donor approval system

### Real-time Features
- Socket.io for live notifications
- Emergency request broadcasting
- Donor response notifications
- Live availability updates
- Admin broadcasts

### Core Functionality
- **Donors**: Registration, approval, availability management, emergency response
- **Recipients**: Emergency request submission, donor search, donation scheduling
- **Admins**: User management, analytics, system monitoring, approvals

### Security & Performance
- Rate limiting
- CORS configuration
- Input validation with express-validator
- Error handling middleware
- Compression and security headers

## 📁 Project Structure

```
backend/
├── models/
│   ├── User.js              # User model (donors, recipients, admins)
│   ├── EmergencyRequest.js  # Emergency blood requests
│   ├── DonationHistory.js   # Donation records
│   └── index.js             # Model exports
├── routes/
│   ├── auth.js              # Authentication routes
│   ├── donor.js             # Donor-specific routes
│   ├── recipient.js         # Recipient-specific routes
│   ├── admin.js             # Admin management routes
│   └── emergency.js         # Emergency broadcast routes
├── middleware/
│   ├── auth.js              # JWT authentication middleware
│   ├── errorHandler.js      # Error handling middleware
│   ├── notFound.js          # 404 handler
│   └── socketAuth.js        # Socket.io authentication
├── socketHandlers.js        # Real-time event handlers
├── server.js               # Main server file
├── package.json            # Dependencies and scripts
└── README.md              # This file
```

## 🛠 Installation & Setup

1. **Clone the repository**
   ```bash
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   Create a `.env` file:
   ```env
   # Server Configuration
   PORT=5000
   NODE_ENV=development
   
   # Database
   MONGODB_URI=mongodb://localhost:27017/blood_donation_db
   
   # JWT Configuration
   JWT_SECRET=your_super_secret_jwt_key_here
   JWT_EXPIRES_IN=7d
   
   # Frontend URL (for CORS)
   FRONTEND_URL=http://localhost:3000
   
   # Rate Limiting
   RATE_LIMIT_WINDOW=15
   RATE_LIMIT_MAX=100
   ```

4. **Start MongoDB**
   ```bash
   # Using MongoDB service
   sudo systemctl start mongod
   
   # Or using Docker
   docker run -d -p 27017:27017 --name mongodb mongo:latest
   ```

5. **Run the server**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

## 📋 API Endpoints

### Authentication Routes (`/api/auth`)
- `POST /register` - User registration
- `POST /login` - User login
- `GET /profile` - Get user profile
- `PUT /profile` - Update user profile
- `PUT /change-password` - Change password
- `POST /admin-login` - Admin login

### Donor Routes (`/api/donor`)
- `GET /dashboard` - Get donor dashboard data
- `PUT /availability` - Update availability status
- `GET /emergency-requests` - Get matching emergency requests
- `POST /emergency-requests/:id/respond` - Respond to emergency request
- `GET /donations` - Get donation history
- `GET /responses` - Get response history
- `PUT /medical-info` - Update medical information

### Recipient Routes (`/api/recipient`)
- `GET /dashboard` - Get recipient dashboard
- `GET /donors/search` - Search available donors
- `POST /emergency-request` - Submit emergency request
- `GET /emergency-requests` - Get own emergency requests
- `GET /emergency-requests/:id` - Get specific request with responses
- `PUT /emergency-requests/:id/status` - Update request status
- `POST /emergency-requests/:id/select-donor` - Select donor
- `GET /donations-received` - Get received donations

### Admin Routes (`/api/admin`)
- `GET /dashboard` - Get admin dashboard with statistics
- `GET /users` - Get all users with filtering
- `GET /users/:id` - Get user details
- `PUT /users/:id/approval` - Approve/reject donor
- `GET /emergency-requests` - Get all emergency requests
- `PUT /emergency-requests/:id/priority` - Update request priority
- `GET /analytics/donations` - Get donation analytics
- `GET /analytics/system` - Get system analytics
- `GET /export/:type` - Export data (donations, users, requests)

### Emergency Routes (`/api/emergency`)
- `GET /active` - Get active emergency requests (public)
- `POST /broadcast` - Emergency broadcast to donors

## 🔌 Real-time Events (Socket.io)

### Client → Server Events
- `update-availability` - Update donor availability
- `emergency-request-created` - New emergency request
- `donor-response` - Response to emergency request
- `donation-scheduled` - Donation scheduling
- `donation-completed` - Donation completion
- `admin-broadcast` - Admin broadcast message

### Server → Client Events
- `new-emergency-request` - New emergency notification
- `donor-response` - Donor response notification
- `donation-scheduled` - Donation scheduled notification
- `donation-completed` - Donation completed notification
- `admin-broadcast` - Admin broadcast message
- `availability-updated` - Availability status changed
- `approval-status-updated` - Donor approval status changed

## 📊 Database Models

### User Model
```javascript
{
  name: String,
  email: String,
  password: String (hashed),
  phone: String,
  role: ['donor', 'recipient', 'admin'],
  address: {
    street: String,
    city: String,
    state: String,
    pincode: String
  },
  medicalInfo: {
    bloodGroup: String,
    weight: Number,
    lastDonationDate: Date,
    medicalConditions: [String],
    medications: [String]
  },
  availability: {
    isAvailable: Boolean,
    availableFrom: Date,
    preferredDonationTime: String
  },
  admin: {
    isApproved: Boolean,
    approvedAt: Date,
    rejectedAt: Date
  },
  stats: {
    totalDonations: Number,
    totalRequests: Number
  }
}
```

### EmergencyRequest Model
```javascript
{
  requester: ObjectId,
  patient: {
    name: String,
    age: Number,
    bloodGroup: String,
    gender: String,
    relationship: String
  },
  medical: {
    condition: String,
    urgencyLevel: String,
    requiredBy: Date,
    unitsNeeded: Number,
    bloodType: String
  },
  hospital: {
    name: String,
    address: Object,
    contactNumber: String
  },
  responses: [{
    donor: ObjectId,
    responseType: String,
    scheduledTime: Date,
    notes: String,
    respondedAt: Date
  }],
  status: String,
  admin: {
    priorityScore: Number,
    selectedDonor: ObjectId
  }
}
```

### DonationHistory Model
```javascript
{
  donor: ObjectId,
  recipient: ObjectId,
  emergencyRequest: ObjectId,
  scheduling: {
    scheduledDate: Date,
    actualDate: Date,
    location: Object
  },
  donation: {
    type: String,
    units: Number,
    volume: Number
  },
  status: String,
  recognition: {
    certificateIssued: Boolean,
    rewardPoints: Number
  }
}
```

## 🔐 Authentication Flow

1. **Registration**: User registers with role selection
2. **Login**: JWT token generated and returned
3. **Authorization**: Token validated on protected routes
4. **Role Check**: Role-based access to specific endpoints
5. **Donor Approval**: Admins approve donors before activation

## 🚨 Emergency Flow

1. **Request Creation**: Recipient submits emergency request
2. **Broadcasting**: Real-time notification to eligible donors
3. **Responses**: Donors respond with interest/confirmation
4. **Selection**: Recipient selects donor
5. **Scheduling**: Donation appointment scheduled
6. **Completion**: Donation completed and recorded

## 📈 Real-time Features

### Connection & Authentication
```javascript
const socket = io('http://localhost:5000', {
  auth: {
    token: 'your-jwt-token'
  }
});
```

### Emergency Notifications
```javascript
// Listen for emergency requests (donors)
socket.on('new-emergency-request', (data) => {
  // Show notification to donor
});

// Send donor response
socket.emit('donor-response', {
  requestId: 'request-id',
  responseType: 'confirmed',
  notes: 'Available immediately'
});
```

### Admin Broadcasting
```javascript
// Admin broadcast to specific group
socket.emit('admin-broadcast', {
  target: 'blood-group',
  bloodGroup: 'O+',
  message: 'Urgent: O+ donors needed',
  urgency: 'high'
});
```

## 🛡 Security Features

- **Rate Limiting**: 100 requests per 15 minutes
- **CORS**: Configured for frontend domain
- **Input Validation**: Comprehensive validation with express-validator
- **Password Security**: bcryptjs hashing with salt
- **JWT Security**: Secure token-based authentication
- **Role Authorization**: Route-level role checking

## 📊 Analytics & Monitoring

### Available Analytics
- User registration trends
- Donation statistics
- Emergency request patterns
- Response rates by urgency
- Blood group distribution
- City-wise donation data

### Export Options
- JSON format for API consumption
- CSV format for reporting
- Filtered by date range and type

## 🚀 Deployment

### Environment Setup
1. Set production environment variables
2. Configure MongoDB connection
3. Set secure JWT secret
4. Configure CORS for production domain

### Process Management
```bash
# Using PM2
npm install -g pm2
pm2 start server.js --name "bloodfinder-api"
pm2 save
pm2 startup
```

### Docker Deployment
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

## 🔧 Development

### Available Scripts
```bash
npm run dev          # Start development server with nodemon
npm start           # Start production server
npm test            # Run tests
npm run lint        # Run ESLint
```

### API Testing
Use tools like Postman or Thunder Client with the provided endpoints. Import the API collection for testing.

## 📝 Contributing

1. Fork the repository
2. Create feature branch
3. Make changes with proper testing
4. Submit pull request with description

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For issues and questions:
- Check existing GitHub issues
- Create new issue with detailed description
- Include error logs and steps to reproduce

---

**Built with ❤️ for saving lives through technology**
