import mongoose from "mongoose";

const resolvedLocationSchema = new mongoose.Schema(
  {
    query: { type: String, required: true, index: true },
    normalizedQuery: { type: String, required: true, unique: true, index: true },
    provider: { type: String, default: "mapbox" },

    canonical: { type: String, default: "" },
    district: { type: String, default: "" },
    province: { type: String, default: "" },
    country: { type: String, default: "Nepal" },

    latitude: Number,
    longitude: Number,
    confidence: { type: Number, default: 0 },

    isInsideLumbini: { type: Boolean, default: false, index: true },
    raw: { type: Object, default: {} },
    lastUsedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const ResolvedLocation =
  mongoose.models.ResolvedLocation ||
  mongoose.model("ResolvedLocation", resolvedLocationSchema);
