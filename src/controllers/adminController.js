const TournamentRegistration = require('../models/TournamentRegistration');
const TournamentSettings = require('../models/TournamentSettings');
const tournamentConfig = require('../config/tournamentConfig');
const cloudinaryService = require('../utils/cloudinaryService');

// @desc    Get all registrations with search, filter, and sort
// @route   GET /api/admin/registrations
// @access  Private (Admin)
const getAllRegistrations = async (req, res) => {
  try {
    const { search, status, sort } = req.query;

    let query = {};

    // Search filter
    if (search && search.trim() !== '') {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { fullName: searchRegex },
        { email: searchRegex },
        { registrationId: searchRegex },
        { efFootballId: searchRegex },
        { college: searchRegex },
        { phone: searchRegex }
      ];
    }

    // Status filter
    if (status && status !== 'ALL' && status !== 'All') {
      if (status === 'PENDING' || status === 'PENDING_VERIFICATION') {
        query.registrationStatus = 'PENDING_VERIFICATION';
      } else if (status === 'APPROVED') {
        query.registrationStatus = 'APPROVED';
      } else if (status === 'REJECTED') {
        query.registrationStatus = 'REJECTED';
      } else if (status === 'DRAFT') {
        query.registrationStatus = 'DRAFT';
      }
    }

    // Sorting
    let sortOptions = { createdAt: -1 }; // default newest first
    if (sort === 'oldest') {
      sortOptions = { createdAt: 1 };
    }

    const registrations = await TournamentRegistration.find(query).sort(sortOptions);

    return res.json(registrations);
  } catch (error) {
    console.error('Admin fetch registrations error:', error);
    return res.status(500).json({ message: 'Failed to fetch registrations.' });
  }
};

// @desc    Get registration details for admin
// @route   GET /api/admin/registrations/:id
// @access  Private (Admin)
const getRegistrationDetails = async (req, res) => {
  try {
    const registration = await TournamentRegistration.findById(req.params.id);
    if (!registration) {
      return res.status(404).json({ message: 'Registration not found.' });
    }
    return res.json(registration);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch registration details.' });
  }
};

// @desc    Get short-lived signed URL for registration payment screenshot
// @route   GET /api/admin/registrations/:id/screenshot
// @access  Private (Admin)
const getRegistrationScreenshot = async (req, res) => {
  try {
    const registration = await TournamentRegistration.findById(req.params.id);

    if (!registration) {
      return res.status(404).json({ message: 'Registration record not found.' });
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
    console.error('Error generating screenshot URL for admin:', error);
    return res.status(500).json({ message: error.message || 'Failed to generate screenshot viewing URL.' });
  }
};

// @desc    Approve a participant's payment & registration
// @route   PATCH /api/admin/registrations/:id/approve
// @access  Private (Admin)
const approveRegistration = async (req, res) => {
  try {
    const registration = await TournamentRegistration.findById(req.params.id);

    if (!registration) {
      return res.status(404).json({ message: 'Registration record not found.' });
    }

    registration.paymentStatus = 'VERIFIED';
    registration.registrationStatus = 'APPROVED';
    registration.rejectionReason = '';
    registration.verifiedAt = new Date();

    await registration.save();

    return res.json({
      message: `Registration ${registration.registrationId} approved successfully!`,
      registration
    });
  } catch (error) {
    console.error('Approve registration error:', error);
    return res.status(500).json({ message: 'Failed to approve registration.' });
  }
};

// @desc    Reject a participant's payment with reason
// @route   PATCH /api/admin/registrations/:id/reject
// @access  Private (Admin)
const rejectRegistration = async (req, res) => {
  try {
    const { rejectionReason } = req.body;

    if (!rejectionReason || rejectionReason.trim() === '') {
      return res.status(400).json({ message: 'Please provide a valid reason for rejecting the payment.' });
    }

    const registration = await TournamentRegistration.findById(req.params.id);

    if (!registration) {
      return res.status(404).json({ message: 'Registration record not found.' });
    }

    registration.paymentStatus = 'REJECTED';
    registration.registrationStatus = 'REJECTED';
    registration.rejectionReason = rejectionReason.trim();

    await registration.save();

    return res.json({
      message: `Registration ${registration.registrationId} marked as REJECTED.`,
      registration
    });
  } catch (error) {
    console.error('Reject registration error:', error);
    return res.status(500).json({ message: 'Failed to reject registration.' });
  }
};

// @desc    Get admin statistics
// @route   GET /api/admin/stats
// @access  Private (Admin)
const getAdminStats = async (req, res) => {
  try {
    const totalRegistrations = await TournamentRegistration.countDocuments();
    const pendingCount = await TournamentRegistration.countDocuments({
      registrationStatus: 'PENDING_VERIFICATION'
    });
    const approvedCount = await TournamentRegistration.countDocuments({
      registrationStatus: 'APPROVED'
    });
    const rejectedCount = await TournamentRegistration.countDocuments({
      registrationStatus: 'REJECTED'
    });
    const draftCount = await TournamentRegistration.countDocuments({
      registrationStatus: 'DRAFT'
    });

    const maxParticipants = 32;
    const activeCount = await TournamentRegistration.countDocuments({
      registrationStatus: { $ne: 'REJECTED' }
    });

    const registrationFee = tournamentConfig.registrationFee || 50;
    const maxCapacity = tournamentConfig.maxParticipants || 32;
    const maxPossibleCollection = maxCapacity * registrationFee; // 1600
    const actualConfirmedCollection = approvedCount * registrationFee;
    const totalPrizeMoney = tournamentConfig.totalPrizeMoney || 1400;
    const prizePoolCovered = actualConfirmedCollection >= totalPrizeMoney;

    return res.json({
      totalRegistrations,
      pendingCount,
      approvedCount,
      rejectedCount,
      draftCount,
      maxParticipants,
      activeCount,
      isFull: activeCount >= maxParticipants,
      registrationFee,
      maxPossibleCollection,
      actualConfirmedCollection,
      totalPrizeMoney,
      prizePoolCovered,
      prizePool: tournamentConfig.prizePool,
      prizeBreakdown: tournamentConfig.prizeBreakdown,
      eventExpensesBuffer: tournamentConfig.eventExpensesBuffer || 200
    });
  } catch (error) {
    console.error('Get admin stats error:', error);
    return res.status(500).json({ message: 'Failed to fetch tournament statistics.' });
  }
};

// @desc    Get active payment settings (UPI ID)
// @route   GET /api/admin/payment-settings
// @access  Private (Admin)
const getAdminPaymentSettings = async (req, res) => {
  try {
    const settings = await TournamentSettings.getActiveSettings();
    return res.json({
      upiId: settings.upiId || '',
      updatedBy: settings.updatedBy || 'admin',
      updatedAt: settings.updatedAt
    });
  } catch (error) {
    console.error('Error in getAdminPaymentSettings:', error);
    return res.status(500).json({ message: 'Failed to fetch payment settings.' });
  }
};

// @desc    Update tournament payment UPI ID
// @route   PUT /api/admin/payment-settings
// @access  Private (Admin)
const updatePaymentSettings = async (req, res) => {
  try {
    const { upiId } = req.body;

    if (!upiId || typeof upiId !== 'string') {
      return res.status(400).json({ message: 'UPI ID is required.' });
    }

    const trimmedUpi = upiId.trim();

    if (trimmedUpi.length === 0) {
      return res.status(400).json({ message: 'UPI ID cannot be empty or whitespace only.' });
    }

    if (trimmedUpi.length < 5 || trimmedUpi.length > 256) {
      return res.status(400).json({ message: 'UPI ID must be between 5 and 256 characters.' });
    }

    // Common UPI format: username@bank
    const upiRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z0-9.\-_]{2,64}$/;
    if (!upiRegex.test(trimmedUpi)) {
      return res.status(400).json({
        message: 'Invalid UPI ID format. Please provide a valid UPI handle (e.g., yourname@upi or 9074268400@paytm).'
      });
    }

    const settings = await TournamentSettings.findOneAndUpdate(
      { key: 'tournament_settings' },
      {
        upiId: trimmedUpi,
        updatedBy: req.user?.email || 'admin',
        updatedAt: new Date()
      },
      { new: true, upsert: true, runValidators: true }
    );

    return res.json({
      success: true,
      message: 'Payment UPI ID updated successfully.',
      settings: {
        upiId: settings.upiId,
        updatedBy: settings.updatedBy,
        updatedAt: settings.updatedAt
      }
    });
  } catch (error) {
    console.error('Error in updatePaymentSettings:', error);
    return res.status(500).json({ message: 'Failed to update payment settings.' });
  }
};

module.exports = {
  getAllRegistrations,
  getRegistrationDetails,
  getRegistrationScreenshot,
  approveRegistration,
  rejectRegistration,
  getAdminStats,
  getAdminPaymentSettings,
  updatePaymentSettings
};
