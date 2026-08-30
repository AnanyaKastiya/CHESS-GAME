const Redis = require("ioredis");
const logger = require("../utils/logger");

let redisClient = null;
let isRedisAvailable = false;

const initRedis = () => {
  const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";

  try {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      retryStrategy: () => null, // Don't crash if Redis is unavailable locally
      lazyConnect: true,
    });

    redisClient.connect()
      .then(() => {
        isRedisAvailable = true;
        logger.info("Connected to Redis successfully.");
      })
      .catch((err) => {
        isRedisAvailable = false;
        logger.warn(`Redis connection failed (${err.message}). Using in-memory fallback for queues & caching.`);
      });

    redisClient.on("error", (err) => {
      isRedisAvailable = false;
    });
  } catch (err) {
    isRedisAvailable = false;
    logger.warn(`Redis initialization error: ${err.message}. Using in-memory fallback.`);
  }

  return redisClient;
};

const getRedisClient = () => redisClient;
const isRedisReady = () => isRedisAvailable;

module.exports = { initRedis, getRedisClient, isRedisReady };
