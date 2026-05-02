import mongoose from "mongoose";

const contactSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },

   waId: {
  type: String,
  required: true,
  trim: true,
},

    displayName: {
      type: String,
      trim: true,
      default: "Mitra",
    },

    contactType: {
      type: String,
      enum: ["worker", "employer", "unknown"],
      default: "unknown",
      index: true,
    },

    language: {
      type: String,
      enum: ["nepali_english", "nepali", "english"],
      default: "nepali_english",
    },

    source: {
      type: String,
      enum: ["whatsapp", "voice", "web", "manual"],
      default: "whatsapp",
      index: true,
    },

    status: {
      type: String,
      enum: ["active", "blocked", "opted_out"],
      default: "active",
      index: true,
    },

    botMode: {
      type: String,
      enum: ["bot", "human_paused"],
      default: "bot",
      index: true,
    },

    lastMessageAt: {
      type: Date,
      default: null,
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

contactSchema.index({ waId: 1 }, { unique: true });
contactSchema.index({ phone: 1, source: 1 });

export const Contact = mongoose.model("Contact", contactSchema);