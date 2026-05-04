import mongoose from "mongoose";

const hiringNeedSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      trim: true,
      required: true,
    },

    quantity: {
      type: Number,
      default: 1,
      min: 1,
    },

    salaryMin: {
      type: Number,
      default: null,
    },

    salaryMax: {
      type: Number,
      default: null,
    },

    salaryCurrency: {
      type: String,
      default: "NPR",
    },

    workType: {
      type: String,
      enum: ["full_time", "part_time", "shift", "flexible", "unknown"],
      default: "unknown",
    },

    workingHours: {
      type: String,
      trim: true,
      default: "",
    },

    experienceRequired: {
      type: String,
      enum: ["none", "basic", "experienced", "skilled", "unknown"],
      default: "unknown",
    },

    urgency: {
      type: String,
      enum: [
        "immediate",
        "this_week",
        "within_2_weeks",
        "this_month",
        "exploring",
        "unknown",
      ],
      default: "unknown",
      index: true,
    },
  },
  { _id: false }
);

const employerLeadSchema = new mongoose.Schema(
  {
    contactId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contact",
      required: true,
      index: true,
    },

    businessName: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },

    contactPerson: {
      type: String,
      trim: true,
      default: "",
    },

    phone: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    whatsapp: {
      type: String,
      trim: true,
      default: "",
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

    businessType: {
      type: String,
      enum: [
        "hotel_restaurant",
        "factory_industry",
        "retail_shop",
        "construction",
        "school_institute",
        "clinic_pharmacy",
        "office_admin",
        "other",
        "unknown",
      ],
      default: "unknown",
      index: true,
    },

    hiringNeeds: {
      type: [hiringNeedSchema],
      default: [],
    },

    leadStatus: {
      type: String,
      enum: [
        "new",
        "qualifying",
        "interested",
        "hot",
        "contacted",
        "demo_scheduled",
        "trial_started",
        "paid",
        "not_interested",
        "invalid",
        "closed",
      ],
      default: "new",
      index: true,
    },

    urgencyLevel: {
      type: String,
      enum: ["low", "medium", "high", "urgent", "unknown"],
      default: "unknown",
      index: true,
    },

    score: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
      index: true,
    },

    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    nextFollowUpAt: {
      type: Date,
      default: null,
      index: true,
    },

    source: {
      type: String,
      enum: ["whatsapp", "voice", "web", "manual", "field_agent"],
      default: "whatsapp",
      index: true,
    },

    notes: {
      type: String,
      default: "",
    },

    verificationStatus: {
      type: String,
      enum: ["unverified", "needs_call", "called", "verified", "rejected"],
      default: "needs_call",
      index: true,
    },

    salaryVerified: {
      type: Boolean,
      default: false,
    },

    phoneVerified: {
      type: Boolean,
      default: false,
    },

    needsCall: {
      type: Boolean,
      default: true,
      index: true,
    },

    hrNotes: {
      type: String,
      default: "",
      trim: true,
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

employerLeadSchema.index({ phone: 1, businessName: 1 });
employerLeadSchema.index({ "location.area": 1, leadStatus: 1 });
employerLeadSchema.index({ urgencyLevel: 1, score: -1 });
employerLeadSchema.index({ nextFollowUpAt: 1, leadStatus: 1 });

export const EmployerLead = mongoose.model("EmployerLead", employerLeadSchema);