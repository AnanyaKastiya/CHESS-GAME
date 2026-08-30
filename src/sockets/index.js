const socketIo = require("socket.io");
const jwt = require("jsonwebtoken");
const RoomManager = require("./RoomManager");
const MatchmakingService = require("../services/matchmakingService");
const registerGameSocketHandlers = require("./gameSocket");
const logger = require("../utils/logger");

function initializeSockets(server) {
  const io = socketIo(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  // Socket authentication middleware (optional token support for guests and logged-in users)
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(" ")[1];
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "chess_jwt_secret_dev_key");
        socket.user = decoded;
      } catch (err) {
        logger.warn(`Invalid socket token: ${err.message}`);
      }
    }
    next();
  });

  const roomManager = new RoomManager(io);
  const matchmakingService = new MatchmakingService(io, roomManager);
  registerGameSocketHandlers(io, roomManager, matchmakingService);

  return { io, roomManager, matchmakingService };
}

module.exports = initializeSockets;
