import { sendWhatsAppTextMessage } from "../../services/whatsapp/whatsappClient.service.js";
import { Contact } from "../../models/Contact.model.js";
import { Conversation } from "../../models/Conversation.model.js";
// Use the SAME canonicalization as the WhatsApp inbound path so phone keys match.
import { normalizePhone as sharedNormalizePhone } from "../../utils/normalizePhone.js";

const FOLLOWUP_REPLY_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// canonicalPhone: strips all non-digits and applies Nepal/Japan country-code logic.
// Must match whatever the WhatsApp inbound path stores in Contact.phone.
const canonicalizePhone = (phone = "") => {
  const shared = sharedNormalizePhone(phone);
  if (shared) return shared;

  // Fallback for Japan numbers not covered by the shared utility.
  const digits = String(phone).replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("81")) return digits;
  if (/^0[789]0\d{8}$/.test(digits)) return `81${digits.slice(1)}`;
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

    const normalizedPhone = canonicalizePhone(phone);

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
    // Context is stored under metadata.collectedData (Mixed type) so Mongoose
    // strict-mode does NOT silently strip these custom fields on write or read.
    // Non-fatal: failure to store context is logged but does not fail the response.
    try {
      const followupContact = await Contact.findOne({ phone: normalizedPhone }).lean();
      if (followupContact?._id) {
        const updatedConv = await Conversation.findOneAndUpdate(
          { contactId: followupContact._id, channel: "whatsapp" },
          {
            $set: {
              "metadata.collectedData.awaitingFollowupReply": true,
              "metadata.collectedData.followupSource": "jobmate_followup",
              "metadata.collectedData.followupType": type || "unknown",
              "metadata.collectedData.followupLogId": followUpLogId || null,
              "metadata.collectedData.followupExpiresAt": new Date(Date.now() + FOLLOWUP_REPLY_EXPIRY_MS),
              "metadata.collectedData.expectedInputs": ["1", "2", "3"],
              "metadata.collectedData.lastOutboundContext": {
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
          { returnDocument: "after", runValidators: false }
        );

        if (updatedConv) {
          const cd = updatedConv.metadata?.collectedData || {};
          console.log("AARATI_20A_CONTEXT_SAVED", {
            phone: normalizedPhone,
            canonicalPhone: normalizedPhone,
            conversationId: String(updatedConv._id),
            awaitingFollowupReply: cd.awaitingFollowupReply ?? false,
            followupType: cd.followupType ?? null,
            currentState: updatedConv.currentState,
            state: updatedConv.currentState,
            activeFlow: updatedConv.currentIntent,
          });
        } else {
          console.warn("[external-jobmate-followup] no conversation found for contact", {
            phone: normalizedPhone,
            contactId: String(followupContact._id),
          });
        }
      } else {
        console.warn("[external-jobmate-followup] contact not found, cannot store follow-up context", {
          phone: normalizedPhone,
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