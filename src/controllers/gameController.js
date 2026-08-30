const Game = require("../models/Game");
const User = require("../models/User");
const { getDBStatus } = require("../config/db");

const getGameHistory = async (req, res, next) => {
  try {
    if (getDBStatus()) {
      const games = await Game.find({
        $or: [{ whitePlayer: req.user._id }, { blackPlayer: req.user._id }],
      })
        .sort({ createdAt: -1 })
        .limit(20)
        .populate("whitePlayer", "username rating")
        .populate("blackPlayer", "username rating");

      return res.json({ success: true, count: games.length, data: games });
    } else {
      return res.json({ success: true, count: 0, data: [], message: "In-memory mode (DB not connected)" });
    }
  } catch (error) {
    next(error);
  }
};

const getGameById = async (req, res, next) => {
  try {
    if (getDBStatus()) {
      const game = await Game.findById(req.params.id)
        .populate("whitePlayer", "username rating")
        .populate("blackPlayer", "username rating");

      if (!game) {
        return res.status(404).json({ success: false, message: "Game not found" });
      }

      return res.json({ success: true, data: game });
    } else {
      return res.status(404).json({ success: false, message: "Game not found (DB not connected)" });
    }
  } catch (error) {
    next(error);
  }
};

const { getUniqueInMemoryUsers } = require("./authController");

const getLeaderboard = async (req, res, next) => {
  try {
    if (getDBStatus()) {
      const topPlayers = await User.find()
        .select("username rating gamesPlayed gamesWon")
        .sort({ rating: -1 })
        .limit(10);

      return res.json({ success: true, data: topPlayers });
    } else {
      const memoryUsers = getUniqueInMemoryUsers();
      const demoUsers = [
        { username: "ChessMaster_Pro", rating: 1500, gamesPlayed: 12, gamesWon: 10 },
        { username: "TacticsWizard", rating: 1420, gamesPlayed: 8, gamesWon: 5 },
        { username: "EndgameKing", rating: 1350, gamesPlayed: 6, gamesWon: 4 },
      ];

      // Combine real registered users with demo rankings
      const combined = [...memoryUsers, ...demoUsers]
        .filter((u, index, self) => index === self.findIndex((t) => t.username === u.username))
        .sort((a, b) => b.rating - a.rating)
        .slice(0, 10);

      return res.json({ success: true, data: combined });
    }
  } catch (error) {
    next(error);
  }
};

module.exports = { getGameHistory, getGameById, getLeaderboard };
