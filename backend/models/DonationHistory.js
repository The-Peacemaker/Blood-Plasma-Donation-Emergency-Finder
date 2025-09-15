const mongoose = require('mongoose');

const donationHistorySchema = new mongoose.Schema({
  // Core Information
  donor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Donor is required']
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  emergencyRequest: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EmergencyRequest'
  },
  
  // Donation Details
  donation: {
    type: {
      type: String,
      enum: ['blood', 'plasma', 'platelets', 'red_cells', 'white_cells'],
      required: [true, 'Donation type is required']
    },
    units: {
      type: Number,
      required: [true, 'Number of units is required'],
      min: [1, 'At least 1 unit must be donated'],
      max: [10, 'Cannot donate more than 10 units']
    },
    volume: {
      type: Number, // in ml
      required: [true, 'Volume is required'],
      min: [100, 'Minimum volume is 100ml']
    },
    bloodGroup: {
      type: String,
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
      required: [true, 'Blood group is required']
    }
  },
  
  // Location & Timing
  location: {
    hospital: {
      name: {
        type: String,
        required: [true, 'Hospital name is required']
      },
      address: {
        street: String,
        city: {
          type: String,
          required: [true, 'City is required']
        },
        pincode: String
      },
      contactNumber: String
    },
    bloodBank: {
      name: String,
      licenseNumber: String,
      address: {
        street: String,
        city: String,
        pincode: String
      }
    }
  },
  
  // Medical Information
  medical: {
    preScreening: {
      hemoglobin: {
        type: Number,
        min: [12, 'Hemoglobin level too low'],
        max: [18, 'Hemoglobin level too high']
      },
      bloodPressure: {
        systolic: Number,
        diastolic: Number
      },
      pulse: Number,
      weight: Number,
      temperature: Number
    },
    postDonation: {
      complications: [{
        type: String
      }],
      recoveryNotes: String,
      followUpRequired: {
        type: Boolean,
        default: false
      }
    },
    testResults: {
      hiv: {
        type: String,
        enum: ['negative', 'positive', 'pending'],
        default: 'pending'
      },
      hepatitisB: {
        type: String,
        enum: ['negative', 'positive', 'pending'],
        default: 'pending'
      },
      hepatitisC: {
        type: String,
        enum: ['negative', 'positive', 'pending'],
        default: 'pending'
      },
      syphilis: {
        type: String,
        enum: ['negative', 'positive', 'pending'],
        default: 'pending'
      },
      malaria: {
        type: String,
        enum: ['negative', 'positive', 'pending'],
        default: 'pending'
      }
    }
  },
  
  // Status & Verification
  status: {
    type: String,
    enum: ['scheduled', 'in_progress', 'completed', 'cancelled', 'rejected'],
    default: 'scheduled'
  },
  verification: {
    donorVerified: {
      type: Boolean,
      default: false
    },
    recipientVerified: {
      type: Boolean,
      default: false
    },
    hospitalVerified: {
      type: Boolean,
      default: false
    },
    verificationCode: {
      type: String,
      unique: true,
      sparse: true
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    verifiedAt: Date
  },
  
  // Timing
  scheduling: {
    scheduledDate: {
      type: Date,
      required: [true, 'Scheduled date is required']
    },
    actualDate: Date,
    duration: Number, // in minutes
    arrivalTime: Date,
    completionTime: Date
  },
  
  // Documentation
  documentation: {
    consentForm: {
      signed: {
        type: Boolean,
        default: false
      },
      signedAt: Date,
      witnessSignature: String
    },
    medicalClearance: {
      cleared: {
        type: Boolean,
        default: false
      },
      clearedBy: String,
      clearedAt: Date,
      notes: String
    },
    certificates: [{
      type: {
        type: String,
        enum: ['donation_certificate', 'medical_report', 'test_results']
      },
      url: String,
      issuedAt: Date,
      issuedBy: String
    }]
  },
  
  // Recognition & Rewards
  recognition: {
    certificateIssued: {
      type: Boolean,
      default: false
    },
    rewardPoints: {
      type: Number,
      default: 0
    },
    specialRecognition: String,
    milestoneAchieved: String // e.g., "10th donation", "100ml milestone"
  },
  
  // Feedback
  feedback: {
    donorRating: {
      type: Number,
      min: 1,
      max: 5
    },
    donorComments: String,
    hospitalRating: {
      type: Number,
      min: 1,
      max: 5
    },
    hospitalComments: String,
    staffBehavior: {
      type: Number,
      min: 1,
      max: 5
    },
    facilityRating: {
      type: Number,
      min: 1,
      max: 5
    },
    overallExperience: {
      type: Number,
      min: 1,
      max: 5
    }
  },
  
  // Additional Information
  notes: {
    donorNotes: String,
    hospitalNotes: String,
    adminNotes: String
  },
  
  // Metadata
  metadata: {
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    source: {
      type: String,
      enum: ['emergency_request', 'walk_in', 'scheduled', 'camp'],
      default: 'emergency_request'
    },
    tags: [String]
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
donationHistorySchema.index({ donor: 1, 'scheduling.actualDate': -1 });
donationHistorySchema.index({ 'donation.bloodGroup': 1, 'location.hospital.address.city': 1 });
donationHistorySchema.index({ status: 1, 'scheduling.scheduledDate': 1 });
donationHistorySchema.index({ emergencyRequest: 1 });
donationHistorySchema.index({ 'verification.verificationCode': 1 });

// Virtual for next eligible donation date
donationHistorySchema.virtual('nextEligibleDate').get(function() {
  if (!this.scheduling.actualDate) return null;
  
  // Add 56 days (8 weeks) for whole blood donations
  const gapDays = this.donation.type === 'plasma' ? 14 : 56;
  const nextDate = new Date(this.scheduling.actualDate);
  nextDate.setDate(nextDate.getDate() + gapDays);
  
  return nextDate;
});

// Virtual for donation age (days since donation)
donationHistorySchema.virtual('donationAge').get(function() {
  if (!this.scheduling.actualDate) return null;
  
  const diffMs = Date.now() - this.scheduling.actualDate.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
});

// Virtual for total test results status
donationHistorySchema.virtual('allTestsCleared').get(function() {
  const tests = this.medical.testResults;
  return Object.values(tests).every(result => result === 'negative');
});

// Pre-save middleware to generate verification code
donationHistorySchema.pre('save', function(next) {
  if (this.isNew && !this.verification.verificationCode) {
    this.verification.verificationCode = 
      'DN' + Date.now().toString().slice(-6) + Math.random().toString(36).substr(2, 4).toUpperCase();
  }
  next();
});

// Method to calculate reward points
donationHistorySchema.methods.calculateRewardPoints = function() {
  let points = 0;
  
  // Base points for donation
  points += this.donation.units * 10;
  
  // Bonus for emergency donations
  if (this.metadata.source === 'emergency_request') points += 20;
  
  // Bonus for rare blood groups
  const rareGroups = ['AB-', 'B-', 'A-', 'O-'];
  if (rareGroups.includes(this.donation.bloodGroup)) points += 15;
  
  // Bonus for plasma donations
  if (this.donation.type === 'plasma') points += 5;
  
  this.recognition.rewardPoints = points;
  return points;
};

// Method to check if donation is verified
donationHistorySchema.methods.isFullyVerified = function() {
  return this.verification.donorVerified && 
         this.verification.hospitalVerified && 
         this.verification.verifiedBy;
};

// Method to update status with timestamp
donationHistorySchema.methods.updateStatus = function(newStatus, updatedBy) {
  this.status = newStatus;
  this.metadata.updatedBy = updatedBy;
  
  if (newStatus === 'completed' && !this.scheduling.actualDate) {
    this.scheduling.actualDate = new Date();
    this.scheduling.completionTime = new Date();
  }
  
  return this.save();
};

// Static method to get donation statistics
donationHistorySchema.statics.getDonationStats = function(filters = {}) {
  return this.aggregate([
    { $match: { status: 'completed', ...filters } },
    {
      $group: {
        _id: null,
        totalDonations: { $sum: 1 },
        totalUnits: { $sum: '$donation.units' },
        totalVolume: { $sum: '$donation.volume' },
        avgUnitsPerDonation: { $avg: '$donation.units' },
        bloodGroupDistribution: {
          $push: '$donation.bloodGroup'
        }
      }
    }
  ]);
};

// Static method to get donor leaderboard
donationHistorySchema.statics.getDonorLeaderboard = function(limit = 10) {
  return this.aggregate([
    { $match: { status: 'completed' } },
    {
      $group: {
        _id: '$donor',
        totalDonations: { $sum: 1 },
        totalUnits: { $sum: '$donation.units' },
        totalPoints: { $sum: '$recognition.rewardPoints' },
        lastDonation: { $max: '$scheduling.actualDate' }
      }
    },
    { $sort: { totalDonations: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'donorInfo'
      }
    },
    { $unwind: '$donorInfo' }
  ]);
};

const DonationHistory = mongoose.model('DonationHistory', donationHistorySchema);

module.exports = DonationHistory;
