const fs = require("fs/promises");
const path = require("path");

const DATA_FILE = path.join(__dirname, "..", "..", "data", "study-progress.json");

const VALID_UPDATE_STATUSES = new Set(["completed", "missed"]);
const VALID_STATUSES = new Set(["pending", "completed", "missed"]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function ensureDataFile() {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });

  try {
    await fs.access(DATA_FILE);
  } catch (_error) {
    await fs.writeFile(DATA_FILE, JSON.stringify({ users: {} }, null, 2), "utf8");
  }
}

async function loadProgressData() {
  await ensureDataFile();

  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const data = JSON.parse(raw);

    if (!data || typeof data !== "object") {
      return { users: {} };
    }

    if (!data.users || typeof data.users !== "object") {
      data.users = {};
    }

    return data;
  } catch (_error) {
    return { users: {} };
  }
}

async function saveProgressData(data) {
  await ensureDataFile();
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
}

async function updateDayProgress(userId, day, status) {
  if (!VALID_UPDATE_STATUSES.has(status)) {
    throw new Error("status must be either 'completed' or 'missed'");
  }

  const data = await loadProgressData();
  const users = data.users;
  const userProgress = users[userId] && typeof users[userId] === "object" ? users[userId] : { days: {} };
  const days = userProgress.days && typeof userProgress.days === "object" ? userProgress.days : {};

  days[String(day)] = status;
  users[userId] = { days };

  await saveProgressData(data);

  return {
    userId,
    day,
    status
  };
}

async function replaceUserProgress(userId, days) {
  const sanitizedDays = Object.fromEntries(
    Object.entries(days || {}).map(([day, status]) => [String(day), VALID_STATUSES.has(status) ? status : "pending"])
  );

  const data = await loadProgressData();
  data.users[userId] = { days: sanitizedDays };
  await saveProgressData(data);

  return {
    userId,
    days: clone(sanitizedDays)
  };
}

async function getUserProgress(userId, totalDays) {
  const data = await loadProgressData();
  const storedDays = data.users[userId]?.days && typeof data.users[userId].days === "object" ? data.users[userId].days : {};
  const progressDays = {};

  if (Number(totalDays) > 0) {
    for (let day = 1; day <= Number(totalDays); day += 1) {
      progressDays[String(day)] = VALID_STATUSES.has(storedDays[String(day)]) ? storedDays[String(day)] : "pending";
    }
  }

  Object.entries(storedDays).forEach(([day, status]) => {
    progressDays[String(day)] = VALID_STATUSES.has(status) ? status : "pending";
  });

  return {
    userId,
    days: clone(progressDays)
  };
}

module.exports = {
  VALID_UPDATE_STATUSES: Array.from(VALID_UPDATE_STATUSES),
  getUserProgress,
  replaceUserProgress,
  updateDayProgress
};
