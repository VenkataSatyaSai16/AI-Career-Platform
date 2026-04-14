const jwt = require("jsonwebtoken");
const authService = require("../services/auth.service");
const { env } = require("../config/env");

function signAuthToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      username: user.username
    },
    env.jwtSecret,
    {
      expiresIn: "7d"
    }
  );
}

async function register(req, res, next) {
  try {
    const result = await authService.register(req.body);

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

async function login(req, res, next) {
  try {
    const result = await authService.login(req.body);
    const token = signAuthToken(result.user);

    res.status(200).json({
      ...result,
      token
    });
  } catch (error) {
    next(error);
  }
}

async function logout(_req, res, next) {
  try {
    return res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
}

function googleCallback(req, res) {
  const user = authService.sanitizeUser(req.user);
  const token = signAuthToken(user);
  const redirectUrl = `${env.googleSuccessRedirectUrl}?token=${encodeURIComponent(token)}`;
  res.redirect(302, redirectUrl);
}

function googleFailure(_req, res) {
  res.status(401).json({
    success: false,
    message: "Google authentication failed"
  });
}

async function me(req, res, next) {
  try {
    const user = await authService.getCurrentUser(req.auth.user.id);

    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  googleCallback,
  googleFailure,
  login,
  logout,
  me,
  register
};
