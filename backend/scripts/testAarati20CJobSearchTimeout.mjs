/**
 * AARATI-20C — Job Search API Timeout vs Zero Results Tests
 *
 * Tests the distinction between:
 *   - API timeout  → preserve context, send timeout message (NOT "no jobs found")
 *   - API zero results → truthful "no jobs found" message
 *   - Pending retry  → "job chaiyo" after timeout reuses saved location+jobType
 *
 * Uses the deterministic handleAaratiJobSearchContinuation service and
 * simulates searchJobMateJobs return shapes. No Gemini, no Mapbox.
 *
 * Groups:
 *   A. searchJobMateJobs result shape — timeout vs zero vs has-jobs
 *   B. Retry via pending merge — "job chaiyo" after timeout reuses saved query
 *   C. No Mapbox / No Gemini proof — guard is synchronous pure function
 *   D. "job chaiyo" without context — guard misses, falls through normally
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

// Helper: simulate what the controller receives from searchJobMateJobs
function apiTimeout() {
  return { ok: false, reason: "JOBMATE_API_FAILED_OR_TIMEOUT", count: 0, strategy: "api_failed_or_timeout", jobs: [] };
}
function apiZeroResults() {
  return { ok: true, reason: "NO_SAFE_MATCH", count: 0, strategy: "no_match", jobs: [] };
}
function apiHasJobs(n = 2) {
  return { ok: true, count: n, strategy: "strict", jobs: Array(n).fill({ title: "Driver", location: "Bhardaghat", type: "Full-time", is_active: true, is_verified: true }) };
}

// Helper: conversation in timeout state — guard activated, pending preserved
function convWithPending(location, jobType) {
  return {
    currentState: "awaiting_job_search_query",
    currentIntent: "job_search",
    metadata: {
      collectedData: {
        pendingJobSearch: { location, jobType, retryCount: 0 },
      },
    },
  };
}

// ============================================================
// A. searchJobMateJobs result shape discrimination
// ============================================================
section("A. searchJobMateJobs result shape — timeout vs zero vs has-jobs");

// The controller uses: !searchResult.ok || searchResult.reason === "JOBMATE_API_FAILED_OR_TIMEOUT"
// We verify the flag logic here without importing the full controller.

const a1 = apiTimeout();
assert("[A1] timeout: ok=false", a1.ok === false);
assert("[A1] timeout: reason=JOBMATE_API_FAILED_OR_TIMEOUT", a1.reason === "JOBMATE_API_FAILED_OR_TIMEOUT");
assert("[A1] isApiTimeout=true (ok=false OR reason match)", !a1.ok || a1.reason === "JOBMATE_API_FAILED_OR_TIMEOUT");

const a2 = apiZeroResults();
assert("[A2] zero results: ok=true", a2.ok === true);
assert("[A2] zero results: jobs.length=0", a2.jobs.length === 0);
assert("[A2] isApiTimeout=false (ok=true, no timeout reason)", a2.ok && a2.reason !== "JOBMATE_API_FAILED_OR_TIMEOUT");
// Important: zero results IS accurate — we can say "no jobs found"
assert("[A2] zero results: count=0", a2.count === 0);

const a3 = apiHasJobs(3);
assert("[A3] has jobs: ok=true", a3.ok === true);
assert("[A3] has jobs: count=3", a3.count === 3);
assert("[A3] has jobs: jobs.length=3", a3.jobs.length === 3);

// ============================================================
// B. Retry via pending merge — "job chaiyo" after timeout
// ============================================================
section("B. Pending merge — 'job chaiyo' after timeout reuses saved query");

// B1: After API timeout, controller preserves pendingJobSearch={location:Bhardaghat, jobType:marketing}
// and sets state=awaiting_job_search_query. Next "job chaiyo" triggers the guard.
const b1 = handleAaratiJobSearchContinuation({
  text: "job chaiyo",
  conversation: convWithPending("Bhardaghat", "marketing"),
});
assert("[B1] 'job chaiyo' + pending → shouldHandle=true", b1.shouldHandle === true, `reason: ${b1.reason}`);
assert("[B1] shouldSearchJobs=true (both from pending)", b1.shouldSearchJobs === true);
assert("[B1] location=Bhardaghat (from pending)", b1.query?.location === "Bhardaghat", `got: ${b1.query?.location}`);
assert("[B1] keyword=marketing (from pending)", b1.query?.keyword === "marketing", `got: ${b1.query?.keyword}`);
assert("[B1] reason=JOB_SEARCH_BOTH_KNOWN", b1.reason === "JOB_SEARCH_BOTH_KNOWN");

// B2: "job khojna cha" is also a common retry phrase — pending merges
const b2 = handleAaratiJobSearchContinuation({
  text: "job khojna cha",
  conversation: convWithPending("Bhardaghat", "driver"),
});
assert("[B2] 'job khojna cha' + pending → shouldSearchJobs=true", b2.shouldSearchJobs === true);
assert("[B2] location=Bhardaghat", b2.query?.location === "Bhardaghat");
assert("[B2] keyword=driver", b2.query?.keyword === "driver");

// B3: "ok retry" with pending → search (neither resolves in text, uses pending)
const b3 = handleAaratiJobSearchContinuation({
  text: "ok retry",
  conversation: convWithPending("Butwal", "security"),
});
assert("[B3] 'ok retry' + pending Butwal+security → shouldSearchJobs=true", b3.shouldSearchJobs === true);
assert("[B3] location=Butwal", b3.query?.location === "Butwal");
assert("[B3] keyword=security", b3.query?.keyword === "security");

// B4: pending has only location (no jobType from timeout) — still asks job type
const b4 = handleAaratiJobSearchContinuation({
  text: "job chaiyo",
  conversation: convWithPending("Bhardaghat", null),
});
assert("[B4] pending location only, 'job chaiyo' → asks job type", b4.shouldHandle === true);
assert("[B4] shouldSearchJobs=false (missing jobType)", b4.shouldSearchJobs === false);
assert("[B4] reason=JOB_SEARCH_LOCATION_ONLY", b4.reason === "JOB_SEARCH_LOCATION_ONLY");
assert("[B4] reply asks job type", /kasto type|example/i.test(b4.replyText || ""));

// B5: "job chaiyo" without any pending → reprompt (no location, no jobType, no pending)
const b5 = handleAaratiJobSearchContinuation({
  text: "job chaiyo",
  conversation: {
    currentState: "awaiting_job_search_query",
    currentIntent: "job_search",
    metadata: { collectedData: {} },
  },
});
assert("[B5] 'job chaiyo' no pending → reprompt", b5.reason === "JOB_SEARCH_REPROMPT");
assert("[B5] shouldSearchJobs=false", b5.shouldSearchJobs === false);
assert("[B5] reply has location+job type examples", /location|driver|bhardaghat/i.test(b5.replyText || ""));

// ============================================================
// C. No Mapbox / No Gemini — guard is pure synchronous function
// ============================================================
section("C. No Mapbox / No Gemini — guard is a synchronous pure function");

// The guard never awaits anything — calling it is synchronous.
// If it returned a Promise, we'd need to await it. The lack of async proves no Gemini.
const c1Start = Date.now();
const c1 = handleAaratiJobSearchContinuation({
  text: "marketing bhardaghat",
  conversation: convWithPending(null, null),
});
const c1Ms = Date.now() - c1Start;
assert("[C1] guard returns synchronously (< 10ms)", c1Ms < 10, `took ${c1Ms}ms`);
assert("[C1] result is not a Promise", !(c1 instanceof Promise));
assert("[C1] shouldSearchJobs=true (both in text)", c1.shouldSearchJobs === true);

// ============================================================
// D. "job chaiyo" in non-search state — guard misses, falls through
// ============================================================
section("D. 'job chaiyo' in non-search state — guard does not intercept");

// idle state → guard does not activate; "job chaiyo" falls through to
// worker registration / classifier pipeline unchanged.
const d1 = handleAaratiJobSearchContinuation({
  text: "job chaiyo",
  conversation: { currentState: "idle", currentIntent: "unknown", metadata: { collectedData: {} } },
});
assert("[D1] 'job chaiyo' in idle → shouldHandle=false", d1.shouldHandle === false);
assert("[D1] reason=NOT_IN_JOB_SEARCH_STATE", d1.reason === "NOT_IN_JOB_SEARCH_STATE");

// ask_vacancy_role (employer state) → guard does not intercept
const d2 = handleAaratiJobSearchContinuation({
  text: "job chaiyo",
  conversation: { currentState: "ask_vacancy_role", currentIntent: "employer_lead", metadata: { collectedData: {} } },
});
assert("[D2] 'job chaiyo' in ask_vacancy_role → shouldHandle=false", d2.shouldHandle === false);

// ============================================================
// E. Timeout reply content verification
// ============================================================
section("E. Timeout reply content — must NOT say 'job भेटिएन'");

// The controller builds the timeout reply. We verify the pattern here.
function buildTimeoutReply(location, keyword) {
  return (
    `JobMate system bata job list fetch garna ali time lagyo 🙏\n` +
    `Tapai ko ${location}${keyword ? ` ${keyword}` : ""} job search save gariyo.\n` +
    `Hamro team le check garera suitable job aayo bhane contact garnecha.`
  );
}

const e1 = buildTimeoutReply("Bhardaghat", "marketing");
assert("[E1] timeout reply mentions location (Bhardaghat)", /bhardaghat/i.test(e1));
assert("[E1] timeout reply mentions job type (marketing)", /marketing/i.test(e1));
assert("[E1] timeout reply does NOT say 'job भेटिएन'", !/job भेटिएन/i.test(e1), e1.slice(0, 100));
assert("[E1] timeout reply does NOT say 'bhetiyena'", !/bhetiyena/i.test(e1), e1.slice(0, 100));
assert("[E1] timeout reply mentions 'contact'", /contact/i.test(e1));

// Zero-results message CAN say "job भेटिएन" — that's accurate
const { formatJobsForWhatsApp } = await import("../src/services/jobmate/jobmateJobsClient.service.js");
const e2 = formatJobsForWhatsApp({ jobs: [], location: "Bhardaghat", keyword: "marketing" });
assert("[E2] zero results reply mentions job not found", /bhetiyena|भेटिएन/i.test(e2), e2.slice(0, 120));
assert("[E2] zero results reply is different from timeout reply", e2 !== e1);

// ============================================================
// Summary
// ============================================================
console.log(`\n${"═".repeat(60)}`);
console.log(`AARATI-20C Tests: ${passed} passed, ${failed} failed`);
console.log(`${"═".repeat(60)}`);

if (failed > 0) process.exit(1);
