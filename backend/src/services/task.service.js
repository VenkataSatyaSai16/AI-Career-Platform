const Task = require("../models/Task");
const User = require("../models/User");
const {
  createCalendarEvent,
  deleteCalendarEvent,
  updateCalendarEvent
} = require("./googleCalendarService");

function createError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function sanitizeTask(task) {
  if (!task) {
    return null;
  }

  return {
    id: String(task._id || task.id || ""),
    userId: String(task.userId || ""),
    planId: task.planId || "",
    title: task.title || "",
    description: task.description || "",
    startTime: task.startTime,
    endTime: task.endTime,
    completed: Boolean(task.completed),
    googleEventId: task.googleEventId || "",
    createdAt: task.createdAt,
    updatedAt: task.updatedAt
  };
}

function parseTaskPayload(payload = {}) {
  const title = String(payload.title || "").trim();
  const description = String(payload.description || "").trim();
  const planId = String(payload.planId || payload.plan_id || "").trim();
  const startTime = payload.startTime || payload.start_time;
  const endTime = payload.endTime || payload.end_time;
  const completed = payload.completed === true || String(payload.completed || "").trim().toLowerCase() === "true";

  if (!title) {
    throw createError("title is required", 400);
  }

  const startDate = new Date(startTime);
  const endDate = new Date(endTime);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    throw createError("startTime and endTime must be valid dates", 400);
  }

  if (endDate <= startDate) {
    throw createError("endTime must be later than startTime", 400);
  }

  return {
    title,
    description,
    planId,
    startTime: startDate,
    endTime: endDate,
    completed
  };
}

async function getAuthenticatedUser(userId) {
  const user = await User.findById(userId);

  if (!user) {
    throw createError("User not found", 404);
  }

  return user;
}

async function createTask(userId, payload = {}) {
  const user = await getAuthenticatedUser(userId);
  const taskData = parseTaskPayload(payload);
  const task = await Task.create({
    userId: user._id,
    ...taskData
  });

  if (user.googleAccessToken || user.googleRefreshToken) {
    try {
      const googleEventId = await createCalendarEvent(user, task);
      task.googleEventId = googleEventId || "";
      await task.save();
    } catch (error) {
      console.error("Failed to sync task to Google Calendar", {
        taskId: String(task._id),
        userId: String(user._id),
        message: error.message
      });
    }
  }

  return sanitizeTask(task);
}

async function updateTask(userId, taskId, payload = {}) {
  const user = await getAuthenticatedUser(userId);
  const task = await Task.findOne({
    _id: taskId,
    userId: user._id
  });

  if (!task) {
    throw createError("Task not found", 404);
  }

  const taskData = parseTaskPayload({
    ...task.toObject(),
    ...payload
  });

  Object.assign(task, taskData);
  await task.save();

  if (user.googleAccessToken || user.googleRefreshToken) {
    try {
      if (task.googleEventId) {
        await updateCalendarEvent(user, task);
      } else {
        const googleEventId = await createCalendarEvent(user, task);
        task.googleEventId = googleEventId || "";
        await task.save();
      }
    } catch (error) {
      console.error("Failed to update Google Calendar event", {
        taskId: String(task._id),
        userId: String(user._id),
        message: error.message
      });
    }
  }

  return sanitizeTask(task);
}

async function deleteTask(userId, taskId) {
  const user = await getAuthenticatedUser(userId);
  const task = await Task.findOne({
    _id: taskId,
    userId: user._id
  });

  if (!task) {
    throw createError("Task not found", 404);
  }

  if ((user.googleAccessToken || user.googleRefreshToken) && task.googleEventId) {
    try {
      await deleteCalendarEvent(user, task.googleEventId);
    } catch (error) {
      console.error("Failed to delete Google Calendar event", {
        taskId: String(task._id),
        userId: String(user._id),
        message: error.message
      });
    }
  }

  await task.deleteOne();

  return {
    success: true,
    deletedTaskId: String(task._id)
  };
}

async function listTasks(userId) {
  const user = await getAuthenticatedUser(userId);
  const tasks = await Task.find({ userId: user._id }).sort({ startTime: 1 }).lean();
  return tasks.map((task) => sanitizeTask(task));
}

module.exports = {
  createTask,
  deleteTask,
  listTasks,
  updateTask
};
