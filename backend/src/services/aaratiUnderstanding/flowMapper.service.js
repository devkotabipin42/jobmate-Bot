export function mapUnderstandingToFlow({
  interpretation = {},
  scopeResult = {},
} = {}) {
  const intent = interpretation.possibleIntent || "unclear";

  if (scopeResult.scope === "outside_jobmate" || scopeResult.scope === "risky_or_disallowed") {
    return {
      action: "boundary",
      mappedFlow: "boundary_reply",
      reason: scopeResult.reason,
    };
  }

  if (scopeResult.scope === "unclear_needs_clarification") {
    return {
      action: "clarify",
      mappedFlow: "boundary_reply",
      reason: "unclear_needs_clarification",
    };
  }

  if (intent === "worker_registration") {
    return {
      action: "start_flow",
      mappedFlow: "worker_registration",
      reason: "understanding_worker_registration",
    };
  }

  if (intent === "employer_lead") {
    return {
      action: "start_flow",
      mappedFlow: "employer_lead",
      reason: "understanding_employer_lead",
    };
  }

  if (intent === "job_search") {
    return {
      action: "start_flow",
      mappedFlow: "job_search",
      reason: "understanding_job_search",
    };
  }

  if (intent.startsWith("support_") || intent === "support_answer") {
    return {
      action: "reply_only",
      mappedFlow: "support_answer",
      reason: intent,
    };
  }

  return {
    action: "clarify",
    mappedFlow: "boundary_reply",
    reason: "unmapped_understanding",
  };
}
