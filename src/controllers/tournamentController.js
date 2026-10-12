const TournamentRegistration = require('../models/TournamentRegistration');
const TournamentSettings = require('../models/TournamentSettings');
const tournamentConfig = require('../config/tournamentConfig');

// @desc    Get tournament rules and regulations
// @route   GET /api/tournament/rules
// @access  Public
const getRules = async (req, res) => {
  try {
    const settings = await TournamentSettings.getActiveSettings();
    return res.json({
      rules: tournamentConfig.rules,
      registrationFee: tournamentConfig.registrationFee,
      currency: tournamentConfig.currency,
      upiId: settings?.upiId || tournamentConfig.upiId,
      tournamentName: tournamentConfig.tournamentName,
      techfestName: tournamentConfig.techfestName,
      venue: tournamentConfig.venue,
      eventDate: tournamentConfig.eventDate,
      platform: tournamentConfig.platform,
      maxParticipants: tournamentConfig.maxParticipants || 32,
      prizePool: tournamentConfig.prizePool,
      prizeDescription: tournamentConfig.prizeDescription,
      prizeBreakdown: tournamentConfig.prizeBreakdown
    });
  } catch (error) {
    return res.json({
      rules: tournamentConfig.rules,
      registrationFee: tournamentConfig.registrationFee,
      currency: tournamentConfig.currency,
      upiId: tournamentConfig.upiId,
      tournamentName: tournamentConfig.tournamentName,
      techfestName: tournamentConfig.techfestName,
      venue: tournamentConfig.venue,
      eventDate: tournamentConfig.eventDate,
      platform: tournamentConfig.platform,
      maxParticipants: tournamentConfig.maxParticipants || 32,
      prizePool: tournamentConfig.prizePool,
      prizeDescription: tournamentConfig.prizeDescription,
      prizeBreakdown: tournamentConfig.prizeBreakdown
    });
  }
};

// @desc    Get full tournament info with active registration capacity
// @route   GET /api/tournament/info
// @access  Public
const getTournamentInfo = async (req, res) => {
  try {
    const [activeCount, settings] = await Promise.all([
      TournamentRegistration.countDocuments({
        registrationStatus: { $ne: 'REJECTED' }
      }),
      TournamentSettings.getActiveSettings()
    ]);
    const maxParticipants = tournamentConfig.maxParticipants || 32;

    return res.json({
      ...tournamentConfig,
      upiId: settings?.upiId || tournamentConfig.upiId,
      activeCount,
      maxParticipants,
      isFull: activeCount >= maxParticipants,
      remainingSeats: Math.max(0, maxParticipants - activeCount)
    });
  } catch (error) {
    return res.json({
      ...tournamentConfig,
      activeCount: 0,
      maxParticipants: 32,
      isFull: false,
      remainingSeats: 32
    });
  }
};

// @desc    Get public read-only payment settings (current UPI ID)
// @route   GET /api/tournament/payment-settings
// @access  Public
const getPaymentSettings = async (req, res) => {
  try {
    const settings = await TournamentSettings.getActiveSettings();
    const upiId = settings?.upiId?.trim() || '';
    return res.json({
      upiId,
      registrationFee: tournamentConfig.registrationFee,
      currency: tournamentConfig.currency,
      isConfigured: Boolean(upiId.length > 0)
    });
  } catch (error) {
    console.error('Error in getPaymentSettings:', error);
    return res.status(500).json({ message: 'Failed to fetch payment settings' });
  }
};

// @desc    Get public list of confirmed (approved) tournament participants
// @route   GET /api/tournament/participants
// @access  Public
const getPublicParticipants = async (req, res) => {
  try {
    const maxCapacity = tournamentConfig.maxParticipants || 32;

    // Strict filter: ONLY APPROVED registrations are confirmed participants
    const approvedRegistrations = await TournamentRegistration.find({
      registrationStatus: 'APPROVED'
    })
      .sort({ verifiedAt: 1, createdAt: 1 })
      .select('fullName efFootballId college teamName registrationId registrationStatus gamePlanScreenshotUrl verifiedAt createdAt')
      .lean();

    const confirmedCount = approvedRegistrations.length;
    const remainingSlots = Math.max(0, maxCapacity - confirmedCount);

    // Sanitize and format data: strictly no emails, phones, payment screenshots or private ids
    const participants = approvedRegistrations.map((reg) => ({
      registrationId: reg.registrationId,
      displayName: reg.fullName,
      efFootballId: reg.efFootballId,
      college: reg.college,
      teamName: reg.teamName || '',
      gamePlanScreenshotUrl: reg.gamePlanScreenshotUrl || '',
      status: 'CONFIRMED',
      verifiedAt: reg.verifiedAt || reg.createdAt
    }));

    return res.json({
      participants,
      confirmedCount,
      maxCapacity,
      remainingSlots,
      isFull: confirmedCount >= maxCapacity
    });
  } catch (error) {
    console.error('Error fetching public participants:', error);
    return res.status(500).json({
      message: 'Failed to fetch public participants list.',
      participants: [],
      confirmedCount: 0,
      maxCapacity: 32,
      remainingSlots: 32,
      isFull: false
    });
  }
};

module.exports = {
  getRules,
  getTournamentInfo,
  getPublicParticipants,
  getPaymentSettings
};
