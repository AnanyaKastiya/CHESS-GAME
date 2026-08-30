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

// Security Headers
app.use(
  helmet({
    contentSecurityPolicy: false, // Allows CDN resources for frontend scripts and styles
  })
);

// CORS
app.use(cors());

// Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate Limiting for Auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { success: false, message: "Too many auth attempts, please try again later." },
});
app.use("/api/auth", authLimiter);

// View Engine & Static Files
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "../views"));
app.use(express.static(path.join(__dirname, "../public")));

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/games", gameRoutes);

// Health Check Endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: getDBStatus() ? "connected" : "disconnected (in-memory mode)",
    redis: isRedisReady() ? "connected" : "in-memory fallback",
  });
});

// Web Pages
app.get("/", (req, res) => {
  res.render("index", { title: "Grandmaster Chess - Real-Time Multiplayer Platform" });
});

app.get("/game/:roomId", (req, res) => {
  res.render("index", {
    title: `Chess Match - ${req.params.roomId}`,
    roomId: req.params.roomId,
  });
});

// Error Handlers
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
