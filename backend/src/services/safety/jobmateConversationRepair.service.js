import { AARATI_RULEBOOK, getNextStepHint } from "../../policies/aarati.rulebook.js";

function getText(normalized = {}) {
  return String(
    normalized?.message?.text ||
      normalized?.message?.normalizedText ||
      ""
  ).trim();
}

export function isAaratiIdentityQuestion(text = "") {
  return /timi ko ho|tapai ko ho|who are you|are you ai|bot ho|timi ai ho|tapai ai ho|aarati ko ho/i.test(
    String(text || "")
  );
}

export function isIgnoredComplaint(text = "") {
  return /ignore|ignored|msg dekhidaina|message dekhidaina|reply gardainau|kina answer diyena|mero kura sunena/i.test(
    String(text || "")
  );
}

export function isHumanRequest(text = "") {
  return /human|agent|manche sanga|manxe sanga|team sanga|phone gar|call gar|real person|staff sanga/i.test(
    String(text || "")
  );
}

export function isFrustrationOrAbuse(text = "") {
  return / रिस|risa|frustrat|angry|bekar|jpt|pattu|pagal|stupid|idiot|nonsense|kasto bot|gali|chup|damn|shit|fuck/i.test(
    String(text || "")
  );
}

export function isConfusedMessage(text = "") {
  const value = String(text || "").toLowerCase();

  // Let JobMate knowledge layer answer product/how-it-works questions.
  if (
    /job\s*mate|jobmate|yo platform|asle|yesle|kasari.*kaam|kasari.*kam|how.*work/i.test(value)
  ) {
    return false;
  }

  return /bujhina|bujena|clear chaina|what now|aba ke|k garne|confuse|confused|ke bhayo/i.test(value);
}

function withNextStep(reply, conversation) {
  const hint = getNextStepHint({ conversation });
  return `${reply}

${hint}`;
}

export function detectConversationRepairEvent({ conversation, normalized } = {}) {
  const text = getText(normalized);
  if (!text) return null;

  if (isAaratiIdentityQuestion(text)) {
    return {
      type: "identity_question",
      intent: "worker_registration",
      priority: "low",
      needsHuman: false,
      reply: withNextStep(AARATI_RULEBOOK.repair.identity, conversation),
    };
  }

  if (isHumanRequest(text)) {
    return {
      type: "human_request",
      intent: "frustrated",
      priority: "high",
      needsHuman: true,
      reply: AARATI_RULEBOOK.repair.humanRequest,
    };
  }

  if (isIgnoredComplaint(text)) {
    return {
      type: "ignored_complaint",
      intent: "frustrated",
      priority: "high",
      needsHuman: true,
      reply: withNextStep(AARATI_RULEBOOK.repair.ignored, conversation),
    };
  }

  if (isFrustrationOrAbuse(text)) {
    return {
      type: "frustration_or_abuse",
      intent: "frustrated",
      priority: "high",
      needsHuman: true,
      reply: withNextStep(AARATI_RULEBOOK.repair.frustrated, conversation),
    };
  }

  if (isConfusedMessage(text)) {
    return {
      type: "confused_message",
      intent: "worker_registration",
      priority: "medium",
      needsHuman: false,
      reply: AARATI_RULEBOOK.repair.confused,
    };
  }

  return null;
}
