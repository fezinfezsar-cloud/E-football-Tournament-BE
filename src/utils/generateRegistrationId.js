const TournamentRegistration = require('../models/TournamentRegistration');

const generateRegistrationId = async () => {
  const currentYear = new Date().getFullYear();
  const prefix = `EFT-${currentYear}-`;

  // Find the registration with the highest sequential number
  const count = await TournamentRegistration.countDocuments();
  const nextNum = (count + 1).toString().padStart(4, '0');
  
  let registrationId = `${prefix}${nextNum}`;
  
  // Safety loop in case of collisions
  let exists = await TournamentRegistration.findOne({ registrationId });
  let counter = count + 1;
  while (exists) {
    counter++;
    const padded = counter.toString().padStart(4, '0');
    registrationId = `${prefix}${padded}`;
    exists = await TournamentRegistration.findOne({ registrationId });
  }

  return registrationId;
};

module.exports = generateRegistrationId;
