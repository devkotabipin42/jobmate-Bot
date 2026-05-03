import { AARATI_SAMPLE_REPLIES } from "../../personas/aarati.persona.js";
export function buildReplyMessage({
  contact,
  intentResult,
  flowResult = null,
  conversation = null,
}) {
  const name = resolveDisplayName(contact);

  // If a flow already prepared the next message, use it.
  if (flowResult?.messageToSend) {
    return flowResult.messageToSend;
  }

  // If human already needs to handle this user, don't restart/confuse the flow.
  if (
    conversation?.currentState === "human_paused" ||
    contact?.botMode === "human_paused"
  ) {
    return `Hunchha 🙏 Tapai lai kun kura ma sahayog chahiyeko ho?

Kaam khojna ho ki staff/worker khojna ho?

Sajilo ko lagi yesto lekhna saknuhunchha:
- "malai kaam chahiyo"
- "malai staff chahiyo"`;
  }

  switch (intentResult?.intent) {
    case "opt_out":
      return `Thik chha ${name} 🙏

Tapai lai JobMate bata automatic message pathauna rokeko chha.
Pachi feri support chahiyo bhane "START" lekhera message garnu hola.`;

    case "human_handoff":
      return `Thik chha ${name} 🙏

JobMate team ko ek jana member le tapai sanga kura garnu hunchha.
Kehi samaya parkhanu hola.`;

    case "frustrated":
      return AARATI_SAMPLE_REPLIES.offTopic;

    case "unsupported":
      return `Namaste ${name} 🙏

Ahile hamro WhatsApp assistant le text message matra ramrari handle garcha.
Daya garera tapai ko kura text ma lekhera pathaunu hola.

Example:
- job chaiyo
- staff chahiyo
- human sanga kura garna xa`;

    case "positive":
    case "negative":
    case "defer":
    case "unknown":
    default:
      return AARATI_SAMPLE_REPLIES.offTopic;
  }
}

function resolveDisplayName(contact) {
  const rawName = contact?.displayName || "";

  const badNames = [
    "recruiter",
    "unknown",
    "mitra",
    "whatsapp user",
    "user",
  ];

  const normalized = rawName.trim().toLowerCase();

  if (!rawName || badNames.includes(normalized)) {
    return "Mitra ji";
  }

  if (rawName.length > 25) {
    return "Mitra ji";
  }

  return `${rawName.trim()} ji`;
}
