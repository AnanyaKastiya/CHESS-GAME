const logger = require("../utils/logger");

function registerGameSocketHandlers(io, roomManager, matchmakingService) {
  io.on("connection", (socket) => {
    logger.info(`New client connected: ${socket.id}`);

    socket.on("findMatch", (userData) => {
      try {
        const user = userData || socket.user || {};
        matchmakingService.addToQueue(socket, user);
      } catch (err) {
        logger.error(`Error in findMatch for ${socket.id}:`, err);
        socket.emit("error", { message: "Matchmaking error" });
      }
    });

    socket.on("cancelMatchmaking", () => {
      try {
        matchmakingService.removeFromQueue(socket.id);
        socket.emit("matchmakingStatus", { status: "cancelled" });
      } catch (err) {
        logger.error(`Error in cancelMatchmaking for ${socket.id}:`, err);
      }
    });

    socket.on("joinRoom", ({ roomId, user }) => {
      try {
        if (!roomId) {
          return socket.emit("error", { message: "Room ID is required" });
        }
        const { role, room } = roomManager.joinRoom(roomId, socket, user || socket.user);
        socket.emit("playerRole", { role, roomId });
        logger.info(`Socket ${socket.id} assigned role ${role} in room ${roomId}`);
      } catch (err) {
        logger.error(`Error in joinRoom for ${socket.id}:`, err);
        socket.emit("error", { message: "Failed to join room" });
      }
    });

    socket.on("move", ({ roomId, move }) => {
      try {
        if (!roomId || !move) {
          return socket.emit("invalidMove", { error: "Invalid move payload" });
        }

        const result = roomManager.makeMove(roomId, socket.id, move);
        if (!result.success) {
          socket.emit("invalidMove", { error: result.error, move });
        }
      } catch (err) {
        logger.error(`Error handling move for ${socket.id} in ${roomId}:`, err);
        socket.emit("invalidMove", { error: "Server move error" });
      }
    });

    socket.on("resign", ({ roomId }) => {
      try {
        if (roomId) {
          roomManager.resign(roomId, socket.id);
        }
      } catch (err) {
        logger.error(`Error handling resign for ${socket.id}:`, err);
      }
    });

    socket.on("disconnect", () => {
      matchmakingService.removeFromQueue(socket.id);
      roomManager.handleDisconnect(socket.id);
    });
  });
}

module.exports = registerGameSocketHandlers;
