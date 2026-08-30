const { v4: uuidv4 } = require("uuid");
const logger = require("../utils/logger");

class MatchmakingService {
  constructor(io, roomManager) {
    this.io = io;
    this.roomManager = roomManager;
    this.queue = []; // [{ socketId, userId, username, rating, joinedAt }]
  }

  addToQueue(socket, user = {}) {
    const userId = user.id || socket.id;
    const username = user.username || `Player_${socket.id.substring(0, 4)}`;
    const rating = user.rating || 1200;

    // Prevent duplicate entry
    if (this.queue.some((p) => p.socketId === socket.id || p.userId === userId)) {
      return { success: false, message: "Already in matchmaking queue" };
    }

    const playerEntry = {
      socketId: socket.id,
      userId,
      username,
      rating,
      joinedAt: Date.now(),
    };

    this.queue.push(playerEntry);
    logger.info(`Player ${username} (${rating}) joined matchmaking queue. Queue length: ${this.queue.length}`);

    socket.emit("matchmakingStatus", { status: "queued", position: this.queue.length });

    this.tryMatchPlayers();
    return { success: true };
  }

  removeFromQueue(socketId) {
    const index = this.queue.findIndex((p) => p.socketId === socketId);
    if (index !== -1) {
      const removed = this.queue.splice(index, 1)[0];
      logger.info(`Player ${removed.username} left matchmaking queue.`);
      return true;
    }
    return false;
  }

  tryMatchPlayers() {
    while (this.queue.length >= 2) {
      const player1 = this.queue.shift();
      const player2 = this.queue.shift();

      const socket1 = this.io.sockets.sockets.get(player1.socketId);
      const socket2 = this.io.sockets.sockets.get(player2.socketId);

      // Check if both sockets are still connected
      if (!socket1 || !socket1.connected) {
        if (socket2 && socket2.connected) {
          this.queue.unshift(player2);
        }
        continue;
      }

      if (!socket2 || !socket2.connected) {
        if (socket1 && socket1.connected) {
          this.queue.unshift(player1);
        }
        continue;
      }

      // Generate unique room ID
      const roomId = `match_${uuidv4().substring(0, 8)}`;
      const isP1White = Math.random() < 0.5;

      const whitePlayer = isP1White ? player1 : player2;
      const blackPlayer = isP1White ? player2 : player1;

      // Provision room in RoomManager
      this.roomManager.createRoom(roomId, { timeControl: { initial: 600, increment: 0 } });

      logger.info(`Match created: ${roomId} | White: ${whitePlayer.username} vs Black: ${blackPlayer.username}`);

      // Notify Player 1
      socket1.emit("matchFound", {
        roomId,
        role: isP1White ? "w" : "b",
        opponent: isP1White
          ? { username: blackPlayer.username, rating: blackPlayer.rating }
          : { username: whitePlayer.username, rating: whitePlayer.rating },
      });

      // Notify Player 2
      socket2.emit("matchFound", {
        roomId,
        role: isP1White ? "b" : "w",
        opponent: isP1White
          ? { username: whitePlayer.username, rating: whitePlayer.rating }
          : { username: blackPlayer.username, rating: blackPlayer.rating },
      });
    }
  }

  getQueueLength() {
    return this.queue.length;
  }
}

module.exports = MatchmakingService;
