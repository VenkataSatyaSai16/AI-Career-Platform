const taskService = require("../services/task.service");

async function createTask(req, res, next) {
  try {
    const task = await taskService.createTask(req.auth.user.id, req.body);
    res.status(201).json({
      success: true,
      task
    });
  } catch (error) {
    next(error);
  }
}

async function updateTask(req, res, next) {
  try {
    const task = await taskService.updateTask(req.auth.user.id, req.params.taskId, req.body);
    res.status(200).json({
      success: true,
      task
    });
  } catch (error) {
    next(error);
  }
}

async function deleteTask(req, res, next) {
  try {
    const result = await taskService.deleteTask(req.auth.user.id, req.params.taskId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

async function listTasks(req, res, next) {
  try {
    const tasks = await taskService.listTasks(req.auth.user.id);
    res.status(200).json({
      success: true,
      tasks
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createTask,
  deleteTask,
  listTasks,
  updateTask
};
