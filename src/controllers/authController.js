const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { getDBStatus } = require("../config/db");

const generateToken = (id, username, email, rating = 1200) => {
  return jwt.sign(
    { id, username, email, rating },
    process.env.JWT_SECRET || "chess_jwt_secret_dev_key",
    { expiresIn: "7d" }
  );
};

const inMemoryUsers = new Map();

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

const getUniqueInMemoryUsers = () => {
  const unique = [];
  const seenIds = new Set();
  for (const user of inMemoryUsers.values()) {
    if (!seenIds.has(user.id)) {
      seenIds.add(user.id);
      unique.push({
        username: user.username,
        rating: user.rating || 1200,
        gamesPlayed: user.gamesPlayed || 0,
        gamesWon: user.gamesWon || 0,
      });
    }
  }
  return unique.sort((a, b) => (b.rating || 1200) - (a.rating || 1200));
};

module.exports = { registerUser, loginUser, getUserProfile, getUniqueInMemoryUsers };
