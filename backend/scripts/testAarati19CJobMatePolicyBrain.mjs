/**
 * AARATI-19C — Meaning-Based JobMate Policy Brain Tests
 *
 * Philosophy: test meaning groups, not exact phrases.
 * Same meaning expressed differently must produce the same category.
 * Grouping:
 *   A. Unfair hiring — different words, same forbidden meaning
 *   B. "khana" disambiguation — food-talk vs food-only pay vs hotel job
 *   C. Referential forbidden — context chain
 *   D. Location boundary — Nepal region vs foreign country
 *   E. Out-of-scope vs valid IT job search
 *   F. Document-state interrupt — preserveState=true, preserveCollectedData=true
 *   G. Stale data reset — clearCollectedFields when role changes
 *   H. Availability persistence — mapAvailabilityEnum valid enums
 *
 * Pure unit tests — no DB, no WhatsApp, no AI call.
 * Minimum 40 assertions across 8 groups.
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
// A. UNFAIR HIRING — different words, same forbidden meaning
// ============================================================
section("A. Unfair hiring — different words, same forbidden meaning");

const unfairCases = [
  // Food-only compensation variants
  "khana matra diye hunxa worker lai",
  "bas khana diye pugne worker cha",
  "khana basna diye salary nadida hunxa",
  "paisa nadine khana matra worker chaiyo",
  // Salary-deferred / unpaid trial (NEW 19C)
  "salary paxi dinxu tara pahila kaam garos",
  "paila kaam garos pachi paisa dinchu",
  "trial ma kaam garos paisa pachi herna",
  "1 mahina free ma kaam garos",
  // Existing fair-labor violations still caught
  "free ma kam garne worker cha",
  "trial ko paisa nadida hunxa",
];

for (const text of unfairCases) {
  const d = decide(text);
  assert(
    `"${text.slice(0, 55)}" → forbidden_employer_request`,
    d.category === "forbidden_employer_request",
    `got: ${d.category}`
  );
  assert(`"${text.slice(0, 40)}" → bypassFlow`, d.bypassFlow);
  assert(`"${text.slice(0, 40)}" → blockEmployerFlow`, d.blockEmployerFlow);
  assert(
    `"${text.slice(0, 40)}" → reply has legal/fair salary`,
    /legal|fair salary|salary range|unpaid|illegal/i.test(d.reply || ""),
    `reply: ${(d.reply || "").slice(0, 80)}`
  );
  assert(
    `"${text.slice(0, 40)}" → reply has NO pricing plan leak`,
    !/NPR 499|NPR 999|basic plan/i.test(d.reply || "")
  );
}

// ============================================================
// B. "khana" DISAMBIGUATION
// ============================================================
section('B. "khana" disambiguation — food-talk vs food-only pay vs hotel job');

// 1. "khana khayau" → small talk, never forbidden
const b1 = decide("khana khayau");
assert(
  '"khana khayau" → small_talk_boundary (NOT forbidden)',
  b1.category === "small_talk_boundary",
  `got: ${b1.category}`
);
assert('"khana khayau" → bypassFlow', b1.bypassFlow);

// 2. "khana khayau ani Butwal ma job cha" → NOT forbidden
const b2 = decide("khana khayau ani Butwal ma job cha");
assert(
  '"khana khayau + Butwal job" → NOT forbidden',
  b2.category !== "forbidden_employer_request",
  `got: ${b2.category}`
);

// 3. Hotel cook job WITH salary → valid flow (not forbidden)
const b3 = decide("hotel ma cook job cha Butwal ma salary sanga");
assert(
  '"hotel cook job Butwal salary sanga" → valid (NOT forbidden)',
  b3.category !== "forbidden_employer_request",
  `got: ${b3.category}`
);

// 4. "restaurant ma job cha" → valid job search (no violation keyword)
const b4 = decide("restaurant ma job cha bhardaghat ma");
assert(
  '"restaurant ma job cha bhardaghat ma" → NOT forbidden',
  b4.category !== "forbidden_employer_request",
  `got: ${b4.category}`
);

// ============================================================
// C. REFERENTIAL FORBIDDEN — context chain
// ============================================================
section("C. Referential forbidden — context chain after blocked message");

const refCases = [
  "malai testai chaiyo",
  "tei chaiyo",
  "ho tei",
  "tyo type ko",
  "same type chaiyo",
];

for (const text of refCases) {
  const d = decide(text, { lastBlocked: "forbidden_employer_request" });
  assert(
    `"${text}" (after forbidden block) → referential_forbidden_request`,
    d.category === "referential_forbidden_request",
    `got: ${d.category}`
  );
  assert(`"${text}" → bypassFlow`, d.bypassFlow);
  assert(`"${text}" → blockEmployerFlow`, d.blockEmployerFlow);
  assert(
    `"${text}" → reply has unpaid/illegal/salary`,
    /unpaid|illegal|salary/i.test(d.reply || ""),
    `reply: ${(d.reply || "").slice(0, 80)}`
  );
}

// Triggered via prevUser context (no explicit lastBlocked)
const c_prevUser = decide("tei chaiyo", {
  prevUser: "khana matra diye hunxa worker lai",
  lastBlocked: "",
});
assert(
  '"tei chaiyo" (prevUser food-only forbidden) → referential_forbidden_request',
  c_prevUser.category === "referential_forbidden_request",
  `got: ${c_prevUser.category}`
);

// ============================================================
// D. LOCATION BOUNDARY — Nepal region vs foreign country
// ============================================================
section("D. Location boundary — Lumbini/Nepal vs out-of-region vs foreign");

// Out-of-region Nepal cities → out_of_region_location
const d1 = decide("Kathmandu ma driver job cha");
assert(
  '"Kathmandu ma driver job" → out_of_region_location',
  d1.category === "out_of_region_location",
  `got: ${d1.category}`
);
assert('"Kathmandu" → bypassFlow', d1.bypassFlow);
assert('"Kathmandu" → blockLocationExtraction', d1.blockLocationExtraction);

const d2 = decide("Pokhara ma hotel job chahiyo");
assert(
  '"Pokhara ma hotel job" → out_of_region_location',
  d2.category === "out_of_region_location",
  `got: ${d2.category}`
);

// Foreign countries (NEW 19C) → out_of_region_location
const foreignCases = [
  "Japan ma job chahiyo",
  "Osaka ma kaam milcha",
  "India ma job cha",
  "Qatar ma job chahiyo",
  "Dubai ma kaam milcha",
  "Malaysia ma job chahiyo",
];

for (const text of foreignCases) {
  const d = decide(text);
  assert(
    `"${text}" → out_of_region_location`,
    d.category === "out_of_region_location",
    `got: ${d.category}`
  );
  assert(`"${text}" → bypassFlow`, d.bypassFlow);
}

// Lumbini cities → valid (NOT out_of_region)
const d_lumbini = decide("Butwal ma driver job cha");
assert(
  '"Butwal ma driver job" → valid (NOT out_of_region)',
  d_lumbini.category !== "out_of_region_location",
  `got: ${d_lumbini.category}`
);
assert('"Butwal ma driver job" → allowFlow', d_lumbini.allowFlow === true);

// ============================================================
// E. OUT-OF-SCOPE vs VALID IT JOB SEARCH
// ============================================================
section("E. Out-of-scope service vs valid IT job search in Lumbini");

// "website banau" → out_of_scope
const e1 = decide("can you make my website");
assert(
  '"can you make my website" → out_of_scope_service',
  e1.category === "out_of_scope_service",
  `got: ${e1.category}`
);

const e2 = decide("website banai deu");
assert(
  '"website banai deu" → out_of_scope_service',
  e2.category === "out_of_scope_service",
  `got: ${e2.category}`
);

// "developer job Butwal" → valid job search (NOT out_of_scope)
const e3 = decide("developer job Butwal ma cha");
assert(
  '"developer job Butwal ma cha" → NOT out_of_scope',
  e3.category !== "out_of_scope_service",
  `got: ${e3.category}`
);
assert(
  '"developer job Butwal ma cha" → allowFlow=true',
  e3.allowFlow === true,
  `got: allowFlow=${e3.allowFlow}`
);

// "coding job Bhairahawa" → valid (NOT out_of_scope)
const e4 = decide("coding job Bhairahawa ma cha");
assert(
  '"coding job Bhairahawa ma cha" → NOT out_of_scope',
  e4.category !== "out_of_scope_service",
  `got: ${e4.category}`
);

// ============================================================
// F. DOCUMENT-STATE INTERRUPT
// ============================================================
section("F. Document state interrupt — preserveState + preserveCollectedData");

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
  assert(`"${text.slice(0, 45)}" → bypassFlow`, d.bypassFlow);
  assert(`"${text.slice(0, 45)}" → preserveState=true`, d.preserveState === true);
  assert(
    `"${text.slice(0, 45)}" → preserveCollectedData=true`,
    d.preserveCollectedData === true
  );
  assert(
    `"${text.slice(0, 45)}" → reply mentions blindly pathaudaina or comfortable`,
    /blindly pathaudaina|compulsory chaina|comfortable/i.test(d.reply || ""),
    `reply: ${(d.reply || "").slice(0, 80)}`
  );
}

// Numeric answers inside ask_documents must NOT be intercepted
const f_num1 = decide("1", { state: docState });
assert(
  '"1" in ask_documents → NOT document_privacy_interrupt',
  f_num1.category !== "document_privacy_interrupt",
  `got: ${f_num1.category}`
);
assert('"1" in ask_documents → bypassFlow=false', !f_num1.bypassFlow);

// ============================================================
// G. STALE DATA RESET — clearCollectedFields when role changes
// ============================================================
section("G. Stale data reset — clearCollectedFields when job role changes");

// Old stored jobType = "Hospitality/Cook", new search = developer Butwal
const g1 = decide("developer job Butwal ma cha", {
  collectedData: { jobType: "Hospitality", location: "Bardaghat" },
});
assert(
  '"developer Butwal" with old Hospitality → valid_job_search',
  g1.category === "valid_job_search",
  `got: ${g1.category}`
);
assert(
  '"developer Butwal" with old Hospitality → clearCollectedFields is array',
  Array.isArray(g1.clearCollectedFields),
  `got: ${JSON.stringify(g1.clearCollectedFields)}`
);
assert(
  '"developer Butwal" → clearCollectedFields includes jobType',
  g1.clearCollectedFields?.includes("jobType"),
  `got: ${JSON.stringify(g1.clearCollectedFields)}`
);
assert(
  '"developer Butwal" → clearCollectedFields includes category',
  g1.clearCollectedFields?.includes("category")
);

// Old stored jobType = "driver", new search = hotel cook Butwal
const g2 = decide("hotel ma cook job cha Butwal", {
  collectedData: { jobType: "driver", location: "Butwal" },
});
assert(
  '"hotel cook Butwal" with old driver → valid_job_search',
  g2.category === "valid_job_search",
  `got: ${g2.category}`
);
assert(
  '"hotel cook Butwal" → clearCollectedFields is array',
  Array.isArray(g2.clearCollectedFields),
  `got: ${JSON.stringify(g2.clearCollectedFields)}`
);

// Same role → no stale data reset
const g3 = decide("hotel job Butwal ma cha", {
  collectedData: { jobType: "Hospitality/Cook", location: "Butwal" },
});
assert(
  '"hotel Butwal" with old Hospitality/Cook → clearCollectedFields=null',
  g3.clearCollectedFields === null,
  `got: ${JSON.stringify(g3.clearCollectedFields)}`
);

// No previous stored data → clearCollectedFields=null
const g4 = decide("driver job Butwal ma cha", {
  collectedData: {},
});
assert(
  '"driver Butwal" with no stored data → clearCollectedFields=null',
  g4.clearCollectedFields === null,
  `got: ${JSON.stringify(g4.clearCollectedFields)}`
);

// ============================================================
// H. AVAILABILITY PERSISTENCE
// ============================================================
section("H. Availability enum mapping — valid enum output for all input forms");

const VALID_AVAIL_ENUMS = [
  "immediate",
  "within_1_week",
  "within_2_weeks",
  "within_1_month",
  "not_decided",
  "unknown",
];

const availCases = [
  ["part-time", "within_1_month"],
  ["full-time", "immediate"],
  ["shift based", "within_2_weeks"],
  ["any", "not_decided"],
  ["jun sukai", "not_decided"],
  ["1", "immediate"],
  ["2", "within_2_weeks"],
  ["3", "within_1_month"],
  ["4", "not_decided"],
  ["immediate", "immediate"],
];

for (const [input, expected] of availCases) {
  const result = mapAvailabilityEnum(input);
  assert(
    `mapAvailabilityEnum("${input}") === "${expected}"`,
    result === expected,
    `got: "${result}"`
  );
}

// All outputs must be valid enum values
const variedInputs = [
  "part time",
  "fulltime",
  "shift-based",
  "din bhar",
  "aadha din",
  "within_2_weeks",
];
for (const input of variedInputs) {
  const result = mapAvailabilityEnum(input);
  assert(
    `mapAvailabilityEnum("${input}") returns valid enum`,
    VALID_AVAIL_ENUMS.includes(result),
    `got: "${result}"`
  );
}

// ============================================================
// Summary
// ============================================================
console.log(`\n${"═".repeat(60)}`);
console.log(`AARATI-19C Tests: ${passed} passed, ${failed} failed`);
console.log(`${"═".repeat(60)}`);

if (failed > 0) process.exit(1);
