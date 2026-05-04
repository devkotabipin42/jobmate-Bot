import mongoose from "mongoose";

const JobApplicationSchema = new mongoose.Schema(
  {
    contactId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contact",
      required: true,
      index: true,
    },

    workerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WorkerProfile",
      default: null,
      index: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    jobId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    jobTitle: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },

    companyName: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },

    location: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },

    salaryMin: {
      type: Number,
      default: null,
    },

    salaryMax: {
      type: Number,
      default: null,
    },

    jobType: {
      type: String,
      default: "",
      trim: true,
    },

    status: {
      type: String,
      enum: [
        "interest_submitted",
        "reviewing",
        "shortlisted",
        "contacted",
        "interview_scheduled",
        "selected",
        "rejected",
        "withdrawn",
      ],
      default: "interest_submitted",
      index: true,
    },

    source: {
      type: String,
      enum: ["whatsapp_aarati", "admin", "web", "manual"],
      default: "whatsapp_aarati",
      index: true,
    },

    appliedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    lastStatusAt: {
      type: Date,
      default: Date.now,
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

JobApplicationSchema.index(
  { contactId: 1, jobId: 1 },
  { unique: true }
);

JobApplicationSchema.index({ jobId: 1, status: 1 });
JobApplicationSchema.index({ workerId: 1, status: 1 });

export const JobApplication =
  mongoose.models.JobApplication ||
  mongoose.model("JobApplication", JobApplicationSchema);
