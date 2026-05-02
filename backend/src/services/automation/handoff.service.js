import { HandoffRequest } from "../../models/HandoffRequest.model.js";
import { pauseConversationForHuman } from "./conversationState.service.js";
import { pauseContactForHuman } from "./contact.service.js";

export async function createHandoffRequest({
  contact,
  conversation = null,
  reason = "unknown",
  lastUserMessage = "",
  priority = "medium",
  callRequired = false,
  metadata = {},
}) {
  if (!contact?._id) {
    throw new Error("Contact is required to create handoff request");
  }

  const existingOpen = await HandoffRequest.findOne({
    contactId: contact._id,
    status: { $in: ["open", "assigned", "in_progress"] },
  });

  if (existingOpen) {
    return existingOpen;
  }

  const handoff = await HandoffRequest.create({
    contactId: contact._id,
    conversationId: conversation?._id || null,
    channel: conversation?.channel || "whatsapp",
    reason,
    lastUserMessage,
    status: "open",
    priority,
    callRequired,
    callStatus: callRequired ? "pending" : "not_required",
    metadata,
  });

  if (conversation?._id) {
    await pauseConversationForHuman({
      conversation,
      reason,
    });
  }

  await pauseContactForHuman(contact._id);

  return handoff;
}

export function mapIntentToHandoffReason(intent) {
  if (intent === "human_handoff") return "user_requested_human";
  if (intent === "frustrated") return "frustrated_user";
  if (intent === "unsupported") return "unsupported_message";

  return "unknown";
}

export function shouldCreateHandoff({ intentResult, flowResult }) {
  if (intentResult?.needsHuman) return true;
  if (flowResult?.needsHuman) return true;

  return false;
}

export function resolveHandoffPriority({ intentResult, flowResult }) {
  if (flowResult?.priority === "urgent") return "urgent";
  if (intentResult?.priority === "high" || flowResult?.priority === "high") {
    return "high";
  }
  if (intentResult?.priority === "medium" || flowResult?.priority === "medium") {
    return "medium";
  }

  return "low";
}

export function resolveHandoffReason({ intentResult, flowResult }) {
  if (flowResult?.handoffReason) return flowResult.handoffReason;
  return mapIntentToHandoffReason(intentResult?.intent);
}
