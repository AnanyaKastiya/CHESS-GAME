const express = require("express");
const router = express.Router();
const { getGameHistory, getGameById, getLeaderboard } = require("../controllers/gameController");
const { protect } = require("../middleware/authMiddleware");

router.get("/history", protect, getGameHistory);
router.get("/leaderboard", getLeaderboard);
router.get("/:id", getGameById);

module.exports = router;
