const express = require('express');
const router = express.Router();
const {
  getAllRegistrations,
  getRegistrationDetails,
  getRegistrationScreenshot,
  approveRegistration,
  rejectRegistration,
  getAdminStats,
  getAdminPaymentSettings,
  updatePaymentSettings
} = require('../controllers/adminController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// All routes require valid JWT + Admin authorization
router.use(protect, adminOnly);

router.get('/registrations', getAllRegistrations);
router.get('/registrations/:id', getRegistrationDetails);
router.get('/registrations/:id/screenshot', getRegistrationScreenshot);
router.patch('/registrations/:id/approve', approveRegistration);
router.patch('/registrations/:id/reject', rejectRegistration);
router.get('/stats', getAdminStats);
router.get('/payment-settings', getAdminPaymentSettings);
router.put('/payment-settings', updatePaymentSettings);

module.exports = router;
