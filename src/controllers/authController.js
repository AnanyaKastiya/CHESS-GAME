const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { getDBStatus } = require("../config/db");
const logger = require("../utils/logger");

const generateToken = (id, username, email, rating = 1200) => {
  return jwt.sign(
    { id, username, email, rating },
    process.env.JWT_SECRET || "chess_jwt_secret_dev_key",
    { expiresIn: "7d" }
  );
};

// In-memory fallback if DB is not connected
const inMemoryUsers = new Map();

// @desc    Register a new user
// @route   POST /api/auth/register
const registerUser = async (req, res, next) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ success: false, message: "Please provide all required fields" });
    }

    if (getDBStatus()) {
      const userExists = await User.findOne({ $or: [{ email }, { username }] });
      if (userExists) {
        return res.status(400).json({ success: false, message: "Username or Email already registered" });
      }

      const user = await User.create({ username, email, password });
      return res.status(201).json({
        success: true,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          rating: user.rating,
        },
        token: generateToken(user._id, user.username, user.email, user.rating),
      });
    } else {
      // In-memory fallback
      if (inMemoryUsers.has(username) || inMemoryUsers.has(email)) {
        return res.status(400).json({ success: false, message: "User already exists (in-memory mode)" });
      }
      const fakeId = `user_${Date.now()}`;
      const memoryUser = { id: fakeId, username, email, password, rating: 1200, gamesPlayed: 0, gamesWon: 0 };
      inMemoryUsers.set(username, memoryUser);
      inMemoryUsers.set(email, memoryUser);

      return res.status(201).json({
        success: true,
        user: {
          id: fakeId,
          username,
          email,
          rating: 1200,
        },
        token: generateToken(fakeId, username, email, 1200),
      });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
const loginUser = async (req, res, next) => {
  try {
    const { emailOrUsername, password } = req.body;

    if (!emailOrUsername || !password) {
      return res.status(400).json({ success: false, message: "Please provide username/email and password" });
    }

    if (getDBStatus()) {
      const user = await User.findOne({
        $or: [{ email: emailOrUsername.toLowerCase() }, { username: emailOrUsername }],
      }).select("+password");

      if (user && (await user.matchPassword(password))) {
        return res.json({
          success: true,
          user: {
            id: user._id,
            username: user.username,
            email: user.email,
            rating: user.rating,
          },
          token: generateToken(user._id, user.username, user.email, user.rating),
        });
      } else {
        return res.status(401).json({ success: false, message: "Invalid credentials" });
      }
    } else {
      // In-memory fallback
      const user = inMemoryUsers.get(emailOrUsername);
      if (user && user.password === password) {
        return res.json({
          success: true,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            rating: user.rating,
          },
          token: generateToken(user.id, user.username, user.email, user.rating),
        });
      } else {
        return res.status(401).json({ success: false, message: "Invalid credentials (in-memory mode)" });
      }
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Get user profile
// @route   GET /api/auth/me
const getUserProfile = async (req, res, next) => {
  try {
    res.json({
      success: true,
      user: req.user,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { registerUser, loginUser, getUserProfile };
