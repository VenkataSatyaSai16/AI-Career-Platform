const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { env } = require("../config/env");

async function requireAuth(req, _res, next) {
  try {
    const authorization = String(req.headers.authorization || "");

    if (!authorization.startsWith("Bearer ")) {
      const error = new Error("Authorization token is required");
      error.statusCode = 401;
      throw error;
    }

    const token = authorization.slice("Bearer ".length).trim();
    const payload = jwt.verify(token, env.jwtSecret);
    const user = await User.findById(payload.userId).lean();

    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 401;
      throw error;
    }

    req.auth = {
      token,
      user: {
        id: String(user._id),
        username: user.username,
        email: user.email,
        name: user.name || "",
        googleId: user.googleId || "",
        googleCalendarConnected: Boolean(user.googleAccessToken || user.googleRefreshToken)
      }
    };

    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      error.statusCode = 401;
      error.message = "Invalid or expired token";
    }

    next(error);
  }
}

module.exports = {
  requireAuth
};
