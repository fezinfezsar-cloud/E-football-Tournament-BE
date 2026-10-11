const express = require('express');
const router = express.Router();
const {
  registerParticipant,
  loginParticipant,
  adminLogin,
  getMe
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/register', registerParticipant);
router.post('/login', loginParticipant);
router.post('/admin-login', adminLogin);
router.get('/me', protect, getMe);

module.exports = router;
