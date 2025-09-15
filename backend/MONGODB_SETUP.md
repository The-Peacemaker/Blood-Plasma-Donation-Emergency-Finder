# MongoDB Atlas Setup Guide

## 🌟 MongoDB Atlas (Cloud Database) - Recommended for Beginners

### Step 1: Create Atlas Account
1. Go to: https://www.mongodb.com/atlas
2. Click "Try Free"
3. Sign up with email or Google account

### Step 2: Create Cluster
1. Choose "M0 Sandbox" (Free tier)
2. Select "AWS" as cloud provider
3. Choose nearest region (e.g., "Mumbai" for India)
4. Name your cluster (e.g., "bloodfinder-cluster")
5. Click "Create Cluster"

### Step 3: Database Access
1. Go to "Database Access" in left sidebar
2. Click "Add New Database User"
3. Choose "Password" authentication
4. Username: `bloodfinder_user`
5. Password: Generate secure password or use: `BloodFinder2025!`
6. Database User Privileges: "Read and write to any database"
7. Click "Add User"

### Step 4: Network Access
1. Go to "Network Access" in left sidebar
2. Click "Add IP Address"
3. Click "Allow Access from Anywhere" (for development)
4. Or add your current IP address
5. Click "Confirm"

### Step 5: Get Connection String
1. Go to "Clusters" (Database Deployments)
2. Click "Connect" on your cluster
3. Choose "Connect your application"
4. Select "Node.js" and version "4.1 or later"
5. Copy the connection string

### Step 6: Connection String Format
Your connection string will look like:
```
mongodb+srv://bloodfinder_user:<password>@bloodfinder-cluster.xxxxx.mongodb.net/blood_donation_db?retryWrites=true&w=majority
```

Replace `<password>` with your actual password.

## 🏠 Local MongoDB Installation (Alternative)

### For Windows:
1. Download from: https://www.mongodb.com/try/download/community
2. Install as Windows Service
3. Default connection: `mongodb://localhost:27017/blood_donation_db`

### For MongoDB Compass (GUI):
1. Download MongoDB Compass: https://www.mongodb.com/try/download/compass
2. Connect using your connection string
3. Create database: `blood_donation_db`

## 🐳 Docker Option (Advanced)

```bash
# Pull MongoDB image
docker pull mongo

# Run MongoDB container
docker run -d -p 27017:27017 --name mongodb-bloodfinder mongo

# Connection string: mongodb://localhost:27017/blood_donation_db
```

## ✅ Testing Your Connection

After setup, test with:
```bash
npm run setup
```

Or manually create `.env` file with your MongoDB URI.
