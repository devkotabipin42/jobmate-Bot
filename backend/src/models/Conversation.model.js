import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    contactId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contact",
      required: true,
      index: true,
    },

    channel: {
      type: String,
      enum: ["whatsapp", "voice", "web"],
      default: "whatsapp",
      index: true,
    },

    currentIntent: {
      type: String,
      enum: [
        "worker_registration",
        "employer_lead",
        "profile_update",
        "job_search",
        "salary_question",
        "human_handoff",
        "opt_out",
        "frustrated",
        "unknown",
        'followup_reply',
      ],
      default: "unknown",
      index: true,
    },

    currentState: {
      type: String,
      default: "idle",
      index: true,
    },

    botMode: {
      type: String,
      enum: ["bot", "human_paused"],
      default: "bot",
      index: true,
    },

    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    lastInboundMessageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },

    lastOutboundMessageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },

    lastActivityAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    tenantId: {
      type: String,
      default: "jobmate",
      index: true,
    },
    metadata: {
      lastQuestion: {
        type: String,
        default: null,
      },
      qualificationStep: {
        type: Number,
        default: 0,
      },
      source: {
        type: String,
        default: "whatsapp",
      },
      futureVoiceReady: {
        type: Boolean,
        default: true,
      },

      businessReceptionist: {
        lastQuestion: {
          type: String,
          default: "",
        },
        selectedService: {
          type: String,
          default: "",
        },
        customerName: {
          type: String,
          default: "",
        },
        updatedAt: {
          type: Date,
          default: null,
        },
      },
      // Phase 1 conversation engine fields
      collectedData: {
        type: mongoose.Schema.Types.Mixed,
        default: () => ({}),
      },
      lastAskedField: {
        type: String,
        default: null,
      },
    },
  },
  {
    timestamps: true,
  }
);

conversationSchema.index({ contactId: 1, channel: 1 }, { unique: true });
conversationSchema.index({ currentIntent: 1, currentState: 1 });
conversationSchema.index({ botMode: 1, lastActivityAt: -1 });

export const Conversation = mongoose.model("Conversation", conversationSchema);