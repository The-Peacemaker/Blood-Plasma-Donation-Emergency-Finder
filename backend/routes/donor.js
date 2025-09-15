const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { User, EmergencyRequest, DonationHistory } = require('../models');
const { protect, authorize, checkDonorApproval } = require('../middleware/auth');

const router = express.Router();

// All routes are protected and require donor role
router.use(protect);
router.use(authorize('donor'));

// @desc    Get donor dashboard data
// @route   GET /api/donor/dashboard
// @access  Private (Donor)
router.get('/dashboard', checkDonorApproval, async (req, res, next) => {
  try {
    const donorId = req.user.id;

    // Get emergency requests matching donor's blood group and city
    const emergencyRequests = await EmergencyRequest.find({
      'patient.bloodGroup': req.user.medicalInfo.bloodGroup,
      'hospital.address.city': { $regex: req.user.address.city, $options: 'i' },
      status: 'active',
      'medical.requiredBy': { $gte: new Date() }
    })
    .populate('requester', 'name phone')
    .sort({ 'admin.priorityScore': -1, createdAt: -1 })
    .limit(10);

    // Get donor's donation history
    const donationHistory = await DonationHistory.find({ donor: donorId })
      .populate('emergencyRequest', 'patient.name hospital.name')
      .sort({ 'scheduling.actualDate': -1 })
      .limit(5);

    // Get donor's response history
    const myResponses = await EmergencyRequest.find({
      'responses.donor': donorId
    })
    .populate('requester', 'name phone')
    .sort({ createdAt: -1 })
    .limit(5);

    // Calculate donor stats
    const stats = {
      totalDonations: req.user.stats.totalDonations,
      lifetimeUnits: donationHistory.reduce((sum, donation) => sum + (donation.donation.units || 0), 0),
      responseCount: myResponses.length,
      lastDonationDate: req.user.medicalInfo.lastDonationDate,
      nextEligibleDate: req.user.medicalInfo.lastDonationDate ? 
        new Date(req.user.medicalInfo.lastDonationDate.getTime() + (56 * 24 * 60 * 60 * 1000)) : null,
      canDonateNow: req.user.canDonate()
    };

    res.status(200).json({
      success: true,
      data: {
        donor: req.user,
        emergencyRequests,
        donationHistory,
        myResponses,
        stats
      }
    });

  } catch (error) {
    next(error);
  }
});

// @desc    Update donor availability
// @route   PUT /api/donor/availability
// @access  Private (Donor)
router.put('/availability', checkDonorApproval, [
  body('isAvailable').isBoolean().withMessage('Availability must be true or false'),
  body('availableFrom').optional().isISO8601().withMessage('Available from must be a valid date'),
  body('preferredDonationTime').optional().isIn(['morning', 'afternoon', 'evening', 'any']).withMessage('Invalid preferred donation time')
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

    const { isAvailable, availableFrom, preferredDonationTime } = req.body;

    const updateData = { 'availability.isAvailable': isAvailable };
    
    if (availableFrom) updateData['availability.availableFrom'] = new Date(availableFrom);
    if (preferredDonationTime) updateData['availability.preferredDonationTime'] = preferredDonationTime;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      updateData,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Availability updated successfully',
      data: {
        availability: user.availability
      }
    });

  } catch (error) {
    next(error);
  }
});

// @desc    Get emergency requests for donor
// @route   GET /api/donor/emergency-requests
// @access  Private (Donor)
router.get('/emergency-requests', checkDonorApproval, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  query('urgency').optional().isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid urgency level'),
  query('radius').optional().isInt({ min: 1, max: 500 }).withMessage('Radius must be between 1 and 500 km')
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

    // Build query
    const query = {
      'patient.bloodGroup': req.user.medicalInfo.bloodGroup,
      status: 'active',
      'medical.requiredBy': { $gte: new Date() }
    };

    // Add urgency filter
    if (req.query.urgency) {
      query['medical.urgencyLevel'] = req.query.urgency;
    }

    // Add location filter (simplified - using city for now)
    query['hospital.address.city'] = { $regex: req.user.address.city, $options: 'i' };

    // Get emergency requests
    const emergencyRequests = await EmergencyRequest.find(query)
      .populate('requester', 'name phone email')
      .sort({ 'admin.priorityScore': -1, 'medical.urgencyLevel': -1, createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Get total count
    const total = await EmergencyRequest.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        emergencyRequests,
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

// @desc    Respond to emergency request
// @route   POST /api/donor/emergency-requests/:id/respond
// @access  Private (Donor)
router.post('/emergency-requests/:id/respond', checkDonorApproval, [
  body('responseType').isIn(['interested', 'confirmed']).withMessage('Response type must be interested or confirmed'),
  body('scheduledTime').optional().isISO8601().withMessage('Scheduled time must be a valid date'),
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

    const { responseType, scheduledTime, notes } = req.body;
    const emergencyRequestId = req.params.id;

    // Check if donor can donate
    if (!req.user.canDonate()) {
      return res.status(400).json({
        success: false,
        message: 'You are not eligible to donate at this time. Please check your last donation date.'
      });
    }

    // Find emergency request
    const emergencyRequest = await EmergencyRequest.findById(emergencyRequestId);

    if (!emergencyRequest) {
      return res.status(404).json({
        success: false,
        message: 'Emergency request not found'
      });
    }

    // Check if request is still active
    if (emergencyRequest.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'This emergency request is no longer active'
      });
    }

    // Check if request is expired
    if (emergencyRequest.isExpired()) {
      return res.status(400).json({
        success: false,
        message: 'This emergency request has expired'
      });
    }

    // Check blood group compatibility
    if (emergencyRequest.patient.bloodGroup !== req.user.medicalInfo.bloodGroup) {
      return res.status(400).json({
        success: false,
        message: 'Blood group mismatch'
      });
    }

    // Add or update donor response
    await emergencyRequest.addDonorResponse(
      req.user.id,
      responseType,
      scheduledTime ? new Date(scheduledTime) : null,
      notes
    );

    // Send real-time notification to admin and requester
    const io = req.app.get('io');
    if (io) {
      io.to('admin-room').emit('donor-response', {
        emergencyRequestId,
        donorId: req.user.id,
        donorName: req.user.name,
        responseType,
        timestamp: new Date()
      });

      io.to(`requester-${emergencyRequest.requester}`).emit('donor-response', {
        emergencyRequestId,
        donorName: req.user.name,
        responseType,
        timestamp: new Date()
      });
    }

    res.status(200).json({
      success: true,
      message: `Response recorded successfully. ${responseType === 'confirmed' ? 'Thank you for confirming your donation!' : 'Thank you for showing interest!'}`,
      data: {
        responseType,
        emergencyRequestId
      }
    });

  } catch (error) {
    next(error);
  }
});

// @desc    Get donor's donation history
// @route   GET /api/donor/donations
// @access  Private (Donor)
router.get('/donations', [
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

    const query = { donor: req.user.id };
    
    if (req.query.status) {
      query.status = req.query.status;
    }

    const donations = await DonationHistory.find(query)
      .populate('emergencyRequest', 'patient.name hospital.name medical.condition')
      .populate('recipient', 'name')
      .sort({ 'scheduling.actualDate': -1, 'scheduling.scheduledDate': -1 })
      .skip(skip)
      .limit(limit);

    const total = await DonationHistory.countDocuments(query);

    // Calculate donation statistics
    const stats = await DonationHistory.aggregate([
      { $match: { donor: req.user._id, status: 'completed' } },
      {
        $group: {
          _id: null,
          totalDonations: { $sum: 1 },
          totalUnits: { $sum: '$donation.units' },
          totalVolume: { $sum: '$donation.volume' },
          totalRewardPoints: { $sum: '$recognition.rewardPoints' }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        donations,
        stats: stats[0] || { totalDonations: 0, totalUnits: 0, totalVolume: 0, totalRewardPoints: 0 },
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

// @desc    Get donor's response history
// @route   GET /api/donor/responses
// @access  Private (Donor)
router.get('/responses', [
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

    const responses = await EmergencyRequest.find({
      'responses.donor': req.user.id
    })
    .populate('requester', 'name phone')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

    // Extract donor's specific response from each request
    const responseHistory = responses.map(request => {
      const myResponse = request.responses.find(r => r.donor.toString() === req.user.id.toString());
      return {
        emergencyRequest: {
          _id: request._id,
          patient: request.patient,
          hospital: request.hospital,
          medical: request.medical,
          status: request.status,
          requester: request.requester
        },
        response: myResponse,
        requestCreatedAt: request.createdAt
      };
    });

    const total = await EmergencyRequest.countDocuments({
      'responses.donor': req.user.id
    });

    res.status(200).json({
      success: true,
      data: {
        responses: responseHistory,
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

// @desc    Update donor medical information
// @route   PUT /api/donor/medical-info
// @access  Private (Donor)
router.put('/medical-info', [
  body('weight').optional().isFloat({ min: 50, max: 200 }).withMessage('Weight must be between 50 and 200 kg'),
  body('medicalConditions').optional().isArray().withMessage('Medical conditions must be an array'),
  body('medications').optional().isArray().withMessage('Medications must be an array'),
  body('lastDonationDate').optional().isISO8601().withMessage('Last donation date must be a valid date')
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

    const { weight, medicalConditions, medications, lastDonationDate } = req.body;

    const updateData = {};
    if (weight !== undefined) updateData['medicalInfo.weight'] = weight;
    if (medicalConditions !== undefined) updateData['medicalInfo.medicalConditions'] = medicalConditions;
    if (medications !== undefined) updateData['medicalInfo.medications'] = medications;
    if (lastDonationDate !== undefined) updateData['medicalInfo.lastDonationDate'] = new Date(lastDonationDate);

    const user = await User.findByIdAndUpdate(
      req.user.id,
      updateData,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Medical information updated successfully',
      data: {
        medicalInfo: user.medicalInfo
      }
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;
