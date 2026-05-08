/**
 * AARATI-20D / 20D-HR — Job Search Confirmation / Profile Save
 *
 * Runs at routing priority #4 — after 20A (follow-up guard), 20B (job search
 * continuation), and before safety guards, Mapbox, Gemini, worker registration.
 *
 * Handles the case where a user sees job search results and replies with a
 * confirmation phrase ("ok hubxa", "yes", "save", "job chaiyo", etc.) intending
 * to register their profile using the last valid job search context.
 *
 * HR fix: lastJobSearch is stored in TWO locations depending on which flow ran:
 *   - 20B path  → metadata.collectedData.lastJobSearch
 *   - AI/19A path → metadata.lastJobSearch (top-level)
 * Both are now read and merged.
 *
 * Activation also fires when lastJobSearch exists in either location (not only
 * when state === "job_search_results"), so confirmations after a short state
 * change still work. Mid-flow states (20B/worker-reg) are excluded.
 *
 * Pure functions — no DB calls. Caller (controller) handles DB reads/writes.
 *
 * Exports:
 *   isJobSearchConfirmationActivation({ text, conversation })
 *     → { active, reason, query }
 *
 *   decideJobSearchConfirmationAction({ text, conversation, workerProfile })
 *     → { shouldHandle, reason, replyText, profileUpdate, nextConvPatch,
 *          nextState, queryUsed, missingField }
 */

// ── TTL for lastJobSearch freshness ───────────────────────────────────────
const LAST_JOB_SEARCH_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ── States where profile save confirmation is valid ───────────────────────
// Primary explicit state. Activation also fires when lastJobSearch exists
// (either storage location) unless the state is in FLOW_STATES_EXCLUDE.
const CONFIRM_STATES = new Set([
  "job_search_results",
  "idle", // user may confirm shortly after state resets, within TTL
]);

// ── States that have their own active flow — 20D must NOT intercept ───────
// 20B handles all awaiting_job_search_* states.
// Worker-reg mid-flow states capture availability/document answers; 20D
// must not treat "hunxa" as a profile-save confirmation in those states.
const FLOW_STATES_EXCLUDE = new Set([
  "awaiting_job_search_query",
  "awaiting_job_search_location",
  "awaiting_job_search_jobtype",
  "ask_availability",
  "ask_document_status",
  "ask_job_type",
  "ask_district",
  "ask_location",
  "ask_vacancy_role",
  "ask_business_name",
  "ask_business_name_after_ai",
  "ask_vacancy",
  "ask_urgency",
  "ask_salary_range",
  "ask_work_type",
]);

// ── Confirmation phrases ───────────────────────────────────────────────────
// Text is already lowercased + trimmed by normalizeAaratiText before it reaches here.
const CONFIRM_RE =
  /^(ok|ok hubxa|ok hunxa|ok huncha|hunxa|huncha|yes|y|save|save gardinus|job chaiyo|register|profile save|thik cha|thik chha|cha|hoo|hoo cha|profile banau|register gara|hajur|chalcha|chalaunu)$/i;

// ── Location → district mapping ───────────────────────────────────────────
const LOCATION_DISTRICT = {
  Bhardaghat: "Nawalparasi",
  Parasi: "Nawalparasi",
  Sunwal: "Nawalparasi",
  Nawalparasi: "Nawalparasi",
  Butwal: "Rupandehi",
  Bhairahawa: "Rupandehi",
  Tilottama: "Rupandehi",
  Devdaha: "Rupandehi",
  Taulihawa: "Kapilvastu",
  Nepalgunj: "Banke",
  Ghorahi: "Dang",
  Tulsipur: "Dang",
  Tansen: "Palpa",
  Remote: "",
};

// ── Job type → WorkerProfile jobPreferences value ────────────────────────
const JOBTYPE_PREFERENCE = {
  driver: "driver_transport",
  marketing: "shop_retail",
  sales: "shop_retail",
  helper: "other",
  security: "security_guard",
  kitchen: "hotel_restaurant",
  waiter: "hotel_restaurant",
  hotel: "hotel_restaurant",
  developer: "other",
  cleaner: "other",
  teacher: "other",
  accountant: "other",
};

// ── Utility: read collectedData safely ────────────────────────────────────
function cd(conversation) {
  return conversation?.metadata?.collectedData || {};
}

// ── Utility: get lastJobSearch from either storage location ───────────────
// 20B guard stores in metadata.collectedData.lastJobSearch.
// AI/19A path stores in metadata.lastJobSearch (top-level).
// Both are checked; collectedData wins if both exist.
function getLastJobSearch(conversation) {
  return (
    conversation?.metadata?.collectedData?.lastJobSearch ||
    conversation?.metadata?.lastJobSearch ||
    null
  );
}

// ── Utility: check if a value means "unknown / not set" ──────────────────
function isUnknown(val) {
  return !val || val === "unknown";
}

// ── Utility: district lookup ──────────────────────────────────────────────
function districtFor(location) {
  return LOCATION_DISTRICT[location] || "";
}

// ── Utility: jobPreference from keyword ───────────────────────────────────
function preferenceFor(keyword) {
  return JOBTYPE_PREFERENCE[String(keyword || "").toLowerCase()] || "other";
}

// ══════════════════════════════════════════════════════════════════════════
// Export 1: quick activation check (no workerProfile needed)
// ══════════════════════════════════════════════════════════════════════════

/**
 * Returns { active, reason, query } without any DB calls.
 * The controller calls this first; fetches WorkerProfile only if active=true.
 */
export function isJobSearchConfirmationActivation({ text, conversation }) {
  const state = conversation?.currentState || "idle";

  // Mid-flow states have active handlers — never intercept them.
  if (FLOW_STATES_EXCLUDE.has(state)) {
    return { active: false, reason: "NOT_IN_CONFIRM_STATE" };
  }

  // Phrase check (cheap, no DB).
  const val = String(text || "").toLowerCase().trim();
  if (!CONFIRM_RE.test(val)) {
    return { active: false, reason: "NOT_A_CONFIRMATION_PHRASE" };
  }

  // lastJobSearch from EITHER storage location (20B path OR AI/19A path).
  const lastJobSearch = getLastJobSearch(conversation);
  const hasValidSearch = !!(lastJobSearch?.query?.location || lastJobSearch?.query?.keyword);

  // Activate if:
  //   a) Explicit confirm state (job_search_results, idle), OR
  //   b) lastJobSearch exists in either location — covers AI-path flows where
  //      state may have already been job_search_results when search ran.
  if (!CONFIRM_STATES.has(state) && !hasValidSearch) {
    return { active: false, reason: "NOT_IN_CONFIRM_STATE" };
  }

  if (!hasValidSearch) {
    return { active: false, reason: "NO_LAST_JOB_SEARCH_QUERY" };
  }

  // TTL: stale after 24 hours
  if (lastJobSearch.searchedAt) {
    const age = Date.now() - new Date(lastJobSearch.searchedAt).getTime();
    if (age > LAST_JOB_SEARCH_TTL_MS) {
      return { active: false, reason: "LAST_JOB_SEARCH_STALE" };
    }
  }

  // Idempotency: already saved
  if (cd(conversation).profileSavedFromLastSearch === true) {
    return { active: true, reason: "ALREADY_SAVED", query: lastJobSearch.query };
  }

  return { active: true, reason: "ACTIVATION_OK", query: lastJobSearch.query };
}

// ══════════════════════════════════════════════════════════════════════════
// Export 2: full decision with workerProfile
// ══════════════════════════════════════════════════════════════════════════

/**
 * Called after activation is confirmed and workerProfile has been fetched.
 *
 * @param {{ text: string, conversation: object, workerProfile: object|null }} params
 * @returns {{
 *   shouldHandle: boolean,
 *   reason: string,
 *   replyText: string,
 *   profileUpdate: object|null,
 *   nextConvPatch: object,
 *   nextState: string,
 *   queryUsed: object|null,
 *   missingField: string|null
 * }}
 */
export function decideJobSearchConfirmationAction({ text, conversation, workerProfile }) {
  const activation = isJobSearchConfirmationActivation({ text, conversation });

  if (!activation.active) {
    return { shouldHandle: false, reason: activation.reason };
  }

  const query = activation.query;
  const location = query?.location || "";
  const keyword = query?.keyword || "";
  const district = districtFor(location);
  const preference = preferenceFor(keyword);

  // ── Idempotency ──────────────────────────────────────────────────────────
  if (activation.reason === "ALREADY_SAVED") {
    return {
      shouldHandle: true,
      reason: "IDEMPOTENT_ALREADY_SAVED",
      replyText:
        `Tapai ko ${location}${keyword ? ` ${keyword}` : ""} job search detail ` +
        `JobMate ma already save bhaisako chha 🙏`,
      profileUpdate: null,
      nextConvPatch: {
        currentState: "idle",
        currentIntent: "unknown",
      },
      nextState: "idle",
      queryUsed: query,
      missingField: null,
    };
  }

  // ── Check what fields are missing in existing profile ────────────────────
  const existingAvailability = workerProfile?.availability || "unknown";
  const existingDocStatus = workerProfile?.documentStatus || "unknown";

  const needsAvailability = isUnknown(existingAvailability);
  const needsDocuments = isUnknown(existingDocStatus);

  // Base profile update — always set location + jobPreference from last search.
  // CRITICAL: do NOT save raw text ("ok hubxa") as area.
  const profileSet = {
    profileStatus: "incomplete",
    ...(location
      ? {
          "location.area": location,
          "location.province": "Lumbini",
          "location.country": "Nepal",
          ...(district ? { "location.district": district } : {}),
        }
      : {}),
  };

  const profileUpdate = {
    $set: profileSet,
    ...(preference ? { $addToSet: { jobPreferences: preference } } : {}),
    $inc: { score: 5 },
  };

  // ── Ask next missing field ────────────────────────────────────────────────
  if (needsAvailability) {
    return {
      shouldHandle: true,
      reason: "NEEDS_AVAILABILITY",
      replyText:
        `Thik cha 🙏 Tapai ko ${location}${keyword ? ` ${keyword}` : ""} job search ko detail save gardai chu.\n` +
        `Availability kahile dekhi cha?\n` +
        `Example: today, this week, part-time, full-time`,
      profileUpdate,
      nextConvPatch: {
        "metadata.collectedData.profileSavedFromLastSearch": false,
        "metadata.collectedData.pendingProfileFromSearch": {
          location,
          keyword,
          district,
          preference,
          savedAt: new Date(),
        },
        currentState: "ask_availability",
        currentIntent: "worker_registration",
      },
      nextState: "ask_availability",
      queryUsed: query,
      missingField: "availability",
    };
  }

  if (needsDocuments) {
    return {
      shouldHandle: true,
      reason: "NEEDS_DOCUMENTS",
      replyText:
        `Thik cha 🙏 Tapai ko ${location}${keyword ? ` ${keyword}` : ""} job detail save bhayo.\n` +
        `Tapai sanga documents chha? (license, citizenship, CV):\n` +
        `1. Chha, pathauna sakchhu\n` +
        `2. Chhaina\n` +
        `3. Kehi chha`,
      profileUpdate,
      nextConvPatch: {
        "metadata.collectedData.profileSavedFromLastSearch": false,
        "metadata.collectedData.pendingProfileFromSearch": {
          location,
          keyword,
          district,
          preference,
          savedAt: new Date(),
        },
        currentState: "ask_document_status",
        currentIntent: "worker_registration",
      },
      nextState: "ask_document_status",
      queryUsed: query,
      missingField: "documents",
    };
  }

  // ── All fields present: full save ────────────────────────────────────────
  return {
    shouldHandle: true,
    reason: "FULL_SAVE",
    replyText:
      `Dhanyabaad 🙏 Tapai ko ${location}${keyword ? ` ${keyword}` : ""} job search detail JobMate ma save bhayo.\n` +
      `Suitable job aayepachhi JobMate team le contact garnecha.`,
    profileUpdate: {
      ...profileUpdate,
      $set: {
        ...profileSet,
        profileStatus: "complete",
        lastQualifiedAt: new Date(),
      },
    },
    nextConvPatch: {
      "metadata.collectedData.profileSavedFromLastSearch": true,
      "metadata.collectedData.pendingProfileFromSearch": null,
      currentState: "idle",
      currentIntent: "unknown",
    },
    nextState: "idle",
    queryUsed: query,
    missingField: null,
  };
}
