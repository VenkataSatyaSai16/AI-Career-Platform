const express = require("express");
const passport = require("../config/passport");
const authController = require("../controllers/auth.controller");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/signup", authController.register);
router.post("/logout", authController.logout);
router.get("/me", requireAuth, authController.me);
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email", "https://www.googleapis.com/auth/calendar"],
    accessType: "offline",
    prompt: "consent",
    includeGrantedScopes: true,
    session: false
  })
);
router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/auth/google/failure", session: false }),
  authController.googleCallback
);
router.get("/google/failure", authController.googleFailure);

module.exports = router;
