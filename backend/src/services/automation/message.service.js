import { ProcessedMessage } from "../../models/ProcessedMessage.model.js";
import { Message } from "../../models/Message.model.js";

/**
 * Try to reserve a provider message id for processing.
 * If duplicate key happens, it means webhook/message was already processed.
 */
export async function reserveMessageForProcessing({
  provider = "meta_whatsapp",
  providerMessageId,
  phone,
}) {
  if (!providerMessageId) {
    return {
      isDuplicate: false,
      processedMessage: null,
      reason: "NO_PROVIDER_MESSAGE_ID",
    };
  }

  try {
    const processedMessage = await ProcessedMessage.create({
      provider,
      providerMessageId,
      phone,
      status: "processing",
    });

    return {
      isDuplicate: false,
      processedMessage,
      reason: "",
    };
  } catch (error) {
    if (error?.code === 11000) {
      return {
        isDuplicate: true,
        processedMessage: null,
        reason: "DUPLICATE_PROVIDER_MESSAGE_ID",
      };
    }

    throw error;
  }
}

export async function markMessageProcessed(processedMessageId) {
  if (!processedMessageId) return null;

  return ProcessedMessage.findByIdAndUpdate(
    processedMessageId,
    {
      $set: {
        status: "processed",
        processedAt: new Date(),
      },
    },
    { returnDocument: "after" }
  );
}

export async function markMessageFailed(processedMessageId, errorMessage) {
  if (!processedMessageId) return null;

  return ProcessedMessage.findByIdAndUpdate(
    processedMessageId,
    {
      $set: {
        status: "failed",
        errorMessage: errorMessage || "Unknown error",
      },
    },
    { returnDocument: "after" }
  );
}

export async function saveInboundMessage({
  contact,
  conversation = null,
  normalized,
  intentResult,
}) {
  const msg = normalized.message;

  return Message.create({
    contactId: contact._id,
    conversationId: conversation?._id || null,
    channel: "whatsapp",
    direction: "inbound",
    provider: normalized.provider,
    providerMessageId: msg.providerMessageId,
    messageType: msg.type,
    text: msg.text || "",
    normalizedText: msg.normalizedText || "",
    intent: intentResult?.intent || "unknown",
    buttonId: msg.buttonId,
    buttonTitle: msg.buttonTitle,
    listId: msg.listId,
    listTitle: msg.listTitle,
    media: {
      mediaId: msg.mediaId,
      mimeType: msg.mediaMimeType,
      sha256: msg.mediaSha256,
      caption: msg.mediaCaption,
    },
    location: msg.location,
    status: "received",
    rawPayload: normalized.rawPayload,
  });
}

export async function saveOutboundMessage({
  contact,
  conversation = null,
  text,
  providerMessageId = null,
  status = "sent",
}) {
  return Message.create({
    contactId: contact._id,
    conversationId: conversation?._id || null,
    channel: "whatsapp",
    direction: "outbound",
    provider: "meta_whatsapp",
    providerMessageId,
    messageType: "text",
    text,
    normalizedText: String(text || "").trim().toLowerCase(),
    status,
  });
}
