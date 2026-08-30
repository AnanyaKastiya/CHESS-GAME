const Game = require("../models/Game");
const User = require("../models/User");
const { getDBStatus } = require("../config/db");

// @desc    Get user's game history
// @route   GET /api/games/history
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

// @desc    Get game details by ID
// @route   GET /api/games/:id
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

// @desc    Get Top Players Leaderboard
// @route   GET /api/games/leaderboard
const getLeaderboard = async (req, res, next) => {
  try {
    if (getDBStatus()) {
      const topPlayers = await User.find()
        .select("username rating gamesPlayed gamesWon")
        .sort({ rating: -1 })
        .limit(10);

      return res.json({ success: true, data: topPlayers });
    } else {
      return res.json({
        success: true,
        data: [
          { username: "GrandMaster_Dev", rating: 2100, gamesPlayed: 45, gamesWon: 40 },
          { username: "ChessWizard", rating: 1950, gamesPlayed: 32, gamesWon: 24 },
          { username: "TacticsKing", rating: 1820, gamesPlayed: 28, gamesWon: 19 },
        ],
      });
    }
  } catch (error) {
    next(error);
  }
};

module.exports = { getGameHistory, getGameById, getLeaderboard };
