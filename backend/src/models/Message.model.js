import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
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

    channel: {
      type: String,
      enum: ["whatsapp", "voice", "web", "telegram"],
      default: "whatsapp",
      index: true,
    },

    direction: {
      type: String,
      enum: ["inbound", "outbound"],
      required: true,
      index: true,
    },

    provider: {
      type: String,
      enum: ["meta_whatsapp", "telegram", "internal"],
      default: "meta_whatsapp",
      index: true,
    },

    providerMessageId: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },

    messageType: {
      type: String,
      enum: [
        "text",
        "button",
        "list",
        "image",
        "audio",
        "document",
        "location",
        "interactive_unknown",
        "followup_reply",
      "unknown",
      ],
      default: "unknown",
      index: true,
    },

    text: {
      type: String,
      default: "",
    },

    normalizedText: {
      type: String,
      default: "",
      index: true,
    },

    intent: {
      type: String,
      enum: [
        "worker_registration",
        "document_upload",
        "employer_lead",
        "profile_update",
        "job_search",
        "salary_question",
        "human_handoff",
        "opt_out",
        "restart",
        "frustrated",
        "unsupported",
        "positive",
        "negative",
        "defer",
        "unknown",
        "status_event",
      ],
      default: "unknown",
      index: true,
    },

    buttonId: {
      type: String,
      default: null,
    },

    buttonTitle: {
      type: String,
      default: null,
    },

    listId: {
      type: String,
      default: null,
    },

    listTitle: {
      type: String,
      default: null,
    },

    media: {
      mediaId: {
        type: String,
        default: null,
      },
      mimeType: {
        type: String,
        default: null,
      },
      sha256: {
        type: String,
        default: null,
      },
      caption: {
        type: String,
        default: null,
      },
      url: {
        type: String,
        default: null,
      },
      transcript: {
        type: String,
        default: null,
      },
    },

    location: {
      latitude: {
        type: Number,
        default: null,
      },
      longitude: {
        type: Number,
        default: null,
      },
      name: {
        type: String,
        default: null,
      },
      address: {
        type: String,
        default: null,
      },
    },

    status: {
      type: String,
      enum: ["received", "processed", "sent", "failed"],
      default: "received",
      index: true,
    },

    errorMessage: {
      type: String,
      default: null,
    },

    rawPayload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

messageSchema.index({ contactId: 1, createdAt: -1 });
messageSchema.index({ provider: 1, providerMessageId: 1 });
messageSchema.index({ intent: 1, createdAt: -1 });

export const Message = mongoose.model("Message", messageSchema);