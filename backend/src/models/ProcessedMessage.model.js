import mongoose from "mongoose";

const processedMessageSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      required: true,
      enum: ["meta_whatsapp"],
      default: "meta_whatsapp",
      index: true,
    },

    providerMessageId: {
      type: String,
      required: true,
      trim: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    status: {
      type: String,
      enum: ["processing", "processed", "failed"],
      default: "processing",
      index: true,
    },

    errorMessage: {
      type: String,
      default: null,
    },

    processedAt: {
      type: Date,
      default: null,
    },

    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
      index: { expires: 0 },
    },
  },
  {
    timestamps: true,
  }
);

processedMessageSchema.index(
  { provider: 1, providerMessageId: 1 },
  { unique: true }
);

export const ProcessedMessage = mongoose.model(
  "ProcessedMessage",
  processedMessageSchema
);