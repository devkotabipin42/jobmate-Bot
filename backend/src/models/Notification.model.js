import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        "employer_lead_created",
        "worker_profile_completed",
        "job_application_created",
        "pending_knowledge_created",
        "follow_up_due",
        "system_alert",
      ],
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    message: {
      type: String,
      default: "",
      trim: true,
    },

    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
      index: true,
    },

    status: {
      type: String,
      enum: ["unread", "read", "archived"],
      default: "unread",
      index: true,
    },

    entityType: {
      type: String,
      enum: [
        "EmployerLead",
        "WorkerProfile",
        "JobApplication",
        "PendingKnowledge",
        "System",
      ],
      default: "System",
      index: true,
    },

    entityId: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },

    phone: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

NotificationSchema.index({ status: 1, createdAt: -1 });
NotificationSchema.index({ type: 1, createdAt: -1 });

export const Notification =
  mongoose.models.Notification ||
  mongoose.model("Notification", NotificationSchema);
