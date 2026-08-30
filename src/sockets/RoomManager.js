const { Chess } = require("chess.js");
const logger = require("../utils/logger");

class RoomManager {
  constructor(io) {
    this.io = io;
    this.rooms = new Map();
    this.userSocketMap = new Map();
    this.reconnectTimeouts = new Map();
  }

  createRoom(roomId, options = {}) {
    const timeControl = options.timeControl || { initial: 600, increment: 0 };
    const room = {
      id: roomId,
      chess: new Chess(),
      white: null,
      black: null,
      spectators: [],
      status: "waiting",
      timeControl,
      timers: {
        white: timeControl.initial,
        black: timeControl.initial,
        lastMoveTime: null,
      },
      timerInterval: null,
      drawOffer: null,
      moves: [],
      winner: null,
      winReason: null,
      createdAt: new Date(),
    };

    this.rooms.set(roomId, room);
    logger.info(`Room created: ${roomId}`, { timeControl });
    return room;
  }

  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  joinRoom(roomId, socket, user = {}) {
    let room = this.getRoom(roomId);
    if (!room) {
      room = this.createRoom(roomId);
    }

    const userId = user.id || socket.id;
    const username = user.username || `Player_${socket.id.substring(0, 4)}`;

    socket.join(`game:${roomId}`);

    if (room.white && room.white.userId === userId) {
      room.white.socketId = socket.id;
      room.white.connected = true;
      this.clearReconnectTimeout(userId);
      this.userSocketMap.set(socket.id, { roomId, role: "w", userId });
      logger.info(`Player reconnected as White: ${username} in ${roomId}`);
      this.broadcastRoomState(roomId);
      return { role: "w", room };
    }

    if (room.black && room.black.userId === userId) {
      room.black.socketId = socket.id;
      room.black.connected = true;
      this.clearReconnectTimeout(userId);
      this.userSocketMap.set(socket.id, { roomId, role: "b", userId });
      logger.info(`Player reconnected as Black: ${username} in ${roomId}`);
      this.broadcastRoomState(roomId);
      return { role: "b", room };
    }

    let role = "spectator";

    if (!room.white) {
      room.white = { socketId: socket.id, userId, username, connected: true };
      role = "w";
    } else if (!room.black && room.white.userId !== userId) {
      room.black = { socketId: socket.id, userId, username, connected: true };
      role = "b";
    } else {
      room.spectators.push({ socketId: socket.id, userId, username });
    }

    this.userSocketMap.set(socket.id, { roomId, role, userId });
    logger.info(`User ${username} joined ${roomId} as ${role}`);

    if (room.white && room.black && room.status === "waiting") {
      room.status = "active";
      room.timers.lastMoveTime = Date.now();
      this.startClock(roomId);
      logger.info(`Game started in room ${roomId}: ${room.white.username} (W) vs ${room.black.username} (B)`);
    }

    this.broadcastRoomState(roomId);
    return { role, room };
  }

  makeMove(roomId, socketId, moveData) {
    const room = this.getRoom(roomId);
    if (!room) return { success: false, error: "Room not found" };
    if (room.status !== "active") return { success: false, error: "Game is not active" };

    const currentTurn = room.chess.turn();
    const playerRole = currentTurn === "w" ? room.white : room.black;

    if (!playerRole || playerRole.socketId !== socketId) {
      return { success: false, error: "Not your turn or unauthorized" };
    }

    try {
      const now = Date.now();
      const elapsedSeconds = room.timers.lastMoveTime
        ? (now - room.timers.lastMoveTime) / 1000
        : 0;

      const moveResult = room.chess.move(moveData);
      if (!moveResult) {
        return { success: false, error: "Illegal move" };
      }

      if (currentTurn === "w") {
        room.timers.white = Math.max(0, room.timers.white - elapsedSeconds + room.timeControl.increment);
      } else {
        room.timers.black = Math.max(0, room.timers.black - elapsedSeconds + room.timeControl.increment);
      }
      room.timers.lastMoveTime = now;

      room.moves.push({
        from: moveResult.from,
        to: moveResult.to,
        promotion: moveResult.promotion,
        san: moveResult.san,
        fen: room.chess.fen(),
        timeSpent: elapsedSeconds,
        timestamp: new Date(),
      });

      room.drawOffer = null;

      if (room.chess.isGameOver()) {
        this.endGame(roomId, this.resolveGameOverReason(room.chess));
      }

      this.broadcastRoomState(roomId, { lastMove: moveResult });
      return { success: true, move: moveResult, fen: room.chess.fen() };
    } catch (err) {
      logger.error(`Error executing move in ${roomId}:`, err);
      return { success: false, error: err.message };
    }
  }

  startClock(roomId) {
    const room = this.getRoom(roomId);
    if (!room || room.timerInterval) return;

    room.timerInterval = setInterval(() => {
      if (room.status !== "active") {
        clearInterval(room.timerInterval);
        room.timerInterval = null;
        return;
      }

      const currentTurn = room.chess.turn();
      const now = Date.now();
      const elapsed = room.timers.lastMoveTime ? (now - room.timers.lastMoveTime) / 1000 : 0;
      const remainingTime =
        currentTurn === "w"
          ? room.timers.white - elapsed
          : room.timers.black - elapsed;

      if (remainingTime <= 0) {
        const winner = currentTurn === "w" ? "b" : "w";
        this.endGame(roomId, {
          winner,
          reason: "timeout",
        });
      }
    }, 500);
  }

  stopClock(roomId) {
    const room = this.getRoom(roomId);
    if (room && room.timerInterval) {
      clearInterval(room.timerInterval);
      room.timerInterval = null;
    }
  }

  resolveGameOverReason(chess) {
    if (chess.isCheckmate()) {
      return {
        winner: chess.turn() === "w" ? "b" : "w",
        reason: "checkmate",
      };
    }
    if (chess.isDraw()) {
      let reason = "draw";
      if (chess.isStalemate()) reason = "stalemate";
      else if (chess.isThreefoldRepetition()) reason = "threefold_repetition";
      else if (chess.isInsufficientMaterial()) reason = "insufficient_material";
      return { winner: "draw", reason };
    }
    return { winner: null, reason: "unknown" };
  }

  resign(roomId, socketId) {
    const room = this.getRoom(roomId);
    if (!room || room.status !== "active") return false;

    let winner = null;
    if (room.white && room.white.socketId === socketId) {
      winner = "b";
    } else if (room.black && room.black.socketId === socketId) {
      winner = "w";
    }

    if (winner) {
      this.endGame(roomId, { winner, reason: "resignation" });
      return true;
    }
    return false;
  }

  handleDisconnect(socketId) {
    const userMeta = this.userSocketMap.get(socketId);
    if (!userMeta) return;

    const { roomId, role, userId } = userMeta;
    const room = this.getRoom(roomId);
    this.userSocketMap.delete(socketId);

    if (!room) return;

    if (role === "w" && room.white) {
      room.white.connected = false;
      this.scheduleReconnectTimeout(roomId, userId, "w");
    } else if (role === "b" && room.black) {
      room.black.connected = false;
      this.scheduleReconnectTimeout(roomId, userId, "b");
    } else {
      room.spectators = room.spectators.filter((s) => s.socketId !== socketId);
    }

    this.broadcastRoomState(roomId);
    logger.info(`Socket disconnected: ${socketId} (role: ${role}, room: ${roomId})`);
  }

  scheduleReconnectTimeout(roomId, userId, role) {
    const GRACE_PERIOD_MS = 30000;
    const timeout = setTimeout(() => {
      const room = this.getRoom(roomId);
      if (!room || room.status !== "active") return;

      const player = role === "w" ? room.white : room.black;
      if (player && !player.connected) {
        const winner = role === "w" ? "b" : "w";
        logger.warn(`Player ${userId} failed to reconnect to room ${roomId}. Awarding win to opponent.`);
        this.endGame(roomId, { winner, reason: "abandonment" });
      }
    }, GRACE_PERIOD_MS);

    this.reconnectTimeouts.set(userId, timeout);
  }

  clearReconnectTimeout(userId) {
    if (this.reconnectTimeouts.has(userId)) {
      clearTimeout(this.reconnectTimeouts.get(userId));
      this.reconnectTimeouts.delete(userId);
    }
  }

  endGame(roomId, result) {
    const room = this.getRoom(roomId);
    if (!room || room.status === "completed") return;

    this.stopClock(roomId);
    room.status = "completed";
    room.winner = result.winner;
    room.winReason = result.reason;

    logger.info(`Game completed in room ${roomId}: Winner=${result.winner}, Reason=${result.reason}`);
    this.broadcastRoomState(roomId, { gameOver: result });
  }

  broadcastRoomState(roomId, extraData = {}) {
    const room = this.getRoom(roomId);
    if (!room) return;

    const payload = {
      roomId: room.id,
      fen: room.chess.fen(),
      turn: room.chess.turn(),
      status: room.status,
      white: room.white ? { username: room.white.username, connected: room.white.connected } : null,
      black: room.black ? { username: room.black.username, connected: room.black.connected } : null,
      spectatorsCount: room.spectators.length,
      timers: room.timers,
      moves: room.moves.map((m) => m.san),
      winner: room.winner,
      winReason: room.winReason,
      ...extraData,
    };

    this.io.to(`game:${roomId}`).emit("roomState", payload);
  }
}

module.exports = RoomManager;
