const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false // Don't include password in queries by default
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    match: [/^[0-9]{10}$/, 'Please enter a valid 10-digit phone number']
  },
  
  // Role & Status
  role: {
    type: String,
    enum: ['donor', 'recipient', 'admin'],
    default: 'donor'
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'suspended'],
    default: 'pending'
  },
  
  // Location Information
  address: {
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true
    },
    area: {
      type: String,
      required: [true, 'Area is required'],
      trim: true
    },
    pincode: {
      type: String,
      match: [/^[0-9]{6}$/, 'Please enter a valid 6-digit pincode']
    },
    coordinates: {
      latitude: { type: Number },
      longitude: { type: Number }
    }
  },
  
  // Medical Information (for donors)
  medicalInfo: {
    bloodGroup: {
      type: String,
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
      required: function() { return this.role === 'donor'; }
    },
    dateOfBirth: {
      type: Date,
      required: function() { return this.role === 'donor'; },
      validate: {
        validator: function(date) {
          if (this.role !== 'donor') return true;
          const age = Math.floor((Date.now() - date.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
          return age >= 18 && age <= 65;
        },
        message: 'Donor must be between 18 and 65 years old'
      }
    },
    weight: {
      type: Number,
      required: function() { return this.role === 'donor'; },
      min: [50, 'Weight must be at least 50 kg'],
      max: [200, 'Weight cannot exceed 200 kg']
    },
    lastDonationDate: {
      type: Date
    },
    medicalConditions: [{
      type: String
    }],
    medications: [{
      type: String
    }]
  },
  
  // Availability (for donors)
  availability: {
    isAvailable: {
      type: Boolean,
      default: true
    },
    availableFrom: {
      type: Date,
      default: Date.now
    },
    preferredDonationTime: {
      type: String,
      enum: ['morning', 'afternoon', 'evening', 'any'],
      default: 'any'
    }
  },
  
  // Verification
  verification: {
    isEmailVerified: {
      type: Boolean,
      default: false
    },
    isPhoneVerified: {
      type: Boolean,
      default: false
    },
    documentsUploaded: {
      type: Boolean,
      default: false
    },
    verificationDate: Date,
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  
  // Statistics
  stats: {
    totalDonations: {
      type: Number,
      default: 0
    },
    totalRequests: {
      type: Number,
      default: 0
    },
    lastActive: {
      type: Date,
      default: Date.now
    },
    joinDate: {
      type: Date,
      default: Date.now
    }
  },
  
  // Profile Image
  profileImage: {
    type: String,
    default: ''
  },
  
  // Notification Preferences
  notifications: {
    emailNotifications: {
      type: Boolean,
      default: true
    },
    smsNotifications: {
      type: Boolean,
      default: true
    },
    emergencyAlerts: {
      type: Boolean,
      default: true
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
userSchema.index({ email: 1 });
userSchema.index({ 'address.city': 1, 'medicalInfo.bloodGroup': 1 });
userSchema.index({ role: 1, status: 1 });
userSchema.index({ 'availability.isAvailable': 1 });

// Virtual for age calculation
userSchema.virtual('age').get(function() {
  if (!this.medicalInfo.dateOfBirth) return null;
  return Math.floor((Date.now() - this.medicalInfo.dateOfBirth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
});

// Virtual for full address
userSchema.virtual('fullAddress').get(function() {
  return `${this.address.area}, ${this.address.city}${this.address.pincode ? ` - ${this.address.pincode}` : ''}`;
});

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(parseInt(process.env.BCRYPT_ROUNDS) || 12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to check if user can donate
userSchema.methods.canDonate = function() {
  if (this.role !== 'donor' || !this.availability.isAvailable) return false;
  
  // Check if enough time has passed since last donation (56 days for men, 84 days for women)
  if (this.medicalInfo.lastDonationDate) {
    const daysSinceLastDonation = Math.floor((Date.now() - this.medicalInfo.lastDonationDate.getTime()) / (24 * 60 * 60 * 1000));
    const requiredGap = 56; // Simplified - you can add gender logic here
    return daysSinceLastDonation >= requiredGap;
  }
  
  return true;
};

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to update last active
userSchema.methods.updateLastActive = function() {
  this.stats.lastActive = new Date();
  return this.save();
};

const User = mongoose.model('User', userSchema);

module.exports = User;
