const fs = require("fs/promises");
const path = require("path");

const DATA_FILE = path.join(__dirname, "..", "..", "data", "study-plans.json");

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

async function loadPlansData() {
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

async function savePlansData(data) {
  await ensureDataFile();
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
}

async function saveUserPlan(userId, plan, metadata = {}) {
  if (!userId) {
    throw new Error("userId is required");
  }

  if (!plan || typeof plan !== "object") {
    throw new Error("plan must be an object");
  }

  const data = await loadPlansData();
  const users = data.users;
  const existingEntry = users[userId] && typeof users[userId] === "object" ? users[userId] : {};
  const existingMetadata = existingEntry.metadata && typeof existingEntry.metadata === "object" ? existingEntry.metadata : {};
  const mergedMetadata = {
    ...clone(existingMetadata),
    ...clone(metadata),
    updatedAt: new Date().toISOString(),
    originalDuration:
      Number(existingMetadata.originalDuration || existingEntry.originalPlan?.days?.length || plan.days?.length || 0) || 0,
    currentDuration: Number(plan.days?.length || 0)
  };

  const originalPlan =
    existingEntry.originalPlan && typeof existingEntry.originalPlan === "object"
      ? clone(existingEntry.originalPlan)
      : clone(plan);

  users[userId] = {
    plan: clone(plan),
    originalPlan,
    metadata: mergedMetadata
  };

  await savePlansData(data);
  return clone(users[userId]);
}

async function getUserPlan(userId) {
  if (!userId) {
    return null;
  }

  const data = await loadPlansData();
  const entry = data.users[userId];

  if (!entry || typeof entry !== "object") {
    return null;
  }

  return clone(entry);
}

module.exports = {
  getUserPlan,
  saveUserPlan
};
