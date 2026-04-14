const express = require("express");
const studyPlannerController = require("../controllers/study-planner.controller");

const router = express.Router();

router.post("/generate", studyPlannerController.generatePlan);
router.get("/plan/:userId", studyPlannerController.getPlan);
router.post("/progress", studyPlannerController.updateProgress);
router.get("/progress/:userId", studyPlannerController.getProgress);
router.post("/reschedule", studyPlannerController.reschedulePlan);
router.post("/replan", studyPlannerController.replan);
router.post("/share", studyPlannerController.sharePlan);

module.exports = router;
