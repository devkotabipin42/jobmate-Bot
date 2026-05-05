import axios from "axios";
import { env } from "../../config/env.js";

const META_GRAPH_BASE_URL = "https://graph.facebook.com/v20.0";

/**
 * Send plain text message using Meta WhatsApp Cloud API.
 */
export async function sendWhatsAppTextMessage({
  to,
  text,
}) {
  if (!to) {
    throw new Error("WhatsApp recipient phone is required");
  }

  if (!text) {
    throw new Error("WhatsApp message text is required");
  }

  if (
    !env.META_ACCESS_TOKEN ||
    env.META_ACCESS_TOKEN === "replace_later" ||
    !env.META_PHONE_NUMBER_ID ||
    env.META_PHONE_NUMBER_ID === "replace_later"
  ) {
    console.log("⚠️ WhatsApp send skipped: Meta credentials not configured");
    console.log("To:", to);
    console.log("Message:", text);

    return {
      skipped: true,
      reason: "META_CREDENTIALS_NOT_CONFIGURED",
      to,
      text,
    };
  }

  const url = `${META_GRAPH_BASE_URL}/${env.META_PHONE_NUMBER_ID}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: {
      preview_url: false,
      body: text,
    },
  };

  const response = await axios.post(url, payload, {
    headers: {
      Authorization: `Bearer ${env.META_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    timeout: 10000,
  });

  return {
    skipped: false,
    provider: "meta_whatsapp",
    providerResponse: response.data,
    providerMessageId: response.data?.messages?.[0]?.id || null,
  };
}

/**
 * Send simple interactive button message.
 * Later we can use this for:
 * 1. Kaam khojna
 * 2. Staff khojna
 * 3. Human support
 */
export async function sendWhatsAppButtonMessage({
  to,
  bodyText,
  buttons = [],
}) {
  if (!to) {
    throw new Error("WhatsApp recipient phone is required");
  }

  if (!bodyText) {
    throw new Error("WhatsApp button body text is required");
  }

  if (!Array.isArray(buttons) || buttons.length === 0) {
    throw new Error("Buttons are required");
  }

  const safeButtons = buttons.slice(0, 3).map((button, index) => ({
    type: "reply",
    reply: {
      id: button.id || `button_${index + 1}`,
      title: button.title || `Option ${index + 1}`,
    },
  }));

  if (
    !env.META_ACCESS_TOKEN ||
    env.META_ACCESS_TOKEN === "replace_later" ||
    !env.META_PHONE_NUMBER_ID ||
    env.META_PHONE_NUMBER_ID === "replace_later"
  ) {
    console.log("⚠️ WhatsApp button send skipped: Meta credentials not configured");
    console.log("To:", to);
    console.log("Body:", bodyText);
    console.log("Buttons:", safeButtons);

    return {
      skipped: true,
      reason: "META_CREDENTIALS_NOT_CONFIGURED",
      to,
      bodyText,
      buttons: safeButtons,
    };
  }

  const url = `${META_GRAPH_BASE_URL}/${env.META_PHONE_NUMBER_ID}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: {
        text: bodyText,
      },
      action: {
        buttons: safeButtons,
      },
    },
  };

  const response = await axios.post(url, payload, {
    headers: {
      Authorization: `Bearer ${env.META_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    timeout: 10000,
  });

  return {
    skipped: false,
    provider: "meta_whatsapp",
    providerResponse: response.data,
    providerMessageId: response.data?.messages?.[0]?.id || null,
  };
}


function buildSafeMetaError(error, fallbackMessage = "Meta WhatsApp API request failed") {
  const metaError = error?.response?.data?.error || {};

  const safe = {
    status: error?.response?.status || null,
    message: metaError.message || error?.message || fallbackMessage,
    code: metaError.code || null,
    type: metaError.type || null,
    fbtrace_id: metaError.fbtrace_id || null,
  };

  const safeError = new Error(safe.message);
  safeError.status = safe.status;
  safeError.code = safe.code;
  safeError.type = safe.type;
  safeError.fbtrace_id = safe.fbtrace_id;
  safeError.safe = safe;

  return safeError;
}

export async function getWhatsAppMediaInfo(mediaId) {
  if (!mediaId) {
    throw new Error("WhatsApp media ID is required");
  }

  if (
    !env.META_ACCESS_TOKEN ||
    env.META_ACCESS_TOKEN === "replace_later"
  ) {
    return {
      skipped: true,
      reason: "META_ACCESS_TOKEN_NOT_CONFIGURED",
      mediaId,
    };
  }

  try {
    const response = await axios.get(`${META_GRAPH_BASE_URL}/${mediaId}`, {
      headers: {
        Authorization: `Bearer ${env.META_ACCESS_TOKEN}`,
      },
      timeout: 10000,
    });

    return {
      skipped: false,
      mediaId,
      url: response.data?.url || "",
      mimeType: response.data?.mime_type || "",
      sha256: response.data?.sha256 || "",
      fileSize: response.data?.file_size || null,
      raw: response.data || {},
    };
  } catch (error) {
    throw buildSafeMetaError(error, "Failed to fetch WhatsApp media info");
  }
}

export async function downloadWhatsAppMediaBuffer(mediaUrl) {
  if (!mediaUrl) {
    throw new Error("WhatsApp media URL is required");
  }

  if (
    !env.META_ACCESS_TOKEN ||
    env.META_ACCESS_TOKEN === "replace_later"
  ) {
    return {
      skipped: true,
      reason: "META_ACCESS_TOKEN_NOT_CONFIGURED",
      buffer: null,
    };
  }

  try {
    const response = await axios.get(mediaUrl, {
      headers: {
        Authorization: `Bearer ${env.META_ACCESS_TOKEN}`,
      },
      responseType: "arraybuffer",
      timeout: 15000,
    });

    return {
      skipped: false,
      buffer: Buffer.from(response.data),
      contentType: response.headers?.["content-type"] || "",
      contentLength: Number(response.headers?.["content-length"] || 0),
    };
  } catch (error) {
    throw buildSafeMetaError(error, "Failed to download WhatsApp media");
  }
}
