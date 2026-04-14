const { env } = require("../config/env");

async function transcribeInterviewAudio(file) {
  if (!file?.buffer?.length) {
    const error = new Error("Audio file is required");
    error.statusCode = 400;
    throw error;
  }

  if (!env.deepgramApiKey) {
    const error = new Error("Speech-to-text is not configured");
    error.statusCode = 503;
    throw error;
  }

  const response = await fetch(`https://api.deepgram.com/v1/listen?model=${encodeURIComponent(env.deepgramModel)}&smart_format=true&punctuate=true`, {
    method: "POST",
    headers: {
      Authorization: `Token ${env.deepgramApiKey}`,
      "Content-Type": file.mimetype || "audio/webm"
    },
    body: file.buffer
  });

  if (!response.ok) {
    const errorText = await response.text();
    const error = new Error(`Deepgram transcription failed: ${errorText || response.statusText}`);
    error.statusCode = 502;
    throw error;
  }

  const data = await response.json();
  const transcript = String(data?.results?.channels?.[0]?.alternatives?.[0]?.transcript || "").trim();

  if (!transcript) {
    const error = new Error("No speech detected");
    error.statusCode = 422;
    throw error;
  }

  return {
    transcript
  };
}

async function synthesizeInterviewSpeech(text) {
  const normalizedText = String(text || "").trim().slice(0, 2500);

  if (!normalizedText) {
    const error = new Error("Text is required for speech synthesis");
    error.statusCode = 400;
    throw error;
  }

  try {
    if (!env.elevenLabsApiKey || !env.elevenLabsVoiceId) {
      throw new Error("Text-to-speech is not configured");
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(env.elevenLabsVoiceId)}?output_format=mp3_44100_128&optimize_streaming_latency=3`,
      {
        method: "POST",
        headers: {
          "xi-api-key": env.elevenLabsApiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg"
        },
        body: JSON.stringify({
          text: normalizedText,
          model_id: env.elevenLabsModel,
          voice_settings: {
            stability: 0.45,
            similarity_boost: 0.8
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs synthesis failed: ${errorText || response.statusText}`);
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());

    return {
      audioBuffer,
      contentType: "audio/mpeg",
      fallback: false,
      text: normalizedText
    };
  } catch (error) {
    return {
      audio: null,
      fallback: true,
      text: normalizedText,
      errorMessage: error.message
    };
  }
}

module.exports = {
  transcribeInterviewAudio,
  synthesizeInterviewSpeech
};
