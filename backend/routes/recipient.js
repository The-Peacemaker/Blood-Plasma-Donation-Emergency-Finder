const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { User, EmergencyRequest, DonationHistory } = require('../models');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// All routes are protected and require recipient role
router.use(protect);
router.use(authorize('recipient'));

// @desc    Get recipient dashboard data
// @route   GET /api/recipient/dashboard
// @access  Private (Recipient)
router.get('/dashboard', async (req, res, next) => {
  try {
    const recipientId = req.user.id;

    // Get recipient's emergency requests
    const emergencyRequests = await EmergencyRequest.find({ requester: recipientId })
      .sort({ createdAt: -1 })
      .limit(10);

    // Get recent donations received
    const donationsReceived = await DonationHistory.find({ recipient: recipientId })
      .populate('donor', 'name phone email medicalInfo.bloodGroup')
      .populate('emergencyRequest', 'patient.name medical.condition')
      .sort({ 'scheduling.actualDate': -1 })
      .limit(5);

    // Calculate statistics
    const stats = {
      totalRequests: await EmergencyRequest.countDocuments({ requester: recipientId }),
      activeRequests: await EmergencyRequest.countDocuments({ 
        requester: recipientId, 
        status: 'active' 
      }),
      completedRequests: await EmergencyRequest.countDocuments({ 
        requester: recipientId, 
        status: 'completed' 
      }),
      totalDonationsReceived: await DonationHistory.countDocuments({ 
        recipient: recipientId, 
        status: 'completed' 
      })
    };

    res.status(200).json({
      success: true,
      data: {
        recipient: req.user,
        emergencyRequests,
        donationsReceived,
        stats
      }
    });

  } catch (error) {
    next(error);
  }
});

// @desc    Search for available donors
// @route   GET /api/recipient/donors/search
// @access  Private (Recipient)
router.get('/donors/search', [
  query('bloodGroup').isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).withMessage('Invalid blood group'),
  query('city').optional().isLength({ min: 2 }).withMessage('City must be at least 2 characters'),
  query('radius').optional().isInt({ min: 1, max: 500 }).withMessage('Radius must be between 1 and 500 km'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { bloodGroup, city, radius } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Build search query
    const searchQuery = {
      role: 'donor',
      'admin.isApproved': true,
      'availability.isAvailable': true,
      'medicalInfo.bloodGroup': bloodGroup
    };

    // Add location filter
    if (city) {
      searchQuery['address.city'] = { $regex: city, $options: 'i' };
    } else if (req.user.address && req.user.address.city) {
      // Default to recipient's city if no city specified
      searchQuery['address.city'] = { $regex: req.user.address.city, $options: 'i' };
    }

    // Find eligible donors
    const donors = await User.find(searchQuery)
      .select('name phone email medicalInfo.bloodGroup address availability stats.totalDonations medicalInfo.lastDonationDate')
      .sort({ 'stats.totalDonations': -1, 'medicalInfo.lastDonationDate': 1 })
      .skip(skip)
      .limit(limit);

    // Filter donors who can donate now
    const availableDonors = donors.filter(donor => donor.canDonate());

    const total = await User.countDocuments(searchQuery);

    res.status(200).json({
      success: true,
      data: {
        donors: availableDonors,
        searchCriteria: { bloodGroup, city, radius },
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total: availableDonors.length,
          totalInDatabase: total,
          limit
        }
      }
    });

  } catch (error) {
    next(error);
  }
});

// @desc    Submit emergency blood request
// @route   POST /api/recipient/emergency-request
// @access  Private (Recipient)
router.post('/emergency-request', [
  // Patient information validation
  body('patient.name').isLength({ min: 2, max: 100 }).withMessage('Patient name must be 2-100 characters'),
  body('patient.age').isInt({ min: 1, max: 120 }).withMessage('Patient age must be between 1 and 120'),
  body('patient.bloodGroup').isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).withMessage('Invalid blood group'),
  body('patient.gender').isIn(['male', 'female', 'other']).withMessage('Invalid gender'),
  body('patient.relationship').isIn(['self', 'family', 'friend', 'other']).withMessage('Invalid relationship'),

  // Medical information validation
  body('medical.condition').isLength({ min: 5, max: 500 }).withMessage('Medical condition description must be 5-500 characters'),
  body('medical.urgencyLevel').isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid urgency level'),
  body('medical.requiredBy').isISO8601().withMessage('Required by date must be valid'),
  body('medical.unitsNeeded').isInt({ min: 1, max: 10 }).withMessage('Units needed must be between 1 and 10'),
  body('medical.bloodType').isIn(['whole_blood', 'platelets', 'plasma', 'red_cells']).withMessage('Invalid blood type'),

  // Hospital information validation
  body('hospital.name').isLength({ min: 2, max: 200 }).withMessage('Hospital name must be 2-200 characters'),
  body('hospital.address.street').isLength({ min: 5, max: 200 }).withMessage('Hospital street address must be 5-200 characters'),
  body('hospital.address.city').isLength({ min: 2, max: 100 }).withMessage('Hospital city must be 2-100 characters'),
  body('hospital.address.state').isLength({ min: 2, max: 100 }).withMessage('Hospital state must be 2-100 characters'),
  body('hospital.address.pincode').isLength({ min: 6, max: 6 }).withMessage('Hospital pincode must be 6 digits'),
  body('hospital.contactNumber').isMobilePhone('en-IN').withMessage('Invalid hospital contact number'),

  // Optional fields validation
  body('notes').optional().isLength({ max: 1000 }).withMessage('Notes cannot exceed 1000 characters')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const emergencyRequestData = {
      ...req.body,
      requester: req.user.id,
      requesterInfo: {
        name: req.user.name,
        phone: req.user.phone,
        email: req.user.email
      },
      medical: {
        ...req.body.medical,
        requiredBy: new Date(req.body.medical.requiredBy)
      },
      admin: {
        priorityScore: calculatePriorityScore(req.body.medical.urgencyLevel, req.body.medical.requiredBy)
      }
    };

    const emergencyRequest = await EmergencyRequest.create(emergencyRequestData);

    // Populate the created request for response
    await emergencyRequest.populate('requester', 'name phone email');

    // Send real-time notification to admin
    const io = req.app.get('io');
    if (io) {
      io.to('admin-room').emit('new-emergency-request', {
        requestId: emergencyRequest._id,
        patient: emergencyRequest.patient,
        medical: emergencyRequest.medical,
        hospital: emergencyRequest.hospital,
        requester: emergencyRequest.requester,
        timestamp: emergencyRequest.createdAt
      });

      // Notify eligible donors in the same city
      const eligibleDonors = await User.find({
        role: 'donor',
        'admin.isApproved': true,
        'availability.isAvailable': true,
        'medicalInfo.bloodGroup': emergencyRequest.patient.bloodGroup,
        'address.city': { $regex: emergencyRequest.hospital.address.city, $options: 'i' }
      }).select('_id');

      eligibleDonors.forEach(donor => {
        io.to(`donor-${donor._id}`).emit('new-emergency-request', {
          requestId: emergencyRequest._id,
          patient: emergencyRequest.patient,
          medical: emergencyRequest.medical,
          hospital: emergencyRequest.hospital,
          timestamp: emergencyRequest.createdAt
        });
      });
    }

    res.status(201).json({
      success: true,
      message: 'Emergency request submitted successfully. Eligible donors will be notified.',
      data: {
        emergencyRequest
      }
    });

  } catch (error) {
    next(error);
  }
});

// Helper function to calculate priority score
function calculatePriorityScore(urgencyLevel, requiredBy) {
  const urgencyScores = { critical: 100, high: 75, medium: 50, low: 25 };
  const baseScore = urgencyScores[urgencyLevel] || 25;
  
  // Add time-based urgency
  const hoursUntilRequired = (new Date(requiredBy) - new Date()) / (1000 * 60 * 60);
  let timeScore = 0;
  
  if (hoursUntilRequired <= 2) timeScore = 50;
  else if (hoursUntilRequired <= 6) timeScore = 30;
  else if (hoursUntilRequired <= 24) timeScore = 15;
  else if (hoursUntilRequired <= 72) timeScore = 5;
  
  return Math.min(baseScore + timeScore, 150);
}

// @desc    Get recipient's emergency requests
// @route   GET /api/recipient/emergency-requests
// @access  Private (Recipient)
router.get('/emergency-requests', [
  query('status').optional().isIn(['active', 'completed', 'expired', 'cancelled']).withMessage('Invalid status'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const query = { requester: req.user.id };
    if (req.query.status) {
      query.status = req.query.status;
    }

    const emergencyRequests = await EmergencyRequest.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await EmergencyRequest.countDocuments(query);

    // Add response statistics for each request
    const requestsWithStats = emergencyRequests.map(request => {
      const requestObj = request.toObject();
      requestObj.responseStats = {
        totalResponses: request.responses.length,
        interestedCount: request.responses.filter(r => r.responseType === 'interested').length,
        confirmedCount: request.responses.filter(r => r.responseType === 'confirmed').length
      };
      return requestObj;
    });

    res.status(200).json({
      success: true,
      data: {
        emergencyRequests: requestsWithStats,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total,
          limit
        }
      }
    });

  } catch (error) {
    next(error);
  }
});

// @desc    Get specific emergency request with donor responses
// @route   GET /api/recipient/emergency-requests/:id
// @access  Private (Recipient)
router.get('/emergency-requests/:id', async (req, res, next) => {
  try {
    const emergencyRequest = await EmergencyRequest.findOne({
      _id: req.params.id,
      requester: req.user.id
    }).populate('responses.donor', 'name phone email medicalInfo.bloodGroup stats.totalDonations');

    if (!emergencyRequest) {
      return res.status(404).json({
        success: false,
        message: 'Emergency request not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        emergencyRequest
      }
    });

  } catch (error) {
    next(error);
  }
});

// @desc    Update emergency request status
// @route   PUT /api/recipient/emergency-requests/:id/status
// @access  Private (Recipient)
router.put('/emergency-requests/:id/status', [
  body('status').isIn(['active', 'completed', 'cancelled']).withMessage('Invalid status'),
  body('completionNotes').optional().isLength({ max: 500 }).withMessage('Completion notes cannot exceed 500 characters')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { status, completionNotes } = req.body;

    const emergencyRequest = await EmergencyRequest.findOne({
      _id: req.params.id,
      requester: req.user.id
    });

    if (!emergencyRequest) {
      return res.status(404).json({
        success: false,
        message: 'Emergency request not found'
      });
    }

    // Update status
    emergencyRequest.status = status;
    if (completionNotes) {
      emergencyRequest.notes = completionNotes;
    }

    if (status === 'completed') {
      emergencyRequest.admin.completedAt = new Date();
    }

    await emergencyRequest.save();

    // Send real-time notification
    const io = req.app.get('io');
    if (io) {
      io.to('admin-room').emit('request-status-updated', {
        requestId: emergencyRequest._id,
        status,
        timestamp: new Date()
      });

      // Notify donors who responded
      emergencyRequest.responses.forEach(response => {
        io.to(`donor-${response.donor}`).emit('request-status-updated', {
          requestId: emergencyRequest._id,
          status,
          patientName: emergencyRequest.patient.name,
          timestamp: new Date()
        });
      });
    }

    res.status(200).json({
      success: true,
      message: `Emergency request ${status} successfully`,
      data: {
        emergencyRequest
      }
    });

  } catch (error) {
    next(error);
  }
});

// @desc    Select donor for emergency request
// @route   POST /api/recipient/emergency-requests/:id/select-donor
// @access  Private (Recipient)
router.post('/emergency-requests/:id/select-donor', [
  body('donorId').isMongoId().withMessage('Invalid donor ID'),
  body('scheduledDate').isISO8601().withMessage('Scheduled date must be valid'),
  body('notes').optional().isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { donorId, scheduledDate, notes } = req.body;

    const emergencyRequest = await EmergencyRequest.findOne({
      _id: req.params.id,
      requester: req.user.id
    });

    if (!emergencyRequest) {
      return res.status(404).json({
        success: false,
        message: 'Emergency request not found'
      });
    }

    // Check if donor responded to this request
    const donorResponse = emergencyRequest.responses.find(
      r => r.donor.toString() === donorId
    );

    if (!donorResponse) {
      return res.status(400).json({
        success: false,
        message: 'Selected donor has not responded to this request'
      });
    }

    // Verify donor is still eligible
    const donor = await User.findById(donorId);
    if (!donor || !donor.canDonate()) {
      return res.status(400).json({
        success: false,
        message: 'Selected donor is not eligible to donate'
      });
    }

    // Create donation history record
    const donationHistory = await DonationHistory.create({
      donor: donorId,
      recipient: req.user.id,
      emergencyRequest: emergencyRequest._id,
      scheduling: {
        scheduledDate: new Date(scheduledDate),
        location: emergencyRequest.hospital
      },
      donation: {
        type: emergencyRequest.medical.bloodType,
        units: emergencyRequest.medical.unitsNeeded
      },
      status: 'scheduled',
      notes
    });

    // Update emergency request status
    emergencyRequest.admin.selectedDonor = donorId;
    await emergencyRequest.save();

    // Send notifications
    const io = req.app.get('io');
    if (io) {
      // Notify selected donor
      io.to(`donor-${donorId}`).emit('donation-scheduled', {
        emergencyRequestId: emergencyRequest._id,
        donationId: donationHistory._id,
        scheduledDate: new Date(scheduledDate),
        hospital: emergencyRequest.hospital,
        patient: emergencyRequest.patient,
        timestamp: new Date()
      });

      // Notify admin
      io.to('admin-room').emit('donation-scheduled', {
        emergencyRequestId: emergencyRequest._id,
        donorId,
        recipientId: req.user.id,
        scheduledDate: new Date(scheduledDate),
        timestamp: new Date()
      });
    }

    res.status(200).json({
      success: true,
      message: 'Donor selected and donation scheduled successfully',
      data: {
        donationHistory,
        emergencyRequest
      }
    });

  } catch (error) {
    next(error);
  }
});

// @desc    Get recipient's donation history (received donations)
// @route   GET /api/recipient/donations-received
// @access  Private (Recipient)
router.get('/donations-received', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  query('status').optional().isIn(['scheduled', 'completed', 'cancelled']).withMessage('Invalid status')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const query = { recipient: req.user.id };
    if (req.query.status) {
      query.status = req.query.status;
    }

    const donations = await DonationHistory.find(query)
      .populate('donor', 'name phone email medicalInfo.bloodGroup stats.totalDonations')
      .populate('emergencyRequest', 'patient.name medical.condition')
      .sort({ 'scheduling.actualDate': -1, 'scheduling.scheduledDate': -1 })
      .skip(skip)
      .limit(limit);

    const total = await DonationHistory.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        donations,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total,
          limit
        }
      }
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;
