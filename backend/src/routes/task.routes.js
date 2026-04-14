const express = require("express");
const taskController = require("../controllers/task.controller");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/", requireAuth, taskController.listTasks);
router.post("/", requireAuth, taskController.createTask);
router.put("/:taskId", requireAuth, taskController.updateTask);
router.delete("/:taskId", requireAuth, taskController.deleteTask);

module.exports = router;
