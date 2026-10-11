const mongoose = require('mongoose');
const tournamentConfig = require('../config/tournamentConfig');

const tournamentSettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: 'tournament_settings'
    },
    upiId: {
      type: String,
      required: [true, 'UPI ID is required'],
      trim: true
    },
    updatedBy: {
      type: String,
      default: 'admin'
    }
  },
  {
    timestamps: true
  }
);

// Static method to retrieve or initialize singleton settings document
tournamentSettingsSchema.statics.getActiveSettings = async function () {
  let settings = await this.findOne({ key: 'tournament_settings' });
  if (!settings) {
    const defaultUpi = tournamentConfig.upiId || 'techfest.efootball@upi';
    settings = await this.create({
      key: 'tournament_settings',
      upiId: defaultUpi,
      updatedBy: 'system'
    });
  }
  return settings;
};

const TournamentSettings = mongoose.model('TournamentSettings', tournamentSettingsSchema);

module.exports = TournamentSettings;
