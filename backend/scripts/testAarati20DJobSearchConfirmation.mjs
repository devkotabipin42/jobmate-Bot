/**
 * AARATI-20D / 20D-HR — Job Search Confirmation / Profile Save Tests
 *
 * Verifies that when user sees job_search_results and replies with a
 * confirmation phrase, the last valid job search context is used to save
 * the profile. Raw text ("ok hubxa", "job chaiyo") is NEVER saved as area.
 *
 * Groups:
 *   A. Activation checks — state + phrase + lastJobSearch required
 *   B. "ok hubxa" → uses lastJobSearch Bhardaghat/marketing, not raw text
 *   C. Missing fields — asks availability then documents
 *   D. All fields present → full save, state=idle
 *   E. Idempotency — profileSavedFromLastSearch=true → already saved reply
 *   F. TTL — stale lastJobSearch (>24h) → shouldHandle=false
 *   G. "job chaiyo" after results → uses lastJobSearch (no Mapbox/Gemini)
 *   H. No lastJobSearch → shouldHandle=false
 *   I. Non-confirmation text in job_search_results → does not intercept
 *   J. Regression — no employer flow, no Gemini, no Mapbox
 *   K. HR fix — AI/19A path stores lastJobSearch at metadata.lastJobSearch
 *      (not collectedData) — guard must activate from both locations
 */

import {
  isJobSearchConfirmationActivation,
  decideJobSearchConfirmationAction,
} from "../src/services/aarati/aaratiJobSearchConfirmation.service.js";

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

// ── Helpers ────────────────────────────────────────────────────────────────

function convWithResults(overrides = {}) {
  return {
    currentState: "job_search_results",
    currentIntent: "job_search",
    metadata: {
      collectedData: {
        lastJobSearch: {
          query: { location: "Bhardaghat", keyword: "marketing", category: "" },
          count: 3,
          strategy: "strict",
          jobSearchError: null,
          searchedAt: new Date(),   // fresh
        },
        ...overrides.collectedData,
      },
    },
    ...overrides.conv,
  };
}

function convWithStaleResults() {
  return {
    currentState: "job_search_results",
    currentIntent: "job_search",
    metadata: {
      collectedData: {
        lastJobSearch: {
          query: { location: "Bhardaghat", keyword: "marketing" },
          searchedAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25h ago
        },
      },
    },
  };
}

function workerProfile({ availability = "unknown", documentStatus = "unknown" } = {}) {
  return { availability, documentStatus };
}

// ══════════════════════════════════════════════════════════════════════════
// A. ACTIVATION CHECKS
// ══════════════════════════════════════════════════════════════════════════
section("A. Activation checks");

// Wrong state
const a1 = isJobSearchConfirmationActivation({
  text: "ok hubxa",
  conversation: { currentState: "idle", metadata: { collectedData: {} } },
});
assert("[A1] idle state → active=false", a1.active === false);
// idle is in CONFIRM_STATES (HR fix allows it for post-search confirmation);
// without lastJobSearch the reason is NO_LAST_JOB_SEARCH_QUERY not NOT_IN_CONFIRM_STATE.
assert("[A1] reason=NO_LAST_JOB_SEARCH_QUERY (idle without lastJobSearch)", a1.reason === "NO_LAST_JOB_SEARCH_QUERY");

// ask_vacancy_role (employer state)
const a2 = isJobSearchConfirmationActivation({
  text: "ok hubxa",
  conversation: { currentState: "ask_vacancy_role", metadata: { collectedData: {} } },
});
assert("[A2] ask_vacancy_role → active=false", a2.active === false);

// Correct state, wrong phrase
const a3 = isJobSearchConfirmationActivation({
  text: "bhardaghat ma job cha",
  conversation: convWithResults(),
});
assert("[A3] non-confirmation text → active=false", a3.active === false);
assert("[A3] reason=NOT_A_CONFIRMATION_PHRASE", a3.reason === "NOT_A_CONFIRMATION_PHRASE");

// Correct state, correct phrase, but no lastJobSearch
const a4 = isJobSearchConfirmationActivation({
  text: "ok hubxa",
  conversation: {
    currentState: "job_search_results",
    metadata: { collectedData: {} },
  },
});
assert("[A4] no lastJobSearch → active=false", a4.active === false);
assert("[A4] reason=NO_LAST_JOB_SEARCH_QUERY", a4.reason === "NO_LAST_JOB_SEARCH_QUERY");

// Valid activation
const a5 = isJobSearchConfirmationActivation({ text: "ok hubxa", conversation: convWithResults() });
assert("[A5] job_search_results + ok hubxa + lastJobSearch → active=true", a5.active === true);
assert("[A5] query.location=Bhardaghat", a5.query?.location === "Bhardaghat");

// All confirmation phrases
for (const phrase of ["ok", "ok hubxa", "hunxa", "yes", "save", "job chaiyo", "register", "thik cha", "thik chha", "hajur"]) {
  const r = isJobSearchConfirmationActivation({ text: phrase, conversation: convWithResults() });
  assert(`[A5] "${phrase}" activates`, r.active === true, `reason: ${r.reason}`);
}

// ══════════════════════════════════════════════════════════════════════════
// B. "ok hubxa" → uses Bhardaghat/marketing, NOT raw text
// ══════════════════════════════════════════════════════════════════════════
section("B. 'ok hubxa' uses lastJobSearch — raw text blocked as location");

const b1 = decideJobSearchConfirmationAction({
  text: "ok hubxa",
  conversation: convWithResults(),
  workerProfile: workerProfile(),  // both unknown → asks availability first
});
assert("[B1] shouldHandle=true", b1.shouldHandle === true);
assert("[B1] queryUsed.location=Bhardaghat (not 'ok hubxa')", b1.queryUsed?.location === "Bhardaghat", `got: ${b1.queryUsed?.location}`);
assert("[B1] queryUsed.keyword=marketing (not 'ok hubxa')", b1.queryUsed?.keyword === "marketing");
assert("[B1] profileUpdate.$set has location.area=Bhardaghat", b1.profileUpdate?.$set?.["location.area"] === "Bhardaghat", `got: ${JSON.stringify(b1.profileUpdate?.$set)}`);
assert("[B1] profileUpdate.$set does NOT have 'ok hubxa' anywhere", !JSON.stringify(b1.profileUpdate || {}).includes("ok hubxa"));
assert("[B1] nextConvPatch has no 'ok hubxa'", !JSON.stringify(b1.nextConvPatch || {}).includes("ok hubxa"));
assert("[B1] replyText mentions Bhardaghat", /bhardaghat/i.test(b1.replyText || ""), `reply: ${(b1.replyText || "").slice(0, 120)}`);
assert("[B1] replyText mentions marketing", /marketing/i.test(b1.replyText || ""));

// ══════════════════════════════════════════════════════════════════════════
// C. MISSING FIELDS — asks availability then documents
// ══════════════════════════════════════════════════════════════════════════
section("C. Missing fields — asks next missing field");

// Both missing → asks availability first
const c1 = decideJobSearchConfirmationAction({
  text: "ok",
  conversation: convWithResults(),
  workerProfile: workerProfile({ availability: "unknown", documentStatus: "unknown" }),
});
assert("[C1] missing availability → reason=NEEDS_AVAILABILITY", c1.reason === "NEEDS_AVAILABILITY");
assert("[C1] missingField=availability", c1.missingField === "availability");
assert("[C1] nextState=ask_availability", c1.nextState === "ask_availability");
assert("[C1] reply asks availability", /availability|kahile|example.*today/i.test(c1.replyText || ""), `reply: ${(c1.replyText || "").slice(0, 120)}`);
assert("[C1] profileUpdate.$set.location.area=Bhardaghat", c1.profileUpdate?.$set?.["location.area"] === "Bhardaghat");

// Availability known, documents unknown → asks documents
const c2 = decideJobSearchConfirmationAction({
  text: "ok",
  conversation: convWithResults(),
  workerProfile: workerProfile({ availability: "immediate", documentStatus: "unknown" }),
});
assert("[C2] availability known, docs missing → reason=NEEDS_DOCUMENTS", c2.reason === "NEEDS_DOCUMENTS");
assert("[C2] missingField=documents", c2.missingField === "documents");
assert("[C2] nextState=ask_document_status", c2.nextState === "ask_document_status");
assert("[C2] reply asks documents", /document|citizenship|cv/i.test(c2.replyText || ""), `reply: ${(c2.replyText || "").slice(0, 120)}`);

// ══════════════════════════════════════════════════════════════════════════
// D. ALL FIELDS PRESENT → full save, state=idle
// ══════════════════════════════════════════════════════════════════════════
section("D. All fields present → full save, state=idle");

const d1 = decideJobSearchConfirmationAction({
  text: "yes",
  conversation: convWithResults(),
  workerProfile: workerProfile({ availability: "immediate", documentStatus: "ready" }),
});
assert("[D1] all known → reason=FULL_SAVE", d1.reason === "FULL_SAVE");
assert("[D1] missingField=null", d1.missingField === null);
assert("[D1] nextState=idle", d1.nextState === "idle");
assert("[D1] nextConvPatch.currentState=idle", d1.nextConvPatch?.currentState === "idle");
assert("[D1] nextConvPatch.currentIntent=unknown", d1.nextConvPatch?.currentIntent === "unknown");
assert("[D1] nextConvPatch.profileSavedFromLastSearch=true", d1.nextConvPatch?.["metadata.collectedData.profileSavedFromLastSearch"] === true);
assert("[D1] reply says dhanyabaad", /dhanyabaad/i.test(d1.replyText || ""), `reply: ${(d1.replyText || "").slice(0, 120)}`);
assert("[D1] reply mentions Bhardaghat", /bhardaghat/i.test(d1.replyText || ""));
assert("[D1] profileUpdate.$set.profileStatus=complete", d1.profileUpdate?.$set?.profileStatus === "complete");
assert("[D1] profileUpdate.$set.location.area=Bhardaghat", d1.profileUpdate?.$set?.["location.area"] === "Bhardaghat");
assert("[D1] district set (Nawalparasi for Bhardaghat)", d1.profileUpdate?.$set?.["location.district"] === "Nawalparasi");

// ══════════════════════════════════════════════════════════════════════════
// E. IDEMPOTENCY
// ══════════════════════════════════════════════════════════════════════════
section("E. Idempotency — already saved");

const e1 = decideJobSearchConfirmationAction({
  text: "ok",
  conversation: convWithResults({ collectedData: { profileSavedFromLastSearch: true } }),
  workerProfile: workerProfile({ availability: "immediate", documentStatus: "ready" }),
});
assert("[E1] already saved → reason=IDEMPOTENT_ALREADY_SAVED", e1.reason === "IDEMPOTENT_ALREADY_SAVED");
assert("[E1] profileUpdate=null (no re-save)", e1.profileUpdate === null);
assert("[E1] nextState=idle", e1.nextState === "idle");
assert("[E1] reply says already saved", /already save|bhaisako/i.test(e1.replyText || ""), `reply: ${(e1.replyText || "").slice(0, 120)}`);

// ══════════════════════════════════════════════════════════════════════════
// F. TTL — stale lastJobSearch
// ══════════════════════════════════════════════════════════════════════════
section("F. TTL — stale lastJobSearch (>24h) → active=false");

const f1 = isJobSearchConfirmationActivation({
  text: "ok hubxa",
  conversation: convWithStaleResults(),
});
assert("[F1] stale lastJobSearch → active=false", f1.active === false);
assert("[F1] reason=LAST_JOB_SEARCH_STALE", f1.reason === "LAST_JOB_SEARCH_STALE");

// Fresh lastJobSearch (just now) → active=true
const f2 = isJobSearchConfirmationActivation({
  text: "ok hubxa",
  conversation: convWithResults(),
});
assert("[F2] fresh lastJobSearch → active=true", f2.active === true);

// ══════════════════════════════════════════════════════════════════════════
// G. "job chaiyo" after results → uses lastJobSearch (not Mapbox/Gemini)
// ══════════════════════════════════════════════════════════════════════════
section("G. 'job chaiyo' after results → uses lastJobSearch context");

const g1 = decideJobSearchConfirmationAction({
  text: "job chaiyo",
  conversation: convWithResults(),
  workerProfile: workerProfile(),
});
assert("[G1] 'job chaiyo' in job_search_results → shouldHandle=true", g1.shouldHandle === true);
assert("[G1] queryUsed.location=Bhardaghat (NOT 'job chaiyo')", g1.queryUsed?.location === "Bhardaghat");
assert("[G1] profileUpdate does NOT contain 'job chaiyo' as area", !JSON.stringify(g1.profileUpdate || {}).includes("job chaiyo"));
assert("[G1] reason is NEEDS_AVAILABILITY or FULL_SAVE (not raw text related)", ["NEEDS_AVAILABILITY","NEEDS_DOCUMENTS","FULL_SAVE","IDEMPOTENT_ALREADY_SAVED"].includes(g1.reason));
// Result is synchronous (no Promise → no Gemini/Mapbox)
assert("[G1] result is not a Promise (no async AI call)", !(g1 instanceof Promise));

// ══════════════════════════════════════════════════════════════════════════
// H. NO lastJobSearch → shouldHandle=false
// ══════════════════════════════════════════════════════════════════════════
section("H. No lastJobSearch → falls through to normal flow");

const h1 = decideJobSearchConfirmationAction({
  text: "ok hubxa",
  conversation: {
    currentState: "job_search_results",
    metadata: { collectedData: {} },
  },
  workerProfile: null,
});
assert("[H1] no lastJobSearch → shouldHandle=false", h1.shouldHandle === false);
assert("[H1] reason=NO_LAST_JOB_SEARCH_QUERY", h1.reason === "NO_LAST_JOB_SEARCH_QUERY");

// ══════════════════════════════════════════════════════════════════════════
// I. NON-CONFIRMATION TEXT IN job_search_results → does not intercept
// ══════════════════════════════════════════════════════════════════════════
section("I. Non-confirmation text in job_search_results → no intercept");

for (const phrase of ["bhardaghat driver", "1", "apply", "2 nambero job", "kina", "nai"]) {
  const r = decideJobSearchConfirmationAction({
    text: phrase,
    conversation: convWithResults(),
    workerProfile: null,
  });
  assert(`[I] "${phrase}" → shouldHandle=false`, r.shouldHandle === false, `reason: ${r.reason}`);
}

// ══════════════════════════════════════════════════════════════════════════
// J. REGRESSION — no employer flow, no Gemini, no Mapbox
// ══════════════════════════════════════════════════════════════════════════
section("J. Regression — guard is synchronous pure function");

const jStart = Date.now();
const j1 = decideJobSearchConfirmationAction({
  text: "ok hubxa",
  conversation: convWithResults(),
  workerProfile: workerProfile({ availability: "immediate", documentStatus: "ready" }),
});
const jMs = Date.now() - jStart;
assert("[J1] guard runs synchronously (< 5ms)", jMs < 5, `took ${jMs}ms`);
assert("[J1] result is not a Promise (no Gemini/Mapbox)", !(j1 instanceof Promise));
assert("[J1] employer flow not involved (reason not employer-related)", !String(j1.reason || "").toLowerCase().includes("employer"));
assert("[J1] no 'ok hubxa' in profileUpdate", !JSON.stringify(j1.profileUpdate || {}).includes("ok hubxa"));

// ══════════════════════════════════════════════════════════════════════════
// K. HR FIX — AI/19A path stores lastJobSearch at metadata.lastJobSearch
//    (not metadata.collectedData.lastJobSearch).
//    Guard must detect both storage locations.
// ══════════════════════════════════════════════════════════════════════════
section("K. HR fix — AI-path lastJobSearch at metadata (not collectedData)");

// Simulate exactly what the AI/19A controller path writes:
// conversation.metadata = { ...sanitizeConversationMetadata(conversation.metadata), lastJobSearch: {...} }
function convWithAiPathResults(overrides = {}) {
  return {
    currentState: "job_search_results",
    currentIntent: "job_search",
    metadata: {
      // NO collectedData.lastJobSearch — AI path writes top-level
      collectedData: {},
      lastJobSearch: {
        query: { location: "Bhardaghat", keyword: "marketing", category: "" },
        count: 3,
        strategy: "strict",
        jobs: [],
        searchedAt: new Date(),
      },
      lastQuestion: "job_search_results",
      ...overrides,
    },
  };
}

// K1: AI-path lastJobSearch — activation must fire
const k1 = isJobSearchConfirmationActivation({
  text: "ok hubxa",
  conversation: convWithAiPathResults(),
});
assert("[K1] AI-path lastJobSearch → active=true", k1.active === true, `reason: ${k1.reason}`);
assert("[K1] query.location=Bhardaghat (from metadata.lastJobSearch)", k1.query?.location === "Bhardaghat", `got: ${k1.query?.location}`);
assert("[K1] reason=ACTIVATION_OK", k1.reason === "ACTIVATION_OK");

// K2: AI-path — decideJobSearchConfirmationAction uses correct location (not "ok hubxa")
const k2 = decideJobSearchConfirmationAction({
  text: "ok hubxa",
  conversation: convWithAiPathResults(),
  workerProfile: workerProfile({ availability: "immediate", documentStatus: "ready" }),
});
assert("[K2] shouldHandle=true (AI path)", k2.shouldHandle === true, `reason: ${k2.reason}`);
assert("[K2] queryUsed.location=Bhardaghat (NOT 'ok hubxa')", k2.queryUsed?.location === "Bhardaghat", `got: ${k2.queryUsed?.location}`);
assert("[K2] profileUpdate.$set.location.area=Bhardaghat", k2.profileUpdate?.$set?.["location.area"] === "Bhardaghat");
assert("[K2] no 'ok hubxa' in profileUpdate", !JSON.stringify(k2.profileUpdate || {}).includes("ok hubxa"));
assert("[K2] reason=FULL_SAVE", k2.reason === "FULL_SAVE");
assert("[K2] reply mentions Bhardaghat", /bhardaghat/i.test(k2.replyText || ""), `reply: ${(k2.replyText || "").slice(0, 120)}`);

// K3: AI-path + missing availability → asks availability using correct context
const k3 = decideJobSearchConfirmationAction({
  text: "ok",
  conversation: convWithAiPathResults(),
  workerProfile: workerProfile({ availability: "unknown", documentStatus: "unknown" }),
});
assert("[K3] AI-path missing availability → reason=NEEDS_AVAILABILITY", k3.reason === "NEEDS_AVAILABILITY");
assert("[K3] profileUpdate.$set.location.area=Bhardaghat", k3.profileUpdate?.$set?.["location.area"] === "Bhardaghat");
assert("[K3] no 'ok' saved as area", !JSON.stringify(k3.profileUpdate || {}).includes('"ok"'));

// K4: AI-path "job chaiyo" → uses lastJobSearch, no Gemini/Mapbox
const k4 = decideJobSearchConfirmationAction({
  text: "job chaiyo",
  conversation: convWithAiPathResults(),
  workerProfile: workerProfile(),
});
assert("[K4] 'job chaiyo' AI-path → shouldHandle=true", k4.shouldHandle === true);
assert("[K4] queryUsed.location=Bhardaghat (NOT 'job chaiyo')", k4.queryUsed?.location === "Bhardaghat");
assert("[K4] no 'job chaiyo' in profileUpdate", !JSON.stringify(k4.profileUpdate || {}).includes("job chaiyo"));
assert("[K4] result not a Promise (no AI call)", !(k4 instanceof Promise));

// K5: Mid-flow state ask_availability + lastJobSearch (AI path) → must NOT intercept
const k5 = isJobSearchConfirmationActivation({
  text: "hunxa",
  conversation: {
    currentState: "ask_availability",
    currentIntent: "worker_registration",
    metadata: {
      collectedData: {},
      lastJobSearch: {
        query: { location: "Bhardaghat", keyword: "marketing" },
        searchedAt: new Date(),
      },
    },
  },
});
assert("[K5] ask_availability + lastJobSearch + 'hunxa' → active=false (worker-reg flow protected)", k5.active === false, `reason: ${k5.reason}`);
assert("[K5] reason=NOT_IN_CONFIRM_STATE", k5.reason === "NOT_IN_CONFIRM_STATE");

// K6: ask_document_status → must NOT intercept
const k6 = isJobSearchConfirmationActivation({
  text: "cha",
  conversation: {
    currentState: "ask_document_status",
    currentIntent: "worker_registration",
    metadata: {
      collectedData: {},
      lastJobSearch: {
        query: { location: "Butwal", keyword: "driver" },
        searchedAt: new Date(),
      },
    },
  },
});
assert("[K6] ask_document_status + lastJobSearch + 'cha' → active=false", k6.active === false);

// K7: idle state + AI-path lastJobSearch (fresh) + "ok hubxa" → activate
const k7 = isJobSearchConfirmationActivation({
  text: "ok hubxa",
  conversation: {
    currentState: "idle",
    currentIntent: "unknown",
    metadata: {
      collectedData: {},
      lastJobSearch: {
        query: { location: "Bhardaghat", keyword: "marketing" },
        searchedAt: new Date(), // fresh
      },
    },
  },
});
assert("[K7] idle + fresh AI-path lastJobSearch + 'ok hubxa' → active=true", k7.active === true, `reason: ${k7.reason}`);

// K8: employer state → must NOT intercept even with lastJobSearch
const k8 = isJobSearchConfirmationActivation({
  text: "ok",
  conversation: {
    currentState: "ask_vacancy_role",
    currentIntent: "employer_lead",
    metadata: {
      collectedData: {},
      lastJobSearch: {
        query: { location: "Bhardaghat", keyword: "marketing" },
        searchedAt: new Date(),
      },
    },
  },
});
assert("[K8] ask_vacancy_role + lastJobSearch + 'ok' → active=false (employer protected)", k8.active === false);

// ══════════════════════════════════════════════════════════════════════════
// Summary
// ══════════════════════════════════════════════════════════════════════════
console.log(`\n${"═".repeat(60)}`);
console.log(`AARATI-20D Tests: ${passed} passed, ${failed} failed`);
console.log(`${"═".repeat(60)}`);

if (failed > 0) process.exit(1);
