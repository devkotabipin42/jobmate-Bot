import { extractIntentWithAI } from "./aiIntent.service.js";

const ALLOWED_AI_INTENTS = [
  "job_search",
  "worker_registration",
  "employer_lead",
  "human_handoff",
  "frustrated",
  "opt_out",
  "restart",
  "unknown",
];

export async function applyAIIntentFallback({
  intentResult,
  text,
  minConfidence = 0.75,
}) {
  const cleanText = String(text || "").trim();

  if (!cleanText || cleanText.length < 3) {
    return {
      intentResult,
      aiExtraction: null,
      usedAI: false,
    };
  }

  const shouldUseAI =
    intentResult?.intent === "unknown" ||
    intentResult?.intent === "employer_lead" ||
    intentResult?.intent === "job_search" ||
    looksLikeFrustrated(cleanText) ||
    looksLikeRichEmployerMessage(cleanText);

  if (!shouldUseAI) {
    return {
      intentResult,
      aiExtraction: null,
      usedAI: false,
    };
  }

  const ai = await extractIntentWithAI(cleanText);

  if (
    ai.ok &&
    ai.confidence >= minConfidence &&
    ALLOWED_AI_INTENTS.includes(ai.intent) &&
    ai.intent !== "unknown"
  ) {
    return {
      intentResult: {
        ...intentResult,
        intent: ai.intent,
        needsHuman: ["human_handoff", "frustrated"].includes(ai.intent),
        priority: ["human_handoff", "frustrated"].includes(ai.intent)
          ? "high"
          : "low",
        reason: `AI enhanced: ${ai.reason || ai.intent}`,
      },
      aiExtraction: ai,
      usedAI: true,
    };
  }

  return {
    intentResult,
    aiExtraction: ai.ok ? ai : null,
    usedAI: false,
  };
}

function looksLikeRichEmployerMessage(text) {
  const lower = text.toLowerCase();

  const hasHiringWord = [
    "chahiyo",
    "chaiyo",
    "chaincha",
    "chahincha",
    "hire",
    "hiring",
    "चाहियो",
  ].some((w) => lower.includes(w));

  const hasRoleOrBusiness = [
    "hotel",
    "waiter",
    "staff",
    "worker",
    "helper",
    "driver",
    "guard",
    "security",
    "factory",
    "restaurant",
    "cleaner",
    "cook",
    "jana",
  ].some((w) => lower.includes(w));

  const hasDetail =
    /\d+/.test(lower) ||
    lower.includes("salary") ||
    lower.includes("bardaghat") ||
    lower.includes("bardghat") ||
    lower.includes("butwal") ||
    lower.includes("bhairahawa");

  return hasHiringWord && hasRoleOrBusiness && hasDetail;
}

function looksLikeFrustrated(text) {
  const lower = text.toLowerCase();

  return [
    "chor",
    "fake",
    "scam",
    "fataha",
    "fraud",
    "ठग",
    "चोर",
  ].some((w) => lower.includes(w));
}
