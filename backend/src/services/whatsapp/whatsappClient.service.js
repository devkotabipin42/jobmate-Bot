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
