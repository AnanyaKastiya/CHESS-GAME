require("dotenv").config();
const http = require("http");
const app = require("./app");
const { connectDB } = require("./config/db");
const { initRedis } = require("./config/redis");
const initializeSockets = require("./sockets");
const logger = require("./utils/logger");

const PORT = process.env.PORT || 3000;

async function startServer() {
  // Connect to Database and Cache
  await connectDB();
  initRedis();

  const server = http.createServer(app);
  const { io, roomManager, matchmakingService } = initializeSockets(server);

  server.listen(PORT, () => {
    logger.info(`🚀 Chess Multiplayer Server running on port ${PORT} in ${process.env.NODE_ENV || "development"} mode`);
  });

  // Graceful Shutdown
  const shutdown = () => {
    logger.info("Gracefully shutting down server...");
    server.close(() => {
      logger.info("HTTP server closed.");
      process.exit(0);
    });
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

startServer();
