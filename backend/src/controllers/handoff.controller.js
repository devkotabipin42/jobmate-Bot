import { Contact } from "../models/Contact.model.js";
import { Conversation } from "../models/Conversation.model.js";
import { sendWhatsAppTextMessage } from "../services/whatsapp/whatsappClient.service.js";
import { saveOutboundMessage } from "../services/automation/message.service.js";
import {
  pauseConversationForHuman,
} from "../services/automation/conversationState.service.js";

async function resolveContactAndConversation(contactId) {
  const [contact, conversation] = await Promise.all([
    Contact.findById(contactId),
    Conversation.findOne({ contactId }),
  ]);
  return { contact, conversation };
}

/**
 * POST /admin/conversations/:contactId/send
 * Admin sends a WhatsApp message to the user from the panel.
 * Does NOT change botMode — use takeover first if needed.
 */
export async function adminSendMessage(req, res) {
  try {
    const { contactId } = req.params;
    const { message } = req.body;

    if (!message || !String(message).trim()) {
      return res.status(400).json({ success: false, message: "message is required" });
    }

    const { contact, conversation } = await resolveContactAndConversation(contactId);

    if (!contact) {
      return res.status(404).json({ success: false, message: "Contact not found" });
    }

    const text = String(message).trim();

    const sendResult = await sendWhatsAppTextMessage({ to: contact.phone, text });

    await saveOutboundMessage({
      contact,
      conversation,
      text,
      providerMessageId: sendResult.providerMessageId || null,
      status: sendResult.skipped ? "skipped" : "sent",
    });

    return res.status(200).json({
      success: true,
      sent: !sendResult.skipped,
      skipped: sendResult.skipped || false,
      reason: sendResult.reason || null,
    });
  } catch (error) {
    console.error("❌ adminSendMessage failed:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to send message" });
  }
}

/**
 * POST /admin/conversations/:contactId/takeover
 * Pauses the bot and notifies the user that a human is joining.
 */
export async function adminTakeoverConversation(req, res) {
  try {
    const { contactId } = req.params;

    const { contact, conversation } = await resolveContactAndConversation(contactId);

    if (!contact) {
      return res.status(404).json({ success: false, message: "Contact not found" });
    }

    // Pause bot on both Contact and Conversation documents.
    await Promise.all([
      Contact.findByIdAndUpdate(contact._id, { $set: { botMode: "human_paused" } }),
      conversation
        ? pauseConversationForHuman({ conversation, reason: "human_handoff" })
        : Promise.resolve(),
    ]);

    const text = "Hamro team member tapai sanga kura garna aaucha 🙏 Kehiछin parkhanu hola.";
    const sendResult = await sendWhatsAppTextMessage({ to: contact.phone, text });

    await saveOutboundMessage({
      contact,
      conversation,
      text,
      providerMessageId: sendResult.providerMessageId || null,
      status: sendResult.skipped ? "skipped" : "sent",
    });

    return res.status(200).json({
      success: true,
      botMode: "human_paused",
      sent: !sendResult.skipped,
    });
  } catch (error) {
    console.error("❌ adminTakeoverConversation failed:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to take over conversation" });
  }
}

/**
 * POST /admin/conversations/:contactId/release
 * Resumes the bot and notifies the user.
 */
export async function adminReleaseConversation(req, res) {
  try {
    const { contactId } = req.params;

    const { contact, conversation } = await resolveContactAndConversation(contactId);

    if (!contact) {
      return res.status(404).json({ success: false, message: "Contact not found" });
    }

    // Resume bot on both Contact and Conversation documents.
    await Promise.all([
      Contact.findByIdAndUpdate(contact._id, { $set: { botMode: "bot" } }),
      conversation
        ? Conversation.findByIdAndUpdate(conversation._id, {
            $set: {
              botMode: "bot",
              currentIntent: "unknown",
              currentState: "idle",
              lastActivityAt: new Date(),
            },
          })
        : Promise.resolve(),
    ]);

    const text = "Bot feri active bhayo 🤖\nJob khojna '1', staff khojna '2' thichnus.";
    const sendResult = await sendWhatsAppTextMessage({ to: contact.phone, text });

    await saveOutboundMessage({
      contact,
      conversation,
      text,
      providerMessageId: sendResult.providerMessageId || null,
      status: sendResult.skipped ? "skipped" : "sent",
    });

    return res.status(200).json({
      success: true,
      botMode: "bot",
      sent: !sendResult.skipped,
    });
  } catch (error) {
    console.error("❌ adminReleaseConversation failed:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to release conversation" });
  }
}
