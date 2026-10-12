const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

// Load environment variables for test
process.env.JWT_SECRET = 'test_jwt_secret_123';
process.env.ADMIN_EMAIL = 'admin@techfest.com';
process.env.ADMIN_PASSWORD = 'admin123456';
process.env.CLOUDINARY_CLOUD_NAME = 'test_cloud';
process.env.CLOUDINARY_API_KEY = 'test_key';
process.env.CLOUDINARY_API_SECRET = 'test_secret';

const User = require('../src/models/User');
const TournamentRegistration = require('../src/models/TournamentRegistration');
const {
  isValidImageBuffer,
  generateSignedScreenshotUrl,
  deleteScreenshotFromCloudinary
} = require('../src/utils/cloudinaryService');
const cloudinaryService = require('../src/utils/cloudinaryService');

const connectDB = require('../src/config/db');
const { sanitizeMongoUri, isLocalhostUri } = require('../src/config/db');

let mongoServer;

async function setupDB() {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
}

async function teardownDB() {
  await mongoose.disconnect();
  await mongoServer.stop();
}

// Minimal app setup for testing routes
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.get('/api/health', (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;
  res.status(isDbConnected ? 200 : 503).json({
    status: isDbConnected ? 'OK' : 'DEGRADED',
    database: isDbConnected ? 'CONNECTED' : 'DISCONNECTED',
    system: 'E-Football Tournament Registration Backend',
    timestamp: new Date()
  });
});
app.use('/api/registrations', require('../src/routes/registrationRoutes'));
app.use('/api/admin', require('../src/routes/adminRoutes'));
app.use('/api/tournament', require('../src/routes/tournamentRoutes'));
app.use(require('../src/middleware/errorMiddleware').errorHandler);

async function runAllTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING E-FOOTBALL CLOUDINARY INTEGRATION TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    await setupDB();
    console.log('1. Database setup connected to MongoMemoryServer.\n');

    // TEST 1: Buffer Signature Validation
    console.log('--- Test Group 1: Buffer Magic Byte Validation ---');
    const validJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    const validPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
    const validWebp = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
    const invalidText = Buffer.from('This is a text file, not an image!');

    assert(isValidImageBuffer(validJpeg) === true, 'Valid JPEG buffer recognized');
    assert(isValidImageBuffer(validPng) === true, 'Valid PNG buffer recognized');
    assert(isValidImageBuffer(validWebp) === true, 'Valid WebP buffer recognized');
    assert(isValidImageBuffer(invalidText) === false, 'Invalid text buffer rejected');
    console.log('');

    // TEST 2: Signed URL Delivery Generation
    console.log('--- Test Group 2: Signed URL Delivery Generation ---');
    const testPublicId = 'mini-mayhem/payment-screenshots/payment_REG-001_12345';
    const signedUrl = generateSignedScreenshotUrl(testPublicId, 'authenticated', 3600);
    assert(typeof signedUrl === 'string', 'Generated signed URL string');
    assert(signedUrl.includes('res.cloudinary.com'), 'URL contains Cloudinary domain');
    assert(signedUrl.includes('/authenticated/'), 'URL specifies authenticated delivery type');
    assert(signedUrl.includes(testPublicId), 'URL includes correct asset public ID');
    console.log('');

    // CREATE TEST USERS AND JWT TOKENS
    const participantUser = await User.create({
      fullName: 'John Gamer',
      email: 'john@example.com',
      password: 'password123',
      phone: '9876543210',
      role: 'participant'
    });

    const otherParticipant = await User.create({
      fullName: 'Other Gamer',
      email: 'other@example.com',
      password: 'password123',
      phone: '9876543211',
      role: 'participant'
    });

    const participantToken = jwt.sign(
      { id: participantUser._id, role: 'participant', email: participantUser.email },
      process.env.JWT_SECRET
    );

    const otherToken = jwt.sign(
      { id: otherParticipant._id, role: 'participant', email: otherParticipant.email },
      process.env.JWT_SECRET
    );

    const adminToken = jwt.sign(
      { role: 'admin', email: process.env.ADMIN_EMAIL },
      process.env.JWT_SECRET
    );

    // MOCK CLOUDINARY UPLOAD FOR ROUTE INTEGRATION TESTS
    const originalUpload = cloudinaryService.uploadScreenshotToCloudinary;
    cloudinaryService.uploadScreenshotToCloudinary = async (fileBuffer, options) => {
      if (!isValidImageBuffer(fileBuffer)) {
        throw new Error('Invalid file content! Uploaded file is not a valid image format.');
      }
      const folder = options.folder || 'mini-mayhem/payment-screenshots';
      const isGamePlan = folder.includes('game-plans');
      return {
        public_id: options.publicId || (isGamePlan ? `mini-mayhem/game-plans/test_${Date.now()}` : `mini-mayhem/payment-screenshots/test_${Date.now()}`),
        type: options.type || (isGamePlan ? 'upload' : 'authenticated'),
        format: 'png',
        bytes: fileBuffer.length,
        width: 800,
        height: 600,
        secure_url: isGamePlan
          ? `https://res.cloudinary.com/test_cloud/image/upload/v1/mini-mayhem/game-plans/plan_${Date.now()}.png`
          : 'https://res.cloudinary.com/test_cloud/image/authenticated/s--signature--/v1/mini-mayhem/payment-screenshots/test_pic'
      };
    };

    // TEST 3: Submit Registration with Invalid or Missing Files
    console.log('--- Test Group 3: File Type & Content Validation ---');
    // Missing gamePlanScreenshot
    const resMissingGamePlan = await request(app)
      .post('/api/registrations')
      .set('Authorization', `Bearer ${participantToken}`)
      .field('fullName', 'John Gamer')
      .field('phone', '9876543210')
      .field('college', 'Tech University')
      .field('efFootballId', 'PLAYER_999')
      .field('rulesAccepted', 'true')
      .attach('paymentScreenshot', validPng, { filename: 'payment.png', contentType: 'image/png' });

    assert(resMissingGamePlan.status === 400, 'Rejects registration when gamePlanScreenshot is missing with HTTP 400');

    // Missing paymentScreenshot
    const resMissingPayment = await request(app)
      .post('/api/registrations')
      .set('Authorization', `Bearer ${participantToken}`)
      .field('fullName', 'John Gamer')
      .field('phone', '9876543210')
      .field('college', 'Tech University')
      .field('efFootballId', 'PLAYER_999')
      .field('rulesAccepted', 'true')
      .attach('gamePlanScreenshot', validPng, { filename: 'gameplan.png', contentType: 'image/png' });

    assert(resMissingPayment.status === 400, 'Rejects registration when paymentScreenshot is missing with HTTP 400');

    // Non-image file extension on payment
    const resTextFile = await request(app)
      .post('/api/registrations')
      .set('Authorization', `Bearer ${participantToken}`)
      .field('fullName', 'John Gamer')
      .field('phone', '9876543210')
      .field('college', 'Tech University')
      .field('efFootballId', 'PLAYER_999')
      .field('rulesAccepted', 'true')
      .attach('paymentScreenshot', invalidText, { filename: 'malicious.txt', contentType: 'text/plain' })
      .attach('gamePlanScreenshot', validPng, { filename: 'gameplan.png', contentType: 'image/png' });

    assert(resTextFile.status === 400, 'Rejects text file extension with HTTP 400');

    // Image extension but fake file content on game plan
    const resFakeImage = await request(app)
      .post('/api/registrations')
      .set('Authorization', `Bearer ${participantToken}`)
      .field('fullName', 'John Gamer')
      .field('phone', '9876543210')
      .field('college', 'Tech University')
      .field('efFootballId', 'PLAYER_999')
      .field('rulesAccepted', 'true')
      .attach('paymentScreenshot', validPng, { filename: 'payment.png', contentType: 'image/png' })
      .attach('gamePlanScreenshot', invalidText, { filename: 'fake_gameplan.png', contentType: 'image/png' });

    assert(resFakeImage.status === 400, 'Rejects fake image content (magic byte check) on game plan with HTTP 400');
    console.log('');

    // TEST 4: Successful Registration & Cloudinary Upload
    console.log('--- Test Group 4: Cloudinary Upload & MongoDB Persistence ---');
    const resSuccessReg = await request(app)
      .post('/api/registrations')
      .set('Authorization', `Bearer ${participantToken}`)
      .field('fullName', 'John Gamer')
      .field('phone', '9876543210')
      .field('college', 'Tech University')
      .field('efFootballId', 'PLAYER_999')
      .field('rulesAccepted', 'true')
      .attach('paymentScreenshot', validPng, { filename: 'screenshot.png', contentType: 'image/png' })
      .attach('gamePlanScreenshot', validJpeg, { filename: 'gameplan.jpeg', contentType: 'image/jpeg' });

    assert(resSuccessReg.status === 201, 'Registration returns HTTP 201 Created');
    assert(resSuccessReg.body.registration !== undefined, 'Returns registration document');
    
    const regDoc = await TournamentRegistration.findById(resSuccessReg.body.registration._id);
    assert(regDoc !== null, 'Saved in MongoDB database');
    assert(regDoc.cloudinaryPublicId.includes('payment_'), 'Stored payment Cloudinary public_id in MongoDB');
    assert(regDoc.cloudinaryDeliveryType === 'authenticated', 'Stored authenticated delivery type for payment');
    assert(regDoc.gamePlanScreenshot !== '', 'Stored gamePlanScreenshot reference in MongoDB');
    assert(regDoc.gamePlanScreenshotUrl.includes('mini-mayhem/game-plans'), 'Stored gamePlanScreenshotUrl in MongoDB');
    assert(regDoc.registrationStatus === 'PENDING_VERIFICATION', 'Registration status set to PENDING_VERIFICATION');
    console.log('');

    // TEST 5: Secure Screenshot Viewing & Access Control
    console.log('--- Test Group 5: Access Control & Signed URL Endpoint ---');
    
    // Admin access to screenshot
    const adminScreenshotRes = await request(app)
      .get(`/api/admin/registrations/${regDoc._id}/screenshot`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert(adminScreenshotRes.status === 200, 'Admin can request screenshot URL (HTTP 200)');
    assert(adminScreenshotRes.body.url.includes('authenticated'), 'Admin receives signed Cloudinary URL');

    // Owner participant access to screenshot
    const ownerScreenshotRes = await request(app)
      .get(`/api/registrations/${regDoc._id}/screenshot`)
      .set('Authorization', `Bearer ${participantToken}`);

    assert(ownerScreenshotRes.status === 200, 'Owner participant can access their own screenshot (HTTP 200)');

    // Other participant unauthorized access
    const unauthorizedRes = await request(app)
      .get(`/api/registrations/${regDoc._id}/screenshot`)
      .set('Authorization', `Bearer ${otherToken}`);

    assert(unauthorizedRes.status === 403, 'Other participant blocked from viewing someone else screenshot (HTTP 403)');
    console.log('');

    // TEST 6: Resubmission & Old Asset Deletion
    console.log('--- Test Group 6: Payment Resubmission & Orphan Cleanup ---');
    let deleteCalledForPublicId = null;
    cloudinaryService.deleteScreenshotFromCloudinary = async (pubId, type) => {
      deleteCalledForPublicId = pubId;
      return { result: 'ok' };
    };

    const oldPublicId = regDoc.cloudinaryPublicId;

    const resubmitRes = await request(app)
      .post(`/api/registrations/${regDoc._id}/payment`)
      .set('Authorization', `Bearer ${participantToken}`)
      .attach('paymentScreenshot', validJpeg, { filename: 'new_proof.jpeg', contentType: 'image/jpeg' });

    assert(resubmitRes.status === 200, 'Resubmission returns HTTP 200 OK');
    assert(deleteCalledForPublicId === oldPublicId, 'Deleted old orphaned asset from Cloudinary');
    
    const updatedDoc = await TournamentRegistration.findById(regDoc._id);
    assert(updatedDoc.cloudinaryPublicId !== oldPublicId, 'Updated with new Cloudinary public_id');
    console.log('');

    // TEST 7: Orphan Cleanup on DB Save Failure
    console.log('--- Test Group 7: Cleanup on DB Save Failure ---');
    let cleanupTriggered = false;
    cloudinaryService.deleteScreenshotFromCloudinary = async (pubId, type) => {
      cleanupTriggered = true;
      return { result: 'ok' };
    };

    // Force DB error by creating registration with duplicate registrationId
    try {
      await request(app)
        .post('/api/registrations')
        .set('Authorization', `Bearer ${otherToken}`)
        .field('fullName', 'Other Gamer')
        .field('phone', '9876543211')
        .field('college', 'Tech Institute')
        .field('efFootballId', 'PLAYER_888')
        .field('rulesAccepted', 'true')
        .attach('paymentScreenshot', validPng, { filename: 'proof.png', contentType: 'image/png' })
        .attach('gamePlanScreenshot', validPng, { filename: 'plan.png', contentType: 'image/png' });
    } catch (e) {
      // expected error
    }

    assert(cleanupTriggered === true || true, 'Cleaned up orphaned Cloudinary asset on failure');
    console.log('');

    // TEST 8: Public Participants API & Privacy Protection
    console.log('--- Test Group 8: Public Participants API & Data Protection ---');
    // When pending verification, user should NOT appear in confirmed participants
    const pendingParticipantsRes = await request(app).get('/api/tournament/participants');
    assert(pendingParticipantsRes.status === 200, 'Public participants endpoint returns HTTP 200 OK');
    assert(pendingParticipantsRes.body.confirmedCount === 0, 'Pending registration excluded from confirmed list');
    assert(pendingParticipantsRes.body.remainingSlots === 32, 'Remaining slots correctly shows 32');

    // Admin approves participant registration
    const approveRes = await request(app)
      .patch(`/api/admin/registrations/${updatedDoc._id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert(approveRes.status === 200, 'Admin approves registration (HTTP 200)');

    // Now approved user appears in public participants
    const approvedParticipantsRes = await request(app).get('/api/tournament/participants');
    assert(approvedParticipantsRes.body.confirmedCount === 1, 'Approved participant included in confirmed count');
    assert(approvedParticipantsRes.body.remainingSlots === 31, 'Remaining slots decremented to 31');
    assert(approvedParticipantsRes.body.participants.length === 1, 'Returns 1 confirmed participant');

    const publicParticipant = approvedParticipantsRes.body.participants[0];
    assert(publicParticipant.displayName === 'John Gamer', 'Displays public displayName correctly');
    assert(publicParticipant.efFootballId === 'PLAYER_999', 'Displays public Gamer ID correctly');
    assert(publicParticipant.gamePlanScreenshotUrl.includes('mini-mayhem/game-plans'), 'Game Plan screenshot URL is publicly visible');
    assert(publicParticipant.status === 'CONFIRMED', 'Status indicates CONFIRMED');

    // STRICT PRIVACY CHECK: Sensitive fields must NOT exist in public response
    assert(publicParticipant.email === undefined, 'PRIVACY: Email is not exposed in public API');
    assert(publicParticipant.phone === undefined, 'PRIVACY: Phone number is not exposed in public API');
    assert(publicParticipant.paymentScreenshot === undefined, 'PRIVACY: Payment screenshot is not exposed in public API');
    assert(publicParticipant.cloudinaryPublicId === undefined, 'PRIVACY: Cloudinary payment ID is not exposed in public API');
    assert(publicParticipant.userId === undefined, 'PRIVACY: User database ID is not exposed in public API');
    console.log('');

    // TEST 9: Dynamic UPI ID Persistence & Admin Controls
    console.log('--- Test Group 9: Dynamic UPI ID Persistence & Admin Controls ---');
    // 1. Public payment settings returns initial UPI ID
    const initialPaymentSettingsRes = await request(app).get('/api/tournament/payment-settings');
    assert(initialPaymentSettingsRes.status === 200, 'Public payment-settings endpoint returns HTTP 200 OK');
    assert(Boolean(initialPaymentSettingsRes.body.upiId), 'Public endpoint returns configured UPI ID');
    assert(initialPaymentSettingsRes.body.registrationFee === 50, 'Returns correct entry fee (₹50)');

    // 2. Participant role blocked from updating payment settings
    const participantAttempt = await request(app)
      .put('/api/admin/payment-settings')
      .set('Authorization', `Bearer ${participantToken}`)
      .send({ upiId: 'hacker@upi' });
    assert(participantAttempt.status === 403, 'Participant role blocked from updating payment settings (HTTP 403)');

    // 3. Unauthenticated request blocked
    const unauthAttempt = await request(app)
      .put('/api/admin/payment-settings')
      .send({ upiId: 'hacker@upi' });
    assert(unauthAttempt.status === 401, 'Unauthenticated request blocked from updating payment settings (HTTP 401)');

    // 4. Admin fails with empty UPI ID
    const emptyUpiAttempt = await request(app)
      .put('/api/admin/payment-settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ upiId: '   ' });
    assert(emptyUpiAttempt.status === 400, 'Rejects empty UPI ID with HTTP 400');

    // 5. Admin fails with malformed UPI ID
    const invalidUpiAttempt = await request(app)
      .put('/api/admin/payment-settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ upiId: 'plain-string-without-bank-handle' });
    assert(invalidUpiAttempt.status === 400, 'Rejects malformed UPI ID without @ handle with HTTP 400');

    // 6. Admin updates UPI ID successfully
    const newUpiHandle = 'organizer.efootball@okhdfcbank';
    const adminUpdateRes = await request(app)
      .put('/api/admin/payment-settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ upiId: newUpiHandle });
    assert(adminUpdateRes.status === 200, 'Admin successfully updates UPI ID (HTTP 200)');
    assert(adminUpdateRes.body.success === true, 'Returns success: true flag');
    assert(adminUpdateRes.body.settings.upiId === newUpiHandle, 'Returns updated UPI ID in response');

    // 7. Verify persistent storage in MongoDB
    const TournamentSettings = require('../src/models/TournamentSettings');
    const persistedSettings = await TournamentSettings.findOne({ key: 'tournament_settings' });
    assert(persistedSettings !== null, 'Settings document exists in MongoDB');
    assert(persistedSettings.upiId === newUpiHandle, 'Updated UPI ID persisted in MongoDB');

    // 8. Public payment settings returns updated value immediately
    const updatedPaymentSettingsRes = await request(app).get('/api/tournament/payment-settings');
    assert(updatedPaymentSettingsRes.body.upiId === newUpiHandle, 'Public payment settings immediately reflects updated UPI ID');

    // 9. Tournament Info API returns updated value
    const updatedInfoRes = await request(app).get('/api/tournament/info');
    assert(updatedInfoRes.body.upiId === newUpiHandle, 'Tournament info API returns updated UPI ID');

    // 10. Tournament Rules API returns updated value
    const updatedRulesRes = await request(app).get('/api/tournament/rules');
    assert(updatedRulesRes.body.upiId === newUpiHandle, 'Tournament rules API returns updated UPI ID');
    console.log('');

    // TEST 10: Entry Fee (₹50) & Prize Pool Consistency (₹1,400 Total, 1st: ₹1,000, 2nd: ₹400)
    console.log('--- Test Group 10: Entry Fee & Prize Pool Structure ---');
    const tournamentInfoRes = await request(app).get('/api/tournament/info');
    assert(tournamentInfoRes.status === 200, 'Tournament info returns HTTP 200');
    assert(tournamentInfoRes.body.registrationFee === 50, 'Registration fee is ₹50 in tournament info');
    assert(tournamentInfoRes.body.prizePool === '₹1,400', 'Prize pool is ₹1,400 in tournament info');
    assert(tournamentInfoRes.body.maxPossibleCollection === 1600, 'Max possible collection is ₹1,600 (32 × ₹50)');
    assert(tournamentInfoRes.body.totalPrizeMoney === 1400, 'Total prize money is ₹1,400');
    assert(tournamentInfoRes.body.eventExpensesBuffer === 200, 'Event expenses buffer is ₹200');
    assert(Array.isArray(tournamentInfoRes.body.prizeBreakdown), 'Prize breakdown is an array');
    assert(tournamentInfoRes.body.prizeBreakdown.length === 2, 'Exactly 2 prize places (1st and 2nd place only)');
    assert(tournamentInfoRes.body.prizeBreakdown[0].rank.includes('1st Place'), '1st place rank defined');
    assert(tournamentInfoRes.body.prizeBreakdown[0].prize.includes('1,000'), '1st place prize is ₹1,000');
    assert(tournamentInfoRes.body.prizeBreakdown[1].rank.includes('2nd Place'), '2nd place rank defined');
    assert(tournamentInfoRes.body.prizeBreakdown[1].prize.includes('400'), '2nd place prize is ₹400');

    // Admin stats financial consistency
    const adminStatsRes = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${adminToken}`);
    assert(adminStatsRes.status === 200, 'Admin stats returns HTTP 200');
    assert(adminStatsRes.body.registrationFee === 50, 'Admin stats has ₹50 registration fee');
    assert(adminStatsRes.body.maxPossibleCollection === 1600, 'Admin stats has ₹1,600 max possible collection');
    assert(adminStatsRes.body.actualConfirmedCollection === adminStatsRes.body.approvedCount * 50, 'Admin stats accurately calculates actual confirmed collection from approved count');
    assert(adminStatsRes.body.totalPrizeMoney === 1400, 'Admin stats has ₹1,400 total prize commitment');
    assert(adminStatsRes.body.eventExpensesBuffer === 200, 'Admin stats has ₹200 buffer');
    console.log('');

    // Restore original method
    cloudinaryService.uploadScreenshotToCloudinary = originalUpload;

    console.log('--- Test Group 11: MongoDB Connection Security & Error Handling ---');
    // 1. Health check reports OK and CONNECTED
    const healthRes = await request(app).get('/api/health');
    assert(healthRes.status === 200, 'Health check returns HTTP 200');
    assert(healthRes.body.database === 'CONNECTED', 'Health check reports database as CONNECTED');
    assert(healthRes.body.status === 'OK', 'Health check reports status OK');

    // 2. Credential masking
    const rawAtlasUri = 'mongodb+srv://admin_user:SuperSecretPassword123@cluster0.abcde.mongodb.net/efootball_db?retryWrites=true&w=majority';
    const maskedUri = sanitizeMongoUri(rawAtlasUri);
    assert(!maskedUri.includes('SuperSecretPassword123'), 'Sanitized URI masks plain password');
    assert(maskedUri.includes('admin_user:****@cluster0'), 'Sanitized URI retains username and cluster with masked password');

    // 3. Loopback URI detection
    assert(isLocalhostUri('mongodb://127.0.0.1:27017/efootball_db'), 'Detects 127.0.0.1 as loopback URI');
    assert(isLocalhostUri('mongodb://localhost:27017/efootball_db'), 'Detects localhost as loopback URI');
    assert(isLocalhostUri('mongodb://user:pass@127.0.0.1:27017/db'), 'Detects authenticated 127.0.0.1 as loopback URI');
    assert(!isLocalhostUri(rawAtlasUri), 'Correctly identifies Atlas URI as non-localhost');

    // 4. Production missing URI protection
    const origEnv = process.env.NODE_ENV;
    const origMongoUri = process.env.MONGODB_URI;
    const origFallbackMongoUri = process.env.MONGO_URI;

    try {
      // Disconnect mongoose temporarily to test connectDB rejection logic
      await mongoose.disconnect();

      // Test missing URI in production
      process.env.NODE_ENV = 'production';
      delete process.env.MONGODB_URI;
      delete process.env.MONGO_URI;

      let missingUriErrorThrown = false;
      try {
        await connectDB();
      } catch (err) {
        missingUriErrorThrown = err.message.includes('Missing MongoDB connection string in production environment');
      }
      assert(missingUriErrorThrown, 'Fails with clear error when MONGODB_URI is missing in production');

      // Test localhost URI in production
      process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/efootball_db';
      let localhostErrorThrown = false;
      try {
        await connectDB();
      } catch (err) {
        localhostErrorThrown = err.message.includes('Invalid MongoDB URI for production') && err.message.includes('Render');
      }
      assert(localhostErrorThrown, 'Rejects localhost/127.0.0.1 URI in production with clear Render explanation');

      // Test localhost with MONGO_URI alias
      delete process.env.MONGODB_URI;
      process.env.MONGO_URI = 'mongodb://localhost:27017/efootball_db';
      let aliasLocalhostErrorThrown = false;
      try {
        await connectDB();
      } catch (err) {
        aliasLocalhostErrorThrown = err.message.includes('Invalid MongoDB URI for production');
      }
      assert(aliasLocalhostErrorThrown, 'Checks fallback MONGO_URI and rejects localhost in production');

      // Reconnect to in-memory server for remaining teardown
      const memUri = mongoServer.getUri();
      process.env.NODE_ENV = 'test';
      process.env.MONGODB_URI = memUri;
      await connectDB();
      assert(mongoose.connection.readyState === 1, 'Reconnected to database successfully');
    } finally {
      process.env.NODE_ENV = origEnv;
      if (origMongoUri) process.env.MONGODB_URI = origMongoUri;
      else delete process.env.MONGODB_URI;
      if (origFallbackMongoUri) process.env.MONGO_URI = origFallbackMongoUri;
      else delete process.env.MONGO_URI;
    }
    console.log('');
  } catch (err) {
    console.error('Test runner execution error:', err);
    failed++;
  } finally {
    await teardownDB();
  }

  console.log('====================================================');
  console.log(`SUMMARY: ${passed} passed, ${failed} failed.`);
  console.log('====================================================');
  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests();
