const express = require('express');
const path = require('path');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

// Load environment configuration
dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();

// Core Middlewares
app.use(cors({
  origin: '*', // Allow connections from frontend dev server
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded payment screenshots as static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
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

app.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`⚡ E-Football Backend running on port ${PORT}`);
  console.log(`⚡ Mode: ${process.env.NODE_ENV || 'development'}`);
  console.log(`⚡ Admin Email Configured: ${process.env.ADMIN_EMAIL || 'admin@techfest.com'}`);
  console.log(`===================================================`);
});
