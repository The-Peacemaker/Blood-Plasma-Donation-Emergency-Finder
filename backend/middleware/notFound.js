// 404 Not Found middleware
const notFound = (req, res, next) => {
  const error = new Error(`Route ${req.originalUrl} not found`);
  res.status(404).json({
    success: false,
    message: error.message,
    availableRoutes: {
      auth: '/api/auth',
      donor: '/api/donor',
      recipient: '/api/recipient',
      admin: '/api/admin',
      emergency: '/api/emergency'
    }
  });
};

module.exports = { notFound };
