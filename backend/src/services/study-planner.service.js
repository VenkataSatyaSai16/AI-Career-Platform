const { generateText } = require("./llm.service");
const {
  DEFAULT_PARSED_INPUT,
  applyInputFallbacks,
  buildGeneratePlanPrompt,
  buildParseUserInputPrompt,
  buildReplanPrompt
} = require("./study-planner.prompt.service");
const { getUserPlan, saveUserPlan } = require("../storage/study-plan.store");
const {
  VALID_UPDATE_STATUSES,
  getUserProgress,
  replaceUserProgress,
  updateDayProgress
} = require("../storage/study-progress.store");

const TRUSTED_DOMAINS = new Set(
  [
    "docs.python.org",
    "developer.mozilla.org",
    "docs.oracle.com",
    "en.cppreference.com",
    "www.postgresql.org",
    "developers.google.com",
    "cp-algorithms.com",
    "www.khanacademy.org",
    "ocw.mit.edu",
    "www.geeksforgeeks.org",
    "www.investopedia.com",
    "www.imf.org",
    "www.worldbank.org",
    "www.coursera.org",
    "www.edx.org",
    "www.nasa.gov",
    "www.who.int",
    "www.cdc.gov",
    "www.ncbi.nlm.nih.gov",
    "chem.libretexts.org",
    "phys.libretexts.org",
    "bio.libretexts.org",
    "openstax.org",
    "www.fao.org",
    "www.un.org",
    "www.iso.org",
    "www.ibm.com",
    "aws.amazon.com",
    "learn.microsoft.com",
    "www.tensorflow.org",
    "pytorch.org",
    "www.r-project.org",
    "pandas.pydata.org",
    "scikit-learn.org",
    "arxiv.org",
    "en.wikipedia.org"
  ].map((item) => item.replace(/^www\./, ""))
);

const CURATED_RESOURCES = [
  [["python", "django", "flask"], "Python Official Docs", "https://docs.python.org/3/"],
  [["javascript", "js", "html", "css", "frontend", "react"], "MDN Web Docs", "https://developer.mozilla.org/en-US/"],
  [["java", "spring"], "Oracle Java Documentation", "https://docs.oracle.com/en/java/"],
  [["c++", "cpp"], "cppreference", "https://en.cppreference.com/w/"],
  [["c programming", "c language"], "C Reference", "https://en.cppreference.com/w/c"],
  [["sql", "database", "postgres", "mysql"], "PostgreSQL Documentation", "https://www.postgresql.org/docs/"],
  [["machine learning", "deep learning", "ai", "neural"], "Google ML Crash Course", "https://developers.google.com/machine-learning/crash-course"],
  [["data structure", "algorithm", "dsa"], "CP-Algorithms", "https://cp-algorithms.com/"],
  [["math", "calculus", "algebra", "trigonometry"], "Khan Academy Math", "https://www.khanacademy.org/math"],
  [["statistics", "probability"], "Khan Academy Statistics", "https://www.khanacademy.org/math/statistics-probability"],
  [["physics", "mechanics", "electromagnetism"], "OpenStax Science", "https://openstax.org/subjects/science"],
  [["chemistry", "organic", "inorganic"], "Chemistry LibreTexts", "https://chem.libretexts.org/"],
  [["biology", "genetics", "microbiology"], "Biology LibreTexts", "https://bio.libretexts.org/"],
  [["medical", "medicine", "clinical", "nursing", "anatomy", "physiology"], "NCBI Bookshelf", "https://www.ncbi.nlm.nih.gov/books/"],
  [["public health", "epidemiology"], "WHO Learning", "https://www.who.int/"],
  [["economics", "macro", "micro"], "IMF Learning Resources", "https://www.imf.org/en/Publications/fandd"],
  [["finance", "investment", "stocks", "trading"], "Investopedia", "https://www.investopedia.com/"],
  [["accounting", "bookkeeping"], "Accounting Basics", "https://www.investopedia.com/accounting-4689743"],
  [["business", "management", "leadership"], "Coursera Business", "https://www.coursera.org/browse/business"],
  [["marketing", "digital marketing", "seo"], "HubSpot Academy", "https://academy.hubspot.com/"],
  [["law", "legal"], "Legal Information Institute", "https://www.law.cornell.edu/"],
  [["civil engineering", "structural"], "MIT OpenCourseWare Civil Engineering", "https://ocw.mit.edu/courses/civil-and-environmental-engineering/"],
  [["mechanical engineering", "thermodynamics"], "MIT OpenCourseWare Mechanical Engineering", "https://ocw.mit.edu/courses/mechanical-engineering/"],
  [["electrical engineering", "circuits", "electronics"], "MIT OpenCourseWare EECS", "https://ocw.mit.edu/courses/electrical-engineering-and-computer-science/"],
  [["operating system", "os"], "MIT OpenCourseWare", "https://ocw.mit.edu/"],
  [["network", "computer network"], "GeeksforGeeks Networks", "https://www.geeksforgeeks.org/computer-network-tutorials/"],
  [["aws", "cloud"], "AWS Documentation", "https://docs.aws.amazon.com/"],
  [["azure"], "Microsoft Learn", "https://learn.microsoft.com/training/"],
  [["ui", "ux", "design"], "Interaction Design Foundation", "https://www.interaction-design.org/literature"],
  [["english", "grammar", "ielts", "toefl"], "British Council LearnEnglish", "https://learnenglish.britishcouncil.org/"],
  [["history", "world history"], "Khan Academy History", "https://www.khanacademy.org/humanities/world-history"],
  [["geography", "environment"], "National Geographic Education", "https://education.nationalgeographic.org/"]
];

async function generatePlannerPlan(payload = {}) {
  const userInput = normalizeText(payload.user_input || payload.userInput);
  const userId = normalizeText(payload.user_id || payload.userId);
  const parsedInput = userInput ? await parseUserInput(userInput) : applyInputFallbacks({});
  const course = normalizeText(payload.course) || parsedInput.course || DEFAULT_PARSED_INPUT.course;
  const duration = payload.duration || parsedInput.duration || DEFAULT_PARSED_INPUT.duration;
  const knowledgeLevel =
    normalizeText(payload.knowledge_level || payload.knowledgeLevel || payload.level) ||
    parsedInput.level ||
    DEFAULT_PARSED_INPUT.level;
  const objective =
    normalizeText(payload.objective) || parsedInput.objective || DEFAULT_PARSED_INPUT.objective;
  const preparingFor =
    normalizeText(payload.preparing_for || payload.preparingFor) || objective || DEFAULT_PARSED_INPUT.objective;
  const dailyHoursRaw = payload.hours || payload.daily_hours || payload.dailyHours || 2;
  const durationDays = parsePositiveInt(duration, "duration");
  const dailyHours = parsePositiveNumber(dailyHoursRaw, "hours");
  const generatedPlan = await generatePlanContent({
    course,
    durationDays,
    dailyHours,
    knowledgeLevel,
    preparingFor,
    objective
  });
  const normalizedDays = normalizePlanDays({
    course,
    days: generatedPlan.days,
    defaultHours: dailyHours
  });

  if (!normalizedDays.length) {
    const error = new Error("Generated plan was empty. Please try again.");
    error.statusCode = 502;
    throw error;
  }

  const plan = {
    summary: normalizeText(generatedPlan.summary) || buildFallbackSummary({ course, knowledgeLevel, objective, preparingFor, durationDays }),
    days: normalizedDays
  };

  if (userId) {
    await saveUserPlan(userId, plan, {
      course,
      knowledgeLevel,
      preparingFor,
      objective,
      lastInput: userInput
    });
  }

  return {
    plan,
    userId: userId || null,
    stored: Boolean(userId),
    parsedInput
  };
}

async function getPlannerPlan(userId) {
  const normalizedUserId = normalizeText(userId);

  if (!normalizedUserId) {
    const error = new Error("userId is required");
    error.statusCode = 400;
    throw error;
  }

  const entry = await getUserPlan(normalizedUserId);

  if (!entry) {
    const error = new Error("No saved plan found for this user");
    error.statusCode = 404;
    throw error;
  }

  return {
    userId: normalizedUserId,
    plan: entry.plan,
    originalPlan: entry.originalPlan,
    metadata: entry.metadata || {}
  };
}

async function updatePlannerProgress(payload = {}) {
  const userId = normalizeText(payload.user_id || payload.userId);
  const day = parsePositiveInt(payload.day, "day");
  const status = normalizeText(payload.status).toLowerCase();

  if (!userId) {
    const error = new Error("userId is required");
    error.statusCode = 400;
    throw error;
  }

  if (!VALID_UPDATE_STATUSES.includes(status)) {
    const error = new Error("status must be either 'completed' or 'missed'");
    error.statusCode = 400;
    throw error;
  }

  const progress = await updateDayProgress(userId, day, status);

  return {
    message: "Progress updated successfully",
    progress
  };
}

async function getPlannerProgress(userId, totalDays) {
  const normalizedUserId = normalizeText(userId);

  if (!normalizedUserId) {
    const error = new Error("userId is required");
    error.statusCode = 400;
    throw error;
  }

  const total = totalDays == null || totalDays === "" ? undefined : parsePositiveInt(totalDays, "totalDays");
  return getUserProgress(normalizedUserId, total);
}

async function reschedulePlannerPlan(payload = {}) {
  const userId = normalizeText(payload.user_id || payload.userId);

  if (!userId) {
    const error = new Error("userId is required");
    error.statusCode = 400;
    throw error;
  }

  const storedPlanEntry = await getUserPlan(userId);

  if (!storedPlanEntry) {
    const error = new Error("No saved plan found for this userId");
    error.statusCode = 404;
    throw error;
  }

  const storedPlan = storedPlanEntry.plan;

  if (!storedPlan || typeof storedPlan !== "object") {
    const error = new Error("Stored plan is invalid");
    error.statusCode = 500;
    throw error;
  }

  const progress = await getUserProgress(userId, storedPlan.days?.length || 0);
  const result = reschedulePlan(storedPlan, progress);
  const updatedPlan = result.plan;
  const rescheduleSummary = result.rescheduleSummary;

  await saveUserPlan(userId, updatedPlan, {
    ...(storedPlanEntry.metadata || {}),
    lastRescheduled: rescheduleSummary
  });

  const completedCount = Object.values(progress.days || {}).filter((status) => status === "completed").length;
  const refreshedProgress = {};

  for (let day = 1; day <= updatedPlan.days.length; day += 1) {
    refreshedProgress[String(day)] = day <= completedCount ? "completed" : "pending";
  }

  await replaceUserProgress(userId, refreshedProgress);

  return {
    message: "Plan rescheduled successfully",
    userId,
    plan: updatedPlan,
    rescheduleSummary
  };
}

async function replanPlannerPlan(payload = {}) {
  const userId = normalizeText(payload.user_id || payload.userId);

  if (!userId) {
    const error = new Error("userId is required");
    error.statusCode = 400;
    throw error;
  }

  const storedPlanEntry = await getUserPlan(userId);

  if (!storedPlanEntry) {
    const error = new Error("No saved plan found for this userId");
    error.statusCode = 404;
    throw error;
  }

  const currentPlan = storedPlanEntry.plan;
  const originalPlan = storedPlanEntry.originalPlan || currentPlan;
  const metadata = storedPlanEntry.metadata || {};

  if (!currentPlan || typeof currentPlan !== "object") {
    const error = new Error("Stored plan is invalid");
    error.statusCode = 500;
    throw error;
  }

  const progress = await getUserProgress(userId, currentPlan.days?.length || 0);
  const segments = splitPlanByProgress(currentPlan, progress);
  const { completedDays, remainingDays, missedDays } = segments;

  if (!remainingDays.length) {
    return {
      message: "No remaining days to replan",
      userId,
      plan: currentPlan,
      missedDays: []
    };
  }

  const generated = await generateReplannedDays({
    originalPlan,
    progress,
    missedDays,
    remainingDays,
    metadata
  });

  const defaultHours = Number(remainingDays[0]?.estimated_hours || remainingDays[0]?.estimatedHours || 1) || 1;
  const normalizedReplannedDays = normalizePlanDays({
    course: metadata.course || "Study Plan",
    days: generated.remainingDays,
    defaultHours
  });

  if (!normalizedReplannedDays.length) {
    const error = new Error("Replanned days were empty after normalization");
    error.statusCode = 502;
    throw error;
  }

  const mergedDays = mergeReplannedDays(completedDays, normalizedReplannedDays);
  const updatedPlan = {
    summary: normalizeText(generated.summary) || currentPlan.summary || "",
    days: mergedDays
  };

  await saveUserPlan(userId, updatedPlan, {
    ...metadata,
    lastReplanAdjustments: generated.adjustments,
    lastReplanMissedDays: missedDays.map((day) => day.originalDay)
  });

  const refreshedProgress = {};
  for (let day = 1; day <= mergedDays.length; day += 1) {
    refreshedProgress[String(day)] = day <= completedDays.length ? "completed" : "pending";
  }

  await replaceUserProgress(userId, refreshedProgress);

  return {
    message: "Plan updated successfully",
    userId,
    promptContext: {
      missedDays: missedDays.map((day) => day.originalDay),
      remainingDayCount: remainingDays.length
    },
    replanSummary: {
      summary: updatedPlan.summary,
      adjustments: generated.adjustments,
      completedDaysKept: completedDays.length,
      remainingDaysReplanned: normalizedReplannedDays.length
    },
    plan: updatedPlan
  };
}

async function sendPlannerEmail(payload = {}) {
  const email = normalizeText(payload.email);
  const course = normalizeText(payload.course) || "Study Plan";
  const pdfBase64 = normalizeText(payload.pdf_base64 || payload.pdfBase64);
  const calendarBase64 = normalizeText(payload.calendar_ics_base64 || payload.calendarIcsBase64);

  if (!email || !pdfBase64) {
    const error = new Error("Email and PDF content are required");
    error.statusCode = 400;
    throw error;
  }

  if (!isValidEmail(email)) {
    const error = new Error("Invalid email address");
    error.statusCode = 400;
    throw error;
  }

  let nodemailer;

  try {
    nodemailer = require("nodemailer");
  } catch (_error) {
    const dependencyError = new Error("Email sharing is not available until nodemailer is installed");
    dependencyError.statusCode = 501;
    throw dependencyError;
  }

  const smtpHost = normalizeText(process.env.SMTP_HOST);
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpUser = normalizeText(process.env.SMTP_USER);
  const smtpPass = normalizeText(process.env.SMTP_PASS);
  const smtpFrom = normalizeText(process.env.SMTP_FROM) || smtpUser;
  const smtpUseSsl = parseBoolean(process.env.SMTP_USE_SSL, false);

  if (!smtpHost || !smtpPort || !smtpUser || !smtpPass || !smtpFrom) {
    const error = new Error("Missing SMTP configuration in the backend environment");
    error.statusCode = 400;
    throw error;
  }

  const transport = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpUseSsl,
    auth: {
      user: smtpUser,
      pass: smtpPass
    }
  });

  const pdfBuffer = decodeBase64Payload(pdfBase64, "Invalid PDF payload");
  const calendarBuffer = calendarBase64 ? decodeBase64Payload(calendarBase64, "Invalid calendar payload") : null;
  const attachments = [
    {
      filename: "study_plan.pdf",
      content: pdfBuffer,
      contentType: "application/pdf"
    }
  ];

  if (calendarBuffer) {
    attachments.push({
      filename: "study_plan.ics",
      content: calendarBuffer,
      contentType: "text/calendar"
    });
  }

  await transport.sendMail({
    from: smtpFrom,
    to: email,
    subject: `${course} - Study Plan PDF`,
    text: calendarBuffer
      ? "Please find your study plan PDF and calendar file attached."
      : "Please find your study plan PDF attached.",
    attachments
  });

  return {
    message: "PDF shared successfully"
  };
}

async function parseUserInput(text) {
  const cleanedText = normalizeText(text);

  if (!cleanedText) {
    return applyInputFallbacks({});
  }

  try {
    const response = await generateText(buildParseUserInputPrompt(cleanedText), {
      useSecond: true,
      taskName: "study planner input parsing"
    });
    const parsed = safeParseJson(response.reply);

    if (parsed && typeof parsed === "object") {
      return applyInputFallbacks(parsed);
    }
  } catch (_error) {
    // Fall through to the local heuristic parser.
  }

  return applyInputFallbacks(parseUserInputHeuristically(cleanedText));
}

async function generatePlanContent({
  course,
  durationDays,
  dailyHours,
  knowledgeLevel,
  preparingFor,
  objective
}) {
  const prompt = buildGeneratePlanPrompt({
    course,
    durationDays,
    dailyHours,
    knowledgeLevel,
    preparingFor,
    objective
  });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await generateText(prompt, {
        useSecond: true,
        taskName: "study plan generation"
      });
      const parsed = safeParseJson(response.reply);

      if (parsed && Array.isArray(parsed.days) && parsed.days.length === durationDays) {
        return {
          summary: parsed.summary,
          days: parsed.days
        };
      }
    } catch (_error) {
      // Retry before falling back.
    }
  }

  return buildFallbackPlan({
    course,
    durationDays,
    dailyHours,
    knowledgeLevel,
    preparingFor,
    objective
  });
}

async function generateReplannedDays({
  originalPlan,
  progress,
  missedDays,
  remainingDays,
  metadata
}) {
  const prompt = buildReplanPrompt({
    originalPlan,
    progress,
    missedDays,
    remainingDays,
    metadata
  });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await generateText(prompt, {
        useSecond: true,
        taskName: "study plan replanning"
      });
      const parsed = safeParseJson(response.reply);

      if (parsed && Array.isArray(parsed.remaining_days) && parsed.remaining_days.length) {
        return {
          summary: normalizeText(parsed.summary),
          adjustments: normalizeText(parsed.adjustments),
          remainingDays: parsed.remaining_days
        };
      }
    } catch (_error) {
      // Retry before local fallback.
    }
  }

  const fallbackDays = buildFallbackReplannedDays({
    remainingDays,
    missedDays,
    metadata
  });

  return {
    summary:
      buildFallbackSummary({
        course: metadata.course || "Study Plan",
        knowledgeLevel: metadata.knowledgeLevel || metadata.knowledge_level || "intermediate",
        objective: metadata.objective || "general learning",
        preparingFor: metadata.preparingFor || metadata.preparing_for || metadata.objective || "general learning",
        durationDays: fallbackDays.length
      }) || "",
    adjustments: buildFallbackAdjustmentText(missedDays),
    remainingDays: fallbackDays
  };
}

function splitPlanByProgress(plan, progress) {
  if (!plan || typeof plan !== "object") {
    throw new Error("Stored plan is invalid");
  }

  const days = Array.isArray(plan.days) ? plan.days : [];

  if (!days.length) {
    throw new Error("Stored plan has no days");
  }

  const progressDays = progress && typeof progress.days === "object" ? progress.days : {};
  const completedDays = [];
  const remainingDays = [];
  const missedDays = [];

  days.forEach((day, index) => {
    const status = progressDays[String(index + 1)] || "pending";
    const clonedDay = clone(day);
    clonedDay.status = status;
    clonedDay.originalDay = index + 1;

    if (status === "completed") {
      completedDays.push(clonedDay);
      return;
    }

    remainingDays.push(clonedDay);

    if (status === "missed") {
      missedDays.push(clonedDay);
    }
  });

  return {
    completedDays,
    remainingDays,
    missedDays
  };
}

function reschedulePlan(plan, progress) {
  if (!plan || typeof plan !== "object") {
    throw new Error("Stored plan is invalid");
  }

  const originalDays = Array.isArray(plan.days) ? plan.days : [];

  if (!originalDays.length) {
    throw new Error("Stored plan has no days to reschedule");
  }

  const progressDays = progress && typeof progress.days === "object" ? progress.days : {};
  const completedDays = [];
  const pendingTasks = [];
  const missedTasks = [];
  const missedDayNumbers = [];

  originalDays.forEach((day, index) => {
    const status = progressDays[String(index + 1)] || "pending";
    const clonedDay = clone(day);

    if (status === "completed") {
      completedDays.push(clonedDay);
      return;
    }

    if (status === "missed") {
      missedDayNumbers.push(index + 1);
      missedTasks.push(clonedDay);
      return;
    }

    pendingTasks.push(clonedDay);
  });

  const reorderedDays = normalizeDayOrder([...completedDays, ...pendingTasks, ...missedTasks]);

  return {
    plan: {
      ...clone(plan),
      days: reorderedDays
    },
    rescheduleSummary: {
      missedDays: missedDayNumbers,
      tasksShifted: missedDayNumbers.length > 0,
      originalDuration: originalDays.length,
      newDuration: reorderedDays.length
    }
  };
}

function mergeReplannedDays(completedDays, replannedDays) {
  const merged = [];

  completedDays.forEach((day, index) => {
    const clonedDay = clone(day);
    delete clonedDay.status;
    delete clonedDay.originalDay;
    clonedDay.day = index + 1;
    merged.push(clonedDay);
  });

  replannedDays.forEach((day, index) => {
    const clonedDay = clone(day);
    delete clonedDay.status;
    delete clonedDay.originalDay;
    clonedDay.day = merged.length + index + 1;
    merged.push(clonedDay);
  });

  return merged;
}

function normalizePlanDays({ course, days, defaultHours }) {
  return (Array.isArray(days) ? days : [])
    .map((day, index) => {
      if (!day || typeof day !== "object") {
        return null;
      }

      const title = normalizeText(day.title) || "Study Session";
      const focus = normalizeText(day.focus);
      const estimatedHours = normalizeHours(day.estimated_hours ?? day.estimatedHours, defaultHours);
      const [resourceTitle, resourceUrl] = pickBestResource({
        course,
        title,
        focus,
        existingTitle: normalizeText(day.resource_title || day.resourceTitle || "Reference"),
        existingUrl: normalizeText(day.resource_url || day.resourceUrl)
      });

      return {
        day: parsePositiveInt(day.day || index + 1, "day"),
        title,
        focus,
        estimated_hours: estimatedHours,
        resource_title: resourceTitle,
        resource_url: resourceUrl,
        notes: normalizeText(day.notes),
        ...(day.original_day || day.originalDay
          ? { original_day: Number(day.original_day || day.originalDay) || index + 1 }
          : {})
      };
    })
    .filter(Boolean);
}

function pickBestResource({ course, title, focus, existingTitle = "", existingUrl = "" }) {
  const searchText = `${course} ${title} ${focus}`.toLowerCase();

  for (const [keywords, label, url] of CURATED_RESOURCES) {
    if (keywords.some((keyword) => searchText.includes(keyword))) {
      return [label, url];
    }
  }

  const normalizedExistingUrl = normalizeUrl(existingUrl);
  if (normalizedExistingUrl && isTrustedUrl(normalizedExistingUrl)) {
    return [existingTitle || "Reference", normalizedExistingUrl];
  }

  const query = encodeURIComponent(`${course} ${title} ${focus}`.trim());
  return ["Wikipedia Search", `https://en.wikipedia.org/wiki/Special:Search?search=${query}`];
}

function buildFallbackPlan({
  course,
  durationDays,
  dailyHours,
  knowledgeLevel,
  preparingFor,
  objective
}) {
  const courseLabel = course || "Study Plan";
  const phases = buildCoursePhases(courseLabel, knowledgeLevel, preparingFor, objective);
  const days = [];

  for (let day = 1; day <= durationDays; day += 1) {
    const phase = phases[(day - 1) % phases.length];
    const practiceType = day % 5 === 0 ? "mock review" : day % 3 === 0 ? "guided practice" : "concept review";
    days.push({
      day,
      title: phase.title,
      focus: `${phase.focus}. Use this session for ${practiceType} tied to ${objective}.`,
      estimated_hours: dailyHours,
      resource_title: phase.resourceTitle,
      resource_url: phase.resourceUrl,
      notes: phase.notes
    });
  }

  return {
    summary: buildFallbackSummary({ course: courseLabel, knowledgeLevel, objective, preparingFor, durationDays }),
    days
  };
}

function buildFallbackReplannedDays({ remainingDays, missedDays, metadata }) {
  const missedMap = new Set(missedDays.map((day) => day.originalDay));
  const missedFirst = remainingDays
    .filter((day) => missedMap.has(day.originalDay))
    .concat(remainingDays.filter((day) => !missedMap.has(day.originalDay)));

  return missedFirst.map((day, index) => ({
    day: index + 1,
    title: normalizeText(day.title) || `Catch-up session ${index + 1}`,
    focus: normalizeText(day.focus) || `Revisit this ${metadata.course || "study"} topic with stronger recall and practice.`,
    estimated_hours: normalizeHours(day.estimated_hours ?? day.estimatedHours, 2),
    resource_title: normalizeText(day.resource_title || day.resourceTitle) || "Reference",
    resource_url: normalizeText(day.resource_url || day.resourceUrl),
    notes:
      normalizeText(day.notes) ||
      (missedMap.has(day.originalDay)
        ? "This day was moved forward because it had been missed earlier."
        : "Adjusted to keep the remaining plan balanced.")
  }));
}

function buildCoursePhases(course, knowledgeLevel, preparingFor, objective) {
  const level = String(knowledgeLevel || "").toLowerCase();
  const target = normalizeText(preparingFor || objective).toLowerCase();
  const foundationTitle = level === "advanced" ? `Advanced ${course} refresh` : `${course} foundations`;
  const applicationTitle = target.includes("interview")
    ? `${course} interview application`
    : target.includes("exam")
      ? `${course} exam practice`
      : `${course} practical application`;
  const foundationResource = pickBestResource({ course, title: foundationTitle, focus: "foundations" });
  const workflowResource = pickBestResource({ course, title: `${course} key workflows`, focus: "patterns" });
  const applicationResource = pickBestResource({ course, title: applicationTitle, focus: preparingFor || objective });
  const revisionResource = pickBestResource({ course, title: `${course} checkpoint and revision`, focus: "revision" });

  return [
    {
      title: foundationTitle,
      focus: `Review the core building blocks, terminology, and must-know concepts in ${course}`,
      resourceTitle: foundationResource[0],
      resourceUrl: foundationResource[1],
      notes: "Start by making short notes you can revise quickly."
    },
    {
      title: `${course} key workflows`,
      focus: `Understand the most common workflows, patterns, and problem types in ${course}`,
      resourceTitle: workflowResource[0],
      resourceUrl: workflowResource[1],
      notes: "Connect each concept to one real example."
    },
    {
      title: applicationTitle,
      focus: `Apply ${course} concepts in the style of ${preparingFor || objective}`,
      resourceTitle: applicationResource[0],
      resourceUrl: applicationResource[1],
      notes: "Practice under realistic constraints instead of only reading."
    },
    {
      title: `${course} weak-area repair`,
      focus: "Revisit weak areas, fill gaps, and explain tricky topics in your own words",
      resourceTitle: revisionResource[0],
      resourceUrl: revisionResource[1],
      notes: "Treat this as a correction day and capture mistakes."
    },
    {
      title: `${course} checkpoint and revision`,
      focus: "Run a checkpoint session, summarize your progress, and revise important takeaways",
      resourceTitle: revisionResource[0],
      resourceUrl: revisionResource[1],
      notes: "End with a quick self-test or mini mock."
    }
  ];
}

function buildFallbackSummary({ course, knowledgeLevel, objective, preparingFor, durationDays }) {
  return `This ${durationDays}-day plan for ${course} is tailored to a ${knowledgeLevel} learner preparing for ${preparingFor}. It balances foundations, applied practice, revision, and checkpoints so the learner can move steadily toward ${objective}.`;
}

function buildFallbackAdjustmentText(missedDays) {
  if (!missedDays.length) {
    return "The remaining plan was tightened to keep the same overall objective while improving pacing.";
  }

  const movedDays = missedDays.map((day) => day.originalDay).join(", ");
  return `The updated plan front-loads missed days (${movedDays}) and redistributes the rest of the remaining work to keep progress realistic.`;
}

function parseUserInputHeuristically(text) {
  const normalized = normalizeText(text);
  const durationMatch = normalized.match(/(\d+)\s*(day|days|week|weeks|month|months)/i);
  let duration = DEFAULT_PARSED_INPUT.duration;

  if (durationMatch) {
    const value = Number(durationMatch[1]);
    const unit = durationMatch[2].toLowerCase();

    if (unit.startsWith("week")) {
      duration = String(value * 7);
    } else if (unit.startsWith("month")) {
      duration = String(value * 30);
    } else {
      duration = String(value);
    }
  }

  const levelMatch = normalized.match(/\b(beginner|basics|intermediate|advanced)\b/i);
  const objectiveMatch =
    normalized.match(/\b(placements?|placement prep|interview prep|exam preparation|upskilling|revision|internship preparation)\b/i) ||
    normalized.match(/\b(for\s+[a-z\s]+)$/i);
  const courseMatch =
    normalized.match(/(?:learn|study|prepare|master|revise)\s+(.+?)(?:\s+in\s+\d+\s*(?:day|days|week|weeks|month|months)|,|\.|$)/i) ||
    normalized.match(/^(.+?)(?:\s+in\s+\d+\s*(?:day|days|week|weeks|month|months)|,|\.|$)/i);

  return {
    course: normalizeText(courseMatch?.[1]) || DEFAULT_PARSED_INPUT.course,
    duration,
    level: normalizeText(levelMatch?.[1]).toLowerCase() || DEFAULT_PARSED_INPUT.level,
    objective: normalizeText(objectiveMatch?.[1]).replace(/^for\s+/i, "") || DEFAULT_PARSED_INPUT.objective
  };
}

function safeParseJson(rawText) {
  const text = String(rawText || "")
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  if (!text) {
    return null;
  }

  const candidate = extractJsonObject(text);

  try {
    return JSON.parse(candidate);
  } catch (_error) {
    return null;
  }
}

function extractJsonObject(text) {
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }

  return text;
}

function parsePositiveInt(value, fieldName) {
  const parsed = Number.parseInt(String(value), 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    const error = new Error(`${fieldName} must be a positive integer`);
    error.statusCode = 400;
    throw error;
  }

  return parsed;
}

function parsePositiveNumber(value, fieldName) {
  const parsed = Number.parseFloat(String(value));

  if (!Number.isFinite(parsed) || parsed <= 0) {
    const error = new Error(`${fieldName} must be a positive number`);
    error.statusCode = 400;
    throw error;
  }

  return parsed;
}

function normalizeHours(value, fallback) {
  const numeric = Number.parseFloat(String(value));

  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric;
  }

  const fallbackNumeric = Number.parseFloat(String(fallback));
  return Number.isFinite(fallbackNumeric) && fallbackNumeric > 0 ? fallbackNumeric : 1;
}

function normalizeDayOrder(days) {
  return days.map((day, index) => {
    const clonedDay = clone(day);
    clonedDay.original_day = Number(clonedDay.day) || index + 1;
    clonedDay.day = index + 1;
    return clonedDay;
  });
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeUrl(url) {
  const value = normalizeText(url);

  if (!value) {
    return "";
  }

  const prefixed = value.startsWith("http://") || value.startsWith("https://") ? value : `https://${value}`;

  try {
    const parsed = new URL(prefixed);
    return parsed.hostname ? prefixed : "";
  } catch (_error) {
    return "";
  }
}

function isTrustedUrl(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    return TRUSTED_DOMAINS.has(host);
  } catch (_error) {
    return false;
  }
}

function parseBoolean(value, fallback = false) {
  if (value == null) {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
}

function isValidEmail(value) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value || "");
}

function decodeBase64Payload(payload, errorMessage) {
  const normalized = String(payload || "")
    .replace(/^data:[^,]+,/, "")
    .replace(/\s+/g, "");

  try {
    return Buffer.from(normalized, "base64");
  } catch (_error) {
    const error = new Error(errorMessage);
    error.statusCode = 400;
    throw error;
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function generateStudyPlan(report = {}) {
  const overallScore = normalizeScore(report.overallScore);
  const weaknesses = normalizeList(report.weaknesses);
  const strengths = normalizeList(report.strengths);
  const level = getStudyLevel(overallScore);
  const topics = buildStudyTopics(weaknesses, strengths, level);
  const duration = `${Math.max(2, topics.length)}-${Math.max(5, topics.length + 1)} days`;

  return {
    goal: buildGoal(level, weaknesses, strengths),
    duration,
    plan: topics.map((topic, index) => ({
      day: index + 1,
      topic: topic.title,
      tasks: buildTasks(topic, level)
    }))
  };
}

function getStudyLevel(score) {
  if (score < 5) {
    return "foundational";
  }

  if (score <= 7) {
    return "intermediate";
  }

  return "advanced";
}

function buildStudyTopics(weaknesses, strengths, level) {
  const mappedTopics = weaknesses.map(mapWeaknessToTopic).filter(Boolean);
  const uniqueTopics = dedupeTopics(mappedTopics);

  if (!uniqueTopics.length) {
    uniqueTopics.push(getDefaultTopic(level, strengths));
  }

  if (uniqueTopics.length === 1) {
    uniqueTopics.push(getSupportTopic(level));
  }

  return uniqueTopics.slice(0, 5);
}

function mapWeaknessToTopic(weakness) {
  const value = weakness.toLowerCase();

  if (value.includes("system design")) {
    return { key: "system-design", title: "System Design Basics" };
  }

  if (value.includes("communication")) {
    return { key: "communication", title: "Explain projects clearly" };
  }

  if (value.includes("backend") || value.includes("api") || value.includes("database") || value.includes("db schema")) {
    return { key: "backend", title: "API design, DB schema" };
  }

  if (value.includes("technical") || value.includes("accuracy")) {
    return { key: "technical-accuracy", title: "Core backend fundamentals" };
  }

  if (value.includes("complete") || value.includes("depth")) {
    return { key: "answer-depth", title: "Structured deep-dive answers" };
  }

  if (value.includes("example") || value.includes("impact")) {
    return { key: "project-storytelling", title: "Impact-driven project storytelling" };
  }

  return { key: `custom-${value}`, title: capitalizeWords(weakness) };
}

function getDefaultTopic(level, strengths) {
  if (strengths.some((item) => item.includes("communication"))) {
    return { key: "advanced-backend", title: level === "advanced" ? "Advanced system design trade-offs" : "Backend fundamentals review" };
  }

  if (level === "foundational") {
    return { key: "foundations", title: "Programming and backend foundations" };
  }

  if (level === "intermediate") {
    return { key: "intermediate-backend", title: "Intermediate backend design" };
  }

  return { key: "advanced-backend", title: "Advanced system design trade-offs" };
}

function getSupportTopic(level) {
  if (level === "foundational") {
    return { key: "support-communication", title: "Interview communication basics" };
  }

  if (level === "intermediate") {
    return { key: "support-problem-solving", title: "Problem-solving and trade-offs" };
  }

  return { key: "support-architecture", title: "Architecture review and optimization" };
}

function buildTasks(topic, level) {
  const levelTasks = {
    foundational: [
      `Review beginner concepts for ${topic.title}.`,
      `Write short notes explaining ${topic.title} in simple language.`,
      `Practice one interview-style answer focused on ${topic.title}.`
    ],
    intermediate: [
      `Study intermediate patterns and trade-offs for ${topic.title}.`,
      `Solve one practical exercise related to ${topic.title}.`,
      `Explain your solution out loud in a structured interview format.`
    ],
    advanced: [
      `Review advanced scenarios and edge cases for ${topic.title}.`,
      `Design or critique a production-grade example around ${topic.title}.`,
      `Practice a concise senior-level explanation with trade-offs and risks.`
    ]
  };

  return levelTasks[level];
}

function buildGoal(level, weaknesses, strengths) {
  const primaryWeakness = weaknesses[0] || "backend interview performance";
  const supportStrength = strengths[0] || "your strongest areas";

  if (level === "foundational") {
    return `Rebuild core understanding around ${primaryWeakness} while using ${supportStrength} as a stable base.`;
  }

  if (level === "intermediate") {
    return `Improve consistency in ${primaryWeakness} and turn existing strengths like ${supportStrength} into stronger interview answers.`;
  }

  return `Sharpen advanced performance in ${primaryWeakness} while extending strengths such as ${supportStrength} into senior-level interview depth.`;
}

function dedupeTopics(topics) {
  const seen = new Set();

  return topics.filter((topic) => {
    if (!topic?.key || seen.has(topic.key)) {
      return false;
    }

    seen.add(topic.key);
    return true;
  });
}

function normalizeScore(score) {
  const numericScore = Number(score);
  return Number.isNaN(numericScore) ? 0 : Math.max(0, Math.min(10, numericScore));
}

function normalizeList(items) {
  return Array.isArray(items)
    ? items
        .map((item) => {
          if (typeof item === "string") {
            return item.trim();
          }

          if (item && typeof item === "object") {
            return String(item.title || item.description || "").trim();
          }

          return "";
        })
        .filter(Boolean)
    : [];
}

function capitalizeWords(value) {
  return String(value || "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

module.exports = {
  generatePlannerPlan,
  generateStudyPlan,
  getPlannerPlan,
  getPlannerProgress,
  replanPlannerPlan,
  reschedulePlannerPlan,
  sendPlannerEmail,
  updatePlannerProgress
};
