const studyPlannerService = require("../services/study-planner.service");

async function generatePlan(req, res, next) {
  try {
    const result = await studyPlannerService.generatePlannerPlan(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

async function getPlan(req, res, next) {
  try {
    const result = await studyPlannerService.getPlannerPlan(req.params.userId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

async function updateProgress(req, res, next) {
  try {
    const result = await studyPlannerService.updatePlannerProgress(req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

async function getProgress(req, res, next) {
  try {
    const result = await studyPlannerService.getPlannerProgress(req.params.userId, req.query.totalDays);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

async function reschedulePlan(req, res, next) {
  try {
    const result = await studyPlannerService.reschedulePlannerPlan(req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

async function replan(req, res, next) {
  try {
    const result = await studyPlannerService.replanPlannerPlan(req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

async function sharePlan(req, res, next) {
  try {
    const result = await studyPlannerService.sendPlannerEmail(req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  generatePlan,
  getPlan,
  getProgress,
  replan,
  reschedulePlan,
  sharePlan,
  updateProgress
};
