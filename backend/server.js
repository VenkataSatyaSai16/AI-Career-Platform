import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3000);
const groqApiKey = process.env.GROQ_API_KEY || "";

app.use(cors({ origin: true }));
app.use(express.json({ limit: "1mb" }));

app.set("trust proxy", 1);

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.headers["x-forwarded-for"] || req.ip || req.connection?.remoteAddress || "unknown";
  },
  message: {
    error: "Too many requests. Please wait a moment."
  }
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.post("/chat", chatLimiter, async (req, res) => {
  if (!groqApiKey) {
    res.status(500).json({ error: "Missing GROQ_API_KEY" });
    return;
  }

  try {
    const upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${groqApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(req.body)
    });

    const payloadText = await upstream.text();
    let payload;

    try {
      payload = payloadText ? JSON.parse(payloadText) : null;
    } catch {
      payload = null;
    }

    if (!upstream.ok) {
      const upstreamError =
        payload?.error?.message ||
        payload?.error ||
        payloadText ||
        `Upstream request failed with status ${upstream.status}`;

      res.status(upstream.status).json({ error: String(upstreamError) });
      return;
    }

    if (!payload || typeof payload !== "object") {
      res.status(502).json({ error: "Invalid response from Groq." });
      return;
    }

    if (payload.error) {
      res.status(502).json({
        error: payload.error?.message || String(payload.error)
      });
      return;
    }

    res.json(payload);
  } catch (error) {
    res.status(500).json({ error: error?.message || "Server error" });
  }
});

app.listen(port, () => {
  console.log(`Backend proxy running on http://localhost:${port}`);
});
