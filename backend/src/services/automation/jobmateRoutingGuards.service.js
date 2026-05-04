// Centralized JobMate routing guards.
// Keeps controller clean and prevents active employer flows from being rerouted.

const ACTIVE_EMPLOYER_STATES = new Set([
  "ask_business_name",
  "ask_business_name_after_ai",
  "ask_vacancy",
  "ask_vacancy_role",
  "ask_location",
  "ask_urgency",
      "ask_salary_range",
      "ask_work_type",
]);

const NON_OVERRIDABLE_INTENTS = new Set([
  "restart",
  "opt_out",
  "frustrated",
]);

export function isGenericHelpRequest(text = "") {
  const value = String(text || "").toLowerCase().trim();

  if (!value) return false;

  const hasHelpWord =
    /\bhelp\b|sahayog|sayog|madat|help gar|help garnu|gardinu/i.test(value);

  const hasClearHumanRequest =
    /human|agent|phone|call|team sanga|manche sanga|manxe sanga|staff sanga/i.test(value);

  const hasClearJobMateIntent =
    /staff|worker|kaam|kam|job|jagir|company|salary|register|apply/i.test(value);

  return hasHelpWord && !hasClearHumanRequest && !hasClearJobMateIntent;
}

export function isActiveEmployerState(state = "") {
  return ACTIVE_EMPLOYER_STATES.has(String(state || ""));
}

export function applyJobMateRoutingGuards({
  intentResult,
  aiBrain,
  conversation,
  normalized,
  env,
} = {}) {
  if (!intentResult) return intentResult;

  const text = String(
    normalized?.message?.normalizedText ||
    normalized?.message?.text ||
    ""
  ).toLowerCase().trim();

  if (isGenericHelpRequest(text)) {
    intentResult.intent = "unknown";
    intentResult.finalIntent = "unknown";
    intentResult.needsHuman = false;
    intentResult.priority = "low";
    intentResult.reason = "Generic help clarification";
    intentResult.aiIntent = "unknown";

    if (aiBrain?.intentResult) {
      aiBrain.intentResult.intent = "unknown";
      aiBrain.intentResult.finalIntent = "unknown";
      aiBrain.intentResult.needsHuman = false;
      aiBrain.intentResult.priority = "low";
      aiBrain.intentResult.reason = "Generic help clarification";
    }

    return intentResult;
  }

  if (
    env?.BOT_MODE === "jobmate_hiring" &&
    isActiveEmployerState(conversation?.currentState) &&
    !NON_OVERRIDABLE_INTENTS.has(intentResult.intent)
  ) {
    intentResult.intent = "employer_lead";
    intentResult.finalIntent = "employer_lead";
    intentResult.needsHuman = false;
    intentResult.priority = "low";
    intentResult.reason = "Locked to active employer flow";

    if (aiBrain?.intentResult) {
      aiBrain.intentResult.intent = "employer_lead";
      aiBrain.intentResult.finalIntent = "employer_lead";
      aiBrain.intentResult.needsHuman = false;
      aiBrain.intentResult.priority = "low";
      aiBrain.intentResult.reason = "Locked to active employer flow";
    }

    return intentResult;
  }

  return intentResult;
}
