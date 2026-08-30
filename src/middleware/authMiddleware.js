const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { getDBStatus } = require("../config/db");

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "chess_jwt_secret_dev_key"
      );

      if (getDBStatus()) {
        req.user = await User.findById(decoded.id).select("-password");
      } else {
        req.user = {
          _id: decoded.id,
          username: decoded.username,
          email: decoded.email,
          rating: decoded.rating || 1200,
        };
      }

      if (!req.user) {
        return res.status(401).json({ success: false, message: "User not found" });
      }

      return next();
    } catch (error) {
      return res.status(401).json({ success: false, message: "Not authorized, token failed" });
    }
  }

  if (!token) {
    return res.status(401).json({ success: false, message: "Not authorized, no token" });
  }
};

module.exports = { protect };
