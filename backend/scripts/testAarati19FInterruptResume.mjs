/**
 * AARATI-19F — Interrupt-Answer-Resume Tests
 *
 * Verifies that bypass categories with preserveState:true append a soft
 * re-prompt when the conversation is in an active flow step.
 *
 * Groups:
 *   A. Resume after document/privacy interrupt
 *   B. Resume after small-talk and out-of-scope during flow
 *   C. Negative — NO resume after forbidden / flow switch / idle
 *   D. Resume prompt content correctness per state
 *
 * Pure unit tests — no DB, no WhatsApp.
 */

import {
  decideAaratiNextAction,
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
// A. DOCUMENT / PRIVACY INTERRUPTS INSIDE ACTIVE FLOW STATES
// ============================================================
section("A. Privacy interrupts — answer + resume document options");

// Test 1: ask_documents + document privacy question
// document_privacy_interrupt reply ALREADY contains 1/2/3 options
const a1 = decide("document leak bhayo bhane k huncha", {
  state: { currentState: "ask_documents" },
});
assert('"document leak" in ask_documents → document_privacy_interrupt', a1.category === "document_privacy_interrupt", `got: ${a1.category}`);
assert('"document leak" → preserveState=true', a1.preserveState === true);
assert('"document leak" → reply has privacy answer (blindly pathaudaina)', /blindly pathaudaina/i.test(a1.reply || ""), `reply: ${(a1.reply || "").slice(0, 100)}`);
assert('"document leak" → reply already has 1/2/3 document options', /1\..*2\..*3\./s.test(a1.reply || ""), `reply: ${(a1.reply || "").slice(0, 200)}`);

// Test 2: ask_availability + part-time clarification (current_step_question_interrupt)
// buildStepQuestionReply already appends the menu
const a2 = decide("part time vaneko k ho", {
  state: { currentState: "ask_availability" },
});
assert('"part time vaneko k ho" in ask_availability → current_step_question_interrupt', a2.category === "current_step_question_interrupt", `got: ${a2.category}`);
assert('"part time vaneko k ho" → preserveState=true', a2.preserveState === true);
assert('"part time vaneko k ho" → reply has part-time explanation', /aadha din|part.?time/i.test(a2.reply || ""), `reply: ${(a2.reply || "").slice(0, 120)}`);
assert('"part time vaneko k ho" → reply has numbered options', /1\.|2\.|3\./s.test(a2.reply || ""), `reply: ${(a2.reply || "").slice(0, 200)}`);

// Test 3: ask_location + "Lumbini matra ho?"
const a3 = decide("Lumbini matra ho", {
  state: { currentState: "ask_location" },
});
assert('"Lumbini matra ho" in ask_location → current_step_question_interrupt', a3.category === "current_step_question_interrupt", `got: ${a3.category}`);
assert('"Lumbini matra ho" → preserveState=true', a3.preserveState === true);
assert('"Lumbini matra ho" → reply has location explanation', /lumbini|province|butwal|bardaghat/i.test(a3.reply || ""), `reply: ${(a3.reply || "").slice(0, 120)}`);
assert('"Lumbini matra ho" → reply re-asks location', /tapai|area|kun/i.test(a3.reply || ""), `reply: ${(a3.reply || "").slice(0, 120)}`);

// ============================================================
// B. SMALL-TALK AND OUT-OF-SCOPE INSIDE FLOW — RESUME APPENDED
// ============================================================
section("B. Small-talk / out-of-scope in flow — resume prompt appended");

// Test 4: ask_documents + "khana khayau" → small_talk_boundary + resume doc options
const b4 = decide("khana khayau", {
  state: { currentState: "ask_documents" },
});
assert('"khana khayau" in ask_documents → small_talk_boundary', b4.category === "small_talk_boundary", `got: ${b4.category}`);
assert('"khana khayau" in ask_documents → preserveState=true', b4.preserveState === true);
assert('"khana khayau" → reply has warm boundary', /jobmate|ready chu|help/i.test(b4.reply || ""), `reply: ${(b4.reply || "").slice(0, 100)}`);
assert('"khana khayau" in ask_documents → reply has document options (resume)', /1\..*chha|chha.*pachi|resume.*doc|aghi sodheko/i.test(b4.reply || ""), `reply: ${(b4.reply || "").slice(0, 300)}`);

// Test 5: ask_availability + "website banau" → out_of_scope + resume availability options
const b5 = decide("website banai deu", {
  state: { currentState: "ask_availability" },
});
assert('"website banai deu" in ask_availability → out_of_scope_service', b5.category === "out_of_scope_service", `got: ${b5.category}`);
assert('"website banai deu" in ask_availability → preserveState=true', b5.preserveState === true);
assert('"website banai deu" → reply has scope boundary answer', /website|coding|jobmate/i.test(b5.reply || ""), `reply: ${(b5.reply || "").slice(0, 100)}`);
assert('"website banai deu" in ask_availability → reply has availability options (resume)', /full.?time|part.?time|shift|jun sukai/i.test(b5.reply || ""), `reply: ${(b5.reply || "").slice(0, 300)}`);

// Hesitation inside ask_documents → reply + doc options
const b6 = decide("aile pathaudina", {
  state: { currentState: "ask_documents" },
});
assert('"aile pathaudina" in ask_documents → hesitation_privacy', b6.category === "hesitation_privacy", `got: ${b6.category}`);
assert('"aile pathaudina" → preserveState=true', b6.preserveState === true);
assert('"aile pathaudina" in ask_documents → reply has resume document options', /aghi sodheko|1\..*chha|chha.*pachi/i.test(b6.reply || ""), `reply: ${(b6.reply || "").slice(0, 300)}`);

// Frustration inside ask_vacancy_role → resume role prompt
const b7 = decide("kina bujdainau", {
  state: { currentState: "ask_vacancy_role" },
});
assert('"kina bujdainau" in ask_vacancy_role → frustration_or_insult', b7.category === "frustration_or_insult", `got: ${b7.category}`);
assert('"kina bujdainau" in ask_vacancy_role → preserveState=true', b7.preserveState === true);
assert('"kina bujdainau" in ask_vacancy_role → reply has role resume prompt', /kun role|kati jana|waiter|cook/i.test(b7.reply || ""), `reply: ${(b7.reply || "").slice(0, 300)}`);

// ============================================================
// C. NEGATIVE — NO RESUME AFTER FORBIDDEN / FLOW SWITCH / IDLE
// ============================================================
section("C. Negative — NO resume when forbidden, flow-switch, or idle state");

// Test 6: ask_vacancy_role + "malai job chaiyo Butwal ma" → flow switch, no employer resume
const c6 = decide("malai job chaiyo Butwal ma", {
  state: { currentState: "ask_vacancy_role" },
  collectedData: { businessName: "ABC School", jobType: "teacher" },
});
assert('"malai job chaiyo Butwal ma" → valid_job_search (flow switch)', c6.category === "valid_job_search", `got: ${c6.category}`);
assert('"malai job chaiyo Butwal ma" → allowFlow=true (not preserved employer step)', c6.allowFlow === true);
assert('"malai job chaiyo Butwal ma" → NO employer resume in reply', !/kun role|kati jana staff/i.test(c6.reply || ""), `got reply: ${(c6.reply || "").slice(0, 100)}`);

// Test 7: employer_ask_salary + "salary pachi heramla" → forbidden, no resume
const c7 = decide("salary pachi heramla", {
  state: { currentState: "employer_ask_salary" },
});
assert('"salary pachi heramla" in employer_ask_salary → forbidden_employer_request', c7.category === "forbidden_employer_request", `got: ${c7.category}`);
assert('"salary pachi heramla" → bypassFlow', c7.bypassFlow);
assert('"salary pachi heramla" → NO salary resume in reply', !/salary range kati|NPR.*month/i.test(c7.reply || ""), `got reply: ${(c7.reply || "").slice(0, 100)}`);

// In idle state — no resume appended to small_talk
const c8 = decide("khana khayau", {
  state: { currentState: "idle" },
});
assert('"khana khayau" in idle → small_talk_boundary (no resume)', c8.category === "small_talk_boundary", `got: ${c8.category}`);
assert('"khana khayau" idle → reply does NOT have resume document options', !/aghi sodheko|1\..*chha/i.test(c8.reply || ""), `got reply: ${(c8.reply || "").slice(0, 200)}`);

// ============================================================
// D. RESUME PROMPT CONTENT PER STATE
// ============================================================
section("D. Resume prompt content — correct options per active state");

// asked_register state
const d1 = decide("khana khayau", { state: { currentState: "asked_register" } });
assert('small_talk in asked_register → resume has register options', /register garna|hoo.*register|aile hoina/i.test(d1.reply || ""), `reply: ${(d1.reply || "").slice(0, 300)}`);

// ask_jobType state
const d2 = decide("khana khayau", { state: { currentState: "ask_jobType" } });
assert('small_talk in ask_jobType → resume has job type options', /hotel|driver|security|sales|it.*tech|jun sukai/i.test(d2.reply || ""), `reply: ${(d2.reply || "").slice(0, 300)}`);

// ask_business_name state
const d3 = decide("khana khayau", { state: { currentState: "ask_business_name" } });
assert('small_talk in ask_business_name → resume asks business name', /business.*naam|company.*naam/i.test(d3.reply || ""), `reply: ${(d3.reply || "").slice(0, 300)}`);

// ask_vacancy state
const d4 = decide("khana khayau", { state: { currentState: "ask_vacancy" } });
assert('small_talk in ask_vacancy → resume asks vacancy count/role', /kati jana|kasto role/i.test(d4.reply || ""), `reply: ${(d4.reply || "").slice(0, 300)}`);

// employer_ask_salary state with NON-forbidden message → resume salary prompt
const d5 = decide("kina bujdainau", { state: { currentState: "employer_ask_salary" } });
assert('frustration in employer_ask_salary → resume has salary prompt', /salary range|NPR.*month/i.test(d5.reply || ""), `reply: ${(d5.reply || "").slice(0, 300)}`);

// ============================================================
// Summary
// ============================================================
console.log(`\n${"═".repeat(60)}`);
console.log(`AARATI-19F Tests: ${passed} passed, ${failed} failed`);
console.log(`${"═".repeat(60)}`);

if (failed > 0) process.exit(1);
