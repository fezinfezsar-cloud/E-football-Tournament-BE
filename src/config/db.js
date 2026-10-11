const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/efootball_db';
    
    // Attempt standard connection
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 3000 // 3 seconds timeout before fallback
    });

    console.log(`[MongoDB] Connected: ${conn.connection.host}:${conn.connection.port}/${conn.connection.name}`);
  } catch (error) {
    console.warn(`[MongoDB] Primary connection failed (${error.message}). Attempting in-memory database fallback for seamless execution...`);
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
