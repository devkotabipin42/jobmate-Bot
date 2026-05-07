/**
 * AARATI-20A — Follow-up Reply Context Guard Tests
 *
 * Verifies that decideFollowupReplyContext correctly intercepts numeric
 * replies when conversation is awaiting a follow-up reply, and passes
 * through all other messages unchanged.
 *
 * Groups:
 *   A. Activation checks — guard passes through when no context
 *   B. candidate_reengagement option 1 (still_looking)
 *   C. candidate_reengagement option 2 (not_looking)
 *   D. candidate_reengagement option 3 (update_location_job_type)
 *   E. Unrecognised input while awaiting reply
 *   F. Expired follow-up context
 *   G. Unknown follow-up type — generic ack for 1/2/3
 *
 * Pure unit tests — no DB, no WhatsApp.
 */

import { decideFollowupReplyContext } from "../src/services/aarati/aaratiFollowupReplyContextGuard.service.js";

let passed = 0;
let failed = 0;

function assert(label, condition, detail = "") {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

function section(title) {
  console.log(`\n── ${title} ──`);
}

/** Build a minimal conversation object with follow-up metadata */
function withFollowup(overrides = {}) {
  return {
    metadata: {
      awaitingFollowupReply: true,
      followupSource: "jobmate_followup",
      followupType: "candidate_reengagement",
      followupExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      ...overrides,
    },
  };
}

// ============================================================
// A. ACTIVATION CHECKS
// ============================================================
section("A. Activation checks — guard passes through when no context");

// No metadata at all
const a1 = decideFollowupReplyContext({ text: "1", phone: "9779800000001", conversation: {} });
assert("no metadata → shouldHandle=false", a1.shouldHandle === false, `got: ${JSON.stringify(a1)}`);
assert("no metadata → reason=no_followup_context", a1.reason === "no_followup_context", `got: ${a1.reason}`);

// awaitingFollowupReply = false
const a2 = decideFollowupReplyContext({
  text: "1",
  phone: "9779800000001",
  conversation: { metadata: { awaitingFollowupReply: false, followupSource: "jobmate_followup" } },
});
assert("awaitingFollowupReply=false → shouldHandle=false", a2.shouldHandle === false);
assert("awaitingFollowupReply=false → reason=no_followup_context", a2.reason === "no_followup_context");

// Wrong followup source
const a3 = decideFollowupReplyContext({
  text: "1",
  phone: "9779800000001",
  conversation: { metadata: { awaitingFollowupReply: true, followupSource: "other_system" } },
});
assert("wrong followupSource → shouldHandle=false", a3.shouldHandle === false);
assert("wrong followupSource → reason=wrong_followup_source", a3.reason === "wrong_followup_source");

// ============================================================
// B. candidate_reengagement — option 1 (still_looking)
// ============================================================
section("B. candidate_reengagement — option 1 (still_looking)");

const b1 = decideFollowupReplyContext({ text: "1", phone: "9779800000001", conversation: withFollowup() });
assert('"1" → shouldHandle=true', b1.shouldHandle === true);
assert('"1" → reason=candidate_reengagement_still_looking', b1.reason === "candidate_reengagement_still_looking");
assert('"1" → clearFollowupContext=true', b1.clearFollowupContext === true);
assert('"1" → nextState=awaiting_job_search_query', b1.nextState === "awaiting_job_search_query");
assert('"1" → metadataPatch clears awaitingFollowupReply', b1.metadataPatch?.["metadata.awaitingFollowupReply"] === false);
assert('"1" → metadataPatch sets stillLooking=true', b1.metadataPatch?.["metadata.stillLooking"] === true);
assert('"1" → reply has job search prompt', /kun location|kasto job/i.test(b1.replyText || ""), `reply: ${(b1.replyText || "").slice(0, 120)}`);

// Nepali alias for option 1
const b2 = decideFollowupReplyContext({ text: "ho", phone: "9779800000001", conversation: withFollowup() });
assert('"ho" → candidate_reengagement_still_looking', b2.reason === "candidate_reengagement_still_looking");

const b3 = decideFollowupReplyContext({ text: "khojdai chu", phone: "9779800000001", conversation: withFollowup() });
assert('"khojdai chu" → candidate_reengagement_still_looking', b3.reason === "candidate_reengagement_still_looking");

// ============================================================
// C. candidate_reengagement — option 2 (not_looking)
// ============================================================
section("C. candidate_reengagement — option 2 (not_looking)");

const c1 = decideFollowupReplyContext({ text: "2", phone: "9779800000001", conversation: withFollowup() });
assert('"2" → shouldHandle=true', c1.shouldHandle === true);
assert('"2" → reason=candidate_reengagement_not_looking', c1.reason === "candidate_reengagement_not_looking");
assert('"2" → clearFollowupContext=true', c1.clearFollowupContext === true);
assert('"2" → nextState=null', c1.nextState === null);
assert('"2" → metadataPatch sets stillLooking=false', c1.metadataPatch?.["metadata.stillLooking"] === false);
assert('"2" → reply acknowledges not looking', /aile job naparne|note gariyo/i.test(c1.replyText || ""), `reply: ${(c1.replyText || "").slice(0, 120)}`);

// Nepali alias
const c2 = decideFollowupReplyContext({ text: "haina", phone: "9779800000001", conversation: withFollowup() });
assert('"haina" → candidate_reengagement_not_looking', c2.reason === "candidate_reengagement_not_looking");

// ============================================================
// D. candidate_reengagement — option 3 (update_location_job_type)
// ============================================================
section("D. candidate_reengagement — option 3 (update_location_job_type)");

const d1 = decideFollowupReplyContext({ text: "3", phone: "9779800000001", conversation: withFollowup() });
assert('"3" → shouldHandle=true', d1.shouldHandle === true);
assert('"3" → reason=candidate_reengagement_update_location_job_type', d1.reason === "candidate_reengagement_update_location_job_type");
assert('"3" → clearFollowupContext=true', d1.clearFollowupContext === true);
assert('"3" → nextState=awaiting_job_search_query', d1.nextState === "awaiting_job_search_query");
assert('"3" → reply asks for location/job type update', /location|job type/i.test(d1.replyText || ""), `reply: ${(d1.replyText || "").slice(0, 120)}`);

// ============================================================
// E. Unrecognised input while awaiting reply
// ============================================================
section("E. Unrecognised input — guard yields, passes through");

const e1 = decideFollowupReplyContext({ text: "ke ho", phone: "9779800000001", conversation: withFollowup() });
assert('"ke ho" → shouldHandle=false', e1.shouldHandle === false);
assert('"ke ho" → reason=text_not_matching_candidate_reengagement_options', e1.reason === "text_not_matching_candidate_reengagement_options");

const e2 = decideFollowupReplyContext({ text: "4", phone: "9779800000001", conversation: withFollowup() });
assert('"4" (out-of-range) → shouldHandle=false', e2.shouldHandle === false);

// ============================================================
// F. Expired follow-up context
// ============================================================
section("F. Expired follow-up context");

const f1 = decideFollowupReplyContext({
  text: "1",
  phone: "9779800000001",
  conversation: withFollowup({ followupExpiresAt: new Date(Date.now() - 1000) }),
});
assert("expired context → shouldHandle=false", f1.shouldHandle === false);
assert("expired context → reason=followup_expired", f1.reason === "followup_expired");

// ============================================================
// G. Unknown follow-up type — generic ack for 1/2/3
// ============================================================
section("G. Unknown follow-up type — generic ack for 1/2/3");

const g1 = decideFollowupReplyContext({
  text: "1",
  phone: "9779800000001",
  conversation: withFollowup({ followupType: "some_future_type" }),
});
assert("unknown type + \"1\" → shouldHandle=true", g1.shouldHandle === true);
assert("unknown type + \"1\" → reason=unknown_followup_type_generic_ack", g1.reason === "unknown_followup_type_generic_ack");
assert("unknown type + \"1\" → clearFollowupContext=true", g1.clearFollowupContext === true);
assert("unknown type + \"1\" → reply acknowledges", /note gariyo|follow-up/i.test(g1.replyText || ""), `reply: ${(g1.replyText || "").slice(0, 120)}`);

const g2 = decideFollowupReplyContext({
  text: "ke ho",
  phone: "9779800000001",
  conversation: withFollowup({ followupType: "some_future_type" }),
});
assert("unknown type + unrecognised text → shouldHandle=false", g2.shouldHandle === false);
assert("unknown type + unrecognised text → reason=text_not_matching_expected_input", g2.reason === "text_not_matching_expected_input");

// ============================================================
// Summary
// ============================================================
console.log(`\n${"═".repeat(60)}`);
console.log(`AARATI-20A Tests: ${passed} passed, ${failed} failed`);
console.log(`${"═".repeat(60)}`);

if (failed > 0) process.exit(1);
