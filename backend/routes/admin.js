const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { User, EmergencyRequest, DonationHistory } = require('../models');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// All routes are protected and require admin role
router.use(protect);
router.use(authorize('admin'));

// @desc    Get admin dashboard data
// @route   GET /api/admin/dashboard
// @access  Private (Admin)
router.get('/dashboard', async (req, res, next) => {
  try {
    // Get overall statistics
    const stats = await Promise.all([
      User.countDocuments({ role: 'donor' }),
      User.countDocuments({ role: 'recipient' }),
      User.countDocuments({ role: 'donor', 'admin.isApproved': true }),
      User.countDocuments({ role: 'donor', 'admin.isApproved': false }),
      EmergencyRequest.countDocuments({ status: 'active' }),
      EmergencyRequest.countDocuments({ status: 'completed' }),
      DonationHistory.countDocuments({ status: 'completed' }),
      DonationHistory.countDocuments({ status: 'scheduled' })
    ]);

    const dashboardStats = {
      users: {
        totalDonors: stats[0],
        totalRecipients: stats[1],
        approvedDonors: stats[2],
        pendingDonors: stats[3]
      },
      requests: {
        activeRequests: stats[4],
        completedRequests: stats[5]
      },
      donations: {
        completedDonations: stats[6],
        scheduledDonations: stats[7]
      }
    };

    // Get recent activities
    const recentActivities = await Promise.all([
      // Recent emergency requests
      EmergencyRequest.find()
        .populate('requester', 'name phone')
        .sort({ createdAt: -1 })
        .limit(5),
      
      // Recent user registrations
      User.find({ role: { $in: ['donor', 'recipient'] } })
        .select('name email role createdAt admin.isApproved')
        .sort({ createdAt: -1 })
        .limit(5),
      
      // Recent completed donations
      DonationHistory.find({ status: 'completed' })
        .populate('donor', 'name')
        .populate('recipient', 'name')
        .sort({ 'scheduling.actualDate': -1 })
        .limit(5)
    ]);

    // Get urgent requests (high priority)
    const urgentRequests = await EmergencyRequest.find({
      status: 'active',
      $or: [
        { 'medical.urgencyLevel': 'critical' },
        { 'medical.urgencyLevel': 'high' }
      ]
    })
    .populate('requester', 'name phone')
    .sort({ 'admin.priorityScore': -1 })
    .limit(10);

    // Get blood group distribution
    const bloodGroupStats = await User.aggregate([
      { $match: { role: 'donor', 'admin.isApproved': true } },
      { $group: { _id: '$medicalInfo.bloodGroup', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        stats: dashboardStats,
        recentEmergencyRequests: recentActivities[0],
        recentUserRegistrations: recentActivities[1],
        recentCompletedDonations: recentActivities[2],
        urgentRequests,
        bloodGroupDistribution: bloodGroupStats
      }
    });

  } catch (error) {
    next(error);
  }
});

// @desc    Get all users with filtering and pagination
// @route   GET /api/admin/users
// @access  Private (Admin)
router.get('/users', [
  query('role').optional().isIn(['donor', 'recipient', 'admin']).withMessage('Invalid role'),
  query('status').optional().isIn(['approved', 'pending', 'rejected']).withMessage('Invalid status'),
  query('bloodGroup').optional().isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).withMessage('Invalid blood group'),
  query('city').optional().isLength({ min: 2 }).withMessage('City must be at least 2 characters'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('search').optional().isLength({ min: 2 }).withMessage('Search term must be at least 2 characters')
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
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Build query
    const query = {};

    if (req.query.role) {
      query.role = req.query.role;
    }

    if (req.query.status && req.query.role === 'donor') {
      switch (req.query.status) {
        case 'approved':
          query['admin.isApproved'] = true;
          break;
        case 'pending':
          query['admin.isApproved'] = false;
          query['admin.rejectedAt'] = { $exists: false };
          break;
        case 'rejected':
          query['admin.rejectedAt'] = { $exists: true };
          break;
      }
    }

    if (req.query.bloodGroup) {
      query['medicalInfo.bloodGroup'] = req.query.bloodGroup;
    }

    if (req.query.city) {
      query['address.city'] = { $regex: req.query.city, $options: 'i' };
    }

    if (req.query.search) {
      query.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } },
        { phone: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total,
          limit
        },
        filters: req.query
      }
    });

  } catch (error) {
    next(error);
  }
});

// @desc    Get user details by ID
// @route   GET /api/admin/users/:id
// @access  Private (Admin)
router.get('/users/:id', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get additional data based on user role
    let additionalData = {};

    if (user.role === 'donor') {
      // Get donation history
      additionalData.donationHistory = await DonationHistory.find({ donor: user._id })
        .populate('recipient', 'name')
        .populate('emergencyRequest', 'patient.name medical.condition')
        .sort({ 'scheduling.actualDate': -1 })
        .limit(10);

      // Get response history
      additionalData.responseHistory = await EmergencyRequest.find({
        'responses.donor': user._id
      })
      .populate('requester', 'name')
      .sort({ createdAt: -1 })
      .limit(10);
    }

    if (user.role === 'recipient') {
      // Get emergency requests
      additionalData.emergencyRequests = await EmergencyRequest.find({ requester: user._id })
        .sort({ createdAt: -1 })
        .limit(10);

      // Get received donations
      additionalData.receivedDonations = await DonationHistory.find({ recipient: user._id })
        .populate('donor', 'name')
        .populate('emergencyRequest', 'patient.name medical.condition')
        .sort({ 'scheduling.actualDate': -1 })
        .limit(10);
    }

    res.status(200).json({
      success: true,
      data: {
        user,
        ...additionalData
      }
    });

  } catch (error) {
    next(error);
  }
});

// @desc    Approve or reject donor
// @route   PUT /api/admin/users/:id/approval
// @access  Private (Admin)
router.put('/users/:id/approval', [
  body('action').isIn(['approve', 'reject']).withMessage('Action must be approve or reject'),
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

    const { action, notes } = req.body;

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.role !== 'donor') {
      return res.status(400).json({
        success: false,
        message: 'Only donors can be approved or rejected'
      });
    }

    if (action === 'approve') {
      user.admin.isApproved = true;
      user.admin.approvedAt = new Date();
      user.admin.approvedBy = req.user.id;
      user.admin.rejectedAt = undefined;
      user.admin.rejectionReason = undefined;
    } else {
      user.admin.isApproved = false;
      user.admin.rejectedAt = new Date();
      user.admin.rejectionReason = notes || 'No reason provided';
      user.admin.approvedAt = undefined;
      user.admin.approvedBy = undefined;
    }

    if (notes) {
      user.admin.notes = notes;
    }

    await user.save();

    // Send real-time notification to the donor
    const io = req.app.get('io');
    if (io) {
      io.to(`donor-${user._id}`).emit('approval-status-updated', {
        status: action === 'approve' ? 'approved' : 'rejected',
        notes,
        timestamp: new Date()
      });
    }

    res.status(200).json({
      success: true,
      message: `Donor ${action}d successfully`,
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          admin: user.admin
        }
      }
    });

  } catch (error) {
    next(error);
  }
});

// @desc    Get all emergency requests with filtering
// @route   GET /api/admin/emergency-requests
// @access  Private (Admin)
router.get('/emergency-requests', [
  query('status').optional().isIn(['active', 'completed', 'expired', 'cancelled']).withMessage('Invalid status'),
  query('urgency').optional().isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid urgency level'),
  query('bloodGroup').optional().isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).withMessage('Invalid blood group'),
  query('city').optional().isLength({ min: 2 }).withMessage('City must be at least 2 characters'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
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
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Build query
    const query = {};

    if (req.query.status) {
      query.status = req.query.status;
    }

    if (req.query.urgency) {
      query['medical.urgencyLevel'] = req.query.urgency;
    }

    if (req.query.bloodGroup) {
      query['patient.bloodGroup'] = req.query.bloodGroup;
    }

    if (req.query.city) {
      query['hospital.address.city'] = { $regex: req.query.city, $options: 'i' };
    }

    const emergencyRequests = await EmergencyRequest.find(query)
      .populate('requester', 'name phone email')
      .populate('responses.donor', 'name phone medicalInfo.bloodGroup')
      .sort({ 'admin.priorityScore': -1, createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await EmergencyRequest.countDocuments(query);

    // Add statistics for each request
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
        },
        filters: req.query
      }
    });

  } catch (error) {
    next(error);
  }
});

// @desc    Update emergency request priority
// @route   PUT /api/admin/emergency-requests/:id/priority
// @access  Private (Admin)
router.put('/emergency-requests/:id/priority', [
  body('priorityScore').isInt({ min: 0, max: 200 }).withMessage('Priority score must be between 0 and 200'),
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

    const { priorityScore, notes } = req.body;

    const emergencyRequest = await EmergencyRequest.findById(req.params.id);

    if (!emergencyRequest) {
      return res.status(404).json({
        success: false,
        message: 'Emergency request not found'
      });
    }

    emergencyRequest.admin.priorityScore = priorityScore;
    emergencyRequest.admin.lastUpdatedBy = req.user.id;
    emergencyRequest.admin.lastUpdatedAt = new Date();

    if (notes) {
      emergencyRequest.admin.notes = notes;
    }

    await emergencyRequest.save();

    res.status(200).json({
      success: true,
      message: 'Priority updated successfully',
      data: {
        emergencyRequest: {
          _id: emergencyRequest._id,
          admin: emergencyRequest.admin
        }
      }
    });

  } catch (error) {
    next(error);
  }
});

// @desc    Get donation analytics
// @route   GET /api/admin/analytics/donations
// @access  Private (Admin)
router.get('/analytics/donations', [
  query('period').optional().isIn(['week', 'month', 'quarter', 'year']).withMessage('Invalid period'),
  query('startDate').optional().isISO8601().withMessage('Start date must be valid'),
  query('endDate').optional().isISO8601().withMessage('End date must be valid')
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

    let startDate, endDate;
    const period = req.query.period || 'month';

    if (req.query.startDate && req.query.endDate) {
      startDate = new Date(req.query.startDate);
      endDate = new Date(req.query.endDate);
    } else {
      // Set default date range based on period
      endDate = new Date();
      switch (period) {
        case 'week':
          startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'quarter':
          startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
          break;
        case 'year':
          startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      }
    }

    // Get donation statistics
    const donationStats = await DonationHistory.aggregate([
      {
        $match: {
          'scheduling.actualDate': { $gte: startDate, $lte: endDate },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$scheduling.actualDate' }
          },
          count: { $sum: 1 },
          totalUnits: { $sum: '$donation.units' },
          totalVolume: { $sum: '$donation.volume' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Get blood group wise donations
    const bloodGroupStats = await DonationHistory.aggregate([
      {
        $match: {
          'scheduling.actualDate': { $gte: startDate, $lte: endDate },
          status: 'completed'
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'donor',
          foreignField: '_id',
          as: 'donorInfo'
        }
      },
      {
        $group: {
          _id: '$donorInfo.medicalInfo.bloodGroup',
          count: { $sum: 1 },
          totalUnits: { $sum: '$donation.units' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get city wise donations
    const cityStats = await DonationHistory.aggregate([
      {
        $match: {
          'scheduling.actualDate': { $gte: startDate, $lte: endDate },
          status: 'completed'
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'donor',
          foreignField: '_id',
          as: 'donorInfo'
        }
      },
      {
        $group: {
          _id: '$donorInfo.address.city',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    res.status(200).json({
      success: true,
      data: {
        period: {
          startDate,
          endDate,
          period
        },
        dailyDonations: donationStats,
        bloodGroupDistribution: bloodGroupStats,
        topCities: cityStats,
        summary: {
          totalDonations: donationStats.reduce((sum, day) => sum + day.count, 0),
          totalUnits: donationStats.reduce((sum, day) => sum + day.totalUnits, 0),
          averageDonationsPerDay: donationStats.length > 0 ? 
            (donationStats.reduce((sum, day) => sum + day.count, 0) / donationStats.length).toFixed(2) : 0
        }
      }
    });

  } catch (error) {
    next(error);
  }
});

// @desc    Get system analytics
// @route   GET /api/admin/analytics/system
// @access  Private (Admin)
router.get('/analytics/system', async (req, res, next) => {
  try {
    // Get user registration trends (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const userRegistrationTrends = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo },
          role: { $in: ['donor', 'recipient'] }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            role: '$role'
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.date': 1 } }
    ]);

    // Get emergency request trends
    const emergencyRequestTrends = await EmergencyRequest.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            urgency: '$medical.urgencyLevel'
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.date': 1 } }
    ]);

    // Get response rate statistics
    const responseRateStats = await EmergencyRequest.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $project: {
          responseCount: { $size: '$responses' },
          urgencyLevel: '$medical.urgencyLevel',
          bloodGroup: '$patient.bloodGroup'
        }
      },
      {
        $group: {
          _id: '$urgencyLevel',
          totalRequests: { $sum: 1 },
          totalResponses: { $sum: '$responseCount' },
          averageResponses: { $avg: '$responseCount' }
        }
      }
    ]);

    // Get top performing donors
    const topDonors = await User.aggregate([
      {
        $match: {
          role: 'donor',
          'admin.isApproved': true
        }
      },
      {
        $sort: { 'stats.totalDonations': -1 }
      },
      {
        $limit: 10
      },
      {
        $project: {
          name: 1,
          'medicalInfo.bloodGroup': 1,
          'stats.totalDonations': 1,
          'address.city': 1
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        userRegistrationTrends,
        emergencyRequestTrends,
        responseRateStats,
        topDonors,
        generatedAt: new Date()
      }
    });

  } catch (error) {
    next(error);
  }
});

// @desc    Export data for reporting
// @route   GET /api/admin/export/:type
// @access  Private (Admin)
router.get('/export/:type', [
  query('startDate').optional().isISO8601().withMessage('Start date must be valid'),
  query('endDate').optional().isISO8601().withMessage('End date must be valid'),
  query('format').optional().isIn(['json', 'csv']).withMessage('Format must be json or csv')
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

    const { type } = req.params;
    const format = req.query.format || 'json';
    const startDate = req.query.startDate ? new Date(req.query.startDate) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();

    let data;

    switch (type) {
      case 'donations':
        data = await DonationHistory.find({
          'scheduling.actualDate': { $gte: startDate, $lte: endDate }
        })
        .populate('donor', 'name email medicalInfo.bloodGroup')
        .populate('recipient', 'name email')
        .populate('emergencyRequest', 'patient.name medical.condition')
        .lean();
        break;

      case 'emergency-requests':
        data = await EmergencyRequest.find({
          createdAt: { $gte: startDate, $lte: endDate }
        })
        .populate('requester', 'name email phone')
        .lean();
        break;

      case 'users':
        data = await User.find({
          createdAt: { $gte: startDate, $lte: endDate },
          role: { $in: ['donor', 'recipient'] }
        })
        .select('-password')
        .lean();
        break;

      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid export type. Supported types: donations, emergency-requests, users'
        });
    }

    if (format === 'csv') {
      // Convert to CSV format (simplified implementation)
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${type}-export-${Date.now()}.csv"`);
      
      // This is a simplified CSV conversion - in production, use a proper CSV library
      const csvData = JSON.stringify(data);
      res.send(csvData);
    } else {
      res.status(200).json({
        success: true,
        data: {
          type,
          exportDate: new Date(),
          dateRange: { startDate, endDate },
          count: data.length,
          records: data
        }
      });
    }

  } catch (error) {
    next(error);
  }
});

module.exports = router;
