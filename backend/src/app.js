const cors = require("cors");
const express = require("express");
const passport = require("./config/passport");
const authRoutes = require("./routes/authRoutes");
const routes = require("./routes");
const { env } = require("./config/env");
const { notFoundHandler, errorHandler } = require("./middleware/error.middleware");

const app = express();

app.set("trust proxy", 1);

app.use(
  cors({
    origin: env.frontendUrl,
    credentials: true
  })
);
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "ai-interview-agent-backend",
    timestamp: new Date().toISOString()
  });
});

app.get("/", (_req, res) => {
  res.status(200).send('<a href="/auth/google">Login with Google</a>');
});

app.use("/auth", authRoutes);
app.use("/api", routes);
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
