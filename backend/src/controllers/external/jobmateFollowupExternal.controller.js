import { sendWhatsAppTextMessage } from "../../services/whatsapp/whatsappClient.service.js";
import { Contact } from "../../models/Contact.model.js";
import { Conversation } from "../../models/Conversation.model.js";

const FOLLOWUP_REPLY_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const normalizePhone = (phone = "") => {
  const digits = String(phone).replace(/\D/g, "");

  if (!digits) return "";

  // Already international Nepal
  if (digits.startsWith("977")) return digits;

  // Already international Japan
  if (digits.startsWith("81")) return digits;

  // Japan local mobile test number: 080xxxxxxxx / 090xxxxxxxx / 070xxxxxxxx
  if (/^0[789]0\d{8}$/.test(digits)) {
    return `81${digits.slice(1)}`;
  }

  // Nepal local mobile: 98xxxxxxxx / 97xxxxxxxx
  if (/^9[78]\d{8}$/.test(digits)) {
    return `977${digits}`;
  }

  // Fallback: keep digits so Meta error is honest
  return digits;
};

export const receiveJobmateFollowup = async (req, res) => {
  try {
    const expectedSecret = process.env.JOBMATE_FOLLOWUP_WEBHOOK_SECRET;
    const receivedSecret = req.headers["x-jobmate-secret"];

    if (expectedSecret && receivedSecret !== expectedSecret) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized follow-up webhook"
      });
    }

    const {
      followUpLogId,
      type,
      phone,
      recipientName,
      jobTitle,
      companyName,
      message,
      metadata = {}
    } = req.body;

    const normalizedPhone = normalizePhone(phone);

    if (!normalizedPhone || !message) {
      return res.status(400).json({
        success: false,
        message: "phone and message are required"
      });
    }

    console.log("[external-jobmate-followup] received", {
      followUpLogId,
      type,
      phone: normalizedPhone,
      recipientName,
      jobTitle,
      companyName,
      metadata
    });

    const sendResult = await sendWhatsAppTextMessage({
      to: normalizedPhone,
      text: message
    });

    console.log("[external-jobmate-followup] whatsapp sent", {
      followUpLogId,
      phone: normalizedPhone,
      providerMessageId: sendResult?.providerMessageId || null
    });

    // ── AARATI-20A: Store follow-up context for the reply guard ──────────────
    // When the user replies (e.g. "1"), the WhatsApp webhook will read
    // metadata.awaitingFollowupReply and route the reply before any
    // employer parser, classifier, or Mapbox call sees it.
    // Non-fatal: failure to store context is logged but does not fail the response.
    try {
      const followupContact = await Contact.findOne({ phone: normalizedPhone }).lean();
      if (followupContact?._id) {
        await Conversation.updateOne(
          { contactId: followupContact._id, channel: "whatsapp" },
          {
            $set: {
              "metadata.awaitingFollowupReply": true,
              "metadata.followupSource": "jobmate_followup",
              "metadata.followupType": type || "unknown",
              "metadata.followupLogId": followUpLogId || null,
              "metadata.followupExpiresAt": new Date(Date.now() + FOLLOWUP_REPLY_EXPIRY_MS),
              "metadata.expectedInputs": ["1", "2", "3"],
              "metadata.lastOutboundContext": {
                source: "jobmate_followup",
                type: type || "unknown",
                options: {
                  "1": "still_looking",
                  "2": "not_looking",
                  "3": "update_location_job_type",
                },
              },
            },
          },
          { runValidators: false }
        );
        console.log("[external-jobmate-followup] follow-up context stored", {
          phone: normalizedPhone,
          type,
          followUpLogId,
        });
      }
    } catch (contextError) {
      console.warn(
        "[external-jobmate-followup] failed to store follow-up context (non-fatal):",
        contextError.message
      );
    }
    // ── End AARATI-20A context store ──────────────────────────────────────────

    return res.status(200).json({
      success: true,
      followupId: followUpLogId || `jobmate_${Date.now()}`,
      messageId: sendResult?.providerMessageId || "",
      status: "sent"
    });
  } catch (error) {
    console.error("[external-jobmate-followup] failed", error);

    return res.status(500).json({
      success: false,
      message: error.message,
      metaError: error.response?.data || null
    });
  }
};