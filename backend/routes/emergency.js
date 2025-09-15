const express = require('express');
const { body, validationResult } = require('express-validator');
const { EmergencyRequest, User } = require('../models');
const { protect } = require('../middleware/auth');

const router = express.Router();

// @desc    Get all active emergency requests (public endpoint for emergency services)
// @route   GET /api/emergency/active
// @access  Public (limited info)
router.get('/active', async (req, res, next) => {
  try {
    const activeRequests = await EmergencyRequest.find({
      status: 'active',
      'medical.requiredBy': { $gte: new Date() }
    })
    .select('patient.bloodGroup medical.urgencyLevel hospital.name hospital.address.city createdAt')
    .sort({ 'admin.priorityScore': -1 })
    .limit(50);

    const summary = await EmergencyRequest.aggregate([
      {
        $match: {
          status: 'active',
          'medical.requiredBy': { $gte: new Date() }
        }
      },
      {
        $group: {
          _id: {
            bloodGroup: '$patient.bloodGroup',
            urgency: '$medical.urgencyLevel'
          },
          count: { $sum: 1 }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        activeRequests,
        summary,
        totalActive: activeRequests.length,
        lastUpdated: new Date()
      }
    });

  } catch (error) {
    next(error);
  }
});

// @desc    Emergency alert broadcast
// @route   POST /api/emergency/broadcast
// @access  Private (Admin or Emergency Services)
router.post('/broadcast', protect, [
  body('bloodGroup').isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).withMessage('Invalid blood group'),
  body('urgencyLevel').isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid urgency level'),
  body('city').isLength({ min: 2 }).withMessage('City must be at least 2 characters'),
  body('message').isLength({ min: 10, max: 500 }).withMessage('Message must be 10-500 characters'),
  body('radius').optional().isInt({ min: 1, max: 100 }).withMessage('Radius must be between 1 and 100 km')
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

    const { bloodGroup, urgencyLevel, city, message, radius } = req.body;

    // Find eligible donors
    const eligibleDonors = await User.find({
      role: 'donor',
      'admin.isApproved': true,
      'availability.isAvailable': true,
      'medicalInfo.bloodGroup': bloodGroup,
      'address.city': { $regex: city, $options: 'i' }
    });

    // Broadcast to all eligible donors
    const io = req.app.get('io');
    if (io) {
      const broadcastData = {
        type: 'emergency-broadcast',
        bloodGroup,
        urgencyLevel,
        city,
        message,
        broadcastBy: req.user.name,
        timestamp: new Date()
      };

      // Send to individual donors
      eligibleDonors.forEach(donor => {
        io.to(`donor-${donor._id}`).emit('emergency-broadcast', broadcastData);
      });

      // Send to admin room
      io.to('admin-room').emit('emergency-broadcast-sent', {
        ...broadcastData,
        recipientCount: eligibleDonors.length
      });
    }

    res.status(200).json({
      success: true,
      message: `Emergency broadcast sent to ${eligibleDonors.length} eligible donors`,
      data: {
        recipientCount: eligibleDonors.length,
        broadcastData: {
          bloodGroup,
          urgencyLevel,
          city,
          message
        }
      }
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;
