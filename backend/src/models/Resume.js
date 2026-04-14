const mongoose = require("mongoose");

const resumeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  source: {
    type: String,
    default: "builder",
    trim: true
  },
  jobRole: {
    type: String,
    default: "",
    trim: true
  },
  template: {
    type: String,
    default: "minimal",
    trim: true
  },
  resumeText: {
    type: String,
    default: ""
  },
  latexText: {
    type: String,
    default: ""
  },
  structuredResume: {
    type: Object,
    default: {}
  },
  pdfUrl: {
    type: String,
    default: ""
  },
  cloudinaryPublicId: {
    type: String,
    default: ""
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.models.Resume || mongoose.model("Resume", resumeSchema);
