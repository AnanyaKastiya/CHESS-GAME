const mongoose = require("mongoose");
const logger = require("../utils/logger");

let isConnected = false;

const connectDB = async () => {
  if (isConnected) return;

  const mongoURI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/chess_game_db";

  try {
    const conn = await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 3000,
    });
    isConnected = true;
    logger.info(`MongoDB connected successfully: ${conn.connection.host}`);
  } catch (err) {
    logger.warn(`MongoDB connection failed (${err.message}). Continuing in-memory without persistent DB.`);
    isConnected = false;
  }
};

const getDBStatus = () => isConnected;

module.exports = { connectDB, getDBStatus };
