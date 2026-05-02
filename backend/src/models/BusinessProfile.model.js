import mongoose from "mongoose";

const serviceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    priceFrom: { type: Number, default: null },
    priceTo: { type: Number, default: null },
    currency: { type: String, default: "NPR" },
    isActive: { type: Boolean, default: true },
  },
  { _id: true }
);

const faqSchema = new mongoose.Schema(
  {
    question: { type: String, required: true, trim: true },
    answer: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { _id: true }
);

const businessProfileSchema = new mongoose.Schema(
  {
    singletonKey: {
      type: String,
      default: "default",
      unique: true,
      index: true,
    },

    businessName: {
      type: String,
      default: "JobMate Business",
      trim: true,
    },

    businessType: {
      type: String,
      default: "jobmate",
      trim: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    contact: {
      phone: { type: String, default: "" },
      whatsapp: { type: String, default: "" },
      email: { type: String, default: "" },
      website: { type: String, default: "" },
    },

    location: {
      area: { type: String, default: "" },
      district: { type: String, default: "" },
      province: { type: String, default: "Lumbini" },
      country: { type: String, default: "Nepal" },
      mapLink: { type: String, default: "" },
    },

    openingHours: {
      type: String,
      default: "",
    },

    languageStyle: {
      type: String,
      default: "roman_nepali",
    },

    botTone: {
      type: String,
      default: "polite_friendly",
    },

    safetyMode: {
      answerOnlyFromBusinessData: { type: Boolean, default: true },
      humanHandoffOnDiscount: { type: Boolean, default: true },
      humanHandoffOnComplaint: { type: Boolean, default: true },
      humanHandoffOnUnknown: { type: Boolean, default: true },
    },

    services: [serviceSchema],
    faqs: [faqSchema],

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

export const BusinessProfile = mongoose.model(
  "BusinessProfile",
  businessProfileSchema
);
