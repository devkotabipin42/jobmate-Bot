import mongoose from "mongoose";

const handoffRequestSchema = new mongoose.Schema(
  {
    contactId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contact",
      required: true,
      index: true,
    },

    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      default: null,
      index: true,
    },

    channel: {
      type: String,
      enum: ["whatsapp", "voice", "web"],
      default: "whatsapp",
      index: true,
    },

    reason: {
      type: String,
      enum: [
        "user_requested_human",
        "frustrated_user",
        "unsupported_message",
        "high_value_employer",
        "qualified_employer",
        "qualified_worker",
        "system_error",
        "call_required",
        "unknown",
      ],
      default: "unknown",
      index: true,
    },

    lastUserMessage: {
      type: String,
      default: "",
    },

    status: {
      type: String,
      enum: ["open", "assigned", "in_progress", "resolved", "closed"],
      default: "open",
      index: true,
    },

    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
      index: true,
    },

    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    callRequired: {
      type: Boolean,
      default: false,
      index: true,
    },

    callStatus: {
      type: String,
      enum: [
        "not_required",
        "pending",
        "called",
        "no_answer",
        "callback_scheduled",
        "completed",
      ],
      default: "not_required",
      index: true,
    },

    callbackAt: {
      type: Date,
      default: null,
      index: true,
    },

    resolutionNote: {
      type: String,
      default: "",
    },

    resolvedAt: {
      type: Date,
      default: null,
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

handoffRequestSchema.index({ status: 1, priority: 1, createdAt: -1 });
handoffRequestSchema.index({ callRequired: 1, callStatus: 1 });
handoffRequestSchema.index({ contactId: 1, status: 1 });

export const HandoffRequest = mongoose.model(
  "HandoffRequest",
  handoffRequestSchema
);