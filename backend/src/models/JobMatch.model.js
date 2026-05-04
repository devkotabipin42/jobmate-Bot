import mongoose from "mongoose";

const JobMatchSchema = new mongoose.Schema(
  {
    employerLeadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "EmployerLead",
      required: true,
      index: true,
    },

    workerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WorkerProfile",
      required: true,
      index: true,
    },

    jobApplicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JobApplication",
      default: null,
      index: true,
    },

    employerPhone: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },

    workerPhone: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },

    businessName: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },

    workerName: {
      type: String,
      default: "",
      trim: true,
    },

    role: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },

    roleLabel: {
      type: String,
      default: "",
      trim: true,
    },

    location: {
      area: {
        type: String,
        default: "",
        trim: true,
      },
      district: {
        type: String,
        default: "",
        trim: true,
        index: true,
      },
      province: {
        type: String,
        default: "Lumbini",
        trim: true,
      },
      country: {
        type: String,
        default: "Nepal",
        trim: true,
      },
    },

    matchScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
      index: true,
    },

    matchReasons: {
      type: [String],
      default: [],
    },

    status: {
      type: String,
      enum: [
        "matched",
        "contacted",
        "interview_scheduled",
        "selected",
        "placed",
        "rejected",
        "withdrawn",
      ],
      default: "matched",
      index: true,
    },

    source: {
      type: String,
      enum: ["dashboard", "auto_match", "manual"],
      default: "dashboard",
      index: true,
    },

    matchedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    lastStatusAt: {
      type: Date,
      default: Date.now,
    },

    placedAt: {
      type: Date,
      default: null,
    },

    notes: {
      type: String,
      default: "",
      trim: true,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

JobMatchSchema.index(
  { employerLeadId: 1, workerId: 1, role: 1 },
  { unique: true }
);

JobMatchSchema.index({ status: 1, updatedAt: -1 });
JobMatchSchema.index({ workerId: 1, status: 1 });
JobMatchSchema.index({ employerLeadId: 1, status: 1 });

export const JobMatch =
  mongoose.models.JobMatch ||
  mongoose.model("JobMatch", JobMatchSchema);
