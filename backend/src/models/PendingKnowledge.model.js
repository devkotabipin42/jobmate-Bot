import mongoose from "mongoose";

const PendingKnowledgeExampleSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      default: "",
      trim: true,
    },
    phone: {
      type: String,
      default: "",
      trim: true,
    },
    source: {
      type: String,
      default: "whatsapp_aarati",
      trim: true,
    },
    seenAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const PendingKnowledgeSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["role", "location", "faq", "salary", "company"],
      required: true,
      index: true,
    },

    rawText: {
      type: String,
      required: true,
      trim: true,
    },

    normalizedKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },

    suggestedKey: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },

    suggestedLabel: {
      type: String,
      default: "",
      trim: true,
    },

    suggestedValue: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },

    count: {
      type: Number,
      default: 1,
      min: 1,
    },

    examples: {
      type: [PendingKnowledgeExampleSchema],
      default: [],
    },

    firstSeenAt: {
      type: Date,
      default: Date.now,
    },

    lastSeenAt: {
      type: Date,
      default: Date.now,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

    reviewedBy: {
      type: String,
      default: "",
      trim: true,
    },

    reviewNote: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

PendingKnowledgeSchema.index(
  { type: 1, normalizedKey: 1 },
  { unique: true }
);

export const PendingKnowledge =
  mongoose.models.PendingKnowledge ||
  mongoose.model("PendingKnowledge", PendingKnowledgeSchema);
