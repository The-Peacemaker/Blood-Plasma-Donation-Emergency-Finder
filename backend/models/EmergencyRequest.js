const mongoose = require('mongoose');

const emergencyRequestSchema = new mongoose.Schema({
  // Request Information
  requester: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Requester is required']
  },
  
  // Patient Information
  patient: {
    name: {
      type: String,
      required: [true, 'Patient name is required'],
      trim: true
    },
    age: {
      type: Number,
      required: [true, 'Patient age is required'],
      min: [0, 'Age cannot be negative'],
      max: [120, 'Age cannot exceed 120']
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
      required: [true, 'Patient gender is required']
    },
    bloodGroup: {
      type: String,
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
      required: [true, 'Blood group is required']
    },
    contactNumber: {
      type: String,
      required: [true, 'Contact number is required'],
      match: [/^[0-9]{10}$/, 'Please enter a valid 10-digit phone number']
    },
    alternateContact: {
      type: String,
      match: [/^[0-9]{10}$/, 'Please enter a valid 10-digit phone number']
    }
  },
  
  // Medical Details
  medical: {
    condition: {
      type: String,
      required: [true, 'Medical condition is required'],
      trim: true
    },
    urgencyLevel: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      required: [true, 'Urgency level is required']
    },
    unitsRequired: {
      type: Number,
      required: [true, 'Units required is needed'],
      min: [1, 'At least 1 unit is required'],
      max: [10, 'Cannot request more than 10 units']
    },
    requiredBy: {
      type: Date,
      required: [true, 'Required by date is needed'],
      validate: {
        validator: function(date) {
          return date >= new Date();
        },
        message: 'Required by date must be in the future'
      }
    },
    additionalNotes: {
      type: String,
      maxlength: [500, 'Additional notes cannot exceed 500 characters']
    }
  },
  
  // Hospital Information
  hospital: {
    name: {
      type: String,
      required: [true, 'Hospital name is required'],
      trim: true
    },
    address: {
      street: String,
      city: {
        type: String,
        required: [true, 'Hospital city is required']
      },
      pincode: {
        type: String,
        match: [/^[0-9]{6}$/, 'Please enter a valid 6-digit pincode']
      }
    },
    coordinates: {
      latitude: Number,
      longitude: Number
    },
    contactNumber: {
      type: String,
      required: [true, 'Hospital contact number is required'],
      match: [/^[0-9]{10}$/, 'Please enter a valid 10-digit phone number']
    },
    doctorName: {
      type: String,
      required: [true, 'Doctor name is required'],
      trim: true
    }
  },
  
  // Request Status
  status: {
    type: String,
    enum: ['active', 'partially_fulfilled', 'fulfilled', 'expired', 'cancelled'],
    default: 'active'
  },
  
  // Responses from Donors
  responses: [{
    donor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    responseType: {
      type: String,
      enum: ['interested', 'confirmed', 'completed', 'cancelled'],
      default: 'interested'
    },
    responseDate: {
      type: Date,
      default: Date.now
    },
    scheduledTime: Date,
    notes: String,
    verificationCode: {
      type: String,
      unique: true,
      sparse: true
    }
  }],
  
  // Fulfillment Details
  fulfillment: {
    unitsFulfilled: {
      type: Number,
      default: 0
    },
    completedDonations: [{
      donor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      units: Number,
      donationDate: Date,
      verificationCode: String,
      status: {
        type: String,
        enum: ['verified', 'pending', 'rejected'],
        default: 'pending'
      }
    }],
    fulfilledDate: Date
  },
  
  // Visibility & Reach
  visibility: {
    isPublic: {
      type: Boolean,
      default: true
    },
    targetCities: [{
      type: String
    }],
    maxRadius: {
      type: Number,
      default: 50, // in kilometers
      min: [1, 'Radius must be at least 1 km'],
      max: [500, 'Radius cannot exceed 500 km']
    }
  },
  
  // Administrative
  admin: {
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reviewDate: Date,
    adminNotes: String,
    priorityScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    }
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    default: function() {
      // Expire after 30 days if not specified
      return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
emergencyRequestSchema.index({ 'patient.bloodGroup': 1, 'hospital.address.city': 1, status: 1 });
emergencyRequestSchema.index({ 'medical.urgencyLevel': 1, createdAt: -1 });
emergencyRequestSchema.index({ status: 1, 'medical.requiredBy': 1 });
emergencyRequestSchema.index({ 'hospital.coordinates': '2dsphere' });
emergencyRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Virtual for time remaining
emergencyRequestSchema.virtual('timeRemaining').get(function() {
  const now = new Date();
  const required = new Date(this.medical.requiredBy);
  const diffMs = required.getTime() - now.getTime();
  
  if (diffMs <= 0) return 'Expired';
  
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h`;
});

// Virtual for fulfillment percentage
emergencyRequestSchema.virtual('fulfillmentPercentage').get(function() {
  if (this.medical.unitsRequired === 0) return 0;
  return Math.round((this.fulfillment.unitsFulfilled / this.medical.unitsRequired) * 100);
});

// Virtual for response count
emergencyRequestSchema.virtual('responseCount').get(function() {
  return this.responses.length;
});

// Pre-save middleware to calculate priority score
emergencyRequestSchema.pre('save', function(next) {
  if (this.isModified('medical.urgencyLevel') || this.isNew) {
    let score = 0;
    
    // Urgency level scoring
    const urgencyScores = { critical: 40, high: 30, medium: 20, low: 10 };
    score += urgencyScores[this.medical.urgencyLevel] || 0;
    
    // Time sensitivity scoring
    const hoursRemaining = (this.medical.requiredBy - Date.now()) / (1000 * 60 * 60);
    if (hoursRemaining <= 6) score += 30;
    else if (hoursRemaining <= 24) score += 20;
    else if (hoursRemaining <= 72) score += 10;
    
    // Units required scoring
    if (this.medical.unitsRequired >= 5) score += 20;
    else if (this.medical.unitsRequired >= 3) score += 10;
    
    // Blood group rarity scoring
    const rareGroups = ['AB-', 'AB+', 'B-', 'A-', 'O-'];
    if (rareGroups.includes(this.patient.bloodGroup)) score += 10;
    
    this.admin.priorityScore = Math.min(score, 100);
  }
  next();
});

// Method to check if request is expired
emergencyRequestSchema.methods.isExpired = function() {
  return new Date() > this.medical.requiredBy || new Date() > this.expiresAt;
};

// Method to check if request is fulfilled
emergencyRequestSchema.methods.isFulfilled = function() {
  return this.fulfillment.unitsFulfilled >= this.medical.unitsRequired;
};

// Method to add donor response
emergencyRequestSchema.methods.addDonorResponse = function(donorId, responseType, scheduledTime, notes) {
  // Check if donor already responded
  const existingResponse = this.responses.find(r => r.donor.toString() === donorId.toString());
  
  if (existingResponse) {
    existingResponse.responseType = responseType;
    existingResponse.responseDate = new Date();
    if (scheduledTime) existingResponse.scheduledTime = scheduledTime;
    if (notes) existingResponse.notes = notes;
  } else {
    this.responses.push({
      donor: donorId,
      responseType,
      responseDate: new Date(),
      scheduledTime,
      notes,
      verificationCode: Math.random().toString(36).substr(2, 8).toUpperCase()
    });
  }
  
  return this.save();
};

const EmergencyRequest = mongoose.model('EmergencyRequest', emergencyRequestSchema);

module.exports = EmergencyRequest;
