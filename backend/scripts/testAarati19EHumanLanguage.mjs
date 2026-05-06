/**
 * AARATI-19E — Name Memory, Joined-Location Tokenizer, Human Clarification Brain
 *
 * Groups:
 *   A. Name memory — intro detection, save, reply personalization
 *   B. Joined location tokenizer — pokharama, kathmanduma, butwalma, bhargatma, japanma
 *   C. Hesitation / refusal to share details
 *   D. Teacher / school ambiguity → employer vs jobseeker vs clarification
 *   E. Regression — existing behaviour unchanged
 *
 * Pure unit tests — no DB, no WhatsApp, no AI.
 */

import {
  decideAaratiNextAction,
} from "../src/services/aarati/aaratiConversationDecision.service.js";

import {
  extractNameFromIntro,
  isAaratiHesitationText,
} from "../src/services/aarati/aaratiTextNormalizer.service.js";

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
// A. NAME MEMORY
// ============================================================
section("A. Name memory — intro detection and reply personalization");

// A1: "My name is bharat devkota"
const a1 = decide("My name is bharat devkota");
assert('"My name is bharat devkota" → name_capture', a1.category === "name_capture", `got: ${a1.category}`);
assert('"My name is bharat devkota" → extractedName = Bharat Devkota', a1.extractedName === "Bharat Devkota", `got: "${a1.extractedName}"`);
assert('"My name is bharat devkota" → bypassFlow', a1.bypassFlow === true);
assert('"My name is bharat devkota" → reply includes Bharat ji', /bharat ji/i.test(a1.reply || ""), `reply: ${(a1.reply || "").slice(0, 80)}`);
assert('"My name is bharat devkota" → reply includes dhanyabaad', /dhanyabaad/i.test(a1.reply || ""));

// A2: "mero naam sujata ho"
const a2 = decide("mero naam sujata ho");
assert('"mero naam sujata ho" → name_capture', a2.category === "name_capture", `got: ${a2.category}`);
assert('"mero naam sujata ho" → extractedName = Sujata', a2.extractedName === "Sujata", `got: "${a2.extractedName}"`);
assert('"mero naam sujata ho" → reply includes Sujata ji', /sujata ji/i.test(a2.reply || ""), `reply: ${(a2.reply || "").slice(0, 80)}`);

// A3: extractNameFromIntro unit — valid multi-word English
assert('extractNameFromIntro("I am Bikash Thapa") = "Bikash Thapa"', extractNameFromIntro("I am Bikash Thapa") === "Bikash Thapa", `got: "${extractNameFromIntro("I am Bikash Thapa")}"`);

// A4: extractNameFromIntro must NOT return noise names
assert('extractNameFromIntro("my name is test") = null', extractNameFromIntro("my name is test") === null, `got: "${extractNameFromIntro("my name is test")}"`);
assert('extractNameFromIntro("my name is admin") = null', extractNameFromIntro("my name is admin") === null);

// A5: single-word job role must not be captured as name with "ma X ho"
assert('extractNameFromIntro("ma driver ho") = null', extractNameFromIntro("ma driver ho") === null, `got: "${extractNameFromIntro("ma driver ho")}"`);

// A6: invalid phone-like input must not be captured
assert('extractNameFromIntro("my name is 9842000000") = null', extractNameFromIntro("my name is 9842000000") === null);

// A7: name already saved — do NOT capture again (do not bypass)
const a7 = decide("My name is bharat devkota", {
  state: { currentState: "idle", metadata: { displayName: "Bharat Devkota" } },
});
assert(
  '"My name is bharat devkota" with existing displayName → NOT name_capture (no re-prompt)',
  a7.category !== "name_capture",
  `got: ${a7.category}`
);

// A8: After name saved, forbidden reply uses Bharat ji (not Mitra ji)
const a8 = decide("khana matra diye hunxa worker lai", {
  state: { currentState: "idle", metadata: { displayName: "Bharat Devkota" } },
});
assert(
  'forbidden reply with displayName=Bharat Devkota → contains "Bharat ji"',
  /bharat ji/i.test(a8.reply || ""),
  `reply: ${(a8.reply || "").slice(0, 100)}`
);
assert(
  'forbidden reply with displayName → does NOT say "Mitra ji"',
  !/mitra ji/i.test(a8.reply || ""),
  `reply: ${(a8.reply || "").slice(0, 100)}`
);

// ============================================================
// B. JOINED LOCATION TOKENIZER
// ============================================================
section("B. Joined location tokenizer — attached postpositions");

// B1: "Pokharama kam painchha" → out_of_region
const b1 = decide("Pokharama kam painchha");
assert('"Pokharama kam painchha" → out_of_region_location', b1.category === "out_of_region_location", `got: ${b1.category}`);
assert('"Pokharama kam painchha" → bypassFlow', b1.bypassFlow);
assert('"Pokharama kam painchha" → blockLocationExtraction', b1.blockLocationExtraction);

// B2: "kathmanduma marketing job cha" → out_of_region
const b2 = decide("kathmanduma marketing job cha");
assert('"kathmanduma marketing job cha" → out_of_region_location', b2.category === "out_of_region_location", `got: ${b2.category}`);

// B3: "japanma kaam cha" → out_of_region (foreign)
const b3 = decide("japanma kaam cha");
assert('"japanma kaam cha" → out_of_region_location', b3.category === "out_of_region_location", `got: ${b3.category}`);

// B4: "butwalma driver job cha" → valid_job_search (Lumbini)
const b4 = decide("butwalma driver job cha");
assert('"butwalma driver job cha" → valid_job_search', b4.category === "valid_job_search", `got: ${b4.category}`);
assert('"butwalma driver job cha" → allowFlow', b4.allowFlow === true);

// B5: "butwlma driver job cha" (typo) → valid_job_search
const b5 = decide("butwlma driver job cha");
assert('"butwlma driver job cha" → valid_job_search', b5.category === "valid_job_search", `got: ${b5.category}`);

// B6: "bhargatma kaam chaiyo" (typo for bardaghat) → valid_job_search
const b6 = decide("bhargatma kaam chaiyo");
assert('"bhargatma kaam chaiyo" → valid_job_search', b6.category === "valid_job_search", `got: ${b6.category}`);

// B7: "schoolko lagi teacher painchha" → ambiguous clarification
const b7 = decide("schoolko lagi teacher painchha");
assert('"schoolko lagi teacher painchha" → ambiguous_teacher_school_clarification', b7.category === "ambiguous_teacher_school_clarification", `got: ${b7.category}`);
assert('"schoolko lagi teacher" → bypassFlow', b7.bypassFlow);
assert('"schoolko lagi teacher" → reply has 2 numbered options', /1\.|2\./i.test(b7.reply || ""), `reply: ${(b7.reply || "").slice(0, 120)}`);

// B8: "khana khayau ani butwalma driver job cha" → valid_job_search (NOT small talk)
const b8 = decide("khana khayau ani butwalma driver job cha");
assert('"khana khayau + butwalma driver job" → valid_job_search (not small talk)', b8.category === "valid_job_search", `got: ${b8.category}`);
assert('"khana khayau + butwalma driver job" → allowFlow', b8.allowFlow === true);

// ============================================================
// C. HESITATION / REFUSAL
// ============================================================
section("C. Hesitation — respectful reply, preserve state");

// C1: plain hesitation
const c1 = decide("Ma detail pathauna sakdina");
assert('"Ma detail pathauna sakdina" → hesitation_privacy', c1.category === "hesitation_privacy", `got: ${c1.category}`);
assert('"Ma detail pathauna sakdina" → bypassFlow', c1.bypassFlow);
assert('"Ma detail pathauna sakdina" → preserveCollectedData', c1.preserveCollectedData === true);
assert('"Ma detail pathauna sakdina" → reply has no pressure (pressure chaina)', /pressure chaina|comfortable/i.test(c1.reply || ""), `reply: ${(c1.reply || "").slice(0, 100)}`);

// C2: inside ask_documents flow → preserveState
const c2 = decide("aile pathaudina", { state: { currentState: "ask_documents" } });
assert('"aile pathaudina" in ask_documents → hesitation_privacy', c2.category === "hesitation_privacy", `got: ${c2.category}`);
assert('"aile pathaudina" → preserveState=true (in flow)', c2.preserveState === true);

// C3: "dar lagcha" alone
const c3 = decide("dar lagcha");
assert('"dar lagcha" → hesitation_privacy', c3.category === "hesitation_privacy", `got: ${c3.category}`);

// C4: isAaratiHesitationText unit tests
assert('isAaratiHesitationText("Ma detail pathauna sakdina") = true', isAaratiHesitationText("Ma detail pathauna sakdina"));
assert('isAaratiHesitationText("aile pathaudina") = true', isAaratiHesitationText("aile pathaudina"));
assert('isAaratiHesitationText("private ho") = true', isAaratiHesitationText("private ho"));
assert('isAaratiHesitationText("butwal ma driver job cha") = false', !isAaratiHesitationText("butwal ma driver job cha"));

// ============================================================
// D. TEACHER / SCHOOL CLARIFICATION
// ============================================================
section("D. Teacher/school — employer vs jobseeker vs ambiguous");

// D1: "school ko lagi teacher staff chahiyo" → employer
const d1 = decide("school ko lagi teacher staff chahiyo");
assert('"school ko lagi teacher staff chahiyo" → valid_employer_hiring', d1.category === "valid_employer_hiring", `got: ${d1.category}`);
assert('"school ko lagi teacher staff chahiyo" → allowFlow', d1.allowFlow === true);

// D2: "malai teacher job chahiyo butwalma" → jobseeker
const d2 = decide("malai teacher job chahiyo butwalma");
assert('"malai teacher job chahiyo butwalma" → valid_job_search', d2.category === "valid_job_search", `got: ${d2.category}`);
assert('"malai teacher job chahiyo" → allowFlow', d2.allowFlow === true);

// D3: "school ma teacher job cha?" → jobseeker
const d3 = decide("school ma teacher job cha?");
assert('"school ma teacher job cha?" → valid_job_search', d3.category === "valid_job_search", `got: ${d3.category}`);

// D4: ambiguous — "teacher paincha?" → clarification
const d4 = decide("teacher paincha?");
assert('"teacher paincha?" → ambiguous_teacher_school_clarification', d4.category === "ambiguous_teacher_school_clarification", `got: ${d4.category}`);

// D5: ambiguous reply includes both options
assert('"teacher paincha?" reply has option 1 and 2', /1\..*2\./s.test(d4.reply || ""), `reply: ${(d4.reply || "").slice(0, 160)}`);

// D6: "teacher chahiyo" alone (no staff keyword, no malai) → ambiguous
const d6 = decide("teacher chahiyo");
assert('"teacher chahiyo" → ambiguous_teacher_school_clarification', d6.category === "ambiguous_teacher_school_clarification", `got: ${d6.category}`);

// ============================================================
// E. REGRESSION
// ============================================================
section("E. Regression — 19A/19C behaviour unchanged");

// E1: food-only forbidden
assert(
  '"khana matra diye hunxa worker lai" → forbidden_employer_request',
  decide("khana matra diye hunxa worker lai").category === "forbidden_employer_request"
);

// E2: referential forbidden after lastBlocked
assert(
  '"malai testai chaiyo" (after forbidden) → referential_forbidden_request',
  decide("malai testai chaiyo", { lastBlocked: "forbidden_employer_request" }).category === "referential_forbidden_request"
);

// E3: out_of_scope
assert(
  '"can you make website" → out_of_scope_service',
  decide("can you make my website").category === "out_of_scope_service"
);

// E4: salary-deferred forbidden (19C)
assert(
  '"salary paxi dinxu" → forbidden_employer_request',
  decide("salary paxi dinxu tara pahila kaam garos").category === "forbidden_employer_request"
);

// E5: Japan foreign location (19C)
assert(
  '"Japan ma job chahiyo" → out_of_region_location',
  decide("Japan ma job chahiyo").category === "out_of_region_location"
);

// E6: valid Lumbini job search
assert(
  '"Butwal ma driver job cha" → valid_job_search',
  decide("Butwal ma driver job cha").category === "valid_job_search"
);

// E7: valid employer hiring
assert(
  '"can you provide me staff" → valid_employer_hiring',
  decide("can you provide me staff").category === "valid_employer_hiring"
);

// E8: stale data cleared on role change (19C)
const e8 = decide("developer job Butwal ma cha", { collectedData: { jobType: "Hospitality" } });
assert(
  '"developer Butwal" with old Hospitality → clearCollectedFields is array',
  Array.isArray(e8.clearCollectedFields)
);

// ============================================================
// Summary
// ============================================================
console.log(`\n${"═".repeat(60)}`);
console.log(`AARATI-19E Tests: ${passed} passed, ${failed} failed`);
console.log(`${"═".repeat(60)}`);

if (failed > 0) process.exit(1);
