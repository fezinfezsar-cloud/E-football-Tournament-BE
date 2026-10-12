const mongoose = require('mongoose');

/**
 * Masks credentials in a MongoDB connection URI so it can be logged safely.
 * Example: mongodb+srv://admin:secret123@cluster0.abc.mongodb.net/db -> mongodb+srv://admin:****@cluster0.abc.mongodb.net/db
 */
const sanitizeMongoUri = (uri) => {
  if (!uri || typeof uri !== 'string') return '';
  return uri.replace(/(mongodb(?:\+srv)?:\/\/[^:]+:)([^@]+)(@.+)/i, '$1****$3');
};

/**
 * Checks if a URI targets a localhost or loopback address.
 */
const isLocalhostUri = (uri) => {
  if (!uri || typeof uri !== 'string') return false;
  return /^(mongodb(?:\+srv)?:\/\/)([^@]+@)?(127\.0\.0\.1|localhost|0\.0\.0\.0)(:\d+)?/i.test(uri.trim());
};

/**
 * Connects to MongoDB with environment-aware error handling and credential protection.
 */
const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  const isProduction = process.env.NODE_ENV === 'production';
  // Check MONGODB_URI first, with fallback to MONGO_URI
  const configuredUri = (process.env.MONGODB_URI || process.env.MONGO_URI || '').trim();

  // In production, strictly enforce a valid remote hosted MongoDB Atlas connection URI
  if (isProduction) {
    if (!configuredUri) {
      const errorMsg =
        `[MongoDB Configuration Error] Missing MongoDB connection string in production environment.\n` +
        `Render containers cannot connect to local databases. Please configure the 'MONGODB_URI' environment variable ` +
        `in Render's Environment settings with your MongoDB Atlas connection string ` +
        `(e.g., mongodb+srv://<username>:<password>@cluster0.mongodb.net/efootball_db?retryWrites=true&w=majority).`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    if (isLocalhostUri(configuredUri)) {
      const sanitized = sanitizeMongoUri(configuredUri);
      const errorMsg =
        `[MongoDB Configuration Error] Invalid MongoDB URI for production: '${sanitized}'.\n` +
        `Render services run in the cloud and cannot connect to '127.0.0.1' or 'localhost' on your personal computer.\n` +
        `Please update 'MONGODB_URI' in Render's Environment settings with your hosted MongoDB Atlas connection string.`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
  }

  // Determine target URI: in development/test, allow fallback to localhost if not configured
  const mongoUri = configuredUri || 'mongodb://127.0.0.1:27017/efootball_db';

  try {
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: isProduction ? 15000 : 5000
    });

    const hostDisplay = `${conn.connection.host}${conn.connection.port ? ':' + conn.connection.port : ''}`;
    console.log(`[MongoDB] Connected successfully: ${hostDisplay}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    const safeUri = sanitizeMongoUri(mongoUri);

    if (isProduction) {
      console.error(`[MongoDB] Production connection to MongoDB Atlas failed (${safeUri}):`, error.message);
      throw error;
    }

    // In local development, fall back to in-memory database if local MongoDB daemon is not running
    console.warn(`[MongoDB] Primary connection to ${safeUri} failed (${error.message}). Attempting in-memory database fallback for development...`);
    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const mongod = await MongoMemoryServer.create();
      const memoryUri = mongod.getUri();

      const conn = await mongoose.connect(memoryUri);
      console.log(`[MongoDB] Connected to In-Memory Instance: ${conn.connection.host}/${conn.connection.name}`);
      return conn;
    } catch (memError) {
      console.error(`[MongoDB] Database connection error:`, memError.message);
      throw memError;
    }
  }
};

module.exports = connectDB;
module.exports.sanitizeMongoUri = sanitizeMongoUri;
module.exports.isLocalhostUri = isLocalhostUri;
