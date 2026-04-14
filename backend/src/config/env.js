function requireIf(condition, key) {
  if (condition && !process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const provider = (process.env.LLM_PROVIDER || "gemini").toLowerCase();
const validProviders = ["gemini", "groq"];

if (!validProviders.includes(provider)) {
  throw new Error(`Unsupported LLM_PROVIDER "${provider}". Use one of: ${validProviders.join(", ")}`);
}

requireIf(["gemini", "groq"].includes(provider), "GEMINI_API_KEY_1");
requireIf(["gemini", "groq"].includes(provider), "GEMINI_API_KEY_2");
requireIf(provider === "groq", "GROQ_API_KEY");
requireIf(Boolean(process.env.MONGO_URI || process.env.MONGODB_URI) === false, "MONGO_URI");
requireIf(true, "JWT_SECRET");
requireIf(
  !process.env.CLOUDINARY_URL,
  "CLOUDINARY_CLOUD_NAME"
);
requireIf(
  !process.env.CLOUDINARY_URL,
  "CLOUDINARY_API_KEY"
);
requireIf(
  !process.env.CLOUDINARY_URL,
  "CLOUDINARY_API_SECRET"
);
requireIf(Boolean(process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_SECRET), "GOOGLE_CLIENT_ID");
requireIf(Boolean(process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_SECRET), "GOOGLE_CLIENT_SECRET");
requireIf(Boolean(process.env.CLIENT_ID || process.env.CLIENT_SECRET), "CLIENT_ID");
requireIf(Boolean(process.env.CLIENT_ID || process.env.CLIENT_SECRET), "CLIENT_SECRET");

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 5000),
  mongoUri: process.env.MONGO_URI || process.env.MONGODB_URI,
  llmProvider: provider,
  geminiApiKey1: process.env.GEMINI_API_KEY_1,
  geminiApiKey2: process.env.GEMINI_API_KEY_2,
  geminiModel: process.env.GEMINI_MODEL || "gemini-2.5-flash",
  groqApiKey: process.env.GROQ_API_KEY || "",
  groqModel: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
  deepgramApiKey: process.env.DEEPGRAM_API_KEY || "",
  deepgramModel: process.env.DEEPGRAM_MODEL || "nova-3",
  elevenLabsApiKey: process.env.ELEVENLABS_API_KEY || "",
  elevenLabsVoiceId: process.env.ELEVENLABS_VOICE_ID || "",
  elevenLabsModel: process.env.ELEVENLABS_MODEL || "eleven_flash_v2_5",
  maxHistoryItems: Math.max(1, Math.min(3, Number(process.env.MAX_HISTORY_ITEMS || 3))),
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  jwtSecret: process.env.JWT_SECRET,
  cloudinaryUrl: process.env.CLOUDINARY_URL,
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || "",
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || "",
  googleClientId: process.env.CLIENT_ID || process.env.GOOGLE_CLIENT_ID || "",
  googleClientSecret: process.env.CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || "",
  googleCallbackUrl: process.env.REDIRECT_URI || process.env.GOOGLE_CALLBACK_URL || "/auth/google/callback",
  googleRedirectUri: process.env.REDIRECT_URI || process.env.GOOGLE_CALLBACK_URL || "http://localhost:5000/auth/google/callback",
  googleSuccessRedirectUrl: process.env.GOOGLE_SUCCESS_REDIRECT_URL || "http://localhost:5173/auth-success"
};

module.exports = { env };
