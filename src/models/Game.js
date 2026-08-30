const mongoose = require("mongoose");

const moveSchema = new mongoose.Schema(
  {
    from: { type: String, required: true },
    to: { type: String, required: true },
    promotion: { type: String },
    san: { type: String, required: true },
    fen: { type: String, required: true },
    timeSpent: { type: Number, default: 0 },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const gameSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: true,
      index: true,
    },
    whitePlayer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    blackPlayer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    whiteUsername: { type: String, required: true },
    blackUsername: { type: String, required: true },
    winner: {
      type: String,
      enum: ["w", "b", "draw", null],
      default: null,
    },
    winReason: {
      type: String,
      enum: [
        "checkmate",
        "timeout",
        "resignation",
        "stalemate",
        "threefold_repetition",
        "insufficient_material",
        "abandonment",
        "draw",
        null,
      ],
      default: null,
    },
    status: {
      type: String,
      enum: ["waiting", "active", "completed", "abandoned"],
      default: "waiting",
      index: true,
    },
    timeControl: {
      initial: { type: Number, default: 600 },
      increment: { type: Number, default: 0 },
    },
    moves: [moveSchema],
    pgn: { type: String, default: "" },
    finalFen: { type: String, default: "" },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Game", gameSchema);
