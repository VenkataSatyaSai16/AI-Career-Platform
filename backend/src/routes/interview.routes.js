const express = require("express");
const multer = require("multer");
const interviewController = require("../controllers/interview.controller");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

router.post("/start", interviewController.startInterview);
router.post("/next", interviewController.nextQuestion);
router.post("/transcribe", upload.single("audio"), interviewController.transcribeVoice);
router.post("/tts", interviewController.synthesizeVoice);
router.get("/history/:userId", interviewController.getInterviewHistory);
router.get("/progress", requireAuth, interviewController.getInterviewProgress);
router.get("/report/:sessionId", interviewController.getInterviewReport);
router.get("/session/:sessionId", interviewController.getSessionById);
router.post("/generate-plan", requireAuth, interviewController.generatePlanFromFeedback);

module.exports = router;
