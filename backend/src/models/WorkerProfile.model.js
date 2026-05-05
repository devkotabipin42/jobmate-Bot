import mongoose from "mongoose";

const workerDocumentSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["license", "citizenship", "cv", "certificate", "photo", "other"],
      default: "other",
      index: true,
    },
    mediaId: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    mimeType: {
      type: String,
      trim: true,
      default: "",
    },
    sha256: {
      type: String,
      trim: true,
      default: "",
    },
    caption: {
      type: String,
      trim: true,
      default: "",
    },
    filename: {
      type: String,
      trim: true,
      default: "",
    },
    storageUrl: {
      type: String,
      trim: true,
      default: "",
    },
    source: {
      type: String,
      enum: ["whatsapp", "admin", "manual"],
      default: "whatsapp",
    },
    status: {
      type: String,
      enum: ["received", "downloaded", "uploaded", "failed"],
      default: "received",
    },
    verified: {
      type: Boolean,
      default: false,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { _id: true }
);

const workerProfileSchema = new mongoose.Schema(
  {
    contactId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contact",
      required: true,
      unique: true,
      index: true,
    },

    fullName: {
      type: String,
      trim: true,
      default: "",
    },

    phone: {
  type: String,
  required: true,
  trim: true,
},

    location: {
      area: {
        type: String,
        trim: true,
        default: "",
        index: true,
      },
      district: {
        type: String,
        trim: true,
        default: "",
        index: true,
      },
      province: {
        type: String,
        trim: true,
        default: "Lumbini",
      },
      country: {
        type: String,
        trim: true,
        default: "Nepal",
      },
    },

    jobPreferences: [
      {
        type: String,
        trim: true,
      },
    ],

    skills: [
      {
        type: String,
        trim: true,
      },
    ],

    experienceLevel: {
      type: String,
      enum: [
        "none",
        "less_than_1_year",
        "1_to_2_years",
        "2_to_5_years",
        "5_plus_years",
        "unknown",
      ],
      default: "unknown",
      index: true,
    },

    expectedSalary: {
      min: {
        type: Number,
        default: null,
      },
      max: {
        type: Number,
        default: null,
      },
      currency: {
        type: String,
        default: "NPR",
      },
    },

    availability: {
      type: String,
      enum: [
        "immediate",
        "within_1_week",
        "within_2_weeks",
        "within_1_month",
        "not_decided",
        "unknown",
      ],
      default: "unknown",
      index: true,
    },

    age: {
      type: Number,
      default: null,
      min: 14,
      max: 80,
    },

    documentStatus: {
      type: String,
      enum: ["ready", "available_later", "not_available", "unknown"],
      default: "unknown",
    },

    documents: {
      type: [workerDocumentSchema],
      default: [],
    },

    profileStatus: {
      type: String,
      enum: ["incomplete", "complete", "verified", "rejected", "placed"],
      default: "incomplete",
      index: true,
    },

    score: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
      index: true,
    },

    source: {
      type: String,
      enum: ["whatsapp", "voice", "web", "manual"],
      default: "whatsapp",
      index: true,
    },

    notes: {
      type: String,
      default: "",
    },

    lastQualifiedAt: {
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

workerProfileSchema.index({ phone: 1 }, { unique: true });
workerProfileSchema.index({ "location.area": 1, profileStatus: 1 });
workerProfileSchema.index({ jobPreferences: 1 });
workerProfileSchema.index({ score: -1 });

export const WorkerProfile = mongoose.model(
  "WorkerProfile",
  workerProfileSchema
);