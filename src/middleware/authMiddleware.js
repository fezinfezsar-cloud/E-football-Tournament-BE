const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];

      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'efootball_super_secret_jwt_key_2026_techfest'
      );

      // Check if token represents virtual admin
      const configuredAdminEmail = (process.env.ADMIN_EMAIL || 'admin@techfest.com').toLowerCase().trim();
      const decodedEmail = (decoded.email || '').toLowerCase().trim();

      if (decoded.role === 'admin' && (decodedEmail === configuredAdminEmail || decoded.id === 'admin_sys_id')) {
        req.user = {
          _id: 'admin_sys_id',
          fullName: 'Tournament Administrator',
          email: configuredAdminEmail,
          role: 'admin'
        };
        return next();
      }

      // Find standard user in database
      const user = await User.findById(decoded.id).select('-password');

      if (!user) {
        return res.status(401).json({ message: 'User account no longer exists.' });
      }

      req.user = user;
      next();
    } catch (error) {
      console.error('JWT verification error:', error.message);
      return res.status(401).json({ message: 'Not authorized, token failed or expired.' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no access token provided.' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    return res.status(403).json({ message: 'Access denied: Admin privileges required.' });
  }
};

const participantOnly = (req, res, next) => {
  if (req.user && req.user.role === 'participant') {
    next();
  } else {
    return res.status(403).json({ message: 'Access denied: Participant privileges required.' });
  }
};

module.exports = {
  protect,
  adminOnly,
  participantOnly
};
