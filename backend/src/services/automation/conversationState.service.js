import { Conversation } from "../../models/Conversation.model.js";

/**
 * Find or create one conversation per contact + channel.
 */
export async function getOrCreateConversation({
  contact,
  channel = "whatsapp",
}) {
  if (!contact?._id) {
    throw new Error("Contact is required to create conversation");
  }

  return Conversation.findOneAndUpdate(
    {
      contactId: contact._id,
      channel,
    },
    {
      $setOnInsert: {
        contactId: contact._id,
        channel,
        currentIntent: "unknown",
        currentState: "idle",
        botMode: contact.botMode || "bot",
        metadata: {
          qualificationStep: 0,
          source: channel,
          futureVoiceReady: true,
      businessReceptionist: {
        lastQuestion: "",
        selectedService: "",
        customerName: "",
        updatedAt: null,
      },
        },
      },
      $set: {
        lastActivityAt: new Date(),
      },
    },
    {
      returnDocument: "after",
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );
}

/**
 * Update conversation after intent classification.
 */
export async function updateConversationIntent({
  conversation,
  intent,
  state = null,
  botMode = null,
  lastInboundMessageId = null,
  metadata = {},
}) {
  if (!conversation?._id) {
    throw new Error("Conversation is required");
  }

  const update = {
    $set: {
      currentIntent: intent || conversation.currentIntent || "unknown",
      lastActivityAt: new Date(),
      ...metadataToDotNotation(metadata),
    },
  };

  if (state) {
    update.$set.currentState = state;
  }

  if (botMode) {
    update.$set.botMode = botMode;
  }

  if (lastInboundMessageId) {
    update.$set.lastInboundMessageId = lastInboundMessageId;
  }

  return Conversation.findByIdAndUpdate(conversation._id, update, {
    returnDocument: "after",
  });
}

/**
 * Update current state and qualification step.
 */
export async function updateConversationState({
  conversation,
  currentState,
  qualificationStep,
  lastQuestion = null,
}) {
  if (!conversation?._id) {
    throw new Error("Conversation is required");
  }

  const update = {
    $set: {
      currentState,
      "metadata.qualificationStep": qualificationStep,
      lastActivityAt: new Date(),
    },
  };

  if (lastQuestion) {
    update.$set["metadata.lastQuestion"] = lastQuestion;
  }

  return Conversation.findByIdAndUpdate(conversation._id, update, {
    returnDocument: "after",
  });
}

/**
 * Pause bot and move conversation to human mode.
 */
export async function pauseConversationForHuman({
  conversation,
  reason = "human_handoff",
}) {
  if (!conversation?._id) {
    throw new Error("Conversation is required");
  }

  return Conversation.findByIdAndUpdate(
    conversation._id,
    {
      $set: {
        botMode: "human_paused",
        currentIntent: reason,
        currentState: "human_paused",
        lastActivityAt: new Date(),
      },
    },
    { returnDocument: "after" }
  );
}

/**
 * Mark conversation as opt-out.
 */
export async function markConversationOptedOut(conversation) {
  if (!conversation?._id) {
    throw new Error("Conversation is required");
  }

  return Conversation.findByIdAndUpdate(
    conversation._id,
    {
      $set: {
        botMode: "human_paused",
        currentIntent: "opt_out",
        currentState: "opted_out",
        lastActivityAt: new Date(),
      },
    },
    { returnDocument: "after" }
  );
}

function metadataToDotNotation(metadata = {}) {
  const result = {};

  for (const [key, value] of Object.entries(metadata)) {
    result[`metadata.${key}`] = value;
  }

  return result;
}

export async function resetConversationForRestart(conversation) {
  if (!conversation?._id) {
    throw new Error("Conversation is required for restart reset");
  }

  conversation.currentIntent = "unknown";
  conversation.currentState = "idle";

  const existingMetadata = conversation.metadata || {};

  conversation.metadata = {
    qualificationStep: 0,
    lastQuestion: null,
    restartedAt: new Date(),
    source: existingMetadata.source || "whatsapp",
    futureVoiceReady:
      typeof existingMetadata.futureVoiceReady === "boolean"
        ? existingMetadata.futureVoiceReady
        : true,
    businessReceptionist: {
      lastQuestion: "",
      selectedService: "",
      customerName: "",
      updatedAt: null,
    },
  };

  await conversation.save();

  return conversation;
}
