const Groq = require("groq-sdk");
const { env } = require("../../config/env");

let groqClient;

function getGroqClient() {
  if (!groqClient) {
    groqClient = new Groq({
      apiKey: env.groqApiKey
    });
  }

  return groqClient;
}

async function generateGroqResponse(prompt, options = {}) {
  const { taskName = "text generation" } = options;

  try {
    const completion = await getGroqClient().chat.completions.create({
      model: env.groqModel,
      messages: [
        {
          role: "user",
          content: String(prompt || "").trim()
        }
      ]
    });

    const reply = completion?.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      throw new Error("Groq returned empty text");
    }

    return {
      reply,
      usage: completion.usage || null
    };
  } catch (error) {
    throw buildProviderError(error, taskName);
  }
}

function buildProviderError(error, taskName) {
  const details =
    error?.message ||
    error?.error?.message ||
    error?.response?.error?.message ||
    `Groq failed during ${taskName}`;
  const statusCode = Number(error?.status || error?.statusCode || error?.response?.status);
  const finalError = new Error(`Groq ${taskName} failed: ${details}`);
  const normalizedDetails = String(details).toLowerCase();

  if (
    statusCode === 429 ||
    normalizedDetails.includes("rate limit") ||
    normalizedDetails.includes("too many requests")
  ) {
    finalError.statusCode = 429;
  } else {
    finalError.statusCode = statusCode || 502;
  }

  finalError.provider = "groq";
  return finalError;
}

module.exports = {
  generateGroqResponse
};
