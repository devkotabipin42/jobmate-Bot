const RISKY_INTENTS = new Set([
  "risky_unpaid_labor",
  "risky_underage_worker",
  "risky_fake_documents",
  "risky_illegal_work",
]);

const OUTSIDE_INTENTS = new Set([
  "outside_service",
  "outside_entertainment",
]);

const INSIDE_INTENTS = new Set([
  "worker_registration",
  "employer_lead",
  "job_search",
  "support_answer",
  "support_job_guarantee",
  "support_worker_fee",
  "support_document_privacy",
  "support_sahakari_info",
]);

export function matchJobMateScope({ interpretation = {} } = {}) {
  const possibleIntent = interpretation.possibleIntent || "unclear";

  if (RISKY_INTENTS.has(possibleIntent)) {
    return {
      scope: "risky_or_disallowed",
      reason: possibleIntent,
    };
  }

  if (OUTSIDE_INTENTS.has(possibleIntent)) {
    return {
      scope: "outside_jobmate",
      reason: possibleIntent,
    };
  }

  if (INSIDE_INTENTS.has(possibleIntent)) {
    return {
      scope: "inside_jobmate",
      reason: possibleIntent,
    };
  }

  return {
    scope: "unclear_needs_clarification",
    reason: possibleIntent,
  };
}
