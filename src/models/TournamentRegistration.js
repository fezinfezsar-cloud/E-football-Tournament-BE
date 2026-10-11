const mongoose = require('mongoose');

const tournamentRegistrationSchema = new mongoose.Schema(
  {
    registrationId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true
    },
    college: {
      type: String,
      required: [true, 'College/Institution name is required'],
      trim: true
    },
    efFootballId: {
      type: String,
      required: [true, 'E-Football Gamer/Player ID is required'],
      trim: true
    },
    teamName: {
      type: String,
      default: '',
      trim: true
    },
    rulesAccepted: {
      type: Boolean,
      required: [true, 'Rules acceptance status is required'],
      default: false
    },
    rulesAcceptedAt: {
      type: Date,
      default: null
    },
    paymentScreenshot: {
      type: String,
      default: ''
    },
    cloudinaryPublicId: {
      type: String,
      default: ''
    },
    cloudinaryDeliveryType: {
      type: String,
      enum: ['authenticated', 'private', 'upload'],
      default: 'authenticated'
    },
    cloudinaryMetadata: {
      format: { type: String, default: '' },
      bytes: { type: Number, default: 0 },
      width: { type: Number, default: 0 },
      height: { type: Number, default: 0 },
      uploadedAt: { type: Date, default: null }
    },
    gamePlanScreenshot: {
      type: String,
      default: ''
    },
    cloudinaryGamePlanPublicId: {
      type: String,
      default: ''
    },
    cloudinaryGamePlanDeliveryType: {
      type: String,
      enum: ['authenticated', 'private', 'upload'],
      default: 'upload'
    },
    gamePlanScreenshotUrl: {
      type: String,
      default: ''
    },
    gamePlanMetadata: {
      format: { type: String, default: '' },
      bytes: { type: Number, default: 0 },
      width: { type: Number, default: 0 },
      height: { type: Number, default: 0 },
      uploadedAt: { type: Date, default: null }
    },
    paymentStatus: {
      type: String,
      enum: ['NOT_SUBMITTED', 'PENDING', 'VERIFIED', 'REJECTED'],
      default: 'NOT_SUBMITTED'
    },
    registrationStatus: {
      type: String,
      enum: ['DRAFT', 'PENDING_VERIFICATION', 'APPROVED', 'REJECTED'],
      default: 'DRAFT'
    },
    rejectionReason: {
      type: String,
      default: ''
    },
    submittedAt: {
      type: Date,
      default: null
    },
    verifiedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

const TournamentRegistration = mongoose.model(
  'TournamentRegistration',
  tournamentRegistrationSchema
);

module.exports = TournamentRegistration;
