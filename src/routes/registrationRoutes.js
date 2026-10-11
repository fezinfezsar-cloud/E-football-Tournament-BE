const express = require('express');
const router = express.Router();
const {
  createRegistration,
  uploadPayment,
  getMyRegistration,
  getRegistrationById,
  getRegistrationScreenshotById
} = require('../controllers/registrationController');
const { protect, participantOnly } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.post(
  '/',
  protect,
  participantOnly,
  upload.fields([
    { name: 'paymentScreenshot', maxCount: 1 },
    { name: 'gamePlanScreenshot', maxCount: 1 }
  ]),
  createRegistration
);

router.get('/my', protect, getMyRegistration);

router.get('/:id', protect, getRegistrationById);

router.get('/:id/screenshot', protect, getRegistrationScreenshotById);

router.post(
  '/:id/payment',
  protect,
  participantOnly,
  upload.single('paymentScreenshot'),
  uploadPayment
);

module.exports = router;
