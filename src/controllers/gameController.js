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
          { username: "ChessMaster_Pro", rating: 2150, gamesPlayed: 52, gamesWon: 45 },
          { username: "TacticsWizard", rating: 1980, gamesPlayed: 38, gamesWon: 29 },
          { username: "EndgameKing", rating: 1840, gamesPlayed: 31, gamesWon: 22 },
        ],
      });
    }
  } catch (error) {
    next(error);
  }
};

module.exports = { getGameHistory, getGameById, getLeaderboard };
