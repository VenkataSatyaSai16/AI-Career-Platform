const bcrypt = require("bcrypt");
const User = require("../models/User");

function createError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function sanitizeUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: String(user._id || user.id || ""),
    username: user.username || "",
    name: user.name || "",
    email: user.email || "",
    googleId: user.googleId || "",
    googleCalendarConnected: Boolean(user.googleAccessToken || user.googleRefreshToken)
  };
}

async function ensureUniqueRegistrationFields(username, email) {
  const [usernameOwner, emailOwner] = await Promise.all([
    User.findOne({ username }).lean(),
    User.findOne({ email }).lean()
  ]);

  if (usernameOwner) {
    throw createError("Username already exists", 409);
  }

  if (emailOwner) {
    throw createError("Email already exists", 409);
  }
}

async function register(payload = {}) {
  const username = String(payload.username || "").trim();
  const email = String(payload.email || "").trim().toLowerCase();
  const password = String(payload.password || "");

  if (!username || !email || !password) {
    throw createError("Username, email, and password are required", 400);
  }

  if (password.length < 8) {
    throw createError("Password must be at least 8 characters long", 400);
  }

  await ensureUniqueRegistrationFields(username, email);

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    username,
    email,
    password: passwordHash,
    name: username
  });

  console.log("Local auth user created:", {
    userId: user.id,
    username: user.username,
    email: user.email
  });

  return {
    success: true,
    message: "Registration successful",
    user: sanitizeUser(user)
  };
}

async function login(payload = {}) {
  const identifier = String(payload.username || payload.email || payload.identifier || "").trim();
  const password = String(payload.password || "");

  if (!identifier || !password) {
    throw createError("Username or email and password are required", 400);
  }

  const user = await User.findOne({
    $or: [{ username: identifier }, { email: identifier.toLowerCase() }]
  });

  if (!user) {
    throw createError("Invalid credentials", 401);
  }

  if (!user.password) {
    throw createError("This account uses Google login only. Please sign in with Google.", 400);
  }

  const passwordMatches = await bcrypt.compare(password, user.password);

  if (!passwordMatches) {
    throw createError("Invalid credentials", 401);
  }

  return {
    success: true,
    user: sanitizeUser(user)
  };
}

async function getCurrentUser(userId) {
  const user = await User.findById(userId).lean();

  if (!user) {
    throw createError("User not found", 404);
  }

  return sanitizeUser(user);
}

module.exports = {
  getCurrentUser,
  login,
  register,
  sanitizeUser
};
