const jwt = require('jsonwebtoken');
const { User } = require('../models');

// Protect routes - require authentication
const protect = async (req, res, next) => {
  try {
    let token;

    // Check for token in headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Get user from token
      const user = await User.findById(decoded.id).select('-password');
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Access denied. User not found.'
        });
      }

      // Check if user is active
      if (user.status === 'suspended') {
        return res.status(401).json({
          success: false,
          message: 'Account suspended. Contact administrator.'
        });
      }

      // Update last active
      user.updateLastActive();

      req.user = user;
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Invalid token.'
      });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error in authentication'
    });
  }
};

// Authorize specific roles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Please log in.'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. ${req.user.role} role is not authorized for this action.`
      });
    }

    next();
  };
};

// Check if donor is approved
const checkDonorApproval = (req, res, next) => {
  if (req.user.role === 'donor' && req.user.status !== 'approved') {
    return res.status(403).json({
      success: false,
      message: 'Donor account pending approval. Please wait for admin verification.',
      status: req.user.status
    });
  }
  next();
};

// Check if user owns resource or is admin
const checkOwnership = (resourceUserField = 'user') => {
  return (req, res, next) => {
    // Admins can access any resource
    if (req.user.role === 'admin') {
      return next();
    }

    // For other users, check ownership in the next middleware
    // This is a helper that sets up the check
    req.checkOwnership = resourceUserField;
    next();
  };
};

module.exports = {
  protect,
  authorize,
  checkDonorApproval,
  checkOwnership
};
