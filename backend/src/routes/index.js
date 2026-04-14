const express = require("express");
const authRoutes = require("./auth.routes");
const interviewRoutes = require("./interview.routes");
const resumeRoutes = require("./resume.routes");
const studyPlannerRoutes = require("./study-planner.routes");
const taskRoutes = require("./task.routes");
const uploadRoutes = require("./upload.routes");

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/interview", interviewRoutes);
router.use("/resume", resumeRoutes);
router.use("/study-planner", studyPlannerRoutes);
router.use("/tasks", taskRoutes);
router.use("/upload", uploadRoutes);

module.exports = router;
