const DEFAULT_PARSED_INPUT = {
  course: "General Study Plan",
  duration: "30",
  level: "beginner",
  objective: "general learning"
};

function buildParseUserInputPrompt(text) {
  return [
    "You are an expert study-planning assistant.",
    "Extract structured study-planning fields from the user's natural-language input.",
    "Return strict JSON only. Do not include markdown, explanations, or code fences.",
    "",
    "Required fields:",
    "- course",
    "- duration",
    "- level",
    "- objective",
    "",
    "Rules:",
    '- duration must be the number of days as a string when possible.',
    "- If a field is missing or unclear, use an empty string.",
    "- Keep values concise and normalized.",
    '- "level" should prefer one of: beginner, basics, intermediate, advanced.',
    '- "objective" should capture the user\'s main purpose, such as placements, exam preparation, interview prep, upskilling, revision, or general learning.',
    "",
    `User input: ${JSON.stringify({ text }, null, 2)}`,
    "",
    "Return JSON in this exact shape:",
    JSON.stringify(
      {
        course: "",
        duration: "",
        level: "",
        objective: ""
      },
      null,
      2
    )
  ].join("\n");
}

function applyInputFallbacks(parsed) {
  const data = parsed && typeof parsed === "object" ? parsed : {};
  const rawDuration = String(data.duration || "").trim();
  const durationMatch = rawDuration.match(/\d+/);

  return {
    course: String(data.course || "").trim() || DEFAULT_PARSED_INPUT.course,
    duration: durationMatch ? durationMatch[0] : DEFAULT_PARSED_INPUT.duration,
    level: String(data.level || "").trim().toLowerCase() || DEFAULT_PARSED_INPUT.level,
    objective: String(data.objective || "").trim() || DEFAULT_PARSED_INPUT.objective
  };
}

function buildGeneratePlanPrompt({
  course,
  durationDays,
  dailyHours,
  knowledgeLevel,
  preparingFor,
  objective
}) {
  return `
You are an expert study planner. Generate a detailed daily plan in strict JSON only.
Do not include markdown, code fences, or extra text.

Course: ${course}
Duration: ${durationDays} days
Daily study time: ${dailyHours} hours
Current knowledge level: ${knowledgeLevel}
Preparing for: ${preparingFor}
Learner objective: ${objective}

Return JSON in this exact shape:
{
  "summary": "one short paragraph",
  "days": [
    {
      "day": 1,
      "title": "topic title",
      "focus": "what to study in this session",
      "estimated_hours": ${dailyHours},
      "resource_title": "resource name",
      "resource_url": "https://full-working-link",
      "notes": "short notes"
    }
  ]
}

Rules:
- Provide one item per day for all ${durationDays} days.
- Resource links must be valid full URLs and relevant.
- Keep focus actionable and concise.
- Personalize the plan according to the learner's current knowledge level, target preparation context, and objective.
- If the learner is a beginner, include foundation-building first.
- If the learner is preparing for an exam, interview, or deadline, prioritize accordingly.
`.trim();
}

function buildReplanPrompt({
  originalPlan,
  progress,
  missedDays,
  remainingDays,
  metadata
}) {
  const course = metadata.course || "Unknown course";
  const knowledgeLevel = metadata.knowledgeLevel || metadata.knowledge_level || "";
  const preparingFor = metadata.preparingFor || metadata.preparing_for || "";
  const objective = metadata.objective || "";
  const remainingSlots = remainingDays.length;

  return `
You are an expert study replanning assistant.
Adjust the remaining study plan using the learner's original goal and actual progress.
Return strict JSON only. Do not include markdown, explanations, or code fences.

Learner context:
- Course: ${course}
- Knowledge level: ${knowledgeLevel}
- Preparing for: ${preparingFor}
- Objective: ${objective}

Rules:
- Keep the original goal intact.
- Do not modify already completed days.
- Rework only the remaining portion of the plan.
- Account for missed days and redistribute topics logically.
- Optimize for the remaining time.
- Prefer concise, actionable daily tasks.
- Keep estimated_hours realistic.
- If possible, fit the updated plan into ${remainingSlots} remaining days.
- If extension is genuinely needed to preserve quality, you may increase the remaining day count slightly.
- Return valid JSON in the exact shape below.

Input data:
${JSON.stringify(
  {
    originalPlan,
    progress,
    missedDays,
    remainingDays,
    remainingSlots
  },
  null,
  2
)}

Return JSON in this exact shape:
{
  "summary": "short summary of the updated plan",
  "adjustments": "short explanation of what changed",
  "remaining_days": [
    {
      "day": 1,
      "title": "topic title",
      "focus": "what to study in this session",
      "estimated_hours": 2,
      "resource_title": "resource name",
      "resource_url": "https://full-working-link",
      "notes": "short notes"
    }
  ]
}
`.trim();
}

module.exports = {
  DEFAULT_PARSED_INPUT,
  applyInputFallbacks,
  buildGeneratePlanPrompt,
  buildParseUserInputPrompt,
  buildReplanPrompt
};
