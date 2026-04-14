const SYSTEM_ROLE = `
You are an expert interview orchestrator.
You behave like a real interviewer.
You adapt based on resume context, prior answers, detected strengths, detected weaknesses, and the selected interview mode.
Be concise, specific, and realistic.
`;

function summarizeResume(resumeText) {
  return String(resumeText || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1200);
}

function getModeGuidance(mode) {
  const guidanceMap = {
    HR: "Focus on behavioral and situational questions, communication quality, ownership, teamwork, conflict handling, and leadership signals.",
    DSA: "Focus on logic, problem solving, complexity analysis, correctness, trade-offs, and follow-up reasoning depth.",
    resume: "Focus on project decisions, work experience, architecture choices, impact, ownership, and authenticity of resume claims."
  };

  return guidanceMap[mode] || "Keep the interview adaptive and grounded in candidate evidence.";
}

function getDifficultyGuidance(difficulty) {
  const guidanceMap = {
    beginner: "Keep questions accessible, concrete, and foundational. Prefer simpler follow-ups and avoid heavy edge-case depth.",
    intermediate: "Ask moderately deep questions with practical trade-offs, implementation details, and realistic follow-ups.",
    advanced: "Ask deeper questions with system design, edge cases, trade-offs, failure scenarios, and stronger senior-level probing."
  };

  return guidanceMap[difficulty] || guidanceMap.intermediate;
}

function buildStartInterviewPrompt({ resumeText, mode, difficulty = "intermediate", previousReport }) {
  const resumeSummary = summarizeResume(resumeText);
  const previousWeaknesses = Array.isArray(previousReport?.weaknesses)
    ? previousReport.weaknesses.filter(Boolean)
    : [];
  const previousReportSection = previousWeaknesses.length
    ? `
Previous Interview Report:
Candidate previously had weaknesses in:
${previousWeaknesses.map((item) => `- ${item}`).join("\n")}

Focus this interview on improving those areas.
Ask targeted and progressive questions.
`.trim()
    : "";

  return {
    systemPrompt: SYSTEM_ROLE,
    userPrompt: `
Mode: ${mode}
Mode Guidance: ${getModeGuidance(mode)}
Difficulty: ${difficulty}
Difficulty Guidance: ${getDifficultyGuidance(difficulty)}

Resume:
${resumeSummary}

${previousReportSection}

Task:
Start a realistic interview session.
Ask exactly one strong opening question tailored to the candidate.
Match the selected difficulty naturally.
Return only the question text.
`.trim()
  };
}

function buildNextQuestionPrompt({ resumeText, mode, difficulty = "intermediate", history, question, answer }) {
  const resumeSummary = summarizeResume(resumeText);
  return {
    systemPrompt: SYSTEM_ROLE,
    userPrompt: `
You are a professional technical interviewer.

Interview Mode:
${mode}
Mode Guidance:
${getModeGuidance(mode)}
Difficulty:
${difficulty}
Difficulty Guidance:
${getDifficultyGuidance(difficulty)}

Resume:
${resumeSummary}

Previous Q&A:
${history}

Question:
${question}

Candidate just answered:
${answer}

Evaluate the candidate's answer.

Return ONLY valid JSON in this format:
{
  "feedback": "detailed natural language paragraph (existing style)",
  "score": 0,
  "strengths": ["point1", "point2"],
  "weaknesses": ["point1", "point2"],
  "communication": 0,
  "technicalAccuracy": 0,
  "completeness": 0,
  "improvements": ["actionable suggestion 1", "actionable suggestion 2"],
  "nextQuestion": "adaptive follow-up question"
}

RULES:
- Keep feedback natural and detailed.
- Maintain a professional interviewer tone that is honest, constructive, and not overly harsh.
- Always include at least one encouraging or neutral observation in the feedback.
- Score should be balanced, not extreme unless necessary.
- Avoid extreme scores (0-1) unless the answer is completely irrelevant or empty.
- Even weak answers should receive at least minimal credit if they are partially correct.
- Use camelCase consistently for every field name.
- Ensure all fields are always present and never null.
- Always include at least 2 strengths and 2 weaknesses.
- Improvements must be actionable.
- Next question must relate to the previous answer.
- Match the depth of the next question to the selected difficulty.
- If the interview has enough evidence and should stop, set "nextQuestion" to "END".
- Do NOT return anything outside JSON.

SCORING GUIDELINE:
- 1-2: very poor, almost no relevance
- 3-4: weak but shows some understanding
- 5-6: average
- 7-8: strong
- 9-10: excellent
`.trim()
  };
}

function buildInterviewReportPrompt({ resumeText, mode, history }) {
  return {
    systemPrompt: SYSTEM_ROLE,
    userPrompt: `
Generate a final interview analysis.

Interview Mode:
${mode}
Mode Guidance:
${getModeGuidance(mode)}

Resume:
${resumeText}

Interview History:
${history}

Return plain text in exactly this format:
Strengths:
- <point>
- <point>
Weaknesses:
- <point>
- <point>
Improvement Tips:
- <point>
- <point>
Overall Score: <number from 0 to 10>
Summary: <short final summary>
`.trim()
  };
}

module.exports = {
  buildStartInterviewPrompt,
  buildNextQuestionPrompt,
  buildInterviewReportPrompt
};
