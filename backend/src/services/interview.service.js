const mongoose = require("mongoose");
const InterviewSession = require("../models/interview-session.model");
const { env } = require("../config/env");
const { generateQuestion, evaluateAnswer: evaluateAnswerWithLlm } = require("./llm.service");
const {
  buildStartInterviewPrompt,
  buildNextQuestionPrompt
} = require("./prompt.service");
const { cleanResumeText } = require("./resume.service");
const { generateStudyPlan } = require("./study-planner.service");
const { createTask } = require("./task.service");

async function startInterview(payload = {}, requestSession = {}) {
  const sessionResume = requestSession?.resume?.resumeText || "";
  const { userId, resumeText, mode = "resume", difficulty = "intermediate" } = payload;
  const normalizedUserId = userId || "anonymous";
  const effectiveResumeText = cleanResumeText(resumeText || sessionResume);

  validateStartPayload({ resumeText: effectiveResumeText, mode, difficulty });

  const normalizedResume = effectiveResumeText;
  const previousReport = await getLatestCompletedReportForUser(normalizedUserId);
  const firstQuestion = cleanQuestionText(await generateOpeningQuestion({
    resumeText: normalizedResume,
    mode,
    difficulty,
    previousReport
  }));

  if (!firstQuestion) {
    throw new Error("LLM did not return an opening question");
  }

  const interviewSession = await InterviewSession.create({
    userId: normalizedUserId,
    resumeFileName: requestSession?.resume?.fileName || "",
    resumeText: normalizedResume,
    mode,
    difficulty,
    questionCount: 1,
    maxQuestions: 5,
    history: [
      {
        question: firstQuestion
      }
    ]
  });

  console.log("Interview started:", interviewSession.id);

  return {
    sessionId: interviewSession.id,
    userId: interviewSession.userId,
    mode: interviewSession.mode,
    difficulty: interviewSession.difficulty,
    firstQuestion,
    maxQuestions: interviewSession.maxQuestions,
    createdAt: interviewSession.createdAt
  };
}

async function processAnswer(payload) {
  const { sessionId, answer } = payload;
  const normalizedAnswer = normalizeUserAnswer(answer);

  if (!sessionId || !mongoose.Types.ObjectId.isValid(sessionId)) {
    const error = new Error("Valid sessionId is required");
    error.statusCode = 400;
    throw error;
  }

  if (!normalizedAnswer) {
    const error = new Error("Answer is required");
    error.statusCode = 400;
    throw error;
  }

  const session = await InterviewSession.findById(sessionId);

  if (!session) {
    const error = new Error("Interview session not found");
    error.statusCode = 404;
    throw error;
  }

  if (session.status === "completed") {
    const error = new Error("Interview session is already completed");
    error.statusCode = 409;
    throw error;
  }

  const lastHistoryItem = session.history[session.history.length - 1];
  const currentQuestionCount = session.questionCount || session.history.length || 0;

  if (!lastHistoryItem) {
    throw new Error("Interview session has no pending question");
  }

  const formattedHistory = serializeHistory(session.history.slice(-env.maxHistoryItems));
  const evaluation = await evaluateAnswer({
    session,
    history: formattedHistory,
    question: lastHistoryItem.question,
    answer: normalizedAnswer,
    currentQuestionCount
  });

  console.log("Answer processed:", session.id, `length=${normalizedAnswer.length}`);

  lastHistoryItem.answer = normalizedAnswer;
  lastHistoryItem.feedback = evaluation.feedback;
  lastHistoryItem.score = normalizeScore(evaluation.score);
  lastHistoryItem.strengths = evaluation.strengths;
  lastHistoryItem.weaknesses = evaluation.weaknesses;
  lastHistoryItem.communication = normalizeScore(evaluation.communication);
  lastHistoryItem.technicalAccuracy = normalizeScore(evaluation.technicalAccuracy);
  lastHistoryItem.completeness = normalizeScore(evaluation.completeness);
  lastHistoryItem.improvements = evaluation.improvements;
  lastHistoryItem.answeredAt = new Date();

  if (currentQuestionCount >= session.maxQuestions) {
    await markSessionCompleted(session);
  } else if (evaluation.nextQuestion) {
    session.history.push({
      question: evaluation.nextQuestion
    });
    session.questionCount = currentQuestionCount + 1;
    console.log("Question generated:", session.id);
  } else {
    await markSessionCompleted(session);
  }

  await session.save();
  const finalReport = session.status === "completed" ? session.finalReport : null;

  return {
    sessionId: session.id,
    feedback: lastHistoryItem.feedback,
    score: lastHistoryItem.score,
    strengths: lastHistoryItem.strengths,
    weaknesses: lastHistoryItem.weaknesses,
    communication: lastHistoryItem.communication,
    technicalAccuracy: lastHistoryItem.technicalAccuracy,
    completeness: lastHistoryItem.completeness,
    improvements: lastHistoryItem.improvements,
    currentQuestion: Math.min(currentQuestionCount, session.maxQuestions),
    maxQuestions: session.maxQuestions,
    nextQuestion: session.status === "completed" ? "" : evaluation.nextQuestion || "",
    status: session.status,
    ...(session.status === "completed" && {
      message: "Feedback saved",
      suggestion: true,
      suggestionAvailable: session.suggestedPlanAvailable === true,
      finalSummary: session.finalSummary,
      report: normalizeReport(finalReport)
    })
  };
}

async function getInterviewHistory(userId) {
  const normalizedUserId = String(userId || "").trim();

  if (!normalizedUserId) {
    const error = new Error("userId is required");
    error.statusCode = 400;
    throw error;
  }

  const sessions = await InterviewSession.find({
    userId: normalizedUserId,
    status: "completed"
  })
    .sort({ completedAt: -1, createdAt: -1 })
    .select("_id mode score completedAt createdAt finalSummary finalReport suggestedPlanAvailable generatedPlanIds")
    .lean();

  return sessions.map((session) => ({
    sessionId: session._id,
    score: session.score ?? session.finalReport?.overallScore ?? 0,
    date: session.completedAt || session.createdAt,
    mode: session.mode,
    summary: session.finalSummary || session.finalReport?.finalFeedback || "",
    feedbackText: session.finalSummary || session.finalReport?.finalFeedback || "",
    weakAreas: ensureStringArray(session.finalReport?.progressComparison?.weakAreas),
    suggestionAvailable: session.suggestedPlanAvailable === true,
    generatedPlanIds: ensureStringArray(session.generatedPlanIds)
  }));
}

async function getInterviewProgress(userId) {
  const normalizedUserId = String(userId || "").trim();

  if (!normalizedUserId) {
    const error = new Error("userId is required");
    error.statusCode = 400;
    throw error;
  }

  const sessions = await InterviewSession.find({
    userId: normalizedUserId,
    status: "completed"
  })
    .sort({ completedAt: 1, createdAt: 1 })
    .select("score completedAt createdAt history finalReport")
    .lean();

  const scores = [];
  const communication = [];
  const technical = [];
  const completeness = [];
  const sessionSummaries = [];
  const weakAreas = new Map();

  sessions.forEach((session) => {
    const answeredRounds = Array.isArray(session.history) ? session.history.filter((item) => item && item.answer) : [];
    const averageCommunication = averageMetric(answeredRounds.map((item) => item.communication));
    const averageTechnical = averageMetric(answeredRounds.map((item) => item.technicalAccuracy));
    const averageCompleteness = averageMetric(answeredRounds.map((item) => item.completeness));
    const overallScore = normalizeScore(session.score ?? session.finalReport?.overallScore) ?? 0;
    const date = session.completedAt || session.createdAt;

    scores.push(overallScore);
    communication.push(averageCommunication);
    technical.push(averageTechnical);
    completeness.push(averageCompleteness);
    sessionSummaries.push({
      date,
      score: overallScore
    });

    normalizeWeaknesses(session.finalReport?.weaknesses).forEach((item) => {
      const title = item.title || "Improvement area";
      weakAreas.set(title, (weakAreas.get(title) || 0) + 1);
    });
  });

  const improvement = scores.length >= 2 ? scores[scores.length - 1] - scores[0] : 0;
  const weakAreaList = Array.from(weakAreas.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([title]) => title);

  return {
    scores,
    communication,
    technical,
    completeness,
    sessions: sessionSummaries,
    improvement,
    weakAreas: weakAreaList
  };
}

async function generateInterviewReport(sessionId) {
  if (!mongoose.Types.ObjectId.isValid(sessionId)) {
    const error = new Error("Valid sessionId is required");
    error.statusCode = 400;
    throw error;
  }

  const session = await InterviewSession.findById(sessionId);

  if (!session) {
    const error = new Error("Interview session not found");
    error.statusCode = 404;
    throw error;
  }

  if (session.status !== "completed") {
    const error = new Error("Interview report is available after the interview is completed");
    error.statusCode = 409;
    throw error;
  }

  if (shouldRefreshFinalReport(session) && session.status === "completed") {
    const report = await buildFinalReport(session);
    session.finalReport = report;
    session.score = report.overallScore;
    session.finalSummary = report.finalFeedback;
    await session.save();
  }

  const report = session.finalReport?.overallScore != null ? session.finalReport : await buildFinalReport(session);

  return {
    sessionId: session._id,
    mode: session.mode,
    createdAt: session.createdAt,
    completedAt: session.completedAt || "",
    report: normalizeReport(report),
    suggestion: session.suggestedPlanAvailable === true,
    suggestionAvailable: session.suggestedPlanAvailable === true,
    generatedPlanIds: ensureStringArray(session.generatedPlanIds),
    studyPlan: hasStudyPlan(session.studyPlan) ? normalizeStudyPlan(session.studyPlan) : null
  };
}

async function generatePlanFromFeedback(userId, payload = {}) {
  const sessionId = normalizeText(payload.sessionId);

  if (!sessionId || !mongoose.Types.ObjectId.isValid(sessionId)) {
    const error = new Error("Valid sessionId is required");
    error.statusCode = 400;
    throw error;
  }

  const session = await InterviewSession.findById(sessionId);

  if (!session) {
    const error = new Error("Interview session not found");
    error.statusCode = 404;
    throw error;
  }

  if (normalizeText(session.userId) !== normalizeText(userId)) {
    const error = new Error("You are not allowed to generate a plan for this feedback");
    error.statusCode = 403;
    throw error;
  }

  if (session.status !== "completed") {
    const error = new Error("A plan can only be generated from completed interview feedback");
    error.statusCode = 409;
    throw error;
  }

  const role = normalizeText(payload.role) || `${session.mode} interview`;
  const company = normalizeText(payload.company);
  const feedbackText = normalizeText(payload.feedbackText) || session.finalSummary || session.finalReport?.finalFeedback || "";
  const weakAreas = ensureStringArray(payload.weakAreas).length
    ? ensureStringArray(payload.weakAreas)
    : ensureStringArray(session.finalReport?.progressComparison?.weakAreas);
  const report = session.finalReport?.overallScore != null
    ? session.finalReport
    : await buildFinalReport(session);
  const plan = generateStudyPlan({
    ...report,
    weaknesses: weakAreas.length ? weakAreas : extractWeaknessTitles(report.weaknesses),
    finalFeedback: feedbackText || report.finalFeedback
  });
  const planId = `feedback-${session.id}-${Date.now()}`;
  const createdTasks = [];
  const baseDate = getNextMorningDate();

  for (const entry of Array.isArray(plan.plan) ? plan.plan : []) {
    const startTime = new Date(baseDate);
    startTime.setDate(baseDate.getDate() + Math.max(0, Number(entry.day || 1) - 1));
    const endTime = new Date(startTime);
    endTime.setHours(startTime.getHours() + 1, 30, 0, 0);

    const task = await createTask(userId, {
      planId,
      title: entry.topic || `Study Session ${entry.day || ""}`.trim(),
      description: (entry.tasks || []).join("\n"),
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString()
    });
    createdTasks.push(task);
  }

  session.generatedPlanIds = [...new Set([...(session.generatedPlanIds || []), planId])];
  session.suggestedPlanAvailable = false;
  await session.save();

  return {
    success: true,
    message: "Study plan created successfully",
    planId,
    company,
    role,
    feedbackText,
    weakAreas,
    taskCount: createdTasks.length
  };
}

async function getSession(sessionId) {
  if (!mongoose.Types.ObjectId.isValid(sessionId)) {
    const error = new Error("Valid sessionId is required");
    error.statusCode = 400;
    throw error;
  }

  const session = await InterviewSession.findById(sessionId).lean();

  if (!session) {
    const error = new Error("Interview session not found");
    error.statusCode = 404;
    throw error;
  }

  return session;
}

async function getLatestCompletedReportForUser(userId) {
  const normalizedUserId = String(userId || "").trim();

  if (!normalizedUserId) {
    return null;
  }

  const session = await InterviewSession.findOne({
    userId: normalizedUserId,
    status: "completed"
  })
    .sort({ completedAt: -1, createdAt: -1 })
    .select("finalReport score history")
    .lean();

  if (!session) {
    return null;
  }

  if (session.finalReport?.overallScore != null) {
    return {
      overallScore: session.finalReport.overallScore,
      strengths: session.finalReport.strengths || [],
      weaknesses: extractWeaknessTitles(session.finalReport.weaknesses)
    };
  }

  const computedReport = createFinalReport(session);

  return {
    overallScore: computedReport.overallScore,
    strengths: computedReport.strengths,
    weaknesses: extractWeaknessTitles(computedReport.weaknesses)
  };
}

function validateStartPayload({ resumeText, mode, difficulty }) {
  if (!resumeText || !resumeText.trim()) {
    const error = new Error("resumeText is required");
    error.statusCode = 400;
    throw error;
  }

  if (resumeText.length > 25000) {
    const error = new Error("resumeText is too long");
    error.statusCode = 400;
    throw error;
  }

  if (!["HR", "DSA", "resume"].includes(mode)) {
    const error = new Error("mode must be one of HR, DSA, resume");
    error.statusCode = 400;
    throw error;
  }

  if (!["beginner", "intermediate", "advanced"].includes(difficulty)) {
    const error = new Error("difficulty must be one of beginner, intermediate, advanced");
    error.statusCode = 400;
    throw error;
  }
}

function serializeHistory(history) {
  return history
    .map((item, index) => {
      return [
        `Round ${index + 1}`,
        `Question: ${item.question || ""}`,
        `Answer: ${item.answer || ""}`,
        `Feedback: ${item.feedback || ""}`,
        `Score: ${item.score ?? ""}`,
        `Strengths: ${(item.strengths || []).join("; ")}`,
        `Weaknesses: ${(item.weaknesses || []).join("; ")}`
      ].join("\n");
    })
    .join("\n\n");
}

function normalizeScore(score) {
  const numericScore = Number(score);

  if (Number.isNaN(numericScore)) {
    return null;
  }

  return Math.max(0, Math.min(10, numericScore));
}

async function markSessionCompleted(session) {
  const report = await buildFinalReport(session);
  session.status = "completed";
  session.completedAt = new Date();
  session.score = report.overallScore;
  session.finalSummary = report.finalFeedback;
  session.finalReport = report;
  session.suggestedPlanAvailable = true;
  console.log("Interview completed:", session.id);
}

function parseEvaluationText(rawText) {
  const parsed = safeParseEvaluationJson(rawText);

  if (parsed) {
    return normalizeEvaluation(parsed);
  }

  const feedback = extractLabeledValue(rawText, "Feedback");
  const scoreValue = extractLabeledValue(rawText, "Score");
  const nextQuestionValue = extractLabeledValue(rawText, "Next Question");

  return normalizeEvaluation(
    {
      feedback: feedback || rawText.trim() || "Unable to evaluate answer properly.",
      score: parseScore(scoreValue),
      nextQuestion: normalizeNextQuestion(nextQuestionValue) || "Can you try explaining your answer again?"
    }
  );
}

function safeParseEvaluationJson(rawText) {
  const cleaned = String(rawText || "")
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  if (!cleaned) {
    return null;
  }

  const jsonCandidate = extractJsonObject(cleaned);

  try {
    return JSON.parse(jsonCandidate);
  } catch (error) {
    console.error("JSON parse failed", error);
    return null;
  }
}

function normalizeEvaluation(data) {
  const normalized = {
    feedback: normalizeText(data.feedback) || "Unable to evaluate answer properly.",
    score: normalizeScore(data.score ?? 0) ?? 0,
    strengths: ensureArrayWithFallback(data.strengths, ["Relevant experience", "Some subject familiarity"]),
    weaknesses: ensureArrayWithFallback(data.weaknesses, ["Needs more specificity", "Could improve depth"]),
    communication: normalizeScore(data.communication ?? 0) ?? 0,
    technicalAccuracy:
      normalizeScore(data.technicalAccuracy ?? data.technical_accuracy ?? 0) ?? 0,
    completeness: normalizeScore(data.completeness ?? 0) ?? 0,
    improvements: ensureArrayWithFallback(data.improvements, ["Use a clearer structure", "Add one concrete example"]),
    nextQuestion: normalizeNextQuestion(data.nextQuestion || data.next_question) || "Can you try explaining your answer again?"
  };

  const missingFields = [];

  if (!normalized.feedback) missingFields.push("feedback");
  if (!Array.isArray(data.strengths)) missingFields.push("strengths");
  if (!Array.isArray(data.weaknesses)) missingFields.push("weaknesses");
  if (data.communication == null) missingFields.push("communication");
  if (data.technicalAccuracy == null && data.technical_accuracy == null) missingFields.push("technicalAccuracy");
  if (data.completeness == null) missingFields.push("completeness");
  if (!Array.isArray(data.improvements)) missingFields.push("improvements");
  if (data.nextQuestion == null && data.next_question == null) missingFields.push("nextQuestion");

  if (missingFields.length > 0) {
    console.warn("AI response missing fields, using fallback values");
  }

  return normalized;
}

function extractLabeledValue(text, label) {
  const pattern = new RegExp(`${label}\\s*:\\s*(.+)`, "i");
  const match = String(text || "").match(pattern);
  return match ? match[1].trim() : "";
}

function extractJsonObject(text) {
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }

  return text;
}

function formatPrompt({ systemPrompt, userPrompt }) {
  return `${systemPrompt}\n\n${userPrompt}`.trim();
}

async function buildFinalReport(session) {
  const baseReport = createFinalReport(session);
  const progressComparison = await buildProgressComparison(session, baseReport);

  return {
    ...baseReport,
    progress: {
      previousScore: progressComparison.previousScore,
      currentScore: progressComparison.currentScore,
      improvement: progressComparison.improvement
    },
    progressMetrics: progressComparison.progressMetrics,
    progressComparison
  };
}

async function generateOpeningQuestion({ resumeText, mode, difficulty, previousReport }) {
  try {
    const response = await generateQuestion(
      buildStartInterviewPrompt({
        resumeText,
        mode,
        difficulty,
        previousReport
      })
    );
    return response.reply;
  } catch (error) {
    console.warn("Falling back to local opening question generation", { error: error.message });
    return buildFallbackOpeningQuestion({ resumeText, mode, difficulty });
  }
}

function createFinalReport(session) {
  const history = Array.isArray(session.history) ? session.history : [];
  const answeredRounds = history.filter((item) => item && item.answer);
  const scores = answeredRounds.map((item) => normalizeScore(item.score)).filter((value) => value !== null);
  const communicationScores = answeredRounds
    .map((item) => normalizeScore(item.communication))
    .filter((value) => value !== null);
  const technicalScores = answeredRounds
    .map((item) => normalizeScore(item.technicalAccuracy))
    .filter((value) => value !== null);
  const completenessScores = answeredRounds
    .map((item) => normalizeScore(item.completeness))
    .filter((value) => value !== null);
  const strengths = getTopFrequentItems(answeredRounds.flatMap((item) => item.strengths || []), 3);
  const weaknessTexts = getTopFrequentItems(answeredRounds.flatMap((item) => item.weaknesses || []), 3);

  const overallScore = scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : 0;
  const communicationTrend = getTrend(communicationScores);
  const technicalTrend = getTrend(technicalScores);
  const completenessTrend = getTrend(completenessScores);
  const weaknesses = formatWeaknesses(weaknessTexts);
  const finalFeedback = buildFinalFeedback(overallScore, strengths, weaknesses);
  const roadmap = buildRoadmap(weaknesses);
  const trends = {
    communication: communicationTrend,
    technicalAccuracy: technicalTrend,
    completeness: completenessTrend,
    overall: getTrend(scores)
  };
  const progress = buildProgressSnapshot(overallScore);
  const progressMetrics = {
    scoreTrend: [overallScore, overallScore],
    communicationTrend: [averageMetric(communicationScores), averageMetric(communicationScores)],
    technicalTrend: [averageMetric(technicalScores), averageMetric(technicalScores)]
  };
  const scoreExplanation = buildScoreExplanation({
    overallScore,
    weaknesses,
    completenessValue: averageMetric(completenessScores)
  });
  const topPriority = buildTopPriority(weaknesses);
  const finalInsight = buildFinalInsight({
    overallScore,
    trends,
    strengths,
    weaknesses
  });

  return {
    overallScore,
    strengths,
    weaknesses,
    roadmap,
    trends,
    progress,
    progressMetrics,
    finalFeedback,
    finalInsight,
    scoreExplanation,
    topPriority
  };
}

async function buildProgressComparison(session, baseReport) {
  const previousSessions = await InterviewSession.find({
    userId: session.userId,
    status: "completed",
    _id: { $ne: session._id }
  })
    .sort({ completedAt: -1, createdAt: -1 })
    .limit(1)
    .select("score finalReport history")
    .lean();

  const previousSession = previousSessions[0];

  if (!previousSession) {
    const currentMetrics = getSessionMetricSnapshot(session, baseReport);
    return {
      previousScore: null,
      currentScore: normalizeScore(baseReport?.overallScore ?? session.score) ?? 0,
      improvement: 0,
      progressMetrics: {
        scoreTrend: [currentMetrics.overallScore, currentMetrics.overallScore],
        communicationTrend: [currentMetrics.communication, currentMetrics.communication],
        technicalTrend: [currentMetrics.technicalAccuracy, currentMetrics.technicalAccuracy]
      },
      scoreImprovement: 0,
      improvedAreas: [],
      weakAreas: []
    };
  }

  const currentMetrics = getSessionMetricSnapshot(session, baseReport);
  const previousMetrics = getSessionMetricSnapshot(previousSession, previousSession.finalReport);
  const scoreDifference = currentMetrics.overallScore - previousMetrics.overallScore;
  const communicationDifference = currentMetrics.communication - previousMetrics.communication;
  const technicalAccuracyDifference =
    currentMetrics.technicalAccuracy - previousMetrics.technicalAccuracy;

  return {
    previousScore: previousMetrics.overallScore,
    currentScore: currentMetrics.overallScore,
    improvement: scoreDifference,
    progressMetrics: {
      scoreTrend: [previousMetrics.overallScore, currentMetrics.overallScore],
      communicationTrend: [previousMetrics.communication, currentMetrics.communication],
      technicalTrend: [previousMetrics.technicalAccuracy, currentMetrics.technicalAccuracy]
    },
    scoreImprovement: scoreDifference,
    improvedAreas: getAreaChanges({
      score: scoreDifference,
      communication: communicationDifference,
      technicalAccuracy: technicalAccuracyDifference
    }, "positive"),
    weakAreas: getAreaChanges({
      score: scoreDifference,
      communication: communicationDifference,
      technicalAccuracy: technicalAccuracyDifference
    }, "negative")
  };
}

async function evaluateAnswer({ session, history, question, answer, currentQuestionCount }) {
  try {
    const response = await evaluateAnswerWithLlm(
      buildNextQuestionPrompt({
        resumeText: session.resumeText,
        mode: session.mode,
        difficulty: session.difficulty || "intermediate",
        history,
        question,
        answer
      })
    );
    const evaluationText = response.reply;

    return parseEvaluationText(evaluationText);
  } catch (error) {
    console.warn("Falling back to local answer evaluation", {
      sessionId: session.id,
      error: error.message
    });
    return buildFallbackEvaluation({
      answer,
      mode: session.mode,
      difficulty: session.difficulty || "intermediate",
      currentQuestionCount,
      maxQuestions: session.maxQuestions
    });
  }
}

function getSessionMetricSnapshot(session, report) {
  const history = Array.isArray(session.history) ? session.history : [];
  const answeredRounds = history.filter((item) => item && item.answer);

  return {
    overallScore: normalizeScore(report?.overallScore ?? session.score) ?? 0,
    communication: averageMetric(answeredRounds.map((item) => item.communication)),
    technicalAccuracy: averageMetric(answeredRounds.map((item) => item.technicalAccuracy))
  };
}

function averageMetric(scores) {
  const normalizedScores = scores.map((value) => normalizeScore(value)).filter((value) => value !== null);

  if (!normalizedScores.length) {
    return 0;
  }

  return Math.round(normalizedScores.reduce((sum, value) => sum + value, 0) / normalizedScores.length);
}

function getAreaChanges(differences, direction) {
  return Object.entries(differences)
    .filter(([, difference]) => (direction === "positive" ? difference > 0 : difference < 0))
    .map(([area]) => area);
}

function shouldRefreshFinalReport(session) {
  return (
    session.finalReport?.overallScore == null ||
    !session.finalReport?.progressComparison ||
    session.finalReport?.progress?.currentScore == null ||
    !session.finalReport?.progressMetrics ||
    !session.finalReport?.finalInsight ||
    !session.finalReport?.scoreExplanation ||
    !session.finalReport?.topPriority ||
    !Array.isArray(session.finalReport?.progressComparison?.improvedAreas) ||
    !Array.isArray(session.finalReport?.progressComparison?.weakAreas)
  );
}

function hasStudyPlan(studyPlan) {
  return Boolean(
    studyPlan &&
    typeof studyPlan.goal === "string" &&
    studyPlan.goal.trim() &&
    Array.isArray(studyPlan.plan) &&
    studyPlan.plan.length > 0
  );
}

function cleanQuestionText(rawText) {
  return String(rawText || "").replace(/^["'\s]+|["'\s]+$/g, "").trim();
}

function normalizeNextQuestion(rawText) {
  const value = cleanQuestionText(rawText || "");
  if (!value || /^end$/i.test(value)) {
    return "";
  }

  return value;
}

function parseScore(rawValue) {
  const match = String(rawValue || "").match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function ensureStringArray(value, minimumItems = 0) {
  const normalized = Array.isArray(value)
    ? value.map((item) => normalizeText(item)).filter(Boolean)
    : [];

  if (normalized.length >= minimumItems) {
    return normalized;
  }

  return normalized;
}

function ensureArrayWithFallback(value, fallback) {
  const normalized = ensureStringArray(value);
  return normalized.length ? normalized : fallback;
}

function normalizeUserAnswer(answer) {
  return normalizeText(String(answer || "").slice(0, 6000));
}

function normalizeWeaknesses(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item) => {
      if (typeof item === "string") {
        return buildWeaknessSummary(item);
      }

      return {
        title: normalizeText(item?.title) || "Improvement area",
        description: normalizeText(item?.description) || "Add a clearer and more concrete explanation."
      };
    })
    .filter((item) => item.title || item.description);
}

function normalizeProgress(progress) {
  const previousScore = progress?.previousScore == null ? null : normalizeScore(progress.previousScore);
  const currentScore = normalizeScore(progress?.currentScore ?? 0) ?? 0;
  const improvement =
    previousScore == null
      ? 0
      : Number(progress?.improvement ?? currentScore - previousScore) || 0;

  return {
    previousScore,
    currentScore,
    improvement
  };
}

function normalizeProgressMetrics(progressMetrics, progress) {
  const previousScore = progress.previousScore == null ? progress.currentScore : progress.previousScore;
  const currentScore = progress.currentScore;

  return {
    scoreTrend: normalizeTrendArray(progressMetrics?.scoreTrend, [previousScore, currentScore]),
    communicationTrend: normalizeTrendArray(progressMetrics?.communicationTrend, [0, 0]),
    technicalTrend: normalizeTrendArray(progressMetrics?.technicalTrend, [0, 0])
  };
}

function normalizeTrendArray(values, fallback) {
  if (!Array.isArray(values) || values.length < 2) {
    return fallback;
  }

  return values.slice(0, 2).map((value, index) => {
    const normalized = normalizeScore(value);
    return normalized == null ? fallback[index] : normalized;
  });
}

function extractWeaknessTitles(items) {
  return normalizeWeaknesses(items).map((item) => item.title);
}

function normalizeReport(report) {
  const normalizedWeaknesses = normalizeWeaknesses(report?.weaknesses);
  const progress = normalizeProgress(
    report?.progress || {
      previousScore: report?.progressComparison?.previousScore,
      currentScore: report?.overallScore,
      improvement: report?.progressComparison?.improvement ?? report?.progressComparison?.scoreImprovement
    }
  );
  const trends = {
    communication: normalizeText(report?.trends?.communication) || "Stable",
    technicalAccuracy: normalizeText(report?.trends?.technicalAccuracy) || "Stable",
    completeness: normalizeText(report?.trends?.completeness) || "Stable",
    overall: normalizeText(report?.trends?.overall) || "Stable"
  };
  const progressMetrics = normalizeProgressMetrics(report?.progressMetrics, progress);

  return {
    overallScore: normalizeScore(report?.overallScore ?? 0) ?? 0,
    strengths: ensureStringArray(report?.strengths),
    weaknesses: normalizedWeaknesses,
    roadmap: ensureStringArray(report?.roadmap),
    trends,
    progress,
    progressMetrics,
    finalFeedback: normalizeText(report?.finalFeedback) || "",
    finalInsight:
      normalizeText(report?.finalInsight) ||
      buildFinalInsight({
        overallScore: normalizeScore(report?.overallScore ?? 0) ?? 0,
        trends,
        strengths: ensureStringArray(report?.strengths),
        weaknesses: normalizedWeaknesses
      }),
    scoreExplanation:
      normalizeText(report?.scoreExplanation) ||
      buildScoreExplanation({
        overallScore: normalizeScore(report?.overallScore ?? 0) ?? 0,
        weaknesses: normalizedWeaknesses,
        completenessValue: mapTrendToScore(trends.completeness)
      }),
    topPriority: normalizeText(report?.topPriority) || buildTopPriority(normalizedWeaknesses),
    progressComparison: {
      previousScore: progress.previousScore,
      currentScore: progress.currentScore,
      improvement: progress.improvement,
      scoreImprovement: Number(report?.progressComparison?.scoreImprovement ?? progress.improvement ?? 0) || 0,
      improvedAreas: ensureStringArray(report?.progressComparison?.improvedAreas),
      weakAreas: ensureStringArray(report?.progressComparison?.weakAreas)
    }
  };
}

function normalizeStudyPlan(studyPlan) {
  return {
    goal: normalizeText(studyPlan?.goal) || "",
    duration: normalizeText(studyPlan?.duration) || "",
    plan: Array.isArray(studyPlan?.plan)
      ? studyPlan.plan.map((item) => ({
          day: Number(item?.day ?? 0) || 0,
          topic: normalizeText(item?.topic) || "",
          tasks: ensureStringArray(item?.tasks)
        }))
      : []
  };
}

function getNextMorningDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(9, 0, 0, 0);
  return date;
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function getTrend(scores) {
  if (scores.length < 2) {
    return "Stable";
  }

  const first = scores[0];
  const last = scores[scores.length - 1];

  if (last > first) {
    return "Improved";
  }

  if (last < first) {
    return "Declined";
  }

  return "Stable";
}

function getTopFrequentItems(items, limit) {
  const counts = new Map();

  items
    .map((item) => normalizeText(item).toLowerCase())
    .filter(Boolean)
    .forEach((item) => {
      counts.set(item, (counts.get(item) || 0) + 1);
    });

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([item]) => capitalizeSentence(item));
}

function buildFinalFeedback(overallScore, strengths, weaknesses) {
  const strengthsText = strengths.length ? strengths.join(", ") : "developing core interview skills";
  const weaknessesText = weaknesses.length ? weaknesses.map((item) => item.title).join(", ") : "consistency across answers";

  return `The interview ended with an overall score of ${overallScore}/10. Stronger areas included ${strengthsText}. The main areas to improve are ${weaknessesText}.`;
}

function buildRoadmap(weaknesses) {
  if (!weaknesses.length) {
    return ["Continue practicing structured answers and keep reinforcing your strongest examples."];
  }

  return weaknesses.map((weakness) => mapWeaknessToSuggestion(weakness));
}

function mapWeaknessToSuggestion(weakness) {
  const normalizedWeakness = getWeaknessText(weakness).toLowerCase();

  if (normalizedWeakness.includes("communication")) {
    return "Practice answering in a clear step-by-step structure such as Situation, Action, and Result.";
  }

  if (normalizedWeakness.includes("technical") || normalizedWeakness.includes("accuracy")) {
    return "Review core concepts behind your answers and explain the reasoning before jumping to conclusions.";
  }

  if (normalizedWeakness.includes("complete") || normalizedWeakness.includes("depth")) {
    return "Work on giving fuller answers that cover trade-offs, edge cases, and final outcomes.";
  }

  if (normalizedWeakness.includes("example") || normalizedWeakness.includes("impact")) {
    return "Add concrete project examples with measurable impact to make your answers more credible.";
  }

  return `Practice targeted improvement on: ${normalizeText(weakness?.title) || "this area"}. Prepare a stronger example and a clearer explanation for similar questions.`;
}

function capitalizeSentence(value) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : "";
}

function formatWeaknesses(weaknesses) {
  const seen = new Set();

  return weaknesses
    .map(buildWeaknessSummary)
    .filter((item) => {
      const key = `${normalizeText(item.title).toLowerCase()}|${normalizeText(item.description).toLowerCase()}`;

      if (!key || seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
}

function buildWeaknessSummary(rawWeakness) {
  const text = normalizeText(rawWeakness);

  if (!text) {
    return {
      title: "Improvement area",
      description: "Add a clearer and more concrete explanation."
    };
  }

  const normalized = text.replace(/\.+$/g, "");
  const lower = normalized.toLowerCase();

  if (lower.includes("cross") && lower.includes("team")) {
    return {
      title: "Cross-team collaboration depth",
      description: "Explain stakeholder communication and collaboration decisions more clearly."
    };
  }

  if (lower.includes("communication")) {
    return {
      title: "Communication clarity",
      description: "Structure answers more clearly and make the main point earlier."
    };
  }

  if (lower.includes("technical") || lower.includes("accuracy")) {
    return {
      title: "Technical accuracy",
      description: "Support answers with more precise technical reasoning and fewer vague claims."
    };
  }

  if (lower.includes("complete") || lower.includes("depth")) {
    return {
      title: "Answer depth",
      description: "Cover trade-offs, edge cases, and outcomes with a bit more depth."
    };
  }

  if (lower.includes("example") || lower.includes("impact")) {
    return {
      title: "Real-world examples",
      description: "Add one concrete project example with measurable impact."
    };
  }

  if (lower.includes("specific")) {
    return {
      title: "Specificity",
      description: "Use sharper details instead of broad statements."
    };
  }

  return {
    title: createWeaknessTitle(normalized),
    description: createWeaknessDescription(normalized)
  };
}

function createWeaknessTitle(text) {
  const compact = text
    .replace(/^could have\s+/i, "")
    .replace(/^needs? to\s+/i, "")
    .replace(/^lacked\s+/i, "")
    .replace(/^insufficient\s+/i, "")
    .replace(/^more\s+/i, "")
    .trim();
  const words = compact.split(/\s+/).slice(0, 4);
  return capitalizeSentence(words.join(" ").replace(/[,:;]$/, "")) || "Improvement area";
}

function createWeaknessDescription(text) {
  const sentences = text.split(/[.!?]+/).map((item) => item.trim()).filter(Boolean);
  const firstSentence = sentences[0] || "";
  const words = firstSentence.split(/\s+/).slice(0, 12).join(" ");
  return capitalizeSentence(words.replace(/[,:;]$/, "")) || "Add a clearer and more concrete explanation.";
}

function buildProgressSnapshot(overallScore) {
  return {
    previousScore: null,
    currentScore: overallScore,
    improvement: 0
  };
}

function buildFinalInsight({ overallScore, trends, strengths, weaknesses }) {
  const level = getPerformanceLevel(overallScore);
  const improvedAreas = getImprovedTrendLabels(trends);
  const topStrength = strengths[0] || "baseline interview fundamentals";
  const mainWeakness = weaknesses[0]?.title || "answer consistency";
  const improvementText = improvedAreas.length
    ? `with improvement in ${joinWithAnd(improvedAreas)}`
    : `with steady performance in ${normalizeText(topStrength).toLowerCase()}`;

  return `${level} performance ${improvementText}. Focus on ${normalizeText(mainWeakness).toLowerCase()} to reach the next level.`;
}

function buildScoreExplanation({ overallScore, weaknesses, completenessValue }) {
  const primaryWeakness = weaknesses[0]?.title || "answer depth";

  if (overallScore >= 8) {
    return `You demonstrated strong understanding overall, but improving ${normalizeText(primaryWeakness).toLowerCase()} would make the performance feel more senior and complete.`;
  }

  if (overallScore >= 6) {
    return completenessValue >= 7
      ? `You showed solid understanding, but ${normalizeText(primaryWeakness).toLowerCase()} kept the score from moving higher.`
      : `You demonstrated good core understanding, but the answers needed more depth and completeness to score higher.`;
  }

  if (overallScore >= 4) {
    return `You showed partial understanding, but gaps in ${normalizeText(primaryWeakness).toLowerCase()} and answer completeness held the score back.`;
  }

  return `The interview showed early potential, but the score was limited by low completeness and unclear explanation quality.`;
}

function buildTopPriority(weaknesses) {
  const primaryWeakness = weaknesses[0];

  if (!primaryWeakness) {
    return "Keep strengthening answer structure and real-world examples.";
  }

  return `Improve ${normalizeText(primaryWeakness.title).toLowerCase()} by giving clearer, more concrete explanations.`;
}

function getPerformanceLevel(score) {
  if (score >= 8) {
    return "Strong mid-to-senior level";
  }

  if (score >= 6) {
    return "Solid developing mid-level";
  }

  if (score >= 4) {
    return "Promising early-career";
  }

  return "Foundational";
}

function mapTrendToScore(trend) {
  const normalizedTrend = normalizeText(trend).toLowerCase();

  if (normalizedTrend === "improved") {
    return 8;
  }

  if (normalizedTrend === "declined") {
    return 4;
  }

  return 6;
}

function getImprovedTrendLabels(trends) {
  const labels = [];

  if (normalizeText(trends?.communication).toLowerCase() === "improved") {
    labels.push("communication");
  }

  if (normalizeText(trends?.technicalAccuracy).toLowerCase() === "improved") {
    labels.push("technical depth");
  }

  if (normalizeText(trends?.completeness).toLowerCase() === "improved") {
    labels.push("answer completeness");
  }

  return labels.slice(0, 2);
}

function getWeaknessText(weakness) {
  if (typeof weakness === "string") {
    return normalizeText(weakness);
  }

  return `${normalizeText(weakness?.title)} ${normalizeText(weakness?.description)}`.trim();
}

function joinWithAnd(items) {
  if (!items.length) {
    return "";
  }

  if (items.length === 1) {
    return items[0];
  }

  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function buildFallbackOpeningQuestion({ resumeText, mode, difficulty }) {
  const resumeSnippet = resumeText
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(" ");

  if (mode === "HR") {
    return `Tell me about yourself and walk me through a situation that best reflects your ${difficulty} level experience. ${resumeSnippet}`.trim();
  }

  if (mode === "DSA") {
    return difficulty === "advanced"
      ? "Describe a challenging data structure or algorithm problem you solved, including trade-offs, edge cases, and how you optimized the final solution."
      : "Describe a data structure or algorithm problem you solved and explain your approach step by step.";
  }

  return `Walk me through one project or experience from your resume that best represents your ${difficulty} level strengths.`;
}

function buildFallbackEvaluation({ answer, mode, difficulty, currentQuestionCount, maxQuestions }) {
  const normalizedAnswer = normalizeText(answer);
  const answerLength = normalizedAnswer.split(/\s+/).filter(Boolean).length;
  const score = getFallbackScore(answerLength);
  const isFinalRound = currentQuestionCount >= maxQuestions;

  return normalizeEvaluation({
    feedback:
      answerLength >= 35
        ? "You provided a usable answer with some helpful context. To improve the response, make the example more concrete and explain the reasoning behind your decisions more clearly."
        : "Your answer was brief. Add more detail about what you did, why you chose that approach, and what result it produced.",
    score,
    strengths: answerLength >= 35
      ? ["Provided a relevant example", "Showed awareness of impact and decision-making"]
      : ["Stayed on topic", "Attempted to answer directly"],
    weaknesses: answerLength >= 35
      ? ["Needs sharper technical details", "Could explain trade-offs more clearly"]
      : ["Needs more depth", "Needs clearer real-world examples"],
    communication: Math.max(1, Math.min(10, score + 1)),
    technicalAccuracy: Math.max(0, score - 1),
    completeness: Math.max(0, score - 1),
    improvements: [
      "Use one concrete example with specific actions and outcomes.",
      "Explain the trade-offs or reasoning behind your approach."
    ],
    nextQuestion: isFinalRound ? "END" : buildFallbackNextQuestion({ mode, difficulty, currentQuestionCount: currentQuestionCount + 1 })
  });
}

function getFallbackScore(answerLength) {
  if (answerLength >= 80) {
    return 7;
  }

  if (answerLength >= 45) {
    return 6;
  }

  if (answerLength >= 25) {
    return 5;
  }

  return 3;
}

function buildFallbackNextQuestion({ mode, difficulty, currentQuestionCount }) {
  if (mode === "HR") {
    return currentQuestionCount >= 4
      ? "Tell me about a time you handled conflict or disagreement on a team and what you learned from it."
      : "Describe a situation where you took ownership of a difficult task and how you handled it.";
  }

  if (mode === "DSA") {
    return difficulty === "advanced"
      ? "How would you optimize the solution for scale, edge cases, and time complexity?"
      : "What data structure did you choose and why was it a good fit for the problem?";
  }

  return currentQuestionCount >= 4
    ? "What trade-offs did you make in that project, and how would you improve the implementation today?"
    : "Can you describe one technical challenge from that work and how you solved it?";
}

module.exports = {
  startInterview,
  processAnswer,
  generatePlanFromFeedback,
  getInterviewHistory,
  getInterviewProgress,
  generateInterviewReport,
  getSession
};
