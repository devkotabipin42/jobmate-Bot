import mongoose from "mongoose";

const jobMatchSchema = new mongoose.Schema(
  {
    workerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WorkerProfile",
      required: true,
      index: true,
    },

    employerLeadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "EmployerLead",
      required: true,
      index: true,
    },

    contactId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contact",
      default: null,
      index: true,
    },

    score: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      index: true,
    },

    reasons: [
      {
        type: String,
        trim: true,
      },
    ],

    status: {
      type: String,
      enum: [
        "suggested",
        "admin_review",
        "worker_contacted",
        "employer_contacted",
        "accepted",
        "rejected",
        "placed",
        "expired",
      ],
      default: "suggested",
      index: true,
    },

    source: {
      type: String,
      enum: ["auto", "manual", "ai_assisted"],
      default: "auto",
      index: true,
    },

    adminNote: {
      type: String,
      default: "",
    },

    workerResponse: {
      type: String,
      enum: ["pending", "interested", "not_interested", "no_response"],
      default: "pending",
    },

    employerResponse: {
      type: String,
      enum: ["pending", "interested", "not_interested", "no_response"],
      default: "pending",
    },

    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 1000 * 60 * 60 * 24 * 14),
      index: true,
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

jobMatchSchema.index(
  { workerId: 1, employerLeadId: 1 },
  { unique: true }
);

jobMatchSchema.index({ score: -1, status: 1 });
jobMatchSchema.index({ status: 1, createdAt: -1 });

export const JobMatch = mongoose.model("JobMatch", jobMatchSchema);