import { extractIntentWithAI } from "./aiIntent.service.js";

const HUMAN_INTENTS = ["human_handoff", "frustrated"];

export async function understandMessageWithAI({
  text,
  ruleIntentResult,
  conversation,
}) {
  const normalizedText = String(text || "").trim();

  // Guardrails: never send these to AI unnecessarily.
  if (!normalizedText) {
    return {
      intentResult: ruleIntentResult,
      ai: null,
      usedAI: false,
      source: "rule_empty",
    };
  }

  // Hard commands stay rule-based.
  if (["restart", "opt_out"].includes(ruleIntentResult?.intent)) {
    return {
      intentResult: ruleIntentResult,
      ai: null,
      usedAI: false,
      source: "rule_command",
    };
  }

  // Active step flows stay rule-based after controller override.
  const activeStates = [
    "ask_job_type",
    "ask_district",
    "ask_availability",
    "ask_document_status",
    "ask_business_name",
    "ask_vacancy",
    "ask_location",
    "ask_urgency",
    "job_search_results",
  ];

  const richEmployerMessage =
    ruleIntentResult?.intent === "employer_lead" &&
    (
      /\d+/.test(normalizedText) ||
      normalizedText.toLowerCase().includes("salary") ||
      normalizedText.toLowerCase().includes("waiter") ||
      normalizedText.toLowerCase().includes("driver") ||
      normalizedText.toLowerCase().includes("helper") ||
      normalizedText.toLowerCase().includes("staff") ||
      normalizedText.toLowerCase().includes("worker") ||
      normalizedText.toLowerCase().includes("hotel") ||
      normalizedText.toLowerCase().includes("factory") ||
      normalizedText.toLowerCase().includes("bardaghat") ||
      normalizedText.toLowerCase().includes("bardghat") ||
      normalizedText.toLowerCase().includes("butwal")
    );

  if (activeStates.includes(conversation?.currentState) && !richEmployerMessage) {
    return {
      intentResult: ruleIntentResult,
      ai: null,
      usedAI: false,
      source: "rule_active_state",
    };
  }

  // Very short menu answers stay rule-based.
  if (["1", "2", "3"].includes(normalizedText)) {
    return {
      intentResult: ruleIntentResult,
      ai: null,
      usedAI: false,
      source: "rule_menu",
    };
  }

  const ai = await extractIntentWithAI(normalizedText);

  if (!ai.ok || ai.confidence < 0.7 || ai.intent === "unknown") {
    return {
      intentResult: ruleIntentResult,
      ai,
      usedAI: false,
      source: "ai_low_confidence",
    };
  }

  return {
    intentResult: {
      ...ruleIntentResult,
      intent: ai.intent,
      needsHuman: HUMAN_INTENTS.includes(ai.intent),
      priority: HUMAN_INTENTS.includes(ai.intent) ? "high" : "low",
      reason: `AI understood: ${ai.reason || ai.intent}`,
    },
    ai,
    usedAI: true,
    source: "ai_primary",
  };
}
