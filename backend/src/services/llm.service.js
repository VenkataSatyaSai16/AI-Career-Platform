const { env } = require("../config/env");
const {
  generateGeminiResponse,
  extractPdfTextFromGemini
} = require("./providers/gemini.provider");
const { generateGroqResponse } = require("./providers/groq.provider");

function formatPrompt({ systemPrompt, userPrompt }) {
  return `${systemPrompt}\n\n${userPrompt}`.trim();
}

function normalizePrompt(prompt) {
  if (typeof prompt === "string") {
    return prompt.trim();
  }

  return formatPrompt(prompt);
}

function getProviderChain() {
  if (env.llmProvider === "groq") {
    return [
      { name: "groq", generate: generateGroqResponse },
      { name: "gemini", generate: generateGeminiResponse }
    ];
  }

  return [{ name: "gemini", generate: generateGeminiResponse }];
}

async function generateWithProvider(prompt, options = {}) {
  const normalizedPrompt = normalizePrompt(prompt);
  const { useSecond = false, taskName = "text generation" } = options;
  const errors = [];

  for (const provider of getProviderChain()) {
    try {
      console.info(`[llm] provider=${provider.name} task=${taskName}`);
      return await provider.generate(normalizedPrompt, { useSecond, taskName });
    } catch (error) {
      console.warn(`[llm] provider_failed=${provider.name} task=${taskName}`, {
        statusCode: error.statusCode || error.status || 500,
        message: error.message
      });
      errors.push(`${provider.name}: ${error.message}`);
    }
  }

  const finalError = new Error(`LLM ${taskName} failed. ${errors.join(" | ")}`.trim());
  finalError.statusCode = inferStatusCode(errors);
  throw finalError;
}

function inferStatusCode(errors = []) {
  const text = errors.join(" ").toLowerCase();
  return text.includes("rate limit") || text.includes("429") ? 429 : 502;
}

async function generateQuestion(prompt) {
  return generateWithProvider(prompt, {
    useSecond: false,
    taskName: "question generation"
  });
}

async function evaluateAnswer(prompt) {
  return generateWithProvider(prompt, {
    useSecond: true,
    taskName: "answer evaluation"
  });
}

async function generateAnalysis(prompt) {
  return generateWithProvider(prompt, {
    useSecond: true,
    taskName: "analysis"
  });
}

async function generateText(prompt, options = {}) {
  return generateWithProvider(prompt, options);
}

async function extractPdfText(pdfBuffer) {
  console.info("[llm] provider=gemini task=pdf extraction");
  return extractPdfTextFromGemini(pdfBuffer);
}

module.exports = {
  generateText,
  generateQuestion,
  evaluateAnswer,
  generateAnalysis,
  extractPdfText
};
