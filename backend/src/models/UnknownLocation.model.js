import mongoose from "mongoose";

const unknownLocationSchema = new mongoose.Schema(
  {
    query: {
      type: String,
      required: true,
      index: true,
    },
    normalizedQuery: {
      type: String,
      required: true,
      index: true,
    },
    sourceMessage: {
      type: String,
      default: "",
    },
    phone: {
      type: String,
      default: "",
      index: true,
    },
    guessedProvince: {
      type: String,
      default: "",
    },
    guessedCountry: {
      type: String,
      default: "Nepal",
    },
    status: {
      type: String,
      enum: ["pending_review", "verified", "rejected"],
      default: "pending_review",
      index: true,
    },
    count: {
      type: Number,
      default: 1,
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export const UnknownLocation =
  mongoose.models.UnknownLocation ||
  mongoose.model("UnknownLocation", unknownLocationSchema);
