import mongoose from "mongoose";

const ScheduledFollowupSchema = new mongoose.Schema(
  {
    targetType: {
      type: String,
      enum: ["WorkerProfile", "EmployerLead", "JobApplication"],
      required: true,
      index: true,
    },

    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    triggerType: {
      type: String,
      enum: [
        "profile_complete",
        "employer_lead_qualified",
        "job_application_created",
        "new_matching_job",
        "no_response_after_match",
        "stale_profile",
      ],
      required: true,
      index: true,
    },

    templateName: {
      type: String,
      required: true,
      trim: true,
    },

    templateData: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    scheduledAt: {
      type: Date,
      required: true,
      index: true,
    },

    sentAt: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      enum: ["pending", "sent", "failed", "cancelled"],
      default: "pending",
      index: true,
    },

    attempts: {
      type: Number,
      default: 0,
    },

    lastError: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

ScheduledFollowupSchema.index(
  { targetType: 1, targetId: 1, triggerType: 1, templateName: 1 },
  { unique: true }
);

ScheduledFollowupSchema.index({ status: 1, scheduledAt: 1 });

export const ScheduledFollowup =
  mongoose.models.ScheduledFollowup ||
  mongoose.model("ScheduledFollowup", ScheduledFollowupSchema);
