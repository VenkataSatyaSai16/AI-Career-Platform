const { GoogleGenerativeAI } = require("@google/generative-ai");
const { env } = require("../../config/env");

const clientOne = new GoogleGenerativeAI(env.geminiApiKey1);
const clientTwo = new GoogleGenerativeAI(env.geminiApiKey2);

const modelQuestion = clientOne.getGenerativeModel({ model: env.geminiModel });
const modelEvaluation = clientTwo.getGenerativeModel({ model: env.geminiModel });

async function generateGeminiResponse(prompt, options = {}) {
  const { useSecond = false, taskName = "text generation" } = options;
  const primaryModel = useSecond ? modelEvaluation : modelQuestion;
  const fallbackModel = useSecond ? modelQuestion : modelEvaluation;
  const errors = [];

  try {
    return await generateText(primaryModel, prompt);
  } catch (error) {
    errors.push(`Primary Gemini key failed: ${error.message}`);
  }

  try {
    return await generateText(fallbackModel, prompt);
  } catch (error) {
    errors.push(`Fallback Gemini key failed: ${error.message}`);
  }

  const finalError = buildProviderError(
    `${taskName} failed for both Gemini API keys. ${errors.join(" | ")}`.trim(),
    errors
  );
  throw finalError;
}

async function generateFromGemini(prompt, useSecond = false) {
  const taskName = useSecond ? "answer evaluation" : "question generation";
  const response = await generateGeminiResponse(prompt, { useSecond, taskName });
  return response.reply;
}

async function generateText(model, prompt) {
  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();

  if (!text || !text.trim()) {
    throw new Error("Gemini returned empty text");
  }

  return {
    reply: text.trim(),
    usage: response.usageMetadata || null
  };
}

async function extractPdfTextFromGemini(pdfBuffer) {
  const errors = [];

  try {
    return await generateTextFromParts(modelQuestion, buildPdfExtractionParts(pdfBuffer));
  } catch (error) {
    errors.push(`Primary Gemini key failed: ${error.message}`);
  }

  try {
    return await generateTextFromParts(modelEvaluation, buildPdfExtractionParts(pdfBuffer));
  } catch (error) {
    errors.push(`Fallback Gemini key failed: ${error.message}`);
  }

  const finalError = buildProviderError(
    `PDF text extraction failed for both Gemini API keys. ${errors.join(" | ")}`.trim(),
    errors
  );
  throw finalError;
}

async function generateTextFromParts(model, parts) {
  const result = await model.generateContent(parts);
  const response = await result.response;
  const text = response.text();

  if (!text || !text.trim()) {
    throw new Error("Gemini returned empty text");
  }

  return text.trim();
}

function buildProviderError(message, errors = []) {
  const errorText = [message, ...errors].join(" ").toLowerCase();
  const finalError = new Error(message);

  if (errorText.includes("429") || errorText.includes("rate limit") || errorText.includes("quota")) {
    finalError.statusCode = 429;
  } else {
    finalError.statusCode = 502;
  }

  return finalError;
}

function buildPdfExtractionParts(pdfBuffer) {
  return [
    {
      text: [
        "Extract all readable resume text from this PDF.",
        "This PDF may be image-based or scanned.",
        "Return plain text only.",
        "Preserve headings, bullet points, skills, projects, experience, education, and contact details when readable.",
        "Do not add commentary, markdown fences, or explanations."
      ].join(" ")
    },
    {
      inlineData: {
        mimeType: "application/pdf",
        data: pdfBuffer.toString("base64")
      }
    }
  ];
}

module.exports = {
  generateGeminiResponse,
  generateFromGemini,
  extractPdfTextFromGemini
};
