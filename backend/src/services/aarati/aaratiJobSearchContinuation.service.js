/**
 * AARATI-20B — Job Search Continuation After Follow-up
 *
 * Handles the multi-turn job search conversation that begins when a user
 * replies "1" (still_looking) to a candidate_reengagement follow-up.
 *
 * Activation states:
 *   "awaiting_job_search_query"    — guard just set this; we need both location + jobType
 *   "awaiting_job_search_location" — we have jobType already, need location
 *   "awaiting_job_search_jobtype"  — we have location already, need jobType
 *
 * This guard is deterministic — no Gemini, no Mapbox, no employer parser.
 * All location/jobType extraction is regex + alias tables.
 *
 * Placement: after AARATI-20A guard, before safety/AI/classifier/employer/worker.
 */

// ── Job-search activation states ──────────────────────────────────────────
const JOB_SEARCH_STATES = new Set([
  "awaiting_job_search_query",
  "awaiting_job_search_location",
  "awaiting_job_search_jobtype",
]);

// ── Location alias table ───────────────────────────────────────────────────
// Each entry: [canonical, [...aliases]]
// Aliases are lowercased; text is also lowercased before matching.
const LOCATION_ALIASES = [
  ["Bhardaghat", ["bhardaghat", "bharghat", "bardaghat", "bardghat", "bhardaght", "bardaght", "बर्दघाट"]],
  ["Butwal", ["butwal", "butawal", "बुटवल"]],
  ["Bhairahawa", ["bhairahawa", "bhairawa", "bhairhawa", "siddharthanagar", "सिद्धार्थनगर", "भैरहवा"]],
  ["Parasi", ["parasi", "ramgram", "परासी"]],
  ["Sunwal", ["sunwal", "सुनवल"]],
  ["Nawalparasi", ["nawalparasi", "nawal", "नवलपरासी"]],
  ["Tilottama", ["tilottama", "manigram", "तिलोत्तमा"]],
  ["Devdaha", ["devdaha", "देवदह"]],
  ["Taulihawa", ["taulihawa", "तौलिहवा"]],
  ["Nepalgunj", ["nepalgunj", "नेपालगञ्ज"]],
  ["Ghorahi", ["ghorahi", "घोराही"]],
  ["Tulsipur", ["tulsipur", "तुलसीपुर"]],
  ["Tansen", ["tansen", "तानसेन"]],
  ["Remote", ["remote", "online", "work from home"]],
];

// ── Job-type alias table ───────────────────────────────────────────────────
const JOBTYPE_ALIASES = [
  ["driver", ["driver", "ड्राइभर", "driving", "chalak"]],
  ["marketing", ["marketing", "field marketing", "sales marketing", "marketer"]],
  ["helper", ["helper", "सहयोगी", "sahayogi", "general helper"]],
  ["security", ["security", "guard", "security guard", "सुरक्षा"]],
  ["kitchen", ["cook", "kitchen helper", "chef", "भान्से", "khana pakauney", "kitchen"]],
  ["waiter", ["waiter", "waitress", "waitor"]],
  ["developer", ["frontend", "developer", "programmer", "it", "software", "backend", "react", "coding"]],
  ["sales", ["sales", "salesman", "saleswoman", "sale"]],
  ["cleaner", ["cleaner", "sweeper", "सफाई", "safai"]],
  ["teacher", ["teacher", "शिक्षक", "tutor", "instructor"]],
  ["hotel", ["hotel", "restaurant", "hospitality"]],
  ["accountant", ["accountant", "accounting", "finance", "accounts"]],
];

// ── Cancel patterns ────────────────────────────────────────────────────────
const CANCEL_RE = /^(cancel|cancel gara|cancel garnu|bandha gara|chhadne|nagarnu|nai parcha|thik chha nagarnu)$/i;

// ── Utility: resolve location from free text ───────────────────────────────
function resolveLocation(text) {
  const lower = String(text || "").toLowerCase();
  for (const [canonical, aliases] of LOCATION_ALIASES) {
    if (aliases.some((alias) => lower.includes(alias))) {
      return canonical;
    }
  }
  return null;
}

// ── Utility: resolve job type from free text ──────────────────────────────
function resolveJobType(text) {
  const lower = String(text || "").toLowerCase();
  for (const [canonical, aliases] of JOBTYPE_ALIASES) {
    if (aliases.some((alias) => lower.includes(alias))) {
      return canonical;
    }
  }
  return null;
}

// ── Utility: safe read from metadata.collectedData ────────────────────────
function getCollectedData(conversation) {
  return conversation?.metadata?.collectedData || {};
}

// ── Pending job search from saved collectedData ────────────────────────────
function getPendingJobSearch(conversation) {
  const cd = getCollectedData(conversation);
  return cd.pendingJobSearch || {};
}

// ── Main export ───────────────────────────────────────────────────────────

/**
 * Inspect conversation state and current text to decide whether this is a
 * job-search continuation turn. Returns early-exit instructions if yes.
 *
 * @param {{ text: string, conversation: object }} params
 * @returns {{
 *   shouldHandle: boolean,
 *   replyText: string | null,
 *   statePatch: object,
 *   shouldSearchJobs: boolean,
 *   query: { location: string|null, keyword: string|null, category: string|null } | null,
 *   reason: string
 * }}
 */
export function handleAaratiJobSearchContinuation({ text, conversation }) {
  const state = conversation?.currentState || "idle";
  const intent = conversation?.currentIntent || "unknown";

  // ── Activation check ────────────────────────────────────────────────────
  const inSearchState = JOB_SEARCH_STATES.has(state);
  const inSearchIntent = intent === "job_search";

  if (!inSearchState && !inSearchIntent) {
    return { shouldHandle: false, reason: "NOT_IN_JOB_SEARCH_STATE" };
  }

  // Also skip if this is truly idle with only job_search intent set globally
  // but NOT in one of the explicit search states (prevents false activation
  // on messages that happen to reach here with intent=job_search from past turns).
  if (!inSearchState) {
    return { shouldHandle: false, reason: "NOT_IN_JOB_SEARCH_STATE" };
  }

  const val = String(text || "").toLowerCase().trim();

  // ── Cancel ───────────────────────────────────────────────────────────────
  if (CANCEL_RE.test(val)) {
    return {
      shouldHandle: true,
      replyText:
        "Thik cha 🙏 Job search cancel gariyo.\nPheri chahiyo bhane 'job khojna cha' lekhnus.",
      statePatch: {
        "metadata.collectedData.pendingJobSearch": null,
        currentIntent: "unknown",
        currentState: "idle",
      },
      shouldSearchJobs: false,
      query: null,
      reason: "JOB_SEARCH_CANCELLED",
    };
  }

  // ── Extract from current message ─────────────────────────────────────────
  const currentLocation = resolveLocation(val);
  const currentJobType = resolveJobType(val);

  // ── Merge with pending ───────────────────────────────────────────────────
  const pending = getPendingJobSearch(conversation);
  const mergedLocation = currentLocation || pending.location || null;
  const mergedJobType = currentJobType || pending.jobType || null;

  // ── Case 3 / 4 / 5: both known → search immediately ─────────────────────
  if (mergedLocation && mergedJobType) {
    return {
      shouldHandle: true,
      replyText: null,          // caller builds reply from job results
      statePatch: {
        "metadata.collectedData.pendingJobSearch": null,
        currentIntent: "job_search",
        currentState: "job_search_results",
      },
      shouldSearchJobs: true,
      query: {
        location: mergedLocation,
        keyword: mergedJobType,
        category: "",
      },
      reason: "JOB_SEARCH_BOTH_KNOWN",
    };
  }

  // ── Case 1: only location ────────────────────────────────────────────────
  if (mergedLocation && !mergedJobType) {
    return {
      shouldHandle: true,
      replyText:
        `Bujhe 🙏 ${mergedLocation} ma job khojnu bhako ho.\n` +
        "Kasto type ko job khojnu bhako ho?\n" +
        "Example: driver, marketing, helper, security, cook",
      statePatch: {
        "metadata.collectedData.pendingJobSearch": {
          location: mergedLocation,
          jobType: null,
          retryCount: 0,
        },
        currentIntent: "job_search",
        currentState: "awaiting_job_search_jobtype",
      },
      shouldSearchJobs: false,
      query: { location: mergedLocation, keyword: null, category: null },
      reason: "JOB_SEARCH_LOCATION_ONLY",
    };
  }

  // ── Case 2: only jobType ─────────────────────────────────────────────────
  if (!mergedLocation && mergedJobType) {
    return {
      shouldHandle: true,
      replyText:
        `Bujhe 🙏 ${mergedJobType} job khojnu bhako ho.\n` +
        "Kun location ma khojnu bhako ho?\n" +
        "Example: Butwal, Bhardaghat, Bhairahawa, Parasi",
      statePatch: {
        "metadata.collectedData.pendingJobSearch": {
          location: null,
          jobType: mergedJobType,
          retryCount: 0,
        },
        currentIntent: "job_search",
        currentState: "awaiting_job_search_location",
      },
      shouldSearchJobs: false,
      query: { location: null, keyword: mergedJobType, category: null },
      reason: "JOB_SEARCH_JOBTYPE_ONLY",
    };
  }

  // ── Case 5: neither found — reprompt ─────────────────────────────────────
  const retryCount = (pending.retryCount || 0) + 1;
  return {
    shouldHandle: true,
    replyText:
      "Bujhe 🙏 Job khojna ko lagi:\n" +
      "👉 Location: Butwal, Bhardaghat, Bhairahawa\n" +
      "👉 Job type: driver, marketing, helper\n\n" +
      "Example: driver butwal",
    statePatch: {
      "metadata.collectedData.pendingJobSearch": {
        ...pending,
        retryCount,
      },
      currentIntent: "job_search",
      currentState: state,   // keep current state so next turn tries again
    },
    shouldSearchJobs: false,
    query: null,
    reason: "JOB_SEARCH_REPROMPT",
  };
}
