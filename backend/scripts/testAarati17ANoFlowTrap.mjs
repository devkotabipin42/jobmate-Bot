/**
 * AARATI-17A — No-Flow-Trap Gate Tests
 * Pure unit tests — no DB, no WhatsApp, no AI call.
 */

import {
  detectNoFlowTrap,
  buildNoFlowTrapReply,
  shouldBlockWorkerFlowParsing,
  shouldBlockEmployerFlowParsing,
} from "../src/services/aarati/aaratiNoFlowTrapGate.service.js";

import {
  isAaratiFairLaborViolationText,
  isAaratiUnsafeIllegalText,
} from "../src/services/aarati/aaratiTextNormalizer.service.js";

import { getAaratiHardSafetyBoundaryAnswer } from "../src/services/aarati/aaratiHardSafetyBoundary.service.js";
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

function makeConv(state = "idle", overrides = {}) {
  return {
    currentState: state,
    currentIntent: "",
    metadata: { lastQuestion: "", lastAskedField: "", collectedData: {}, ...overrides },
  };
}

function makeWorkerConv(state = "ask_jobType", overrides = {}) {
  return {
    currentState: state,
    currentIntent: "",
    metadata: { lastQuestion: "", lastAskedField: "jobType", collectedData: {}, ...overrides },
  };
}

function makeEmployerConv(state = "ask_business_name") {
  return {
    currentState: state,
    currentIntent: "",
    metadata: { lastQuestion: "", lastAskedField: "", collectedData: {} },
  };
}

// ---------------------------------------------------------------------------
// A. worker ask_jobType + "can you make my website" → blocked
// ---------------------------------------------------------------------------
section("A. worker ask_jobType + 'can you make my website'");

const convJobType = makeWorkerConv("ask_jobType");

assert(
  '"can you make my website" → shouldBlockWorkerFlowParsing=true',
  shouldBlockWorkerFlowParsing({ text: "can you make my website", conversation: convJobType })
);
assert(
  '"can you make my website" → detectNoFlowTrap=out_of_scope',
  detectNoFlowTrap({ text: "can you make my website", conversation: convJobType }) === "out_of_scope"
);
const websiteReply = buildNoFlowTrapReply({
  trap: "out_of_scope",
  conversation: convJobType,
});
assert(
  "reply mentions JobMate scope",
  /scope|baahira/i.test(websiteReply),
  websiteReply
);
assert(
  "reply includes jobType reminder",
  /IT.*Computer|Driver|Hotel|Sales|Security|Helper/i.test(websiteReply),
  websiteReply
);

// ---------------------------------------------------------------------------
// B. worker ask_jobType + "can you write love letter" → blocked
// ---------------------------------------------------------------------------
section("B. worker ask_jobType + 'can you write love letter'");

assert(
  '"can you write love letter" → shouldBlockWorkerFlowParsing=true',
  shouldBlockWorkerFlowParsing({ text: "can you write love letter", conversation: convJobType })
);
assert(
  '"can you write love letter" → detectNoFlowTrap=out_of_scope',
  detectNoFlowTrap({ text: "can you write love letter", conversation: convJobType }) === "out_of_scope"
);

// ---------------------------------------------------------------------------
// C. worker ask_jobType + "cv banauxau" → cv_help trap
// ---------------------------------------------------------------------------
section("C. worker ask_jobType + 'cv banauxau'");

assert(
  '"cv banauxau" → shouldBlockWorkerFlowParsing=true',
  shouldBlockWorkerFlowParsing({ text: "cv banauxau", conversation: convJobType })
);
assert(
  '"cv banauxau" → detectNoFlowTrap=cv_help',
  detectNoFlowTrap({ text: "cv banauxau", conversation: convJobType }) === "cv_help"
);
const cvHelpReply = buildNoFlowTrapReply({ trap: "cv_help", conversation: convJobType });
assert("cv_help reply mentions profile/cv", /cv|resume|profile/i.test(cvHelpReply));
assert("cv_help reply includes jobType reminder", /IT.*Computer|Driver|Hotel|Sales|Security|Helper/i.test(cvHelpReply));

// ---------------------------------------------------------------------------
// D. worker ask_documents + "ma cv patauna dar lagyo" → cv_privacy trap
// ---------------------------------------------------------------------------
section("D. worker ask_documents + 'ma cv patauna dar lagyo'");

const convDocs = makeWorkerConv("ask_documents", { lastAskedField: "documents" });

assert(
  '"ma cv patauna dar lagyo" → shouldBlockWorkerFlowParsing=true',
  shouldBlockWorkerFlowParsing({ text: "ma cv patauna dar lagyo", conversation: convDocs })
);
assert(
  '"ma cv patauna dar lagyo" → detectNoFlowTrap=cv_privacy',
  detectNoFlowTrap({ text: "ma cv patauna dar lagyo", conversation: convDocs }) === "cv_privacy"
);
const cvPrivacyReply = buildNoFlowTrapReply({ trap: "cv_privacy", conversation: convDocs });
assert(
  "cv_privacy reply mentions permission/match based",
  /permission|match bhaye matra/i.test(cvPrivacyReply),
  cvPrivacyReply
);
assert(
  "cv_privacy reply includes document reminder",
  /document.*compulsory haina|document bina|2 lekhnu/i.test(cvPrivacyReply),
  cvPrivacyReply
);

// ---------------------------------------------------------------------------
// E. worker ask_jobType + "kina bujdainau" → frustration trap
// ---------------------------------------------------------------------------
section("E. worker ask_jobType + 'kina bujdainau'");

assert(
  '"kina bujdainau" → shouldBlockWorkerFlowParsing=true',
  shouldBlockWorkerFlowParsing({ text: "kina bujdainau", conversation: convJobType })
);
assert(
  '"kina bujdainau" → detectNoFlowTrap=frustration',
  detectNoFlowTrap({ text: "kina bujdainau", conversation: convJobType }) === "frustration"
);
const frustReply = buildNoFlowTrapReply({ trap: "frustration", conversation: convJobType });
assert("frustration reply has apology", /sorry/i.test(frustReply));
assert("frustration reply has jobType reminder", /IT.*Computer|Driver|Hotel|Sales|Security|Helper/i.test(frustReply));

// ---------------------------------------------------------------------------
// F. idle + "free ma kam garne worker cha" → fair labor refuse from hardSafety
// ---------------------------------------------------------------------------
section("F. idle + 'free ma kam garne worker cha' → fair labor hard refuse");

const fairLaborHardResult = getAaratiHardSafetyBoundaryAnswer({
  normalized: normalized("free ma kam garne worker cha"),
});
assert("fair labor → non-null hard safety result", fairLaborHardResult !== null);
assert(
  "fair labor detectedIntent=fair_labor_violation",
  fairLaborHardResult?.detectedIntent === "fair_labor_violation",
  fairLaborHardResult?.detectedIntent
);
assert(
  "fair labor reply no pricing plans",
  !/basic plan|premium|monthly fee/i.test(fairLaborHardResult?.reply || ""),
  fairLaborHardResult?.reply
);
assert(
  "fair labor → null from knowledge (no pricing routing)",
  findJobMateKnowledgeAnswer({ normalized: normalized("free ma kam garne worker cha") }) === null
);

// ---------------------------------------------------------------------------
// G. idle + "trial ko paisa nadida hunxa" → fair labor refuse
// ---------------------------------------------------------------------------
section("G. idle + 'trial ko paisa nadida hunxa' → fair labor");

assert(
  '"trial ko paisa nadida hunxa" → isAaratiFairLaborViolationText=true',
  isAaratiFairLaborViolationText("trial ko paisa nadida hunxa")
);
const trialResult = getAaratiHardSafetyBoundaryAnswer({
  normalized: normalized("trial ko paisa nadida hunxa"),
});
assert("trial paisa result non-null", trialResult !== null);
assert(
  "trial paisa detectedIntent=fair_labor_violation",
  trialResult?.detectedIntent === "fair_labor_violation",
  trialResult?.detectedIntent
);

// ---------------------------------------------------------------------------
// H. idle + "age 16 ko helper chaiyo" → underage hard refuse
// ---------------------------------------------------------------------------
section("H. idle + 'age 16 ko helper chaiyo' → underage refuse");

assert(
  '"age 16 ko helper chaiyo" → isAaratiUnsafeIllegalText=true',
  isAaratiUnsafeIllegalText("age 16 ko helper chaiyo")
);
const underageResult = getAaratiHardSafetyBoundaryAnswer({
  normalized: normalized("age 16 ko helper chaiyo"),
});
assert("underage → non-null hard safety result", underageResult !== null);
assert(
  "underage detectedIntent=unsafe_illegal_hiring",
  underageResult?.detectedIntent === "unsafe_illegal_hiring",
  underageResult?.detectedIntent
);

// ---------------------------------------------------------------------------
// I. employer ask_business_name + "free ma kam garne worker cha" → blocked
// ---------------------------------------------------------------------------
section("I. employer ask_business_name + 'free ma kam garne worker cha' → blocked");

const convEmployer = makeEmployerConv("ask_business_name");
assert(
  '"free ma kam garne worker cha" → shouldBlockEmployerFlowParsing=true',
  shouldBlockEmployerFlowParsing({ text: "free ma kam garne worker cha", conversation: convEmployer })
);
assert(
  "detectNoFlowTrap=fair_labor",
  detectNoFlowTrap({ text: "free ma kam garne worker cha", conversation: convEmployer }) === "fair_labor"
);
const empFairLaborReply = buildNoFlowTrapReply({ trap: "fair_labor", conversation: convEmployer });
assert("reply mentions Nepal Labour Act/illegal", /labour act|illegal|legal salary/i.test(empFairLaborReply));
assert("reply has business name reminder", /business.*name|company.*name/i.test(empFairLaborReply));

// ---------------------------------------------------------------------------
// J. employer ask_business_name + "New Nepal Pustak" → NOT blocked
// ---------------------------------------------------------------------------
section("J. employer ask_business_name + 'New Nepal Pustak' → not blocked");

assert(
  '"New Nepal Pustak" → shouldBlockEmployerFlowParsing=false',
  !shouldBlockEmployerFlowParsing({ text: "New Nepal Pustak", conversation: convEmployer })
);
assert(
  '"New Nepal Pustak" → detectNoFlowTrap=null',
  detectNoFlowTrap({ text: "New Nepal Pustak", conversation: convEmployer }) === null
);

// ---------------------------------------------------------------------------
// K. idle + "can you provide me staff" → not blocked
// ---------------------------------------------------------------------------
section("K. idle + 'can you provide me staff' → not blocked (employer flow allowed)");

assert(
  '"can you provide me staff" from idle → shouldBlockEmployerFlowParsing=false',
  !shouldBlockEmployerFlowParsing({ text: "can you provide me staff", conversation: makeConv("idle") })
);

// ---------------------------------------------------------------------------
// L. idle + "Butwal ma driver job cha?" → not blocked
// ---------------------------------------------------------------------------
section("L. idle + 'Butwal ma driver job cha?' → not blocked (job search allowed)");

assert(
  '"Butwal ma driver job cha?" → shouldBlockWorkerFlowParsing=false (idle)',
  !shouldBlockWorkerFlowParsing({ text: "Butwal ma driver job cha?", conversation: makeConv("idle") })
);

// ---------------------------------------------------------------------------
// M. "mero cv sabai company lai dekhauxau?" → cv_privacy hard safety
// ---------------------------------------------------------------------------
section("M. 'mero cv sabai company lai dekhauxau?' → safe privacy answer");

const cvSabaiResult = getAaratiHardSafetyBoundaryAnswer({
  normalized: normalized("mero cv sabai company lai dekhauxau?"),
});
assert("cv sabai → non-null result", cvSabaiResult !== null);
assert(
  "cv sabai detectedIntent=cv_privacy_question",
  cvSabaiResult?.detectedIntent === "cv_privacy_question",
  cvSabaiResult?.detectedIntent
);
assert(
  "cv sabai reply does NOT say 'sabai company lai pathauna sakchhau'",
  !/sabai company lai pathauna sakchhau/i.test(cvSabaiResult?.reply || ""),
  cvSabaiResult?.reply
);

// ---------------------------------------------------------------------------
// N. "can you make my website" from idle → out_of_scope bounded reply
// ---------------------------------------------------------------------------
section("N. idle + 'can you make my website' → out_of_scope, no jobs overclaim");

assert(
  '"can you make my website" from idle → detectNoFlowTrap=out_of_scope',
  detectNoFlowTrap({ text: "can you make my website", conversation: makeConv("idle") }) === "out_of_scope"
);

// ---------------------------------------------------------------------------
// O. "loan dinxau" and "alcohol provide garxau" → out_of_scope / personal money
// ---------------------------------------------------------------------------
section("O. loan / alcohol → bounded refusal");

assert(
  '"loan dinxau" → detectNoFlowTrap=out_of_scope',
  ["out_of_scope", "out_of_scope"].includes(
    detectNoFlowTrap({ text: "loan dinxau", conversation: makeConv("idle") })
  )
);
assert(
  '"alcohol provide garxau" → detectNoFlowTrap=out_of_scope',
  detectNoFlowTrap({ text: "alcohol provide garxau", conversation: makeConv("idle") }) === "out_of_scope"
);

// ---------------------------------------------------------------------------
// P. "kina bujdainau" must produce apology reply, not location/API reply
// ---------------------------------------------------------------------------
section("P. 'kina bujdainau' → apology, never location or Mapbox cue");

const frustTrapReply = buildNoFlowTrapReply({
  trap: "frustration",
  conversation: convJobType,
});
assert(
  "reply has 'sorry' — apology present",
  /sorry/i.test(frustTrapReply)
);
assert(
  "reply has no location/Mapbox cue",
  !/mapbox|location.*api|nawalparasi|rupandehi|kapilvastu|api.*gayo/i.test(frustTrapReply)
);
assert(
  "reply has NO 'Butwal' injected as parsed location",
  !/butwal.*choose|butwal.*select|butwal.*gayo/i.test(frustTrapReply)
);

// ---------------------------------------------------------------------------
// Q. Regression: "salary nadine worker chahiyo" → fair_labor violation
// ---------------------------------------------------------------------------
section("Q. regression: 'salary nadine worker chahiyo' → fair_labor");

assert(
  '"salary nadine worker chahiyo" → isAaratiFairLaborViolationText=true',
  isAaratiFairLaborViolationText("salary nadine worker chahiyo")
);

// ---------------------------------------------------------------------------
// R. Regression: normal messages NOT blocked
// ---------------------------------------------------------------------------
section("R. Regression: safe messages not blocked in worker flow");

assert(
  '"1" (menu reply) → shouldBlockWorkerFlowParsing=false',
  !shouldBlockWorkerFlowParsing({ text: "1", conversation: convJobType })
);
assert(
  '"driver" → shouldBlockWorkerFlowParsing=false',
  !shouldBlockWorkerFlowParsing({ text: "driver", conversation: convJobType })
);
assert(
  '"Butwal" → shouldBlockWorkerFlowParsing=false in ask_district',
  !shouldBlockWorkerFlowParsing({
    text: "Butwal",
    conversation: makeWorkerConv("ask_district", { lastAskedField: "location" }),
  })
);
assert(
  '"hoon" → shouldBlockWorkerFlowParsing=false in asked_register',
  !shouldBlockWorkerFlowParsing({
    text: "hoon",
    conversation: makeWorkerConv("asked_register", { lastAskedField: "" }),
  })
);

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n══════════════════════════════════════════`);
console.log(`AARATI-17A Tests: ${passed} passed, ${failed} failed`);
console.log(`══════════════════════════════════════════`);

if (failed > 0) process.exit(1);
