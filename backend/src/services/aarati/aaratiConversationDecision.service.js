/**
 * AARATI-19C — Meaning-Based JobMate Policy Brain
 * (extends AARATI-19A Conversation-Aware Decision Engine)
 *
 * Pure functions only. No DB calls, no async.
 *
 * Stateful decision layer that considers:
 *   - current message + normalizedText
 *   - previous user message + previous bot message
 *   - lastGateDecision + lastBlockedCategory
 *   - current conversation state + collectedData
 *   - JobMate business rules, Lumbini location rules, legal/fair-labor rules
 *   - current step interrupt handling
 *   - salary-deferred / unpaid-trial patterns (NEW 19C)
 *   - foreign country location rejection (NEW 19C)
 *   - stale collectedData detection + clearCollectedFields (NEW 19C)
 *
 * Must run BEFORE workerRegistration, employerLead, location resolver, Mapbox, job API.
 *
 * Exports:
 *   decideAaratiNextAction({ text, normalizedText, conversationState, collectedData,
 *     previousUserMessage, previousBotMessage, lastGateDecision, lastBlockedCategory })
 *     → DecisionObject
 *
 *   mapAvailabilityEnum(text) → valid WorkerProfile.availability enum string
 *   isInvalidLocationValue(text) → bool
 */

import {
  normalizeAaratiText,
  isAaratiFrustrationText,
  isAaratiUnsafeIllegalText,
  isAaratiIdentityQuestionText,
  isAaratiFairLaborViolationText,
  isAaratiCvPrivacyQuestion,
  isAaratiSmallTalkText,
  isAaratiEmployerRequestText,
  isAaratiJobSeekerRequestText,
  isAaratiRestartCommandText,
  extractNameFromIntro,        // NEW 19E
  isAaratiHesitationText,      // NEW 19E
} from "./aaratiTextNormalizer.service.js";

// ---------------------------------------------------------------------------
// Location / geography constants
// ---------------------------------------------------------------------------

const LUMBINI_PLACES =
  /bardaghat|bhardaghat|bardghat|butwal|bhairahawa|siddharthanagar|parasi|ramgram|sunwal|devdaha|tilottama|kapilvastu|taulihawa|palpa|tansen|lumbini\b|rupandehi|nawalparasi/i;

const OUT_OF_REGION_PLACES =
  /kathmandu|\bktm\b|pokhara|chitwan|dharan|biratnagar|birgunj|dhangadhi|nepalgunj|hetauda|janakpur|lalitpur|bhaktapur|dhading|sindhuli/i;

// Foreign countries / cities that are clearly outside Nepal entirely (NEW 19C)
const CLEARLY_FOREIGN =
  /\bjapan\b|\bosaka\b|\btokyo\b|\bindia\b|\bdelhi\b|\bmumbai\b|\bchina\b|\bbeijing\b|\busa\b|\bamerica\b|\bqatar\b|\bdoha\b|\bmalaysia\b|\bkualalampur\b|\buae\b|\bdubai\b|\babudhabi\b|\bkorea\b|\bseoul\b|\barab\b|\bsaudi\b|\bbidesh\b|videsha|\bforeign\b|\babroad\b|\buk\b.*job|\baustralia\b|\bcanada\b/i;

// Strings that must NEVER be saved as location values
const INVALID_LOCATION_SET = new Set([
  "recheck", "retry", "again", "check again", "ok", "ho", "yes", "no",
  "hello", "start", "menu", "restart", "suru", "k cha", "khabar",
  "kina bujdainau", "khana khayau", "bujhinas", "feri check gara",
  "refresh", "pheri khoja", "feri khoja", "namaste",
]);

// ---------------------------------------------------------------------------
// HELPER 0 — getDisplayName (NEW 19E)
// Reads conversation.metadata.displayName and returns "FirstName ji" or "Mitra ji".
// ---------------------------------------------------------------------------

function getDisplayName(conversationState) {
  const name = String(
    conversationState?.metadata?.displayName ||
    conversationState?.metadata?.preferredName ||
    ""
  ).trim();
  if (name && name.length >= 2 && name.length <= 40) {
    const firstName = name.split(" ")[0];
    return `${firstName} ji`;
  }
  return "Mitra ji";
}

// ---------------------------------------------------------------------------
// HELPER 1 — isForbiddenEmployerRequest
// Extends isAaratiFairLaborViolationText with food-only compensation patterns.
// ---------------------------------------------------------------------------

function isForbiddenEmployerRequest(val) {
  // ── Guard: explicit safe small-talk food phrases ──────────────────────────
  if (/khana khayau|khana khanu bhayo|khana bhayo\b|khana.*khanu\b/i.test(val)) {
    return false;
  }

  // ── Guard: hotel/restaurant job with no violation signal ──────────────────
  if (
    /hotel.*(?:job|kaam|staff|worker)|restaurant.*(?:job|kaam|staff|worker)|cook.*job|baker.*job/i.test(val) &&
    !/nadine\b|nadin\b|free.*ma|bina.*paisa|matra.*khana|bas.*khana|khana.*diye.*pugcha|bina.*salary/i.test(val)
  ) {
    return false;
  }

  // ── Existing fair-labor checks from normalizer ────────────────────────────
  if (isAaratiFairLaborViolationText(val)) return true;

  // ── Underage/illegal + employment context ─────────────────────────────────
  if (
    isAaratiUnsafeIllegalText(val) &&
    /worker|staff|helper|manche|chahiyo|chaiyo|chahiyeko/i.test(val)
  ) return true;

  // ── Food-only compensation (Bug fix #1) ───────────────────────────────────
  // Catches: "khana matra diye hunxa worker lai", "bas khana diye pugne worker cha",
  //          "khana basna diye salary nadida hunxa", "paisa nadine khana matra worker chaiyo"
  if (
    /khana.*matra.*(?:diye|dinchu|dindai|dida|garne|garaunus|dinu\b)|bas.*khana.*(?:diye|dinchu|dida|garne|dinu\b)|khana.*basna.*(?:diye|dinchu|dida|garne)|khana.*diye.*(?:pugcha|pugdo|milcha|huncha)|basna.*matra.*diye|paisa.*nadine.*khana|khana.*matra.*worker|khana.*matra.*staff/i.test(val)
  ) return true;

  // ── Salary-deferred / unpaid-trial (NEW 19C) ──────────────────────────────
  // Catches: "salary paxi dinxu", "paila kaam garos pachi paisa dinchu",
  //          "salary pachi herna", "salary pachi dinxu tara pahila kaam garos",
  //          "trial ma kaam garos paisa pachi", "1 mahina free ma kaam garos"
  if (
    /salary.*paxi.*(?:dinxu|dinchhu|dine\b|herna\b|heramla\b|diu\b)|salary.*pachi.*(?:dinxu|dinchhu|dine\b|herna\b|heramla\b|diu\b)|paisa.*paxi.*(?:dinxu|dinchhu|dine\b)|paisa.*pachi.*(?:dinxu|dinchhu|dine\b)|paila.*kaam.*pachi.*paisa|kaam.*garos.*pachi.*paisa|pachi.*paisa.*dinchu|trial.*ma.*kaam.*paisa.*pachi|trial.*ma.*free.*kaam|1.*mahina.*free.*kaam|ek.*mahina.*free.*kaam|mahina.*free.*ma.*kaam|salary.*pachi.*heramla\b/i.test(val)
  ) return true;

  return false;
}

// ---------------------------------------------------------------------------
// HELPER 2 — isReferentialForbiddenRequest
// Catches "malai testai chaiyo" when previous message was a forbidden request.
// Bug fix #2.
// ---------------------------------------------------------------------------

function isReferentialForbiddenRequest(val, lastBlockedCategory, prevUserMsg) {
  const prevWasForbidden =
    lastBlockedCategory === "forbidden_employer_request" ||
    isForbiddenEmployerRequest(normalizeAaratiText(String(prevUserMsg || "")));

  if (!prevWasForbidden) return false;

  // Note: normalizer converts "chaiyo" → "chahiyo", so patterns use chahiyo form
  return /malai testai chah?iyo|tei chah?iyo|same.*chah?iyo|ho tei\b|tyo hunxa\b|testai worker|tei wala|malai ni tei|tyo type ko\b|tyestai chah?iyo|testai nai\b|eutai type|tei jastai|same type\b/i.test(
    val
  );
}

// ---------------------------------------------------------------------------
// HELPER 3 — isDocumentPrivacyInterrupt
// Bug fix #3 and #4: answer privacy questions inside ask_documents without
// resetting state or saving documentStatus.
// ---------------------------------------------------------------------------

function isDocumentPrivacyInterrupt(val, state) {
  const inDocState = /ask_document|ask_doc/i.test(String(state || ""));

  // Privacy questions always caught regardless of state
  if (
    /document.*jun.*company|document.*company.*lai.*dinu|cv.*jun.*company|cv.*sabai.*company/i.test(val)
  ) return true;
  if (
    /leak.*bhayo|misuse.*huncha|document.*safe\b|cv.*safe\b|mero.*document.*safe|malai.*privacy.*dar/i.test(val)
  ) return true;
  if (
    /citizenship.*pathauna.*dar|cv.*pathauna.*dar|cv.*patauna.*dar|cv.*pathau.*dar|document.*pathauna.*dar/i.test(val)
  ) return true;
  if (
    /cv.*chaina.*job.*milcha|document.*chaina.*job|cv.*bina.*job/i.test(val)
  ) return true;

  // In document state, any leak/privacy question
  if (
    inDocState &&
    /leak|misuse|safe\b|dar\b|jun company|sabai company|baher|share.*sabai|privacy/i.test(val)
  ) return true;

  return false;
}

// ---------------------------------------------------------------------------
// HELPER 4 — isRecheckCommand
// Bug fix #5: "recheck" must never become a location value.
// ---------------------------------------------------------------------------

function isRecheckCommand(val) {
  return (
    /^\s*(?:recheck|check again|feri check gara|retry|again check|refresh|pheri khoja|feri khoja)\s*$/i.test(val) ||
    /\brecheck\b|\bretry\b|\brefresh\b|\bferi check\b|\bpheri khoja\b|\bferi khoja\b/i.test(val)
  );
}

// ---------------------------------------------------------------------------
// HELPER 5 — isCurrentStepQuestionInterrupt
// Detects clarification questions about the current active flow step.
// ---------------------------------------------------------------------------

function isCurrentStepQuestionInterrupt(val, state) {
  const s = String(state || "").toLowerCase();

  if (/ask_avail|availability/.test(s)) {
    if (
      /part.*time.*(?:vaneko|bhane|\bk ho\b|kasto)|full.*time.*(?:kati|ghanta|\bk ho\b)|shift.*(?:based.*\bk ho\b|based.*vaneko|\bk ho\b)|jun sukai.*(?:\bk ho\b|vaneko)|any.*(?:\bk ho\b|vaneko)/i.test(val)
    ) return true;
  }

  if (/ask_location|ask_district|location|district/.test(s)) {
    if (
      /lumbini.*matra.*ho|kathmandu.*(?:mildaina|haina)|sabai.*nepal.*milcha|kati.*thau.*milcha|kun.*area.*milcha/i.test(val)
    ) return true;
  }

  if (/ask_job.*type|ask_jobtype|ask_job\b/.test(s)) {
    if (
      /jun sukai.*(?:vaneko|\bk ho\b|bhane|\bk bujhnu\b)|any.*job.*vaneko|sabai.*kaam.*milcha/i.test(val)
    ) return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Step question reply builder — contextual answer + re-prompt
// ---------------------------------------------------------------------------

function buildStepQuestionReply(val, state) {
  const s = String(state || "").toLowerCase();

  if (/ask_avail|availability/.test(s)) {
    const menu =
      "\n\n1. Immediate / yo hapta\n2. 1-2 hapta bhitra\n3. 1 mahina bhitra\n4. Not decided yet";
    if (/part.*time/i.test(val))
      return "Part-time bhane tapai aadha din (usually 4-6 ghanta) kaam garna milcha 🙏" + menu;
    if (/full.*time/i.test(val))
      return "Full-time bhane din bhar (usually 8+ ghanta) kaam garne commitment ho 🙏" + menu;
    if (/shift/i.test(val))
      return "Shift-based bhane morning/evening/night shift anusar kaam garna milcha 🙏" + menu;
    if (/jun sukai|any/i.test(val))
      return "Jun sukai bhane kasto pani schedule milcha vanera ho 🙏" + menu;
    return "Tapai ko availability choose garnu hola 🙏" + menu;
  }

  if (/ask_location|ask_district|location|district/.test(s)) {
    return (
      "Ahile JobMate ko main focus Lumbini Province vitra cha 🙏\n\n" +
      "Kathmandu/Pokhara ko job ahile available chaina. " +
      "Tapai kun area ma kaam garna milcha? Example: Butwal, Bhairahawa, Bardaghat, Parasi."
    );
  }

  if (/ask_job.*type|ask_jobtype|ask_job\b/.test(s)) {
    return (
      "'Jun sukai' bhane kasto pani kaam milcha vanera ho 🙏\n\n" +
      "Kunai pani role ko lagi apply garna ready hunuhunchha bhane '7' pathaunu hola."
    );
  }

  return "Tapai ko prashna bujhe Mitra ji 🙏\n\nMa help garna sakchu, tara aghi sodheko step ko answer pathaunu hola.";
}

// ---------------------------------------------------------------------------
// Decision object factory
// ---------------------------------------------------------------------------

function makeDecision({
  category,
  action,
  bypassFlow = false,
  allowFlow = false,
  preserveState = false,
  preserveCollectedData = false,
  reply = null,
  nextStatePatch = null,
  reason = "",
  blockLocationExtraction = false,
  blockEmployerFlow = false,
  blockWorkerFlow = false,
  blockJobSearch = false,
  clearCollectedFields = null, // NEW 19C: array of collectedData keys to unset
  extractedName = null,        // NEW 19E: title-cased name to save to metadata.displayName
} = {}) {
  return {
    category,
    action,
    bypassFlow,
    allowFlow,
    preserveState,
    preserveCollectedData,
    reply,
    nextStatePatch,
    reason,
    blockLocationExtraction,
    blockEmployerFlow,
    blockWorkerFlow,
    blockJobSearch,
    clearCollectedFields,
    extractedName,
  };
}

// ---------------------------------------------------------------------------
// Safe debug log — never logs secrets, tokens, CV content, or document numbers
// ---------------------------------------------------------------------------

function logDecision({ category, action, bypassFlow, allowFlow, preserveState, reason, state, normalizedText }) {
  console.log(
    "AARATI_DECISION:",
    JSON.stringify({
      category,
      action,
      bypassFlow,
      allowFlow,
      preserveState,
      reason,
      state: String(state || "").slice(0, 30),
      normalizedText: String(normalizedText || "").slice(0, 60),
    })
  );
}

// ---------------------------------------------------------------------------
// Public: mapAvailabilityEnum
// Maps user-facing availability strings to valid WorkerProfile.availability enum.
// Bug fix #6: "part-time" from Aarati menu must not default to "not_decided" silently.
// ---------------------------------------------------------------------------

export function mapAvailabilityEnum(text = "") {
  const val = String(text || "").toLowerCase().trim();

  if (!val) return "not_decided";

  // Numeric menu responses (from standard askAvailability menu)
  if (val === "1") return "immediate";
  if (val === "2") return "within_2_weeks";
  if (val === "3") return "within_1_month";
  if (val === "4") return "not_decided";

  // Text patterns — time-based availability
  if (/immediate|aaja dekhi|today|yo hapta|taurai|turant/i.test(val)) return "immediate";
  if (/within.*1.*week|1.*hapta.*bhitra|bhitra.*1.*hapta/i.test(val)) return "within_1_week";
  if (/within.*2.*week|1.?2.*hapta|bhitra.*2/i.test(val)) return "within_2_weeks";
  if (/within.*1.*month|1.*mahina/i.test(val)) return "within_1_month";

  // Aarati work-schedule strings (from AI-first availability menu)
  // Map to closest time-based enum value.
  if (/full.?time|fulltime|din bhar/i.test(val)) return "immediate";      // full-time = ready to start
  if (/part.?time|parttime|aadha din/i.test(val)) return "within_1_month"; // part-time = flexible timing
  if (/shift.*based|shiftbased/i.test(val)) return "within_2_weeks";       // shift = moderate flexibility
  if (/jun sukai|any\b|jun.*pani/i.test(val)) return "not_decided";

  // Already a valid enum string
  const VALID_ENUMS = ["immediate", "within_1_week", "within_2_weeks", "within_1_month", "not_decided", "unknown"];
  if (VALID_ENUMS.includes(val)) return val;

  return "not_decided";
}

// ---------------------------------------------------------------------------
// Public: isInvalidLocationValue
// Returns true when the string must never be saved as a location field.
// ---------------------------------------------------------------------------

export function isInvalidLocationValue(text = "") {
  const val = String(text || "").toLowerCase().trim();
  if (!val || val.length < 2) return true;
  if (INVALID_LOCATION_SET.has(val)) return true;
  if (/^(?:recheck|retry|again|ok|yes|no|hello|start|menu|restart|suru|namaste)$/i.test(val)) return true;
  // Frustration / small-talk fragments are never locations
  if (isAaratiFrustrationText(val) || isAaratiSmallTalkText(val)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// HELPER 6a — isHesitationPrivacy (NEW 19E)
// Wraps the normalizer helper; catches "detail pathauna sakdina" etc.
// ---------------------------------------------------------------------------

function isHesitationPrivacy(val) {
  return isAaratiHesitationText(val);
}

// ---------------------------------------------------------------------------
// HELPER 6b — Teacher / school clarification (NEW 19E)
// ---------------------------------------------------------------------------

function isTeacherEmployerHiring(val) {
  // Clear employer signal: "staff", "hire", "worker" alongside school+teacher
  return (
    /school.*teacher.*(?:staff|chahiyo|hire|worker|employee)|college.*teacher.*(?:staff|chahiyo|hire)|academy.*teacher.*(?:staff|chahiyo)/i.test(val) &&
    /staff|hire|worker|employee|chahiyo/i.test(val)
  );
}

function isTeacherJobSearch(val) {
  // Clear jobseeker signal: "malai", "ma teacher", "teacher job chahiyo"
  return /(?:malai|ma).*teacher.*(?:job|kaam)|teacher.*job.*chahiyo|teacher.*kaam.*chahiyo|teacher.*vacancy|school.*ma.*teacher.*job\b|teacher.*job.*(?:cha\b|xa\b|milcha)/i.test(
    val
  );
}

function isAmbiguousTeacherSchool(val) {
  const hasTeacherSchool =
    /school.*teacher|teacher.*school|schoolko.*teacher|teacher.*paincha|teacher.*milcha|teacher.*cha\b|teacher.*chahiyo\b/i.test(
      val
    );
  if (!hasTeacherSchool) return false;
  return !isTeacherEmployerHiring(val) && !isTeacherJobSearch(val);
}

// ---------------------------------------------------------------------------
// HELPER 6 — detectStaleCategoryFields (NEW 19C)
// When the user starts a clearly different new job search (IT vs hotel vs driver
// vs security), returns STALE_SEARCH_FIELDS so the controller can $unset them
// from collectedData before passing to the job search pipeline.
// Returns null when no stale data is detected.
// ---------------------------------------------------------------------------

const STALE_SEARCH_FIELDS = [
  "jobType",
  "category",
  "searchCategoryAsked",
  "jobSearchDone",
  "noJobsFound",
  "jobSearchResults",
  "jobSearchError",
  "jobSearchStrategy",
];

function detectStaleCategoryFields(val, collectedData = {}) {
  const existingJobType = String(
    collectedData?.jobType || collectedData?.category || ""
  ).toLowerCase();

  // Nothing stored yet — nothing to clear
  if (!existingJobType || existingJobType === "other") return null;

  // Detect what the NEW message is looking for
  const wantsIT =
    /\bdevelop(?:er)?\b|\bit\b.*\bjob\b|software.*\bjob\b|\bprogrammer\b|\bcoding.*\bjob\b|\btech.*\bjob\b|\bweb.*developer\b|\bapp.*developer\b/i.test(
      val
    );
  const wantsHotel =
    /\bhotel\b.*(?:\bjob\b|\bkaam\b)|\brestaurant\b.*(?:\bjob\b|\bkaam\b)|\bcook\b.*(?:\bjob\b|\bkaam\b)|\bwaiter\b.*(?:\bjob\b|\bkaam\b)|\bkhana.*ban\b.*\bjob\b/i.test(
      val
    );
  const wantsDriver =
    /\bdriver\b.*(?:\bjob\b|\bkaam\b)|\bdriving\b.*\bjob\b/i.test(val);
  const wantsSecurity =
    /\bguard\b.*(?:\bjob\b|\bkaam\b)|\bsecurity\b.*(?:\bjob\b|\bkaam\b)/i.test(
      val
    );
  const wantsSales =
    /\bsales\b.*(?:\bjob\b|\bkaam\b)|\bmarketing\b.*(?:\bjob\b|\bkaam\b)/i.test(
      val
    );

  // Detect what the OLD stored data represents
  const storedIT =
    /develop|software|programm|it\b|tech|coding|web.*dev|app.*dev/i.test(
      existingJobType
    );
  const storedHotel =
    /hotel|restaurant|cook|waiter|hospitality|khana|food/i.test(existingJobType);
  const storedDriver = /driver|driving/i.test(existingJobType);
  const storedSecurity = /guard|security/i.test(existingJobType);
  const storedSales = /sales|marketing/i.test(existingJobType);

  const newDiffersFromOld =
    (wantsIT && (storedHotel || storedDriver || storedSecurity || storedSales)) ||
    (wantsHotel && (storedIT || storedDriver || storedSecurity || storedSales)) ||
    (wantsDriver && (storedIT || storedHotel || storedSecurity || storedSales)) ||
    (wantsSecurity && (storedIT || storedHotel || storedDriver || storedSales)) ||
    (wantsSales && (storedIT || storedHotel || storedDriver || storedSecurity));

  if (newDiffersFromOld) return STALE_SEARCH_FIELDS;
  return null;
}

// ---------------------------------------------------------------------------
// Main export: decideAaratiNextAction
// Priority order: command → forbidden → referential_forbidden → document_privacy →
//   step_interrupt → cv_privacy → frustration/respect → out_of_scope →
//   pricing → out_of_region → recheck → employer → job_search → worker_reg →
//   identity → small_talk → unknown_safe_fallback
// ---------------------------------------------------------------------------

export function decideAaratiNextAction({
  text = "",
  normalizedText = "",
  conversationState = {},
  collectedData = {},
  previousUserMessage = "",
  previousBotMessage = "",
  lastGateDecision = {},
  lastBlockedCategory = "",
} = {}) {
  const val = normalizedText || normalizeAaratiText(text);
  const rawLower = String(text || "").toLowerCase().trim();
  const state = String(
    conversationState?.currentState ||
    conversationState?.state ||
    ""
  );

  // Display name for personalised replies (NEW 19E)
  const displayName = getDisplayName(conversationState);

  // ── 1. COMMAND ────────────────────────────────────────────────────────────
  if (isAaratiRestartCommandText(rawLower)) {
    const d = makeDecision({
      category: "command",
      action: "show_greeting",
      bypassFlow: true,
      reply:
        "Namaste Mitra ji! JobMate Nepal ma swagatam 🙏\n\nTapai kaam khojdai hunuhunchha ki staff khojdai hunuhunchha?",
      reason: "restart_command",
    });
    logDecision({ ...d, state, normalizedText: val });
    return d;
  }

  // ── 1b. NAME_CAPTURE (NEW 19E) ────────────────────────────────────────────
  // Only capture if no displayName already saved (don't ask again).
  if (!conversationState?.metadata?.displayName) {
    const extractedNameVal = extractNameFromIntro(text); // raw text preserves case
    if (extractedNameVal) {
      const firstName = extractedNameVal.split(" ")[0];
      const d = makeDecision({
        category: "name_capture",
        action: "save_name_greet",
        bypassFlow: true,
        extractedName: extractedNameVal,
        reply:
          `${firstName} ji, dhanyabaad 🙏 Aba ma tapai lai ${firstName} ji bhanera sambodhan garchu.\n\n` +
          `Tapai kaam khojdai hunuhunchha ki staff khojdai hunuhunchha?`,
        reason: "name_introduction",
      });
      logDecision({ ...d, state, normalizedText: val });
      return d;
    }
  }

  // ── 2. FORBIDDEN_EMPLOYER_REQUEST ─────────────────────────────────────────
  if (isForbiddenEmployerRequest(val)) {
    const d = makeDecision({
      category: "forbidden_employer_request",
      action: "hard_refuse",
      bypassFlow: true,
      blockEmployerFlow: true,
      blockWorkerFlow: true,
      blockJobSearch: true,
      blockLocationExtraction: true,
      reply:
        `Yo request JobMate rules anusar mildaina ${displayName} 🙏\n\n` +
        "Khana/basna matra diyera, bina salary, unpaid trial, ya underage worker rakhna mildaina.\n" +
        "JobMate le legal, safe ra fair salary bhayeko hiring matra support garcha.\n\n" +
        "Yedi legal salary sanga staff khojna ho bhane business name, location, role ra salary range pathaunu hola.",
      nextStatePatch: { lastBlockedCategory: "forbidden_employer_request" },
      reason: "fair_labor_or_underage_violation",
    });
    logDecision({ ...d, state, normalizedText: val });
    return d;
  }

  // ── 3. REFERENTIAL_FORBIDDEN_REQUEST ─────────────────────────────────────
  if (isReferentialForbiddenRequest(val, lastBlockedCategory, previousUserMessage)) {
    const d = makeDecision({
      category: "referential_forbidden_request",
      action: "hard_refuse_referential",
      bypassFlow: true,
      blockEmployerFlow: true,
      blockWorkerFlow: true,
      blockJobSearch: true,
      blockLocationExtraction: true,
      reply:
        `Aghi ko jastai unpaid/khana-matra/illegal hiring request JobMate bata support garna mildaina ${displayName} 🙏\n\n` +
        "Legal salary ra safe duty condition bhaye matra staff search process agadi badhauna milcha.",
      nextStatePatch: { lastBlockedCategory: "forbidden_employer_request" },
      reason: "references_previous_illegal_request",
    });
    logDecision({ ...d, state, normalizedText: val });
    return d;
  }

  // ── 4. DOCUMENT_PRIVACY_INTERRUPT ────────────────────────────────────────
  if (isDocumentPrivacyInterrupt(val, state)) {
    const d = makeDecision({
      category: "document_privacy_interrupt",
      action: "reassure_privacy_keep_state",
      bypassFlow: true,
      preserveState: true,
      preserveCollectedData: true,
      blockLocationExtraction: true,
      blockJobSearch: true,
      reply:
        "Dar lagnu normal ho Mitra ji 🙏\n\n" +
        "JobMate le tapai ko CV/document sabai company lai blindly pathaudaina.\n" +
        "Hiring/verification purpose ko lagi matra use garincha, ra relevant verified employer sanga " +
        "tapai comfortable bhayepachhi matra share garna milcha.\n\n" +
        "Aile document pathauna compulsory chaina.\n" +
        "1. Chha, pachi comfortable bhayepachhi pathaunchhu\n" +
        "2. Chhaina\n" +
        "3. Kehi chha, kehi chhaina",
      reason: "document_privacy_question_in_flow",
    });
    logDecision({ ...d, state, normalizedText: val });
    return d;
  }

  // ── 4b. HESITATION_PRIVACY (NEW 19E) ─────────────────────────────────────
  // "Ma detail pathauna sakdina", "aile pathaudina", "private ho" etc.
  // Respect user choice. Preserve state. Offer safe minimal next step.
  if (isHesitationPrivacy(val)) {
    const inFlow = Boolean(state && state !== "idle");
    const d = makeDecision({
      category: "hesitation_privacy",
      action: "respect_hesitation",
      bypassFlow: true,
      preserveState: inFlow,
      preserveCollectedData: true,
      blockLocationExtraction: true,
      reply:
        `Thik cha ${displayName} 🙏 Detail pathauna man chaina bhane pressure chaina.\n\n` +
        "Tapai comfortable hunuhunchha bhane basic kura matra pathauna saknu huncha — naam, location, kasto kaam khojdai hunuhunchha.\n\n" +
        "Natra pachi pani kura garna milcha. Ma yahi chu.",
      reason: "user_hesitation_respect",
    });
    logDecision({ ...d, state, normalizedText: val });
    return d;
  }

  // ── 5. CURRENT_STEP_QUESTION_INTERRUPT ───────────────────────────────────
  if (isCurrentStepQuestionInterrupt(val, state)) {
    const d = makeDecision({
      category: "current_step_question_interrupt",
      action: "answer_step_question_keep_state",
      bypassFlow: true,
      preserveState: true,
      preserveCollectedData: true,
      blockLocationExtraction: true,
      reply: buildStepQuestionReply(val, state),
      reason: "question_about_current_step",
    });
    logDecision({ ...d, state, normalizedText: val });
    return d;
  }

  // ── 6. CV_PRIVACY_SUPPORT ────────────────────────────────────────────────
  if (
    isAaratiCvPrivacyQuestion(val) ||
    /cv.*pathauna.*dar|cv.*patauna.*dar|cv.*pathau.*dar|cv.*patau.*dar|dar.*cv|cv.*safe.*huncha|document.*safe.*huncha|document.*misuse|cv.*misuse|citizenship.*pathauna.*parcha|privacy.*ko.*dar|malai.*privacy.*dar|cv.*chaina.*job.*milcha|document.*chaina\b|cv.*banauxau/i.test(val)
  ) {
    const d = makeDecision({
      category: "cv_privacy_support",
      action: "reassure_privacy",
      bypassFlow: true,
      preserveState: Boolean(state && state !== "idle"),
      preserveCollectedData: true,
      blockLocationExtraction: true,
      reply:
        "Dar lagnu normal ho Mitra ji 🙏\n\n" +
        "JobMate ma tapai ko CV/document hiring purpose ko lagi matra use garincha. " +
        "Pahila CV pathauna compulsory chaina.\n\n" +
        "Tapai comfortable hunuhunchha bhane basic detail bata suru garna milcha:\n" +
        "- Naam\n- Location\n- Kasto kaam khojdai hunuhunchha\n- Available kahile dekhi\n\n" +
        "CV/document pachi matra share garda huncha.",
      reason: "cv_privacy_question",
    });
    logDecision({ ...d, state, normalizedText: val });
    return d;
  }

  // ── 7. FRUSTRATION_OR_INSULT ─────────────────────────────────────────────
  if (
    isAaratiFrustrationText(val) ||
    /kati bhanne|baulayo kia|baulayo\b|bujhinas\b|useless\b|kasto bot.*ho|yo bot.*ho kya|kina bot.*jastai|ramro.*sanga.*answer.*deu|ramro.*answer.*deu/i.test(val)
  ) {
    const d = makeDecision({
      category: "frustration_or_insult",
      action: "apologize_redirect",
      bypassFlow: true,
      blockLocationExtraction: true,
      reply:
        `Sorry ${displayName} 🙏 Aghi ko reply clear bhayena jasto lagyo.\n\n` +
        "Ma JobMate team bata job khojna, staff khojna, CV/document, pricing/support ko kura ma help garna sakchu.\n\n" +
        "Tapai ko main kura ek line ma pathaunu hola, ma sidha answer dinchhu.",
      reason: "frustration_signal",
    });
    logDecision({ ...d, state, normalizedText: val });
    return d;
  }

  // ── 7b. RESPECT_TRUST ────────────────────────────────────────────────────
  if (
    /respect.*gara|malai.*respect|can you respect|ramro.*sanga.*bol(?!\w)|rude.*nabana|mero.*kura.*sunnu|serious.*answer\b/i.test(val)
  ) {
    const d = makeDecision({
      category: "respect_trust",
      action: "warm_apology",
      bypassFlow: true,
      preserveState: Boolean(state && state !== "idle"),
      preserveCollectedData: true,
      reply:
        "Hajur Mitra ji, ma tapai sanga samman sanga kura garchu 🙏\n\n" +
        "Aghi ko reply rude/unclear jasto lagyo bhane sorry. " +
        "Tapai ko kura short ma pathaunu hola, ma calm bhayera sidha help garchu.",
      reason: "respect_request",
    });
    logDecision({ ...d, state, normalizedText: val });
    return d;
  }

  // ── 8. OUT_OF_SCOPE_SERVICE ──────────────────────────────────────────────
  if (
    /website.*bana|website.*ban\b|app.*bana\b|mobile.*app.*bana|web.*app.*bana|can you.*website|make.*website|create.*website|develop.*website|code.*garna.*help|coding.*garna.*aauxa|love.*letter|write.*love|girlfriend.*message|assignment.*gard|poem.*lekh|photo.*edit\b/i.test(val) &&
    !/developer.*job|it.*job|tech.*job|coding.*job/i.test(val)
  ) {
    const d = makeDecision({
      category: "out_of_scope_service",
      action: "scope_boundary",
      bypassFlow: true,
      blockLocationExtraction: true,
      reply: /website|coding|code.*garna|web.*app/i.test(rawLower)
        ? `Website/coding ko kaam ma JobMate bata direct service dina mildaina ${displayName} 🙏\n\nTara IT/developer job khojna ho bhane location ra role pathaunu hola.`
        : `Yo kura JobMate ko main service bhitra pardaina ${displayName} 🙏\n\nMa JobMate team bata job khojna, staff khojna, CV/document guidance, pricing/support ra human team connect garne kura ma help garna sakchu.`,
      reason: "out_of_scope_request",
    });
    logDecision({ ...d, state, normalizedText: val });
    return d;
  }

  // ── 9. PRICING_SUPPORT ───────────────────────────────────────────────────
  if (
    /pricing\b|paisa.*lagcha|lagcha.*paisa|paisa.*magexa|magexa.*paisa|free.*plan|premium.*kati|employer.*plan|plan.*kati|job.*khojna.*paisa/i.test(val)
  ) {
    const d = makeDecision({
      category: "pricing_support",
      action: "give_pricing",
      bypassFlow: true,
      reply:
        "Job khojne manche ko lagi basic registration/support free huncha 🙏\n\n" +
        "Employer/staff khojne business ko lagi plan huncha:\n" +
        "- Free: NPR 0\n- Basic: NPR 499/month\n- Premium: NPR 999/month\n\n" +
        "Tapai job khojdai hunuhunchha ki business ko lagi staff khojdai hunuhunchha?",
      reason: "pricing_question",
    });
    logDecision({ ...d, state, normalizedText: val });
    return d;
  }

  // ── 10. OUT_OF_REGION_LOCATION ───────────────────────────────────────────
  if (
    (OUT_OF_REGION_PLACES.test(val) || CLEARLY_FOREIGN.test(val)) &&
    /job|kaam|kam|staff|worker|vacancy|hire|chahiyo|chaiyo|milcha/i.test(val)
  ) {
    const d = makeDecision({
      category: "out_of_region_location",
      action: "explain_lumbini_focus",
      bypassFlow: true,
      blockLocationExtraction: true,
      reply:
        `Ahile JobMate ko main focus Lumbini Province ho ${displayName} 🙏\n\n` +
        "Yo area ko job aaile confirm garera dekhaina, wrong job dekhaunu mildaina.\n\n" +
        "Tapai Lumbini area, jastai Butwal/Bhairahawa/Bardaghat/Parasi tira job khojna chahanu huncha?",
      reason: "out_of_region",
    });
    logDecision({ ...d, state, normalizedText: val });
    return d;
  }

  // ── 11. RECHECK_COMMAND ──────────────────────────────────────────────────
  if (isRecheckCommand(val)) {
    const existingLocation = String(collectedData?.location || collectedData?.district || "");
    const existingJobType = String(collectedData?.jobType || collectedData?.jobPreference || "");
    const hasContext = Boolean(existingLocation && existingJobType);
    const d = makeDecision({
      category: "recheck_command",
      action: "trigger_recheck",
      bypassFlow: true,
      preserveState: true,
      preserveCollectedData: true,
      blockLocationExtraction: true,
      reply: hasContext
        ? `Thik cha Mitra ji, ma aghi ko ${existingLocation} + ${existingJobType} search lai feri check garne process ma rakhdai chu 🙏\n\nLocation '${existingLocation}' nai rahanchha; 'recheck' location ko rup ma save hudaina.`
        : "Recheck garna actual location ra kaam type chahinchha Mitra ji 🙏\n\nKun area ra kasto kaam ho? Example: Butwal ma driver job.",
      nextStatePatch: {
        "metadata.collectedData.location": existingLocation || undefined,
        "metadata.collectedData.jobType": existingJobType || undefined,
      },
      reason: "recheck_action_not_location",
    });
    logDecision({ ...d, state, normalizedText: val });
    return d;
  }

  // ── 11b. AMBIGUOUS_TEACHER_SCHOOL_CLARIFICATION (NEW 19E) ────────────────
  // Catches "schoolko lagi teacher painchha" — neither clearly employer nor jobseeker.
  if (isAmbiguousTeacherSchool(val)) {
    const d = makeDecision({
      category: "ambiguous_teacher_school_clarification",
      action: "ask_teacher_role_clarification",
      bypassFlow: true,
      preserveState: Boolean(state && state !== "idle"),
      preserveCollectedData: true,
      reply:
        `School ko lagi teacher khojnu bhayeko ho ki tapai teacher job khojdai hunuhunchha, ${displayName}?\n\n` +
        "1. School ko lagi teacher staff chahiyo\n" +
        "2. Ma teacher job khojdai chu",
      reason: "ambiguous_teacher_school",
    });
    logDecision({ ...d, state, normalizedText: val });
    return d;
  }

  // ── 12. VALID_EMPLOYER_HIRING ─────────────────────────────────────────────
  if (
    isAaratiEmployerRequestText(val) ||
    isTeacherEmployerHiring(val) ||
    /\d+\s*jana.*chahiyo|\d+\s*jana.*chaiyo|waiter.*chahiyo|cook.*chahiyo|helper.*chahiyo|guard.*chahiyo|driver.*chahiyo|receptionist.*chahiyo|teacher.*staff.*chahiyo/i.test(val)
  ) {
    const d = makeDecision({
      category: "valid_employer_hiring",
      action: "allow_employer_flow",
      bypassFlow: false,
      allowFlow: true,
      reason: "employer_request",
    });
    logDecision({ ...d, state, normalizedText: val });
    return d;
  }

  // ── 13. VALID_JOB_SEARCH ─────────────────────────────────────────────────
  // Teacher jobseeker (NEW 19E): "malai teacher job chahiyo butwalma"
  if (isTeacherJobSearch(val)) {
    const staleFieldsT = detectStaleCategoryFields(val, collectedData);
    const d = makeDecision({
      category: "valid_job_search",
      action: "allow_job_search",
      bypassFlow: false,
      allowFlow: true,
      clearCollectedFields: staleFieldsT,
      reason: "teacher_job_search",
    });
    logDecision({ ...d, state, normalizedText: val });
    return d;
  }

  if (
    LUMBINI_PLACES.test(val) &&
    /job|kaam|kam|vacancy|cha\b|xa\b|milcha|driver|hotel|security|sales|helper|cook|waiter|guard|receptionist|cashier|teacher/i.test(val)
  ) {
    // NEW 19C: detect stale collectedData from a previous different job search
    const staleFields = detectStaleCategoryFields(val, collectedData);
    const d = makeDecision({
      category: "valid_job_search",
      action: "allow_job_search",
      bypassFlow: false,
      allowFlow: true,
      clearCollectedFields: staleFields, // null when nothing to clear
      reason: staleFields ? "lumbini_job_query_stale_reset" : "lumbini_job_query",
    });
    logDecision({ ...d, state, normalizedText: val });
    return d;
  }

  // ── 14. VALID_WORKER_REGISTRATION ────────────────────────────────────────
  if (
    isAaratiJobSeekerRequestText(val) ||
    /ma.*driver.*ho|ma.*fresher|hotel.*ma.*kaam.*garna.*milcha|job khojdai|kaam khojdai/i.test(val)
  ) {
    const d = makeDecision({
      category: "valid_worker_registration",
      action: "allow_worker_flow",
      bypassFlow: false,
      allowFlow: true,
      reason: "jobseeker_request",
    });
    logDecision({ ...d, state, normalizedText: val });
    return d;
  }

  // ── 15. IDENTITY_CAPABILITY ──────────────────────────────────────────────
  if (
    isAaratiIdentityQuestionText(val) ||
    /timro.*kam.*k|aarati.*ko.*kaam|jobmate.*le.*k.*garxa|timi.*staff.*ho|can you help me\b|what is your work|what do you do/i.test(val)
  ) {
    const d = makeDecision({
      category: "identity_capability",
      action: "explain_role",
      bypassFlow: true,
      reply:
        "Ma Aarati, JobMate team bata support garne staff ho 🙏\n\n" +
        "Mero kaam:\n" +
        "- Kaam khojne manche lai right job search/registration ma help garne\n" +
        "- Employer lai staff requirement collect garne\n" +
        "- CV/document/verification ko guidance dine\n" +
        "- Pricing/support ko basic answer dine\n" +
        "- Zaruri paryo bhane human team samma kura puryaune",
      reason: "identity_question",
    });
    logDecision({ ...d, state, normalizedText: val });
    return d;
  }

  // ── 16. SMALL_TALK_BOUNDARY ──────────────────────────────────────────────
  if (
    isAaratiSmallTalkText(val) ||
    /how old|timro.*age|timi.*umar|where do you live|where.*live|timro.*ghar|ghar.*kata|married.*ho\b|timi.*manxe.*ho|khana.*bbayo|khana.*bayo.*kinae/i.test(val)
  ) {
    const d = makeDecision({
      category: "small_talk_boundary",
      action: "warm_boundary",
      bypassFlow: true,
      reply:
        "Hajur Mitra ji 🙏 Ma JobMate team bata yahi help garna ready chu.\n\n" +
        "Personal kura bhanda JobMate ko kaam ma focus garum hai — " +
        "job khojna, staff khojna, CV/document, pricing/support ma help garna sakchu.",
      reason: "small_talk",
    });
    logDecision({ ...d, state, normalizedText: val });
    return d;
  }

  // ── 17. UNKNOWN_SAFE_FALLBACK ─────────────────────────────────────────────
  const d = makeDecision({
    category: "unknown_safe_fallback",
    action: "continue_pipeline",
    bypassFlow: false,
    allowFlow: true,
    reason: "no_category_matched",
  });
  logDecision({ ...d, state, normalizedText: val });
  return d;
}
