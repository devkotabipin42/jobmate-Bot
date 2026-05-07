/**
 * AARATI-20A — Follow-up Reply Context Guard
 *
 * Runs at priority #2 in the routing ladder — BEFORE safety guards,
 * classifyIntent, employer parser, Mapbox, and location resolver.
 *
 * Responsibility:
 *   When conversation.metadata.awaitingFollowupReply === true, intercept
 *   the user's reply and route it to the correct follow-up handler instead
 *   of letting the employer parser or any other classifier see a bare "1".
 *
 * Pure function — no DB calls, no async.
 * Caller saves metadataPatch and sends replyText.
 *
 * Export:
 *   decideFollowupReplyContext({ text, phone, conversation })
 *   → { shouldHandle, replyText, metadataPatch, nextState, clearFollowupContext, reason }
 *
 * TODO AARATI-20B: Add flow-switch authority — clearEmployerState() / clearWorkerState()
 *   for cases like: user was in employer flow then says "Butwal ma driver job cha?"
 *   Requires surgical pruning of flow-specific metadata while preserving warm/safety memory.
 */

// ── Option matchers for candidate_reengagement ────────────────────────────
const REENGAGEMENT_OPT_1 =
  /^(1|yes|y|ho|hajur|job khojdai chu|khojdai chu)$/i;
const REENGAGEMENT_OPT_2 =
  /^(2|no|n|haina|pardaina|chaina|aile pardaina)$/i;
const REENGAGEMENT_OPT_3 =
  /^(3|update|location|job type|change|location update|job update)$/i;

// ── Utility: convert flat key/value map → MongoDB dot-notation patch ──────
function buildMetaPatch(fields) {
  const patch = {};
  for (const [key, value] of Object.entries(fields)) {
    patch[`metadata.${key}`] = value;
  }
  return patch;
}

// ── candidate_reengagement handler ───────────────────────────────────────

function handleCandidateReengagement(val) {
  if (REENGAGEMENT_OPT_1.test(val)) {
    return {
      shouldHandle: true,
      replyText:
        "Hajur, tapai ajhai job khojdai hunuhuncha bhanera note gariyo 🙏\n\n" +
        "Kun location ma kasto job khojdai hunuhuncha?\n" +
        "Example: Butwal ma driver job, Bardaghat ma frontend job",
      metadataPatch: buildMetaPatch({
        stillLooking: true,
        awaitingFollowupReply: false,
        lastFollowupReply: "still_looking",
        followupHandledAt: new Date(),
      }),
      nextState: "awaiting_job_search_query",
      clearFollowupContext: true,
      reason: "candidate_reengagement_still_looking",
    };
  }

  if (REENGAGEMENT_OPT_2.test(val)) {
    return {
      shouldHandle: true,
      replyText:
        'Thik cha 🙏 aile job naparne bhanera note gariyo.\n' +
        'Pachi job chahiyo bhane "job khojna cha" bhanera message garnu hola.',
      metadataPatch: buildMetaPatch({
        stillLooking: false,
        awaitingFollowupReply: false,
        lastFollowupReply: "not_looking",
        followupHandledAt: new Date(),
      }),
      nextState: null,
      clearFollowupContext: true,
      reason: "candidate_reengagement_not_looking",
    };
  }

  if (REENGAGEMENT_OPT_3.test(val)) {
    return {
      shouldHandle: true,
      replyText:
        "Thik cha 🙏 location/job type update garna saknuhuncha.\n" +
        "Tapai kun location ma kasto job khojdai hunuhuncha?",
      metadataPatch: buildMetaPatch({
        stillLooking: true,
        awaitingFollowupReply: false,
        lastFollowupReply: "update_location_job_type",
        followupHandledAt: new Date(),
      }),
      nextState: "awaiting_job_search_query",
      clearFollowupContext: true,
      reason: "candidate_reengagement_update_location_job_type",
    };
  }

  return {
    shouldHandle: false,
    reason: "text_not_matching_candidate_reengagement_options",
  };
}

// ── Main export ──────────────────────────────────────────────────────────

/**
 * Inspect conversation metadata and decide whether this inbound message
 * is a reply to an active follow-up. Returns early-exit instructions if yes.
 *
 * Preserved fields (never touched by this guard):
 *   lastBlockedCategory, lastGateDecision, lastUserMessage, displayName,
 *   human handoff flags, language, safety metadata.
 */
export function decideFollowupReplyContext({ text, phone, conversation }) {
  const meta = conversation?.metadata || {};

  // ── Activation check 1: must be awaiting a follow-up reply ──────────────
  if (!meta.awaitingFollowupReply) {
    return { shouldHandle: false, reason: "no_followup_context" };
  }

  // ── Activation check 2: must be a jobmate follow-up source ──────────────
  if (meta.followupSource !== "jobmate_followup") {
    return { shouldHandle: false, reason: "wrong_followup_source" };
  }

  // ── Activation check 3: must not be expired ─────────────────────────────
  if (meta.followupExpiresAt && new Date(meta.followupExpiresAt) < new Date()) {
    return { shouldHandle: false, reason: "followup_expired" };
  }

  const val = String(text || "").toLowerCase().trim();
  const followupType = String(meta.followupType || "unknown");

  // ── Route to type-specific handler ──────────────────────────────────────
  if (followupType === "candidate_reengagement") {
    return handleCandidateReengagement(val);
  }

  // ── Unknown type: acknowledge any 1/2/3 reply generically ───────────────
  if (/^[123]$/.test(val)) {
    return {
      shouldHandle: true,
      replyText:
        "Hajur, tapai ko reply note gariyo 🙏 Hamro team le follow-up garnecha.",
      metadataPatch: buildMetaPatch({
        lastFollowupReply: val,
        awaitingFollowupReply: false,
        followupHandledAt: new Date(),
      }),
      nextState: null,
      clearFollowupContext: true,
      reason: "unknown_followup_type_generic_ack",
    };
  }

  return {
    shouldHandle: false,
    reason: "text_not_matching_expected_input",
  };
}
