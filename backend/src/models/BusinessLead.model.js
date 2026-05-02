import mongoose from "mongoose";

const businessLeadSchema = new mongoose.Schema(
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

    phone: {
      type: String,
      required: true,
      index: true,
    },

    displayName: {
      type: String,
      default: "",
      trim: true,
    },

    customerName: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },

    businessProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BusinessProfile",
      default: null,
      index: true,
    },

    source: {
      type: String,
      enum: ["whatsapp", "web", "manual"],
      default: "whatsapp",
      index: true,
    },

    intent: {
      type: String,
      default: "unknown",
      index: true,
    },

    service: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },

    interest: {
      type: String,
      default: "",
      trim: true,
    },

    preferredDate: {
      type: String,
      default: "",
      trim: true,
    },

    preferredTime: {
      type: String,
      default: "",
      trim: true,
    },

    location: {
      type: String,
      default: "",
      trim: true,
    },

    firstMessage: {
      type: String,
      default: "",
      trim: true,
    },

    bookingMessage: {
      type: String,
      default: "",
      trim: true,
    },

    lastMessage: {
      type: String,
      default: "",
      trim: true,
    },

    status: {
      type: String,
      enum: ["new", "contacted", "booked", "closed", "spam"],
      default: "new",
      index: true,
    },

    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "low",
      index: true,
    },

    needsHuman: {
      type: Boolean,
      default: false,
      index: true,
    },

    notes: [
      {
        text: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

businessLeadSchema.index({ phone: 1, status: 1 });
businessLeadSchema.index({ service: 1, createdAt: -1 });

export const BusinessLead = mongoose.model("BusinessLead", businessLeadSchema);
