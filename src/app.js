const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const authRoutes = require("./routes/authRoutes");
const gameRoutes = require("./routes/gameRoutes");
const { errorHandler, notFoundHandler } = require("./middleware/errorMiddleware");
const { getDBStatus } = require("./config/db");
const { isRedisReady } = require("./config/redis");

const app = express();

app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: "Too many auth attempts, please try again later." },
});
app.use("/api/auth", authLimiter);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "../views"));
app.use(express.static(path.join(__dirname, "../public")));

app.use("/api/auth", authRoutes);
app.use("/api/games", gameRoutes);

app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: getDBStatus() ? "connected" : "disconnected (in-memory mode)",
    redis: isRedisReady() ? "connected" : "in-memory fallback",
  });
});

app.get("/", (req, res) => {
  res.render("index", { title: "ChessMate - Real-Time Multiplayer Platform" });
});

app.get("/game/:roomId", (req, res) => {
  res.render("index", {
    title: `Chess Match - ${req.params.roomId}`,
    roomId: req.params.roomId,
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
