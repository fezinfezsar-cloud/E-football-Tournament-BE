// Load environment variables immediately before loading other dependencies
const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const path = require('path');
const cors = require('cors');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

const app = express();

// Configure allowed origins for CORS (Netlify production domain, custom origins, and local dev)
const defaultDevOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000'
];

const configuredOrigins = [];
if (process.env.FRONTEND_URL) {
  process.env.FRONTEND_URL.split(',').forEach((url) => {
    const trimmed = url.trim().replace(/\/+$/, '');
    if (trimmed) configuredOrigins.push(trimmed);
  });
}
if (process.env.ALLOWED_ORIGINS) {
  process.env.ALLOWED_ORIGINS.split(',').forEach((url) => {
    const trimmed = url.trim().replace(/\/+$/, '');
    if (trimmed) configuredOrigins.push(trimmed);
  });
}

const allowedOrigins = Array.from(new Set([...defaultDevOrigins, ...configuredOrigins]));

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests (e.g. mobile apps, curl, health-check, server-to-server, tests)
    if (!origin) return callback(null, true);

    const normalizedOrigin = origin.replace(/\/+$/, '');

    // Allow exact match from allowed origins
    const isExplicitlyAllowed = allowedOrigins.some(
      (allowed) => allowed === '*' || allowed.toLowerCase() === normalizedOrigin.toLowerCase()
    );

    if (isExplicitlyAllowed) {
      return callback(null, true);
    }

    // Support all Netlify production and preview subdomains for the tournament app
    if (/^https:\/\/[a-zA-Z0-9_-]+\.netlify\.app$/i.test(normalizedOrigin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked: Origin ${origin} is not authorized.`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded payment screenshots as static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check endpoint (Render health monitoring)
app.get('/api/health', (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;
  res.status(isDbConnected ? 200 : 503).json({
    status: isDbConnected ? 'OK' : 'DEGRADED',
    database: isDbConnected ? 'CONNECTED' : 'DISCONNECTED',
    system: 'E-Football Tournament Registration Backend',
    timestamp: new Date()
  });
});

// Mount API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/tournament', require('./routes/tournamentRoutes'));
app.use('/api/registrations', require('./routes/registrationRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));

// Error Middlewares
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

let serverInstance = null;

const startServer = async () => {
  try {
    // Connect to MongoDB before accepting incoming requests
    await connectDB();

    serverInstance = app.listen(PORT, HOST, () => {
      console.log(`===================================================`);
      console.log(`⚡ E-Football Backend running on http://${HOST}:${PORT}`);
      console.log(`⚡ Mode: ${process.env.NODE_ENV || 'development'}`);
      console.log(`⚡ Admin Email Configured: ${process.env.ADMIN_EMAIL || 'admin@techfest.com'}`);
      console.log(`⚡ Allowed CORS Origins: ${allowedOrigins.join(', ')}`);
      console.log(`===================================================`);
    });

    return serverInstance;
  } catch (error) {
    console.error(`[Server Fatal Error] Server startup aborted: ${error.message}`);
    process.exit(1);
  }
};

// Start the server only when run directly (not when required as a module in tests)
if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
