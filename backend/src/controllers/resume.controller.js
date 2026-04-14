const resumeService = require("../services/resume.service");
const { generateText } = require("../services/llm.service");
const Resume = require("../models/Resume");
const { deleteFile, uploadPDF } = require("../utils/cloudinaryUpload");

async function uploadResume(req, res, next) {
  try {
    const result = await resumeService.parseUploadedResume({
      file: req.file,
      resumeText: req.body.resumeText
    });

    if (req.session) {
      resumeService.storeResumeInSession(req.session, result);
    }

    res.status(200).json(result);
  } catch (error) {
    console.error("Resume upload failed", {
      fileName: req.file?.originalname,
      error: error.message
    });
    next(error);
  }
}

async function resumeChat(req, res, next) {
  try {
    const step = Number(req.body?.step ?? 0);
    const builderData = resumeService.normalizeResumeBuilderData(req.body?.data);

    if (req.session) {
      resumeService.storeResumeBuilderInSession(req.session, builderData);
    }

    const result = resumeService.getResumeBuilderQuestion(step);
    res.status(200).json(result);
  } catch (error) {
    console.error("Resume chat failed", {
      step: req.body?.step,
      error: error.message
    });
    next(error);
  }
}

async function generateResume(req, res, next) {
  try {
    const isLegacyBuilder = Boolean(req.body?.data);
    const resumeRequest = resumeService.normalizeResumeRequest(req.body);
    const prompt = resumeService.buildResumeGenerationPrompt(resumeRequest);
    let aiResponse = null;

    try {
      const response = await generateText(prompt, {
        useSecond: false,
        taskName: "resume generation"
      });
      aiResponse = resumeService.parseGeneratedResumeJson(response.reply);
    } catch (error) {
      console.warn("Falling back to local resume generation", {
        error: error.message
      });
    }

    const structuredResume = resumeService.buildStructuredResume(resumeRequest, aiResponse || {});
    const resumeText = resumeService.buildResumeText(structuredResume);
    const latexText = resumeService.buildResumeLatex(structuredResume);
    const pdfBuffer = resumeService.buildResumePdfBuffer(structuredResume);

    if (!resumeText) {
      const error = new Error("Unable to generate resume");
      error.statusCode = 502;
      throw error;
    }

    const existingResume = await Resume.findOne({
      userId: req.auth.user.id,
      source: isLegacyBuilder ? "builder" : "ats-generator"
    });

    if (existingResume?.cloudinaryPublicId) {
      await deleteFile(existingResume.cloudinaryPublicId, "raw");
    }

    const uploadedPdf = await uploadPDF(pdfBuffer, req.auth.user.id);
    const resumeRecord = existingResume || new Resume({ userId: req.auth.user.id });
    resumeRecord.source = isLegacyBuilder ? "builder" : "ats-generator";
    resumeRecord.jobRole = structuredResume.jobRole || "";
    resumeRecord.template = resumeRequest.template || "minimal";
    resumeRecord.resumeText = resumeText;
    resumeRecord.latexText = latexText;
    resumeRecord.structuredResume = structuredResume;
    resumeRecord.pdfUrl = uploadedPdf.secure_url || "";
    resumeRecord.cloudinaryPublicId = uploadedPdf.public_id || "";
    resumeRecord.updatedAt = new Date();
    await resumeRecord.save();

    const resumePayload = {
      fileName: `${structuredResume.personalInfo?.fullName || "generated-resume"}.txt`,
      source: resumeRecord.source,
      resumeText,
      latexText,
      pdfUrl: resumeRecord.pdfUrl,
      cloudinaryPublicId: resumeRecord.cloudinaryPublicId
    };

    if (req.session) {
      resumeService.storeResumeBuilderInSession(req.session, resumeRequest);
      resumeService.storeResumeInSession(req.session, resumePayload);
    }

    res.status(200).json({
      ...resumePayload,
      resume: structuredResume
    });
  } catch (error) {
    console.error("Resume generation failed", {
      error: error.message
    });
    next(error);
  }
}

module.exports = {
  generateResume,
  resumeChat,
  uploadResume
};
