const express = require("express");
const resumeController = require("../controllers/resume.controller");
const { requireAuth } = require("../middleware/auth.middleware");
const { upload } = require("../middleware/upload");

const router = express.Router();

router.post("/upload", requireAuth, upload.single("resume"), resumeController.uploadResume);
router.post("/chat", requireAuth, resumeController.resumeChat);
router.post("/generate", requireAuth, resumeController.generateResume);

module.exports = router;
