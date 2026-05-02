/**
 * Meta WhatsApp Cloud API Payload Normalizer
 *
 * Purpose:
 * - Convert raw Meta webhook payload into one clean internal message object.
 * - Support text, button, list, image, audio, document, location, unknown.
 * - Avoid app crash when Meta sends unexpected payload.
 */

export class MetaPayloadNormalizer {
  static normalize(payload) {
    const value = payload?.entry?.[0]?.changes?.[0]?.value;

    if (!value) {
      return {
        ok: false,
        reason: "INVALID_META_PAYLOAD",
        message: "Missing entry[0].changes[0].value",
        rawPayload: payload,
      };
    }

    const message = value?.messages?.[0];
    const contact = value?.contacts?.[0];

    if (!message) {
      return {
        ok: false,
        reason: "NO_MESSAGE_FOUND",
        message: "Payload does not contain user message. It may be status update.",
        rawPayload: payload,
      };
    }

    const messageType = message?.type || "unknown";

    const base = {
      ok: true,
      provider: "meta_whatsapp",
      phoneNumberId: value?.metadata?.phone_number_id || null,
      businessDisplayPhoneNumber: value?.metadata?.display_phone_number || null,

      contact: {
        waId: contact?.wa_id || message?.from || null,
        phone: message?.from || contact?.wa_id || null,
        displayName: contact?.profile?.name || null,
      },

      message: {
        providerMessageId: message?.id || null,
        from: message?.from || null,
        timestamp: message?.timestamp ? Number(message.timestamp) : null,
        type: messageType,

        text: null,
        normalizedText: null,

        buttonId: null,
        buttonTitle: null,

        listId: null,
        listTitle: null,

        mediaId: null,
        mediaMimeType: null,
        mediaSha256: null,
        mediaCaption: null,

        location: null,

        rawMessage: message,
      },

      rawPayload: payload,
    };

    switch (messageType) {
      case "text": {
        const text = message?.text?.body || "";

        base.message.text = text;
        base.message.normalizedText = normalizeText(text);
        break;
      }

      case "interactive": {
        const interactive = message?.interactive;

        if (interactive?.type === "button_reply") {
          const button = interactive?.button_reply;

          base.message.type = "button";
          base.message.buttonId = button?.id || null;
          base.message.buttonTitle = button?.title || null;
          base.message.text = button?.title || button?.id || "";
          base.message.normalizedText = normalizeText(base.message.text);
        } else if (interactive?.type === "list_reply") {
          const list = interactive?.list_reply;

          base.message.type = "list";
          base.message.listId = list?.id || null;
          base.message.listTitle = list?.title || null;
          base.message.text = list?.title || list?.id || "";
          base.message.normalizedText = normalizeText(base.message.text);
        } else {
          base.message.type = "interactive_unknown";
          base.message.text = JSON.stringify(interactive || {});
          base.message.normalizedText = normalizeText(base.message.text);
        }

        break;
      }

      case "button": {
        const button = message?.button;

        base.message.type = "button";
        base.message.buttonId = button?.payload || null;
        base.message.buttonTitle = button?.text || null;
        base.message.text = button?.text || button?.payload || "";
        base.message.normalizedText = normalizeText(base.message.text);
        break;
      }

      case "image": {
        const image = message?.image;

        base.message.mediaId = image?.id || null;
        base.message.mediaMimeType = image?.mime_type || null;
        base.message.mediaSha256 = image?.sha256 || null;
        base.message.mediaCaption = image?.caption || null;
        base.message.text = image?.caption || "";
        base.message.normalizedText = normalizeText(base.message.text);
        break;
      }

      case "audio": {
        const audio = message?.audio;

        base.message.mediaId = audio?.id || null;
        base.message.mediaMimeType = audio?.mime_type || null;
        base.message.mediaSha256 = audio?.sha256 || null;
        break;
      }

      case "document": {
        const document = message?.document;

        base.message.mediaId = document?.id || null;
        base.message.mediaMimeType = document?.mime_type || null;
        base.message.mediaSha256 = document?.sha256 || null;
        base.message.mediaCaption = document?.caption || null;
        base.message.text = document?.caption || document?.filename || "";
        base.message.normalizedText = normalizeText(base.message.text);
        break;
      }

      case "location": {
        const location = message?.location;

        base.message.location = {
          latitude: location?.latitude || null,
          longitude: location?.longitude || null,
          name: location?.name || null,
          address: location?.address || null,
        };

        base.message.text = location?.name || location?.address || "";
        base.message.normalizedText = normalizeText(base.message.text);
        break;
      }

      default: {
        base.message.text = "";
        base.message.normalizedText = "";
        break;
      }
    }

    return base;
  }
}

function normalizeText(text = "") {
  return String(text)
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}