const TournamentRegistration = require('../models/TournamentRegistration');
const generateRegistrationId = require('../utils/generateRegistrationId');
const cloudinaryService = require('../utils/cloudinaryService');

// @desc    Submit tournament registration form
// @route   POST /api/registrations
// @access  Private (Participant)
const createRegistration = async (req, res) => {
  let uploadedPaymentPublicId = null;
  let uploadedPaymentDeliveryType = 'authenticated';
  let uploadedGamePlanPublicId = null;
  let uploadedGamePlanDeliveryType = 'upload';

  try {
    const { fullName, phone, college, efFootballId, teamName, rulesAccepted } = req.body;
    const userId = req.user._id;
    const userEmail = req.user.email; // Lock email to authenticated participant email

    // Check rules acceptance
    if (rulesAccepted !== true && rulesAccepted !== 'true') {
      return res.status(400).json({
        message: 'You must read and accept the rules & regulations to register.'
      });
    }

    // Required fields check
    if (!fullName || !phone || !college || !efFootballId) {
      return res.status(400).json({
        message: 'Full Name, Phone Number, College, and E-Football Gamer ID are required.'
      });
    }

    // BACKEND CAPACITY CHECK: Max 32 non-rejected registrations allowed
    const maxCapacity = 32;
    const activeRegistrationsCount = await TournamentRegistration.countDocuments({
      registrationStatus: { $ne: 'REJECTED' }
    });

    if (activeRegistrationsCount >= maxCapacity) {
      return res.status(400).json({
        message: 'REGISTRATION FULL: All 32 participant seats for MINI MAYHEM have been filled.'
      });
    }

    // Prevent duplicate active registration check
    const existingReg = await TournamentRegistration.findOne({ userId });
    if (existingReg) {
      if (existingReg.registrationStatus !== 'REJECTED') {
        return res.status(400).json({
          message: 'You have already registered for this tournament.',
          registration: existingReg
        });
      } else {
        // If previous registration was rejected, user should update/resubmit payment screenshot instead
        return res.status(400).json({
          message: 'Your previous registration was rejected. Please resubmit your payment screenshot instead of creating a new registration.',
          registration: existingReg
        });
      }
    }

    // Extract files from req.files (upload.fields) or req.file fallback
    const paymentFile = req.files?.paymentScreenshot?.[0] || (req.file?.fieldname === 'paymentScreenshot' ? req.file : null) || req.file;
    const gamePlanFile = req.files?.gamePlanScreenshot?.[0] || (req.file?.fieldname === 'gamePlanScreenshot' ? req.file : null);

    // Validate Payment Screenshot presence
    if (!paymentFile) {
      return res.status(400).json({
        message: 'Payment screenshot is required! Please upload your payment confirmation proof.'
      });
    }

    // Validate Game Plan Screenshot presence
    if (!gamePlanFile) {
      return res.status(400).json({
        message: 'Game Plan screenshot is required! Please upload a screenshot of your E-Football Game Plan.'
      });
    }

    // Validate Payment screenshot magic bytes
    if (!cloudinaryService.isValidImageBuffer(paymentFile.buffer)) {
      return res.status(400).json({
        message: 'Invalid payment screenshot file content! Uploaded file is not a valid image format (JPEG, PNG, WebP).'
      });
    }

    // Validate Game Plan screenshot magic bytes
    if (!cloudinaryService.isValidImageBuffer(gamePlanFile.buffer)) {
      return res.status(400).json({
        message: 'Invalid Game Plan screenshot file content! Uploaded file is not a valid image format (JPEG, PNG, WebP).'
      });
    }

    const registrationId = await generateRegistrationId();

    // 1. Upload Payment Screenshot to Cloudinary (authenticated storage)
    const paymentCustomId = `payment_${registrationId}_${Date.now()}`;
    const paymentUploadResult = await cloudinaryService.uploadScreenshotToCloudinary(paymentFile.buffer, {
      folder: 'mini-mayhem/payment-screenshots',
      type: 'authenticated',
      publicId: paymentCustomId
    });

    uploadedPaymentPublicId = paymentUploadResult.public_id;
    uploadedPaymentDeliveryType = paymentUploadResult.type || 'authenticated';

    const cloudinaryPublicId = paymentUploadResult.public_id;
    const cloudinaryDeliveryType = paymentUploadResult.type || 'authenticated';
    const cloudinaryMetadata = {
      format: paymentUploadResult.format || '',
      bytes: paymentUploadResult.bytes || paymentFile.size,
      width: paymentUploadResult.width || 0,
      height: paymentUploadResult.height || 0,
      uploadedAt: new Date()
    };
    const paymentScreenshot = paymentUploadResult.public_id;

    // 2. Upload Game Plan Screenshot to Cloudinary (public delivery for approved participant profiles)
    const gamePlanCustomId = `gameplan_${registrationId}_${Date.now()}`;
    const gamePlanUploadResult = await cloudinaryService.uploadScreenshotToCloudinary(gamePlanFile.buffer, {
      folder: 'mini-mayhem/game-plans',
      type: 'upload',
      publicId: gamePlanCustomId
    });

    uploadedGamePlanPublicId = gamePlanUploadResult.public_id;
    uploadedGamePlanDeliveryType = gamePlanUploadResult.type || 'upload';

    const cloudinaryGamePlanPublicId = gamePlanUploadResult.public_id;
    const cloudinaryGamePlanDeliveryType = gamePlanUploadResult.type || 'upload';
    const gamePlanScreenshotUrl = gamePlanUploadResult.secure_url || gamePlanUploadResult.url || gamePlanUploadResult.public_id;
    const gamePlanMetadata = {
      format: gamePlanUploadResult.format || '',
      bytes: gamePlanUploadResult.bytes || gamePlanFile.size,
      width: gamePlanUploadResult.width || 0,
      height: gamePlanUploadResult.height || 0,
      uploadedAt: new Date()
    };
    const gamePlanScreenshot = gamePlanUploadResult.public_id;

    const paymentStatus = 'PENDING';
    const registrationStatus = 'PENDING_VERIFICATION';
    const submittedAt = new Date();

    try {
      const newRegistration = await TournamentRegistration.create({
        registrationId,
        userId,
        fullName,
        email: userEmail,
        phone,
        college,
        efFootballId,
        teamName: teamName || '',
        rulesAccepted: true,
        rulesAcceptedAt: new Date(),
        paymentScreenshot,
        cloudinaryPublicId,
        cloudinaryDeliveryType,
        cloudinaryMetadata,
        gamePlanScreenshot,
        cloudinaryGamePlanPublicId,
        cloudinaryGamePlanDeliveryType,
        gamePlanScreenshotUrl,
        gamePlanMetadata,
        paymentStatus,
        registrationStatus,
        submittedAt
      });

      return res.status(201).json({
        message: 'Registration, Game Plan, and payment screenshot submitted successfully!',
        registration: newRegistration
      });
    } catch (dbError) {
      // If DB creation failed after uploading to Cloudinary, delete orphaned assets
      if (uploadedPaymentPublicId) {
        await cloudinaryService.deleteScreenshotFromCloudinary(uploadedPaymentPublicId, uploadedPaymentDeliveryType);
      }
      if (uploadedGamePlanPublicId) {
        await cloudinaryService.deleteScreenshotFromCloudinary(uploadedGamePlanPublicId, uploadedGamePlanDeliveryType);
      }
      throw dbError;
    }
  } catch (error) {
    console.error('Error creating registration:', error.message || error);
    // Cleanup orphaned files if any uncaught error occurred
    if (uploadedPaymentPublicId) {
      await cloudinaryService.deleteScreenshotFromCloudinary(uploadedPaymentPublicId, uploadedPaymentDeliveryType);
    }
    if (uploadedGamePlanPublicId) {
      await cloudinaryService.deleteScreenshotFromCloudinary(uploadedGamePlanPublicId, uploadedGamePlanDeliveryType);
    }
    return res.status(500).json({ message: error.message || 'Server error while processing registration.' });
  }
};

// @desc    Upload or update payment screenshot for existing registration
// @route   POST /api/registrations/:id/payment
// @access  Private (Participant)
const uploadPayment = async (req, res) => {
  let newUploadedPublicId = null;
  let newUploadedDeliveryType = 'authenticated';

  try {
    const registrationId = req.params.id;
    const userId = req.user._id;

    if (!req.file) {
      return res.status(400).json({ message: 'Please select and upload a payment screenshot image.' });
    }

    const registration = await TournamentRegistration.findOne({
      _id: registrationId,
      userId
    });

    if (!registration) {
      return res.status(404).json({ message: 'Registration record not found or not owned by you.' });
    }

    // Validate actual file content bytes (magic numbers)
    if (!cloudinaryService.isValidImageBuffer(req.file.buffer)) {
      return res.status(400).json({
        message: 'Invalid file content! Uploaded file is not a valid image format (JPEG, PNG, WebP).'
      });
    }

    // Upload new screenshot to Cloudinary
    const customPublicId = `payment_${registration.registrationId}_${Date.now()}`;
    const uploadResult = await cloudinaryService.uploadScreenshotToCloudinary(req.file.buffer, {
      folder: 'mini-mayhem/payment-screenshots',
      type: 'authenticated',
      publicId: customPublicId
    });

    newUploadedPublicId = uploadResult.public_id;
    newUploadedDeliveryType = uploadResult.type || 'authenticated';

    // Save reference to old asset for cleanup after successful save
    const oldPublicId = registration.cloudinaryPublicId || (
      registration.paymentScreenshot && !registration.paymentScreenshot.startsWith('/uploads/')
        ? registration.paymentScreenshot
        : null
    );
    const oldDeliveryType = registration.cloudinaryDeliveryType || 'authenticated';

    // Update registration document
    registration.paymentScreenshot = uploadResult.public_id;
    registration.cloudinaryPublicId = uploadResult.public_id;
    registration.cloudinaryDeliveryType = uploadResult.type || 'authenticated';
    registration.cloudinaryMetadata = {
      format: uploadResult.format || '',
      bytes: uploadResult.bytes || req.file.size,
      width: uploadResult.width || 0,
      height: uploadResult.height || 0,
      uploadedAt: new Date()
    };
    registration.paymentStatus = 'PENDING';
    registration.registrationStatus = 'PENDING_VERIFICATION';
    registration.rejectionReason = ''; // Clear prior rejection reason if any
    registration.submittedAt = new Date();

    await registration.save();

    // Cleanup old orphaned Cloudinary asset if it existed
    if (oldPublicId && oldPublicId !== newUploadedPublicId) {
      await cloudinaryService.deleteScreenshotFromCloudinary(oldPublicId, oldDeliveryType);
    }

    return res.json({
      message: 'Payment screenshot submitted successfully! Your status is now PENDING_VERIFICATION.',
      registration
    });
  } catch (error) {
    console.error('Error uploading payment:', error.message || error);
    // Cleanup newly uploaded orphaned asset if process failed
    if (newUploadedPublicId) {
      await cloudinaryService.deleteScreenshotFromCloudinary(newUploadedPublicId, newUploadedDeliveryType);
    }
    return res.status(500).json({ message: error.message || 'Server error while uploading payment screenshot.' });
  }
};

// @desc    Get current user's registration status & details
// @route   GET /api/registrations/my
// @access  Private (Participant)
const getMyRegistration = async (req, res) => {
  try {
    const registration = await TournamentRegistration.findOne({ userId: req.user._id });
    return res.json(registration || null);
  } catch (error) {
    console.error('Error fetching my registration:', error);
    return res.status(500).json({ message: 'Failed to fetch registration data.' });
  }
};

// @desc    Get specific registration details by ID
// @route   GET /api/registrations/:id
// @access  Private (Participant / Admin)
const getRegistrationById = async (req, res) => {
  try {
    const registration = await TournamentRegistration.findById(req.params.id);

    if (!registration) {
      return res.status(404).json({ message: 'Registration not found.' });
    }

    // Ownership check (unless admin)
    if (
      req.user.role !== 'admin' &&
      registration.userId.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: 'Not authorized to view this registration.' });
    }

    return res.json(registration);
  } catch (error) {
    console.error('Error fetching registration:', error);
    return res.status(500).json({ message: 'Failed to fetch registration.' });
  }
};

// @desc    Get short-lived signed URL for participant's own registration payment screenshot
// @route   GET /api/registrations/:id/screenshot
// @access  Private (Participant owner / Admin)
const getRegistrationScreenshotById = async (req, res) => {
  try {
    const registration = await TournamentRegistration.findById(req.params.id);

    if (!registration) {
      return res.status(404).json({ message: 'Registration not found.' });
    }

    // Ownership check (unless admin)
    if (
      req.user.role !== 'admin' &&
      registration.userId.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: 'Not authorized to view this screenshot.' });
    }

    const publicId = registration.cloudinaryPublicId || registration.paymentScreenshot;

    if (!publicId) {
      return res.status(404).json({ message: 'No payment screenshot uploaded for this registration.' });
    }

    const deliveryType = registration.cloudinaryDeliveryType || 'authenticated';
    const signedUrl = cloudinaryService.generateSignedScreenshotUrl(publicId, deliveryType, 3600);

    return res.json({
      url: signedUrl,
      publicId: publicId,
      expiresIn: 3600
    });
  } catch (error) {
    console.error('Error generating screenshot URL for participant:', error);
    return res.status(500).json({ message: error.message || 'Failed to generate screenshot viewing URL.' });
  }
};

module.exports = {
  createRegistration,
  uploadPayment,
  getMyRegistration,
  getRegistrationById,
  getRegistrationScreenshotById
};
