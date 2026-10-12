const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// Helper to generate JWT token
const generateToken = (payload) => {
  return jwt.sign(
    payload,
    process.env.JWT_SECRET || 'efootball_super_secret_jwt_key_2026_techfest',
    { expiresIn: '7d' }
  );
};

/**
 * Verifies entered password against configured admin password.
 * Supports both plain-text strings and pre-hashed bcrypt strings ($2a$, $2b$, $2y$).
 */
const verifyAdminPassword = async (enteredPassword, configuredPassword) => {
  if (!enteredPassword || !configuredPassword) return false;

  const trimmedConfigured = configuredPassword.trim();
  const isBcrypt = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(trimmedConfigured);

  if (isBcrypt) {
    try {
      const match = await bcrypt.compare(enteredPassword, trimmedConfigured);
      if (match) return true;
    } catch (err) {
      console.error('[Admin Auth] Bcrypt comparison error:', err.message);
    }
  }

  // Check direct plain-text match
  if (enteredPassword === configuredPassword) {
    return true;
  }

  // Also check trimmed match to accommodate accidental whitespace during environment variable entry
  if (enteredPassword.trim() === trimmedConfigured) {
    return true;
  }

  return false;
};

// @desc    Register a new participant
// @route   POST /api/auth/register
// @access  Public
const registerParticipant = async (req, res) => {
  try {
    const { fullName, email, password, confirmPassword, phone } = req.body;

    // Strict input validation
    if (!fullName || !email || !password || !confirmPassword || !phone) {
      return res.status(400).json({ message: 'All required fields must be provided.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Please provide a valid email address.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match.' });
    }

    const phoneRegex = /^[0-9+\-\s()]{7,15}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({ message: 'Please provide a valid phone number.' });
    }

    // Check if user with email already exists
    const userExists = await User.findOne({ email: email.toLowerCase() });
    if (userExists) {
      return res.status(400).json({ message: 'An account with this email address already exists.' });
    }

    // CRITICAL SECURITY REQUIREMENT:
    // Ignore any role provided in client payload and force 'participant'
    const user = await User.create({
      fullName,
      email: email.toLowerCase(),
      password,
      phone,
      role: 'participant'
    });

    if (user) {
      const token = generateToken({ id: user._id, role: user.role, email: user.email });
      return res.status(201).json({
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        token
      });
    } else {
      return res.status(400).json({ message: 'Invalid user data provided.' });
    }
  } catch (error) {
    console.error('Participant registration error:', error);
    return res.status(500).json({ message: 'Server error during registration.' });
  }
};

// @desc    Participant Login
// @route   POST /api/auth/login
// @access  Public
const loginParticipant = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    if (user.role === 'admin') {
      return res.status(403).json({ message: 'Admin login must use the dedicated admin portal.' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const token = generateToken({ id: user._id, role: user.role, email: user.email });

    return res.json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      token
    });
  } catch (error) {
    console.error('Participant login error:', error);
    return res.status(500).json({ message: 'Server error during login.' });
  }
};

// @desc    Admin Login (Using strict server environment credentials)
// @route   POST /api/auth/admin-login
// @access  Public
const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const isProduction = process.env.NODE_ENV === 'production';
    const rawAdminEmail = process.env.ADMIN_EMAIL;
    const rawAdminPassword = process.env.ADMIN_PASSWORD;

    // In production, strictly enforce that administrator credentials are configured in environment
    if (isProduction) {
      if (!rawAdminPassword || !rawAdminEmail) {
        console.error('[Admin Auth Error] Administrator credentials (ADMIN_EMAIL / ADMIN_PASSWORD) are not configured in Render environment variables.');
        return res.status(500).json({
          message: 'Administrator authentication is not configured on this server. Please set ADMIN_EMAIL and ADMIN_PASSWORD in Render Environment settings.'
        });
      }
    }

    const envAdminEmail = (rawAdminEmail || 'admin@techfest.com').trim();
    const envAdminPassword = rawAdminPassword || 'admin123456';

    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide admin email and password.' });
    }

    // Compare email case-insensitively and trimmed
    const isEmailValid = (email || '').toLowerCase().trim() === envAdminEmail.toLowerCase().trim();

    // Verify password supporting both plain text and bcrypt hash
    const isPasswordValid = await verifyAdminPassword(password, envAdminPassword);

    if (!isEmailValid || !isPasswordValid) {
      return res.status(401).json({ message: 'Invalid administrator credentials.' });
    }

    // Issue dedicated Admin JWT
    const token = generateToken({
      id: 'admin_sys_id',
      email: envAdminEmail,
      role: 'admin'
    });

    return res.json({
      _id: 'admin_sys_id',
      fullName: 'Tournament Administrator',
      email: envAdminEmail,
      role: 'admin',
      token
    });
  } catch (error) {
    console.error('Admin login error:', error.message);
    return res.status(500).json({ message: 'Server error during admin authentication.' });
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    return res.json({
      _id: req.user._id,
      fullName: req.user.fullName,
      email: req.user.email,
      phone: req.user.phone || '',
      role: req.user.role
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch user profile.' });
  }
};

module.exports = {
  registerParticipant,
  loginParticipant,
  adminLogin,
  getMe
};
