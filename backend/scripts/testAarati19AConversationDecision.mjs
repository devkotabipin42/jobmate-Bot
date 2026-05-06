/**
 * AARATI-19A — Conversation-Aware Decision Engine Tests
 *
 * Pure unit tests — no DB, no WhatsApp, no AI call.
 * Minimum 40 test cases across 10 groups.
 */

import {
  decideAaratiNextAction,
  mapAvailabilityEnum,
  isInvalidLocationValue,
} from "../src/services/aarati/aaratiConversationDecision.service.js";

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

function decide(text, opts = {}) {
  return decideAaratiNextAction({
    text,
    normalizedText: "",
    conversationState: opts.state || { currentState: "idle" },
    collectedData: opts.collectedData || {},
    previousUserMessage: opts.prevUser || "",
    previousBotMessage: opts.prevBot || "",
    lastGateDecision: opts.lastGate || {},
    lastBlockedCategory: opts.lastBlocked || "",
  });
}

// ============================================================
// A. FOOD-ONLY FORBIDDEN (4 inputs)
// ============================================================
section("A. Food-only forbidden employer requests");

const foodForbiddenCases = [
  "khana matra diye hunxa worker lai",
  "bas khana diye pugne worker cha",
  "khana basna diye salary nadida hunxa",
  "paisa nadine khana matra worker chaiyo",
];

for (const text of foodForbiddenCases) {
  const d = decide(text);
  assert(
    `"${text.slice(0, 45)}" → forbidden_employer_request`,
    d.category === "forbidden_employer_request",
    `got: ${d.category}`
  );
  assert(`"${text.slice(0, 45)}" → bypassFlow`, d.bypassFlow);
  assert(`"${text.slice(0, 45)}" → blockEmployerFlow`, d.blockEmployerFlow);
  assert(`"${text.slice(0, 45)}" → blockJobSearch`, d.blockJobSearch);
  assert(`"${text.slice(0, 45)}" → reply has legal/fair salary`, /legal|fair salary|salary range/i.test(d.reply || ""));
  assert(`"${text.slice(0, 45)}" → reply has no pricing plans`, !/NPR 499|NPR 999|basic plan/i.test(d.reply || ""));
}

// ============================================================
// B. SMALL TALK DISTINCTION (2 inputs)
// ============================================================
section("B. Small talk not confused with forbidden");

const d_b5 = decide("khana khayau");
assert(
  '"khana khayau" → small_talk_boundary (NOT forbidden)',
  d_b5.category === "small_talk_boundary",
  `got: ${d_b5.category}`
);
assert('"khana khayau" → NOT forbidden_employer_request', d_b5.category !== "forbidden_employer_request");

const d_b6 = decide("khana khayau ani Butwal ma job cha");
assert(
  '"khana khayau ani Butwal ma job cha" → NOT forbidden',
  d_b6.category !== "forbidden_employer_request",
  `got: ${d_b6.category}`
);
assert(
  '"khana khayau ani Butwal ma job cha" → job search or small_talk (flow allowed or bypass only)',
  ["valid_job_search", "small_talk_boundary", "unknown_safe_fallback"].includes(d_b6.category),
  `got: ${d_b6.category}`
);

// ============================================================
// C. REFERENTIAL ILLEGAL (4 inputs — with lastBlockedCategory context)
// ============================================================
section("C. Referential illegal request after blocked forbidden");

const referentialCases = [
  "malai testai chaiyo",
  "tei chaiyo",
  "ho tei",
  "tyo type ko",
];

for (const text of referentialCases) {
  const d = decide(text, { lastBlocked: "forbidden_employer_request" });
  assert(
    `"${text}" (after forbidden block) → referential_forbidden_request`,
    d.category === "referential_forbidden_request",
    `got: ${d.category}`
  );
  assert(`"${text}" → bypassFlow`, d.bypassFlow);
  assert(`"${text}" → blockEmployerFlow`, d.blockEmployerFlow);
  assert(`"${text}" → reply has illegal/unpaid`, /unpaid|illegal|salary/i.test(d.reply || ""));
}

// Same but triggered by previousUserMessage (no explicit lastBlockedCategory)
const d_c_prev = decide("tei chaiyo", {
  prevUser: "khana matra diye hunxa worker lai",
  lastBlocked: "",
});
assert(
  '"tei chaiyo" (prevUser was food-only forbidden) → referential_forbidden_request',
  d_c_prev.category === "referential_forbidden_request",
  `got: ${d_c_prev.category}`
);

// ============================================================
// D. DOCUMENT PRIVACY INTERRUPT (5 inputs — state ask_documents)
// ============================================================
section("D. Document privacy interrupt inside ask_documents state");

const docState = { currentState: "ask_documents" };

const docInterruptCases = [
  "document jun company lai ni dinuhunxa ki k ho",
  "chha tara leak bhayo bne mero document",
  "mero document misuse huncha",
  "cv safe huncha",
  "citizenship pathauna dar lagcha",
];

for (const text of docInterruptCases) {
  const d = decide(text, { state: docState });
  assert(
    `"${text.slice(0, 50)}" → document_privacy_interrupt`,
    d.category === "document_privacy_interrupt",
    `got: ${d.category}`
  );
  assert(`"${text.slice(0, 50)}" → bypassFlow`, d.bypassFlow);
  assert(`"${text.slice(0, 50)}" → preserveState`, d.preserveState);
  assert(`"${text.slice(0, 50)}" → preserveCollectedData`, d.preserveCollectedData);
  assert(
    `"${text.slice(0, 50)}" → reply has blindly pathaudaina / compulsory chaina`,
    /blindly pathaudaina|compulsory chaina|comfortable/i.test(d.reply || ""),
    `reply: ${(d.reply || "").slice(0, 80)}`
  );
}

// ============================================================
// E. DOCUMENT CHOICES STILL WORK (3 inputs)
// ============================================================
section("E. Numeric document choices flow through (not intercepted)");

// These should NOT be caught as document_privacy_interrupt — they are valid answers
const d_e1 = decide("1", { state: docState });
assert(
  '"1" in ask_documents → NOT document_privacy_interrupt',
  d_e1.category !== "document_privacy_interrupt",
  `got: ${d_e1.category}`
);
assert('"1" → bypassFlow=false (flow continues)', !d_e1.bypassFlow);

const d_e2 = decide("2", { state: docState });
assert(
  '"2" in ask_documents → NOT document_privacy_interrupt',
  d_e2.category !== "document_privacy_interrupt",
  `got: ${d_e2.category}`
);

const d_e3 = decide("3", { state: docState });
assert(
  '"3" in ask_documents → NOT document_privacy_interrupt',
  d_e3.category !== "document_privacy_interrupt",
  `got: ${d_e3.category}`
);

// ============================================================
// F. RECHECK GUARD (2 inputs with existing collectedData)
// ============================================================
section("F. Recheck command — never saved as location");

const recheckData = { location: "Bardaghat", jobType: "Hospitality", availability: "part-time" };

const d_f1 = decide("recheck", { collectedData: recheckData });
assert('"recheck" → recheck_command', d_f1.category === "recheck_command", `got: ${d_f1.category}`);
assert('"recheck" → bypassFlow', d_f1.bypassFlow);
assert('"recheck" → blockLocationExtraction', d_f1.blockLocationExtraction);
assert('"recheck" → preserveCollectedData', d_f1.preserveCollectedData);
assert(
  '"recheck" → reply mentions existing Bardaghat location',
  /bardaghat/i.test(d_f1.reply || ""),
  `reply: ${(d_f1.reply || "").slice(0, 100)}`
);
assert(
  '"recheck" → reply says recheck not saved as location',
  /recheck.*location|location.*recheck/i.test(d_f1.reply || ""),
  `reply: ${(d_f1.reply || "").slice(0, 120)}`
);

const d_f2 = decide("feri check gara", { collectedData: recheckData });
assert('"feri check gara" → recheck_command', d_f2.category === "recheck_command", `got: ${d_f2.category}`);
assert('"feri check gara" → blockLocationExtraction', d_f2.blockLocationExtraction);
assert('"feri check gara" → preserveCollectedData', d_f2.preserveCollectedData);

// ============================================================
// G. DATA INTEGRITY (4 checks)
// ============================================================
section("G. Data integrity — invalid location values");

assert('"recheck" is invalid location', isInvalidLocationValue("recheck"));
assert('"hello" is invalid location', isInvalidLocationValue("hello"));
assert('"Bardaghat" is NOT invalid location', !isInvalidLocationValue("Bardaghat"));
assert(
  '"recheck" with existing location Bardaghat → recheck preserves location (not overwritten)',
  (() => {
    const d = decide("recheck", { collectedData: { location: "Bardaghat", jobType: "driver" } });
    return d.category === "recheck_command" && d.preserveCollectedData === true;
  })()
);

// ============================================================
// H. AVAILABILITY MAPPING (4 checks)
// ============================================================
section("H. Availability enum mapping");

const VALID_AVAIL_ENUMS = ["immediate", "within_1_week", "within_2_weeks", "within_1_month", "not_decided", "unknown"];

assert(
  'mapAvailabilityEnum("part-time") returns valid enum',
  VALID_AVAIL_ENUMS.includes(mapAvailabilityEnum("part-time")),
  `got: ${mapAvailabilityEnum("part-time")}`
);
assert(
  'mapAvailabilityEnum("full-time") returns valid enum',
  VALID_AVAIL_ENUMS.includes(mapAvailabilityEnum("full-time")),
  `got: ${mapAvailabilityEnum("full-time")}`
);
assert(
  'mapAvailabilityEnum("shift based") returns valid enum',
  VALID_AVAIL_ENUMS.includes(mapAvailabilityEnum("shift based")),
  `got: ${mapAvailabilityEnum("shift based")}`
);
assert(
  'mapAvailabilityEnum("any") returns not_decided',
  mapAvailabilityEnum("any") === "not_decided",
  `got: ${mapAvailabilityEnum("any")}`
);

// When interrupt occurs with collectedData.availability set, it is preserved
const d_h_avail = decide("cv safe huncha", {
  state: docState,
  collectedData: { availability: "part-time", location: "Bardaghat" },
});
assert(
  'document interrupt with collectedData.availability=part-time → preserveCollectedData',
  d_h_avail.preserveCollectedData === true
);
assert(
  'document interrupt → does NOT overwrite availability via allowFlow',
  !d_h_avail.allowFlow
);

// ============================================================
// I. EXISTING VALID FLOWS — not blocked (5 inputs)
// ============================================================
section("I. Existing valid flows not blocked");

assert(
  '"can you provide me staff" → valid_employer_hiring',
  decide("can you provide me staff").category === "valid_employer_hiring"
);
assert(
  '"Butwal ma driver job cha" → valid_job_search',
  decide("Butwal ma driver job cha").category === "valid_job_search"
);
assert(
  '"kam chaiyo bhardaghat ma" → valid_job_search or valid_worker_registration',
  ["valid_job_search", "valid_worker_registration"].includes(decide("kam chaiyo bhardaghat ma").category),
  `got: ${decide("kam chaiyo bhardaghat ma").category}`
);
assert(
  '"malai staff chahiyo" → valid_employer_hiring',
  decide("malai staff chahiyo").category === "valid_employer_hiring"
);
assert(
  '"Butwal ma driver job cha" → allowFlow=true',
  decide("Butwal ma driver job cha").allowFlow === true
);

// ============================================================
// J. REGRESSION EDGE CASES (7 inputs)
// ============================================================
section("J. Regression edge cases");

assert(
  '"free ma kam garne worker cha" → forbidden_employer_request',
  decide("free ma kam garne worker cha").category === "forbidden_employer_request"
);
assert(
  '"trial ko paisa nadida hunxa" → forbidden_employer_request',
  decide("trial ko paisa nadida hunxa").category === "forbidden_employer_request"
);
assert(
  '"age 16 ko helper chaiyo" → forbidden_employer_request',
  decide("age 16 ko helper chaiyo").category === "forbidden_employer_request"
);
assert(
  '"can you make my website" → out_of_scope_service',
  decide("can you make my website").category === "out_of_scope_service"
);
assert(
  '"ma cv patauna dar lagxa" → cv_privacy_support',
  ["cv_privacy_support", "document_privacy_interrupt"].includes(decide("ma cv patauna dar lagxa").category),
  `got: ${decide("ma cv patauna dar lagxa").category}`
);
assert(
  '"kina bujdainau" → frustration_or_insult',
  decide("kina bujdainau").category === "frustration_or_insult"
);
assert(
  '"timro kam k ho" → identity_capability',
  decide("timro kam k ho").category === "identity_capability"
);

// ============================================================
// Summary
// ============================================================
console.log(`\n${"═".repeat(55)}`);
console.log(`AARATI-19A Tests: ${passed} passed, ${failed} failed`);
console.log(`${"═".repeat(55)}`);

if (failed > 0) process.exit(1);
