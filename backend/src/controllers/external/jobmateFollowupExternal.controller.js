import { sendWhatsAppTextMessage } from "../../services/whatsapp/whatsappClient.service.js";

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