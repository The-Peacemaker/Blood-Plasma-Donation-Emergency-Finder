#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🩸 BloodFinder Backend Setup Script');
console.log('====================================\n');

async function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function setup() {
  try {
    // Check if .env already exists
    if (fs.existsSync('.env')) {
      const overwrite = await question('.env file already exists. Overwrite? (y/N): ');
      if (overwrite.toLowerCase() !== 'y') {
        console.log('Setup cancelled.');
        rl.close();
        return;
      }
    }

    console.log('Setting up your BloodFinder backend...\n');

    // Get configuration from user
    const port = await question('Enter server port (default: 5000): ') || '5000';
    const mongoUri = await question('Enter MongoDB URI (default: mongodb://localhost:27017/blood_donation_db): ') 
      || 'mongodb://localhost:27017/blood_donation_db';
    
    console.log('\n🔐 JWT Configuration');
    const jwtSecret = await question('Enter JWT secret (or press Enter to generate): ') 
      || generateRandomSecret();
    
    console.log('\n🌐 Frontend Configuration');
    const frontendUrl = await question('Enter frontend URL (default: http://localhost:3000): ') 
      || 'http://localhost:3000';

    // Create .env file
    const envContent = `# BloodFinder Backend Environment Configuration

# Server Configuration
PORT=${port}
NODE_ENV=development

# Database Configuration
MONGODB_URI=${mongoUri}

# JWT Configuration
JWT_SECRET=${jwtSecret}
JWT_EXPIRES_IN=7d

# Frontend URL (for CORS)
FRONTEND_URL=${frontendUrl}

# Rate Limiting Configuration
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100

# Email Configuration (optional)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=
EMAIL_PASS=

# Admin Configuration
ADMIN_EMAIL=admin@bloodfinder.com
ADMIN_PASSWORD=Admin123!@#
`;

    fs.writeFileSync('.env', envContent);
    console.log('✅ Environment file created successfully!\n');

    // Install dependencies
    console.log('📦 Installing dependencies...');
    await executeCommand('npm install');
    console.log('✅ Dependencies installed successfully!\n');

    // Test database connection
    console.log('🔍 Testing database connection...');
    try {
      await executeCommand('node -e "require(\'./models\'); console.log(\'Database connection test passed\')"');
      console.log('✅ Database connection successful!\n');
    } catch (error) {
      console.log('⚠️ Database connection failed. Please check your MongoDB installation.\n');
    }

    // Create uploads directory
    if (!fs.existsSync('uploads')) {
      fs.mkdirSync('uploads');
      console.log('✅ Uploads directory created!\n');
    }

    // Create logs directory
    if (!fs.existsSync('logs')) {
      fs.mkdirSync('logs');
      console.log('✅ Logs directory created!\n');
    }

    console.log('🎉 Setup completed successfully!\n');
    console.log('📋 Next steps:');
    console.log('1. Start MongoDB: sudo systemctl start mongod');
    console.log('2. Start the server: npm run dev');
    console.log('3. Test the API: npm test');
    console.log('4. Visit: http://localhost:' + port + '/api/health\n');

    const startNow = await question('Start the server now? (y/N): ');
    if (startNow.toLowerCase() === 'y') {
      console.log('\n🚀 Starting BloodFinder backend server...\n');
      exec('npm run dev', (error, stdout, stderr) => {
        if (error) {
          console.error('Error starting server:', error);
          return;
        }
        console.log(stdout);
        if (stderr) console.error(stderr);
      });
    }

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
  } finally {
    rl.close();
  }
}

function generateRandomSecret() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let result = '';
  for (let i = 0; i < 64; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

function executeCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(stdout);
    });
  });
}

// Run setup if this file is executed directly
if (require.main === module) {
  setup();
}

module.exports = { setup };
