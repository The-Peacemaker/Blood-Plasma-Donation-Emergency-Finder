# 🚀 Netlify Deployment Guide for BloodFinder

## 📋 Deployment Options Overview

Your BloodFinder project has **TWO main deployment strategies**:

### Option 1: Frontend on Netlify + Backend on Another Platform (Recommended)
- **Frontend**: Deploy on Netlify (static hosting)
- **Backend**: Deploy on Heroku, Railway, Render, or DigitalOcean
- **Database**: MongoDB Atlas (cloud)

### Option 2: Full Serverless on Netlify (Advanced)
- **Frontend**: Netlify static hosting
- **Backend**: Netlify Functions (serverless)
- **Database**: MongoDB Atlas

---

## 🎯 Option 1: Frontend + Separate Backend (RECOMMENDED)

### Step 1: Prepare Your Repository
1. **Push your code to GitHub**:
   ```bash
   git add .
   git commit -m "Prepare for deployment"
   git push origin main
   ```

### Step 2: Deploy Backend First

#### Deploy Backend on Railway (Easiest):
1. Go to [Railway.app](https://railway.app)
2. Sign up with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your BloodFinder repository
5. Choose the `backend` folder as root directory
6. Add environment variables:
   ```
   NODE_ENV=production
   PORT=5000
   MONGODB_URI=your_mongodb_atlas_connection_string
   JWT_SECRET=your_secure_jwt_secret
   FRONTEND_URL=https://your-netlify-site.netlify.app
   ```
7. Deploy! You'll get a URL like: `https://your-backend.railway.app`

#### Alternative: Deploy Backend on Heroku:
1. Install Heroku CLI
2. Create Heroku app:
   ```bash
   cd backend
   heroku create your-bloodfinder-api
   heroku config:set NODE_ENV=production
   heroku config:set MONGODB_URI=your_mongodb_atlas_uri
   heroku config:set JWT_SECRET=your_jwt_secret
   git subtree push --prefix=backend heroku main
   ```

### Step 3: Update Frontend Configuration
1. **Update config.js** with your backend URL:
   ```javascript
   const API_CONFIG = {
       getBaseURL() {
           if (window.location.hostname === 'localhost') {
               return 'http://localhost:5000/api';
           }
           // Replace with your deployed backend URL
           return 'https://your-backend.railway.app/api';
       }
   };
   ```

### Step 4: Deploy Frontend on Netlify

#### Method A: Connect GitHub Repository
1. Go to [Netlify](https://netlify.com)
2. Sign up/Login with GitHub
3. Click "New site from Git"
4. Choose GitHub → Select your repository
5. **Build Settings**:
   - **Base directory**: `/` (root)
   - **Build command**: `echo "Static site - no build needed"`
   - **Publish directory**: `/` (root)

#### Method B: Manual Deploy (Drag & Drop)
1. Create a zip of your frontend files:
   - `index.html`
   - `donor.html`
   - `admin.html`
   - `search.html`
   - `style.css`
   - `script.js`
   - `api-client.js`
   - `config.js`
   - `_redirects`
   - `netlify.toml`
2. Drag and drop the zip to Netlify deploy

### Step 5: Configure Netlify Settings

#### Environment Variables (if needed):
- Go to Site Settings → Environment Variables
- Add:
  ```
  REACT_APP_API_URL=https://your-backend.railway.app/api
  ```

#### Custom Domain (Optional):
- Go to Domain Management → Add custom domain
- Follow DNS setup instructions

---

## 🔧 Option 2: Full Serverless on Netlify

### Prerequisites:
1. **MongoDB Atlas** setup (free tier available)
2. **Basic understanding** of serverless functions

### Step 1: Migrate Backend to Netlify Functions
You'll need to convert your Express.js routes to individual Netlify Functions:

```javascript
// netlify/functions/auth.js
const mongoose = require('mongoose');

exports.handler = async (event, context) => {
    // Connect to MongoDB Atlas
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Handle different HTTP methods and routes
    if (event.path.includes('/auth/login') && event.httpMethod === 'POST') {
        // Login logic here
    }
    
    // Return response
    return {
        statusCode: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ success: true })
    };
};
```

### Step 2: Update netlify.toml
```toml
[build]
  functions = "netlify/functions"
  
[build.environment]
  NODE_VERSION = "18"
```

### Step 3: Deploy to Netlify
- Same process as Option 1, but Netlify will automatically handle your functions

---

## 🔐 Environment Variables Setup

### For MongoDB Atlas:
1. Create account at [MongoDB Atlas](https://cloud.mongodb.com)
2. Create free cluster
3. Get connection string
4. Add to your backend deployment environment variables

### Required Environment Variables:
```bash
# Backend Environment Variables
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/blood_donation_db
JWT_SECRET=your_super_secure_jwt_secret_minimum_32_characters
FRONTEND_URL=https://your-netlify-site.netlify.app
```

---

## 📋 Netlify Deployment Settings

### Build Settings:
- **Base directory**: `/` (leave empty)
- **Build command**: `echo "No build required for static site"`
- **Publish directory**: `/` (or leave empty)
- **Functions directory**: `netlify/functions` (if using Option 2)

### Redirects Configuration:
Your `_redirects` file handles:
- SPA routing for React-like navigation
- API proxying (if using Netlify Functions)
- Page routing for donor.html, admin.html, etc.

### Headers Configuration:
Your `netlify.toml` includes:
- Security headers (XSS protection, etc.)
- CORS headers for API requests
- Content type enforcement

---

## 🚀 Quick Deployment Checklist

### ✅ Pre-deployment:
- [ ] Code pushed to GitHub
- [ ] MongoDB Atlas database created
- [ ] Backend environment variables prepared
- [ ] Frontend config.js updated with production URLs

### ✅ Backend Deployment (Option 1):
- [ ] Backend deployed on Railway/Heroku
- [ ] Environment variables configured
- [ ] API health check working
- [ ] CORS configured for your Netlify domain

### ✅ Frontend Deployment:
- [ ] Netlify site created
- [ ] Repository connected (or manual upload)
- [ ] `_redirects` and `netlify.toml` in place
- [ ] API calls working with deployed backend

### ✅ Post-deployment:
- [ ] Test all functionality
- [ ] Check browser console for errors
- [ ] Verify API connectivity
- [ ] Test user registration/login
- [ ] Test emergency request system

---

## 🔧 Troubleshooting

### Common Issues:

#### CORS Errors:
- Ensure your backend has CORS configured for your Netlify domain
- Check FRONTEND_URL environment variable on backend

#### API Not Found (404):
- Verify backend URL in config.js
- Check if backend is running and accessible
- Test API health endpoint directly

#### Database Connection Issues:
- Verify MongoDB Atlas connection string
- Check IP whitelist in MongoDB Atlas (add 0.0.0.0/0 for Netlify)
- Ensure database user has proper permissions

#### Build Failures:
- Check build logs in Netlify dashboard
- Verify file paths and dependencies
- Ensure all required files are committed to Git

---

## 🌐 Production URLs

After deployment, you'll have:
- **Frontend**: `https://your-site-name.netlify.app`
- **Backend**: `https://your-backend.railway.app` (or your chosen platform)
- **Admin Panel**: `https://your-site-name.netlify.app/admin.html`
- **Donor Portal**: `https://your-site-name.netlify.app/donor.html`

---

## 📞 Support

If you encounter issues:
1. Check Netlify deploy logs
2. Check backend platform logs (Railway/Heroku)
3. Test API endpoints individually
4. Verify environment variables
5. Check browser console for frontend errors

**Happy Deploying! 🩸💻**