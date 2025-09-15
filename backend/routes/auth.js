const express = require('express');
const { body, validationResult } = require('express-validator');
const { User } = require('../models');
const { sendTokenResponse } = require('../utils/auth');
const { protect } = require('../middleware/auth');

const router = express.Router();

// @desc    Register user (donor/recipient)
// @route   POST /api/auth/register
// @access  Public
router.post('/register', [
  body('name').trim().isLength({ min: 2, max: 50 }).withMessage('Name must be between 2-50 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('phone').matches(/^[0-9]{10}$/).withMessage('Please provide a valid 10-digit phone number'),
  body('role').isIn(['donor', 'recipient']).withMessage('Role must be either donor or recipient'),
  body('address.city').trim().notEmpty().withMessage('City is required'),
  body('address.area').trim().notEmpty().withMessage('Area is required')
], async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      name,
      email,
      password,
      phone,
      role,
      address,
      medicalInfo,
      profileImage
    } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { phone }]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: existingUser.email === email ? 'Email already registered' : 'Phone number already registered'
      });
    }

    // Validate donor-specific fields
    if (role === 'donor') {
      if (!medicalInfo || !medicalInfo.bloodGroup || !medicalInfo.dateOfBirth || !medicalInfo.weight) {
        return res.status(400).json({
          success: false,
          message: 'Blood group, date of birth, and weight are required for donors'
        });
      }

      // Validate age
      const age = Math.floor((Date.now() - new Date(medicalInfo.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      if (age < 18 || age > 65) {
        return res.status(400).json({
          success: false,
          message: 'Donor must be between 18 and 65 years old'
        });
      }

      // Validate weight
      if (medicalInfo.weight < 50) {
        return res.status(400).json({
          success: false,
          message: 'Donor weight must be at least 50 kg'
        });
      }
    }

    // Create user
    const userData = {
      name,
      email,
      password,
      phone,
      role,
      address,
      profileImage: profileImage || ''
    };

    if (role === 'donor') {
      userData.medicalInfo = medicalInfo;
      userData.availability = {
        isAvailable: true,
        availableFrom: new Date(),
        preferredDonationTime: medicalInfo.preferredDonationTime || 'any'
      };
    }

    const user = await User.create(userData);

    // Get fresh user without password
    const newUser = await User.findById(user._id).select('-password');

    sendTokenResponse(newUser, 201, res, 'Registration successful! Account pending approval.');

  } catch (error) {
    next(error);
  }
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    // Check for user (include password for comparison)
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if account is suspended
    if (user.status === 'suspended') {
      return res.status(403).json({
        success: false,
        message: 'Account suspended. Contact administrator.'
      });
    }

    // Get user without password
    const userWithoutPassword = await User.findById(user._id).select('-password');

    sendTokenResponse(userWithoutPassword, 200, res, 'Login successful');

  } catch (error) {
    next(error);
  }
});

// @desc    Admin login
// @route   POST /api/auth/admin/login
// @access  Public
router.post('/admin/login', [
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    // For demo purposes, check for demo admin credentials
    if (email === 'admin@demo.com' && password === 'password') {
      // Check if admin user exists, if not create one
      let adminUser = await User.findOne({ email: 'admin@demo.com' });
      
      if (!adminUser) {
        adminUser = await User.create({
          name: 'System Administrator',
          email: 'admin@demo.com',
          password: 'password',
          phone: '9999999999',
          role: 'admin',
          status: 'approved',
          address: {
            city: 'System',
            area: 'Admin'
          }
        });
      }

      const userWithoutPassword = await User.findById(adminUser._id).select('-password');
      sendTokenResponse(userWithoutPassword, 200, res, 'Admin login successful');
      return;
    }

    // Check for admin user
    const user = await User.findOne({ email, role: 'admin' }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid admin credentials'
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid admin credentials'
      });
    }

    // Get user without password
    const userWithoutPassword = await User.findById(user._id).select('-password');

    sendTokenResponse(userWithoutPassword, 200, res, 'Admin login successful');

  } catch (error) {
    next(error);
  }
});

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
router.get('/me', protect, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    res.status(200).json({
      success: true,
      data: {
        user
      }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
router.put('/profile', protect, [
  body('name').optional().trim().isLength({ min: 2, max: 50 }).withMessage('Name must be between 2-50 characters'),
  body('phone').optional().matches(/^[0-9]{10}$/).withMessage('Please provide a valid 10-digit phone number'),
  body('address.city').optional().trim().notEmpty().withMessage('City cannot be empty'),
  body('address.area').optional().trim().notEmpty().withMessage('Area cannot be empty')
], async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const allowedFields = ['name', 'phone', 'address', 'profileImage', 'notifications'];
    
    // For donors, allow medical info updates (except critical fields)
    if (req.user.role === 'donor') {
      allowedFields.push('medicalInfo', 'availability');
    }

    const updateData = {};
    
    // Only include allowed fields that are present in request
    Object.keys(req.body).forEach(key => {
      if (allowedFields.includes(key)) {
        updateData[key] = req.body[key];
      }
    });

    // Don't allow changing critical medical info after approval
    if (req.user.role === 'donor' && req.user.status === 'approved' && updateData.medicalInfo) {
      const criticalFields = ['bloodGroup', 'dateOfBirth'];
      criticalFields.forEach(field => {
        if (updateData.medicalInfo[field] !== undefined) {
          delete updateData.medicalInfo[field];
        }
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      updateData,
      {
        new: true,
        runValidators: true
      }
    );

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user
      }
    });

  } catch (error) {
    next(error);
  }
});

// @desc    Change password
// @route   PUT /api/auth/password
// @access  Private
router.put('/password', protect, [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
], async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { currentPassword, newPassword } = req.body;

    // Get user with password
    const user = await User.findById(req.user.id).select('+password');

    // Check current password
    const isMatch = await user.comparePassword(currentPassword);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password updated successfully'
    });

  } catch (error) {
    next(error);
  }
});

// @desc    Logout user / clear cookie
// @route   POST /api/auth/logout
// @access  Private
router.post('/logout', protect, (req, res) => {
  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true
  });

  res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
});

module.exports = router;
