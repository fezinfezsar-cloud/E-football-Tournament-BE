const mongoose = require('mongoose');

const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/efootball_db';
  const isProduction = process.env.NODE_ENV === 'production';

  try {
    // Attempt connection with appropriate timeout for Atlas/remote cluster
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: isProduction ? 15000 : 5000
    });

    const hostDisplay = `${conn.connection.host}${conn.connection.port ? ':' + conn.connection.port : ''}`;
    console.log(`[MongoDB] Connected: ${hostDisplay}/${conn.connection.name}`);
  } catch (error) {
    if (isProduction) {
      console.error(`[MongoDB] Production connection to MongoDB Atlas failed:`, error.message);
      throw error;
    }

    console.warn(`[MongoDB] Primary connection failed (${error.message}). Attempting in-memory database fallback for development...`);
    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const mongod = await MongoMemoryServer.create();
      const memoryUri = mongod.getUri();
      
      const conn = await mongoose.connect(memoryUri);
      console.log(`[MongoDB] Connected to In-Memory Instance: ${memoryUri}`);
    } catch (memError) {
      console.error(`[MongoDB] Database connection error:`, memError);
      process.exit(1);
    }
  }
};

module.exports = connectDB;
