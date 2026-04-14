const mongoose = require("mongoose");

const weaknessSummarySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      default: "",
      trim: true
    },
    description: {
      type: String,
      default: "",
      trim: true
    }
  },
  { _id: false }
);

const historyItemSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: true,
      trim: true
    },
    answer: {
      type: String,
      default: "",
      trim: true
    },
    feedback: {
      type: String,
      default: "",
      trim: true
    },
    score: {
      type: Number,
      min: 0,
      max: 10,
      default: null
    },
    strengths: {
      type: [String],
      default: []
    },
    weaknesses: {
      type: [String],
      default: []
    },
    communication: {
      type: Number,
      min: 0,
      max: 10,
      default: null
    },
    technicalAccuracy: {
      type: Number,
      min: 0,
      max: 10,
      default: null
    },
    completeness: {
      type: Number,
      min: 0,
      max: 10,
      default: null
    },
    improvements: {
      type: [String],
      default: []
    },
    askedAt: {
      type: Date,
      default: Date.now
    },
    answeredAt: {
      type: Date,
      default: null
    }
  },
  { _id: true }
);

const interviewSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      trim: true,
      default: "anonymous"
    },
    resumeFileName: {
      type: String,
      default: "",
      trim: true
    },
    resumeText: {
      type: String,
      required: true,
      trim: true
    },
    mode: {
      type: String,
      enum: ["HR", "DSA", "resume"],
      required: true
    },
    difficulty: {
      type: String,
      enum: ["beginner", "intermediate", "advanced"],
      default: "intermediate"
    },
    status: {
      type: String,
      enum: ["active", "completed"],
      default: "active"
    },
    questionCount: {
      type: Number,
      default: 0,
      min: 0
    },
    maxQuestions: {
      type: Number,
      default: 5,
      min: 1
    },
    completedAt: {
      type: Date,
      default: null
    },
    score: {
      type: Number,
      min: 0,
      max: 10,
      default: null
    },
    finalSummary: {
      type: String,
      default: "",
      trim: true
    },
    finalReport: {
      overallScore: {
        type: Number,
        min: 0,
        max: 10,
        default: null
      },
      strengths: {
        type: [String],
        default: []
      },
      weaknesses: {
        type: [weaknessSummarySchema],
        default: []
      },
      roadmap: {
        type: [String],
        default: []
      },
      progress: {
        previousScore: {
          type: Number,
          default: null
        },
        currentScore: {
          type: Number,
          default: 0
        },
        improvement: {
          type: Number,
          default: 0
        }
      },
      progressMetrics: {
        scoreTrend: {
          type: [Number],
          default: []
        },
        communicationTrend: {
          type: [Number],
          default: []
        },
        technicalTrend: {
          type: [Number],
          default: []
        }
      },
      progressComparison: {
        scoreImprovement: {
          type: Number,
          default: 0
        },
        improvedAreas: {
          type: [String],
          default: []
        },
        weakAreas: {
          type: [String],
          default: []
        }
      },
      trends: {
        communication: {
          type: String,
          default: "Stable"
        },
        technicalAccuracy: {
          type: String,
          default: "Stable"
        },
        completeness: {
          type: String,
          default: "Stable"
        },
        overall: {
          type: String,
          default: "Stable"
        }
      },
      finalFeedback: {
        type: String,
        default: "",
        trim: true
      },
      finalInsight: {
        type: String,
        default: "",
        trim: true
      },
      scoreExplanation: {
        type: String,
        default: "",
        trim: true
      },
      topPriority: {
        type: String,
        default: "",
        trim: true
      }
    },
    studyPlan: {
      goal: {
        type: String,
        default: "",
        trim: true
      },
      duration: {
        type: String,
        default: "",
        trim: true
      },
      plan: {
        type: [
          {
            day: {
              type: Number,
              min: 1
            },
            topic: {
              type: String,
              trim: true
            },
            tasks: {
              type: [String],
              default: []
            }
          }
        ],
        default: []
      }
    },
    suggestedPlanAvailable: {
      type: Boolean,
      default: false
    },
    generatedPlanIds: {
      type: [String],
      default: []
    },
    history: {
      type: [historyItemSchema],
      default: []
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: true }
  }
);

interviewSessionSchema.index({ userId: 1, createdAt: -1 });
interviewSessionSchema.index({ mode: 1, status: 1 });

module.exports = mongoose.model("InterviewSession", interviewSessionSchema);
