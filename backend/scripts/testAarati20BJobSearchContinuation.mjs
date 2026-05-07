/**
 * AARATI-20B — Job Search Continuation Tests
 *
 * Deterministic — no DB, no Gemini, no Mapbox, no employer parser.
 *
 * Groups:
 *   A. State activation — guard fires only in correct states
 *   B. Location-only extraction — asks job type
 *   C. Job-type-only extraction — asks location
 *   D. Both known in one message — shouldSearchJobs
 *   E. Pending merge — one partial saved, other arrives in next turn
 *   F. Cancel
 *   G. Neither found — reprompt, no Gemini
 *   H. Nepali / alias variants
 *   I. Regression — no employer parser needed for "driver" in search state
 */

import { handleAaratiJobSearchContinuation } from "../src/services/aarati/aaratiJobSearchContinuation.service.js";

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

function conv(state, intent = "job_search", collectedData = {}) {
  return {
    currentState: state,
    currentIntent: intent,
    metadata: { collectedData },
  };
}

// ============================================================
// A. STATE ACTIVATION
// ============================================================
section("A. State activation");

// awaiting_job_search_query → activates
const a1 = handleAaratiJobSearchContinuation({
  text: "bharghat",
  conversation: conv("awaiting_job_search_query"),
});
assert("awaiting_job_search_query → shouldHandle=true", a1.shouldHandle === true, `reason: ${a1.reason}`);

// awaiting_job_search_location → activates
const a2 = handleAaratiJobSearchContinuation({
  text: "butwal",
  conversation: conv("awaiting_job_search_location", "job_search", { pendingJobSearch: { jobType: "driver", location: null } }),
});
assert("awaiting_job_search_location → shouldHandle=true", a2.shouldHandle === true);

// awaiting_job_search_jobtype → activates
const a3 = handleAaratiJobSearchContinuation({
  text: "marketing",
  conversation: conv("awaiting_job_search_jobtype", "job_search", { pendingJobSearch: { location: "Bhardaghat", jobType: null } }),
});
assert("awaiting_job_search_jobtype → shouldHandle=true", a3.shouldHandle === true);

// idle state with job_search intent → does NOT activate
const a4 = handleAaratiJobSearchContinuation({
  text: "bharghat",
  conversation: conv("idle", "job_search"),
});
assert("idle + job_search intent → shouldHandle=false", a4.shouldHandle === false);
assert("idle → reason=NOT_IN_JOB_SEARCH_STATE", a4.reason === "NOT_IN_JOB_SEARCH_STATE");

// ask_vacancy_role (employer state) → does NOT activate
const a5 = handleAaratiJobSearchContinuation({
  text: "driver",
  conversation: conv("ask_vacancy_role", "employer_lead"),
});
assert("ask_vacancy_role → shouldHandle=false", a5.shouldHandle === false);

// ============================================================
// B. LOCATION-ONLY — asks job type
// ============================================================
section("B. Location-only — awaiting_job_search_query + 'bharghat'");

const b1 = handleAaratiJobSearchContinuation({
  text: "bharghat",
  conversation: conv("awaiting_job_search_query"),
});
assert("bharghat → shouldHandle=true", b1.shouldHandle === true);
assert("bharghat → reason=JOB_SEARCH_LOCATION_ONLY", b1.reason === "JOB_SEARCH_LOCATION_ONLY");
assert("bharghat → shouldSearchJobs=false", b1.shouldSearchJobs === false);
assert("bharghat → location=Bhardaghat in query", b1.query?.location === "Bhardaghat", `got: ${b1.query?.location}`);
assert("bharghat → state=awaiting_job_search_jobtype", b1.statePatch?.currentState === "awaiting_job_search_jobtype");
assert("bharghat → pending.location=Bhardaghat", b1.statePatch?.["metadata.collectedData.pendingJobSearch"]?.location === "Bhardaghat");
assert("bharghat → reply asks job type", /kasto type|example.*driver/i.test(b1.replyText || ""), `reply: ${(b1.replyText || "").slice(0, 120)}`);

// alternate alias
const b2 = handleAaratiJobSearchContinuation({
  text: "bardaghat",
  conversation: conv("awaiting_job_search_query"),
});
assert("bardaghat → resolves Bhardaghat", b2.query?.location === "Bhardaghat");

const b3 = handleAaratiJobSearchContinuation({
  text: "kam khojna bharghat ma",
  conversation: conv("awaiting_job_search_query"),
});
assert('"kam khojna bharghat ma" → location Bhardaghat saved', b3.reason === "JOB_SEARCH_LOCATION_ONLY");
assert('"kam khojna bharghat ma" → location=Bhardaghat', b3.query?.location === "Bhardaghat");

// ============================================================
// C. JOB-TYPE-ONLY — asks location
// ============================================================
section("C. Job-type-only — awaiting_job_search_query + 'driver'");

const c1 = handleAaratiJobSearchContinuation({
  text: "driver",
  conversation: conv("awaiting_job_search_query"),
});
assert("driver → shouldHandle=true", c1.shouldHandle === true);
assert("driver → reason=JOB_SEARCH_JOBTYPE_ONLY", c1.reason === "JOB_SEARCH_JOBTYPE_ONLY");
assert("driver → shouldSearchJobs=false", c1.shouldSearchJobs === false);
assert("driver → keyword=driver", c1.query?.keyword === "driver", `got: ${c1.query?.keyword}`);
assert("driver → state=awaiting_job_search_location", c1.statePatch?.currentState === "awaiting_job_search_location");
assert("driver → pending.jobType=driver", c1.statePatch?.["metadata.collectedData.pendingJobSearch"]?.jobType === "driver");
assert("driver → reply asks location", /kun location|example.*butwal/i.test(c1.replyText || ""), `reply: ${(c1.replyText || "").slice(0, 120)}`);
assert("driver → reply does NOT say '1 jana staff'", !/1 jana staff/i.test(c1.replyText || ""));

const c2 = handleAaratiJobSearchContinuation({
  text: "marketing",
  conversation: conv("awaiting_job_search_query"),
});
assert("marketing → JOB_SEARCH_JOBTYPE_ONLY", c2.reason === "JOB_SEARCH_JOBTYPE_ONLY");
assert("marketing → keyword=marketing", c2.query?.keyword === "marketing");

// ============================================================
// D. BOTH KNOWN IN ONE MESSAGE — shouldSearchJobs
// ============================================================
section("D. Both known in one message — shouldSearchJobs=true");

const d1 = handleAaratiJobSearchContinuation({
  text: "field marketing and location bhardaghat",
  conversation: conv("awaiting_job_search_query"),
});
assert('"field marketing and location bhardaghat" → shouldHandle=true', d1.shouldHandle === true);
assert('"field marketing and location bhardaghat" → shouldSearchJobs=true', d1.shouldSearchJobs === true);
assert('"field marketing and location bhardaghat" → location=Bhardaghat', d1.query?.location === "Bhardaghat");
assert('"field marketing and location bhardaghat" → keyword=marketing', d1.query?.keyword === "marketing");
assert('"field marketing and location bhardaghat" → reason=JOB_SEARCH_BOTH_KNOWN', d1.reason === "JOB_SEARCH_BOTH_KNOWN");
assert('"field marketing and location bhardaghat" → state=job_search_results', d1.statePatch?.currentState === "job_search_results");

const d2 = handleAaratiJobSearchContinuation({
  text: "driver butwal",
  conversation: conv("awaiting_job_search_query"),
});
assert('"driver butwal" → shouldSearchJobs=true', d2.shouldSearchJobs === true);
assert('"driver butwal" → location=Butwal', d2.query?.location === "Butwal");
assert('"driver butwal" → keyword=driver', d2.query?.keyword === "driver");

// ============================================================
// E. PENDING MERGE — second turn completes the pair
// ============================================================
section("E. Pending merge — second turn supplies missing piece");

// E1: Pending location + current jobType → search
const e1 = handleAaratiJobSearchContinuation({
  text: "marketing",
  conversation: conv(
    "awaiting_job_search_jobtype",
    "job_search",
    { pendingJobSearch: { location: "Bhardaghat", jobType: null, retryCount: 0 } }
  ),
});
assert("[E1] pending location + 'marketing' → shouldSearchJobs=true", e1.shouldSearchJobs === true);
assert("[E1] location=Bhardaghat (from pending)", e1.query?.location === "Bhardaghat", `got: ${e1.query?.location}`);
assert("[E1] keyword=marketing", e1.query?.keyword === "marketing");
assert("[E1] reason=JOB_SEARCH_BOTH_KNOWN", e1.reason === "JOB_SEARCH_BOTH_KNOWN");

// E2: Pending jobType + current location → search
const e2 = handleAaratiJobSearchContinuation({
  text: "butwal",
  conversation: conv(
    "awaiting_job_search_location",
    "job_search",
    { pendingJobSearch: { location: null, jobType: "driver", retryCount: 0 } }
  ),
});
assert("[E2] pending jobType + 'butwal' → shouldSearchJobs=true", e2.shouldSearchJobs === true);
assert("[E2] location=Butwal", e2.query?.location === "Butwal");
assert("[E2] keyword=driver (from pending)", e2.query?.keyword === "driver", `got: ${e2.query?.keyword}`);

// ============================================================
// F. CANCEL
// ============================================================
section("F. Cancel");

const f1 = handleAaratiJobSearchContinuation({
  text: "cancel",
  conversation: conv("awaiting_job_search_query"),
});
assert("cancel → shouldHandle=true", f1.shouldHandle === true);
assert("cancel → shouldSearchJobs=false", f1.shouldSearchJobs === false);
assert("cancel → reason=JOB_SEARCH_CANCELLED", f1.reason === "JOB_SEARCH_CANCELLED");
assert("cancel → currentState=idle", f1.statePatch?.currentState === "idle");
assert("cancel → currentIntent=unknown", f1.statePatch?.currentIntent === "unknown");
assert("cancel → pendingJobSearch=null", f1.statePatch?.["metadata.collectedData.pendingJobSearch"] === null);
assert("cancel → reply mentions 'job khojna cha'", /job khojna cha/i.test(f1.replyText || ""));

// ============================================================
// G. NEITHER FOUND — reprompt, no Gemini
// ============================================================
section("G. Neither found — reprompt without Gemini");

const g1 = handleAaratiJobSearchContinuation({
  text: "thik chha",
  conversation: conv("awaiting_job_search_query"),
});
assert("unknown text → shouldHandle=true", g1.shouldHandle === true);
assert("unknown text → reason=JOB_SEARCH_REPROMPT", g1.reason === "JOB_SEARCH_REPROMPT");
assert("unknown text → shouldSearchJobs=false", g1.shouldSearchJobs === false);
assert("unknown text → reply has location+job type examples", /location.*butwal|driver|bhardaghat/i.test(g1.replyText || ""), `reply: ${(g1.replyText || "").slice(0, 200)}`);
assert("unknown text → retryCount incremented", g1.statePatch?.["metadata.collectedData.pendingJobSearch"]?.retryCount === 1);
assert("unknown text → state unchanged (still awaiting_job_search_query)", g1.statePatch?.currentState === "awaiting_job_search_query");

// ============================================================
// H. NEPALI / ALIAS VARIANTS
// ============================================================
section("H. Nepali and alias variants");

const h1 = handleAaratiJobSearchContinuation({
  text: "बर्दघाट",
  conversation: conv("awaiting_job_search_query"),
});
assert("बर्दघाट → Bhardaghat", h1.query?.location === "Bhardaghat");

const h2 = handleAaratiJobSearchContinuation({
  text: "ड्राइभर",
  conversation: conv("awaiting_job_search_query"),
});
assert("ड्राइभर → driver", h2.query?.keyword === "driver");

const h3 = handleAaratiJobSearchContinuation({
  text: "bhairhawa",
  conversation: conv("awaiting_job_search_query"),
});
assert("bhairhawa → Bhairahawa", h3.query?.location === "Bhairahawa");

// ============================================================
// I. REGRESSION — no employer parser needed for "driver" in search state
// ============================================================
section("I. Regression — guard is self-contained, no employer parser");

// When in awaiting_job_search_query, "driver" must NOT fall to employer flow.
const i1 = handleAaratiJobSearchContinuation({
  text: "driver",
  conversation: conv("awaiting_job_search_query"),
});
assert("[I1] 'driver' in search state → handled by guard (not employer)", i1.shouldHandle === true);
assert("[I1] reason=JOB_SEARCH_JOBTYPE_ONLY (not employer_lead)", i1.reason === "JOB_SEARCH_JOBTYPE_ONLY");

// "1" in non-search state → guard does not intercept
const i2 = handleAaratiJobSearchContinuation({
  text: "1",
  conversation: conv("idle", "unknown"),
});
assert("[I2] '1' in idle → guard does NOT activate", i2.shouldHandle === false);

// No Gemini needed — all results are synchronous
const i3 = handleAaratiJobSearchContinuation({
  text: "driver bhardaghat",
  conversation: conv("awaiting_job_search_query"),
});
assert("[I3] 'driver bhardaghat' → result is synchronous (no await needed at guard level)", i3.shouldSearchJobs === true && i3.reason === "JOB_SEARCH_BOTH_KNOWN");

// ============================================================
// Summary
// ============================================================
console.log(`\n${"═".repeat(60)}`);
console.log(`AARATI-20B Tests: ${passed} passed, ${failed} failed`);
console.log(`${"═".repeat(60)}`);

if (failed > 0) process.exit(1);
