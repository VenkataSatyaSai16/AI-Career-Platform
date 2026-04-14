const interviewService = require("../services/interview.service");
const voiceService = require("../services/voice.service");

async function startInterview(req, res, next) {
  try {
    const result = await interviewService.startInterview(req.body, req.session);

    if (req.session) {
      req.session.currentInterviewSessionId = result.sessionId;
    }

    res.status(201).json(result);
  } catch (error) {
    console.error("Interview start failed", {
      userId: req.body?.userId,
      error: error.message
    });
    next(error);
  }
}

async function nextQuestion(req, res, next) {
  try {
    const result = await interviewService.processAnswer(req.body);
    res.status(200).json(result);
  } catch (error) {
    console.error("Interview answer processing failed", {
      sessionId: req.body?.sessionId,
      error: error.message
    });
    next(error);
  }
}

async function getInterviewReport(req, res, next) {
  try {
    const result = await interviewService.generateInterviewReport(req.params.sessionId);
    res.status(200).json(result);
  } catch (error) {
    console.error("Interview report retrieval failed", {
      sessionId: req.params?.sessionId,
      error: error.message
    });
    next(error);
  }
}

async function getSessionById(req, res, next) {
  try {
    const result = await interviewService.getSession(req.params.sessionId);
    res.status(200).json(result);
  } catch (error) {
    console.error("Interview session retrieval failed", {
      sessionId: req.params?.sessionId,
      error: error.message
    });
    next(error);
  }
}

async function getInterviewHistory(req, res, next) {
  try {
    const result = await interviewService.getInterviewHistory(req.params.userId);
    res.status(200).json(result);
  } catch (error) {
    console.error("Interview history retrieval failed", {
      userId: req.params?.userId,
      error: error.message
    });
    next(error);
  }
}

async function getInterviewProgress(req, res, next) {
  try {
    const result = await interviewService.getInterviewProgress(req.auth.user.id);
    res.status(200).json(result);
  } catch (error) {
    console.error("Interview progress retrieval failed", {
      userId: req.auth?.user?.id,
      error: error.message
    });
    next(error);
  }
}

async function generatePlanFromFeedback(req, res, next) {
  try {
    const result = await interviewService.generatePlanFromFeedback(req.auth.user.id, req.body);
    res.status(201).json(result);
  } catch (error) {
    console.error("Interview feedback plan generation failed", {
      userId: req.auth?.user?.id,
      sessionId: req.body?.sessionId,
      error: error.message
    });
    next(error);
  }
}

async function transcribeVoice(req, res, next) {
  try {
    const result = await voiceService.transcribeInterviewAudio(req.file);
    console.log("Interview voice transcribed", {
      bytes: req.file?.size || 0,
      transcriptLength: result.transcript.length
    });
    res.status(200).json(result);
  } catch (error) {
    console.error("Interview voice transcription failed", {
      error: error.message
    });
    next(error);
  }
}

async function synthesizeVoice(req, res, next) {
  try {
    const result = await voiceService.synthesizeInterviewSpeech(req.body?.text);

    if (result.fallback) {
      console.error("Interview voice synthesis fell back to text", {
        textLength: String(req.body?.text || "").length,
        error: result.errorMessage
      });
      res.setHeader("Cache-Control", "no-store");
      res.status(200).json({
        audio: null,
        fallback: true,
        text: result.text
      });
      return;
    }

    console.log("Interview voice synthesized", {
      textLength: String(req.body?.text || "").length,
      bytes: result.audioBuffer.length
    });
    res.setHeader("Content-Type", result.contentType);
    res.setHeader("Cache-Control", "no-store");
    res.status(200).send(result.audioBuffer);
  } catch (error) {
    console.error("Interview voice synthesis failed", {
      error: error.message
    });
    next(error);
  }
}

module.exports = {
  startInterview,
  nextQuestion,
  getInterviewHistory,
  getInterviewProgress,
  getInterviewReport,
  getSessionById,
  generatePlanFromFeedback,
  transcribeVoice,
  synthesizeVoice
};
