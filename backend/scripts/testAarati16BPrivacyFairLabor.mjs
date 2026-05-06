/**
 * AARATI-16B — Privacy, Fair Labor, and Frustration Escape Hardening
 * Pure unit tests — no DB, no WhatsApp, no AI call.
 */

import {
  isAaratiFrustrationText,
  isAaratiFairLaborViolationText,
  isAaratiCvPrivacyQuestion,
} from "../src/services/aarati/aaratiTextNormalizer.service.js";

import { getAaratiHardSafetyBoundaryAnswer } from "../src/services/aarati/aaratiHardSafetyBoundary.service.js";
import { getAaratiActiveFlowSideReply } from "../src/services/aarati/aaratiActiveFlowSideReply.service.js";
import { buildAaratiDeterministicFallback } from "../src/services/aarati/aaratiAiFirstRouter.service.js";
import { detectHumanConversationMode } from "../src/services/aarati/aaratiConversationDirector.service.js";
import { findJobMateKnowledgeAnswer } from "../src/services/rag/jobmateKnowledgeAnswer.service.js";

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

function normalized(text) {
  return { message: { text, normalizedText: text.toLowerCase() } };
}

function makeConv(overrides = {}) {
  return {
    currentState: "idle",
    currentIntent: "",
    metadata: { lastQuestion: "", collectedData: {}, ...overrides },
  };
}

function makeActiveConv(state = "ask_jobType", overrides = {}) {
  return {
    currentState: state,
    currentIntent: "",
    metadata: { lastQuestion: "", lastAskedField: "jobType", collectedData: {}, ...overrides },
  };
}

// ---------------------------------------------------------------------------
// 1. isAaratiFrustrationText — bug 3 fix: "bujdainau" without h
// ---------------------------------------------------------------------------
section("1. Frustration detector: bujdainau (no h) now caught");

assert(
  '"kina bujdainau" (no h) is caught as frustration',
  isAaratiFrustrationText("kina bujdainau")
);
assert(
  '"bujhdainau" (with h) still caught',
  isAaratiFrustrationText("bujhdainau")
);
assert(
  '"kina bujhena" still caught',
  isAaratiFrustrationText("kina bujhena")
);

// ---------------------------------------------------------------------------
// 2. isAaratiFairLaborViolationText
// ---------------------------------------------------------------------------
section("2. Fair labor violation detector");

assert(
  '"free ma kaam garne worker" detected',
  isAaratiFairLaborViolationText("free ma kaam garne worker chahiyo")
);
assert(
  '"bina paisa kaam garaunus" detected',
  isAaratiFairLaborViolationText("bina paisa kaam garaunus")
);
assert(
  '"bina salary kaam garne" detected',
  isAaratiFairLaborViolationText("bina salary kaam garne staff chahiyo")
);
assert(
  '"free worker chahiyo" detected',
  isAaratiFairLaborViolationText("free worker chahiyo")
);
assert(
  'normal "salary dine worker" → NOT flagged',
  !isAaratiFairLaborViolationText("15000 salary dine worker chahiyo")
);

// ---------------------------------------------------------------------------
// 3. isAaratiCvPrivacyQuestion
// ---------------------------------------------------------------------------
section("3. CV privacy question detector");

assert(
  '"mero cv sabai company lai dekaunu hunxa ra" detected',
  isAaratiCvPrivacyQuestion("mero cv sabai company lai dekaunu hunxa ra")
);
assert(
  '"cv sabai company lai share" detected',
  isAaratiCvPrivacyQuestion("cv sabai company lai share garna milcha?")
);
assert(
  '"cv leak" detected',
  isAaratiCvPrivacyQuestion("cv leak huncha?")
);
assert(
  'normal "cv pathaunu hola" → NOT flagged',
  !isAaratiCvPrivacyQuestion("cv pathaunu hola")
);

// ---------------------------------------------------------------------------
// 4. Hard safety boundary — CV privacy → safe privacy answer
// ---------------------------------------------------------------------------
section("4. Hard safety: CV privacy question → safe privacy reply");

const cvPrivacyResult = getAaratiHardSafetyBoundaryAnswer({
  normalized: normalized("mero cv sabai company lai dekaunu hunxa ra"),
});

assert("cv privacy returns non-null result", cvPrivacyResult !== null);
assert(
  "cv privacy detectedIntent is cv_privacy_question",
  cvPrivacyResult?.detectedIntent === "cv_privacy_question",
  cvPrivacyResult?.detectedIntent
);
assert(
  "cv privacy reply does NOT say 'sabai company lai pathauna sakchhau'",
  !/sabai company lai pathauna sakchhau/i.test(cvPrivacyResult?.reply || ""),
  cvPrivacyResult?.reply
);
assert(
  "cv privacy reply mentions permission/match based sharing",
  /permission|match bhaye matra|relevant employer/i.test(cvPrivacyResult?.reply || ""),
  cvPrivacyResult?.reply
);

// ---------------------------------------------------------------------------
// 5. Hard safety boundary — fair labor → hard refuse, no pricing
// ---------------------------------------------------------------------------
section("5. Hard safety: fair labor violation → refuse, not pricing");

const fairLaborResult = getAaratiHardSafetyBoundaryAnswer({
  normalized: normalized("free ma kaam garne worker chahiyo"),
});

assert("fair labor returns non-null result", fairLaborResult !== null);
assert(
  "fair labor detectedIntent is fair_labor_violation",
  fairLaborResult?.detectedIntent === "fair_labor_violation",
  fairLaborResult?.detectedIntent
);
assert(
  "fair labor reply does NOT show pricing plans",
  !/basic plan|premium|monthly fee|free.*ho.*plan|pricing/i.test(fairLaborResult?.reply || ""),
  fairLaborResult?.reply
);
assert(
  "fair labor reply mentions Nepal Labour Act or illegal",
  /labour act|illegal|legal salary/i.test(fairLaborResult?.reply || ""),
  fairLaborResult?.reply
);

// ---------------------------------------------------------------------------
// 6. Hard safety boundary — frustration "kina bujdainau" inside active flow
// ---------------------------------------------------------------------------
section("6. Hard safety: 'kina bujdainau' → frustration reply (no Mapbox)");

const frustResult = getAaratiHardSafetyBoundaryAnswer({
  normalized: normalized("kina bujdainau"),
});

assert("'kina bujdainau' returns non-null result", frustResult !== null);
assert(
  "detectedIntent is frustration_or_abuse",
  frustResult?.detectedIntent === "frustration_or_abuse",
  frustResult?.detectedIntent
);
assert(
  "frustration reply has apology",
  /sorry|aghi ko reply/i.test(frustResult?.reply || ""),
  frustResult?.reply
);

// ---------------------------------------------------------------------------
// 7. Active flow side reply — "cv xaina" + active jobType step
// ---------------------------------------------------------------------------
section("7. Active flow: 'cv xaina' inside ask_jobType → CV help + step reminder");

const cvXainaReply = getAaratiActiveFlowSideReply({
  text: "cv xaina",
  conversation: makeActiveConv("ask_jobType"),
});

assert("'cv xaina' inside active flow returns non-null", cvXainaReply !== null);
assert(
  "reply mentions cv/resume help",
  /cv|resume/i.test(cvXainaReply || ""),
  cvXainaReply
);
assert(
  "reply includes current step reminder (job type choices)",
  /it.*computer|driver|hotel|sales|security|helper/i.test(cvXainaReply || ""),
  cvXainaReply
);

// ---------------------------------------------------------------------------
// 8. Active flow side reply — "cv banauxau" inside ask_jobType → CV help + step
// ---------------------------------------------------------------------------
section("8. Active flow: 'cv banauxau' inside ask_jobType → CV help");

const cvBanaReply = getAaratiActiveFlowSideReply({
  text: "cv banauxau",
  conversation: makeActiveConv("ask_jobType"),
});

assert("'cv banauxau' inside active flow returns non-null", cvBanaReply !== null);
assert(
  "reply mentions cv/resume/profile",
  /cv|resume|profile/i.test(cvBanaReply || ""),
  cvBanaReply
);

// ---------------------------------------------------------------------------
// 9. Deterministic fallback — "can you make my website" → out_of_scope_tech
// ---------------------------------------------------------------------------
section("9. Deterministic fallback: 'can you make my website' → out_of_scope_tech");

const websiteResult = buildAaratiDeterministicFallback(
  "can you make my website",
  "can you make my website"
);

assert("website result is non-null", websiteResult !== null);
assert(
  "detectedIntent is out_of_scope_tech",
  websiteResult?.detectedIntent === "out_of_scope_tech",
  websiteResult?.detectedIntent
);
assert(
  "reply does NOT overclaim job listings",
  !/jobmate ma dherai job haru cha/i.test(websiteResult?.reply || ""),
  websiteResult?.reply
);
assert(
  "reply mentions out of scope",
  /scope|baahira|bahar/i.test(websiteResult?.reply || ""),
  websiteResult?.reply
);

// ---------------------------------------------------------------------------
// 10. Director — "website banauxau" → out_of_scope
// ---------------------------------------------------------------------------
section("10. Director: 'website banauxau' → out_of_scope mode");

assert(
  '"website banauxau" → out_of_scope in director',
  detectHumanConversationMode({ text: "website banauxau", conversation: makeConv() }) === "out_of_scope"
);

// ---------------------------------------------------------------------------
// 11. Knowledge answer — fair labor + CV privacy excluded from knowledge routing
// ---------------------------------------------------------------------------
section("11. Knowledge answer: fair labor + CV privacy excluded");

const fairLaborKnowledge = findJobMateKnowledgeAnswer({
  normalized: normalized("free ma kaam garne worker chahiyo"),
});
assert(
  '"free ma kaam garne worker" → null from knowledge (not routed to pricing)',
  fairLaborKnowledge === null,
  JSON.stringify(fairLaborKnowledge)
);

const cvPrivacyKnowledge = findJobMateKnowledgeAnswer({
  normalized: normalized("mero cv sabai company lai dekaunu hunxa ra"),
});
assert(
  '"mero cv sabai company" → null from knowledge',
  cvPrivacyKnowledge === null,
  JSON.stringify(cvPrivacyKnowledge)
);

// ---------------------------------------------------------------------------
// 12. Existing safety still passes — loan, "kaam chahiyo", "staff chahiyo"
// ---------------------------------------------------------------------------
section("12. Regression: existing safe paths still work");

assert(
  '"malai kaam chahiyo" is NOT flagged as fair labor violation',
  !isAaratiFairLaborViolationText("malai kaam chahiyo")
);
assert(
  '"document chaina tara kam chaiyo" → NOT flagged as CV privacy',
  !isAaratiCvPrivacyQuestion("document chaina tara kam chaiyo")
);
assert(
  '"can you provide me staff" → NOT flagged as fair labor',
  !isAaratiFairLaborViolationText("can you provide me staff")
);
assert(
  '"loan chahiyo" → NOT flagged as fair labor',
  !isAaratiFairLaborViolationText("loan chahiyo mero")
);
// Loan is handled by personalMoney guard — ensure knowledge still returns null for loan
const loanKnowledge = findJobMateKnowledgeAnswer({
  normalized: normalized("malai paisa chaiyo loan"),
});
assert(
  '"malai paisa chaiyo loan" → still null from knowledge',
  loanKnowledge === null
);

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n══════════════════════════════════════`);
console.log(`AARATI-16B Tests: ${passed} passed, ${failed} failed`);
console.log(`══════════════════════════════════════`);

if (failed > 0) process.exit(1);
