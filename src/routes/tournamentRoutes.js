const express = require('express');
const router = express.Router();
const {
  getRules,
  getTournamentInfo,
  getPublicParticipants,
  getPaymentSettings
} = require('../controllers/tournamentController');

router.get('/rules', getRules);
router.get('/info', getTournamentInfo);
router.get('/participants', getPublicParticipants);
router.get('/payment-settings', getPaymentSettings);

module.exports = router;
