/**
 * AARATI-17A — No-Flow-Trap Gate
 *
 * Pure functions only. No DB calls, no async.
 *
 * Prevents non-flow messages (frustration, out-of-scope, cv help, identity,
 * trust questions, fair labor violations, underage, unsafe hiring) from being
 * parsed as job type / location / business name inside active worker or
 * employer flows.
 *
 * Exports:
 *   detectNoFlowTrap({ text, conversation }) → trap category string | null
 *   buildNoFlowTrapReply({ trap, conversation }) → reply string with step reminder
 *   shouldBlockWorkerFlowParsing({ text, conversation }) → bool
 *   shouldBlockEmployerFlowParsing({ text, conversation }) → bool
 */

import {
  normalizeAaratiText,
  isAaratiFrustrationText,
  isAaratiUnsafeIllegalText,
  isAaratiPersonalMoneyText,
  isAaratiWeatherText,
  isAaratiMathHomeworkText,
  isAaratiIdentityQuestionText,
  isAaratiFairLaborViolationText,
  isAaratiCvPrivacyQuestion,
  isAaratiSmallTalkText,
  isAaratiEmployerRequestText,
  isAaratiJobSeekerRequestText,
  isAaratiRestartCommandText,
} from "./aaratiTextNormalizer.service.js";

// ---------------------------------------------------------------------------
// State sets
// ---------------------------------------------------------------------------

const ACTIVE_WORKER_STATES = new Set([
  "ask_documents",
  "ask_document_status",
  "ask_availability",
  "ask_jobType",
  "ask_job_type",
  "ask_district",
  "ask_location",
  "asked_register",
  "showed_jobs",
  "job_search_results",
  "search_done",
]);

const ACTIVE_EMPLOYER_STATES = new Set([
  "ask_business_name",
  "ask_business_name_after_ai",
  "ask_vacancy",
  "ask_vacancy_role",
  "ask_urgency",
  "ask_salary_range",
  "ask_work_type",
]);

function isInActiveWorkerFlow(conversation = {}) {
  const state = String(conversation?.currentState || "");
  const lastAskedField = String(conversation?.metadata?.lastAskedField || "");
  return ACTIVE_WORKER_STATES.has(state) || Boolean(lastAskedField);
}

function isInActiveEmployerFlow(conversation = {}) {
  const state = String(conversation?.currentState || "");
  return ACTIVE_EMPLOYER_STATES.has(state);
}

// ---------------------------------------------------------------------------
// Trap category detection — ordered by severity
// ---------------------------------------------------------------------------

function detectTrapCategory(value = "") {
  // Hard safety first
  if (isAaratiUnsafeIllegalText(value)) return "unsafe_hiring";
  if (/bechni\b|bechne\b|bechxan\b|manxe.*bech|manche.*bech/i.test(value)) return "unsafe_hiring";

  // Fair labor violation
  if (isAaratiFairLaborViolationText(value)) return "fair_labor";

  // Frustration / abuse
  if (isAaratiFrustrationText(value)) return "frustration";
  if (/ramro.*saga.*bolna|ramro.*sanga.*bolna|kasto.*reply|useless\b|bakwas/i.test(value)) return "frustration";

  // CV privacy
  if (isAaratiCvPrivacyQuestion(value)) return "cv_privacy";
  if (/cv.*pathauna.*dar|cv.*dar.*lag|document.*share.*dar|cv.*share.*dar|dar.*cv.*pathau|scared.*send.*cv/i.test(value)) return "cv_privacy";

  // CV help
  if (/make my cv|cv.*bana|cv.*banai|resume.*bana|bio.*data.*bana|cv xaina|cv chaina|resume xaina|resume chaina|cv nai chaina|resume nai chaina|cv.*help\b|resume.*help\b|cv banaunus|cv.*pathau/i.test(value)) return "cv_help";

  // Personal money / loan
  if (isAaratiPersonalMoneyText(value)) return "out_of_scope";

  // Weather / math
  if (isAaratiWeatherText(value) || isAaratiMathHomeworkText(value)) return "out_of_scope";

  // Identity
  if (isAaratiIdentityQuestionText(value)) return "identity";

  // Trust
  if (/trust|vishwas|believe|genuine|legit|scam|cheat|bharosa|why.*trust|kyun.*trust|jobmate.*fake|fake.*jobmate|real.*company|company.*real/i.test(value)) return "trust";

  // Out of scope (tech/misc)
  if (/website.*bana|website.*ban|app.*bana|mobile.*app.*bana|web.*app.*bana|can you.*website|make.*website|create.*website|develop.*website/i.test(value)) return "out_of_scope";
  if (/love letter|write.*love|letter.*likhidinu|coding.*sikau|code.*sikau|translate.*caption|bus ticket|passport.*bana|bana.*passport|alcohol\b|whisky\b|wine\b|beer\b|raksi\b/i.test(value)) return "out_of_scope";
  if (/politics|election|religion|dharm|medicine|hospital|doctor\b/i.test(value)) return "out_of_scope";

  // Informational questions that must not update flow state
  if (/remember.*me|yaad.*tapai|recall|recognize|pehchaan|tapai.*chinnu|do you remember/i.test(value)) return "memory";
  if (/can you call|call me|phone gar|call garnu|malai call/i.test(value)) return "call_request";
  if (/choose salary|salary.*myself|salary.*afai|afai.*salary|salary.*choose/i.test(value)) return "salary_choice";
  if (/how fast.*job|kati chitto.*job|kati din.*job|job kahile.*milcha|job.*kati.*din/i.test(value)) return "job_speed";
  if (/interview kasari|interview process|interview hunxa|interview kasto/i.test(value)) return "interview";

  return null;
}

// ---------------------------------------------------------------------------
// Step reminder (minimal inline — mirrors aaratiActiveFlowSideReply logic)
// ---------------------------------------------------------------------------

function getStepReminder(conversation = {}) {
  const state = String(conversation?.currentState || "");
  const lastAskedField = String(conversation?.metadata?.lastAskedField || "");
  const key = lastAskedField || state;

  if (key === "jobType" || state === "ask_jobType" || state === "ask_job_type") {
    return `Aile kaam type choose garne step ma cha:\n1. IT / Computer\n2. Driver / Transport\n3. Hotel / Restaurant\n4. Sales / Shop\n5. Security Guard\n6. Helper / Labor\n7. Jun sukai / any`;
  }
  if (key === "location" || state === "ask_location" || state === "ask_district") {
    return `Aile location step ma cha.\nKripaya tapai kun area/district ma kaam khojdai hunuhunchha, jastai Butwal, Bardaghat, Bhairahawa, Parasi pathaunu hola.`;
  }
  if (key === "availability" || state === "ask_availability") {
    return `Aile availability step ma cha:\n1. Full-time\n2. Part-time\n3. Shift based\n4. Jun sukai`;
  }
  if (key === "documents" || state === "ask_documents" || state === "ask_document_status") {
    return `Aile document step ma cha.\nDocument pathaunu compulsory haina.\nDocument bina profile save garna 2 lekhnu hola.\nDocument chha bhane yahi WhatsApp ma photo/file pathauna saknuhunchha.`;
  }
  if (state === "asked_register") {
    return `Aile profile register garne step ma cha:\n1. Ho, register garchhu\n2. Pachhi try garchhu`;
  }
  if (state === "ask_business_name" || state === "ask_business_name_after_ai") {
    return `Aile employer/business detail step ma cha.\nKripaya business/company name pathaunu hola.`;
  }
  if (state === "ask_vacancy" || state === "ask_vacancy_role") {
    return `Aile required staff role step ma cha.\nKripaya kasto staff chahiyeko ho, role pathaunu hola.`;
  }
  if (state === "ask_salary_range") {
    return `Aile salary/work detail step ma cha.\nKripaya salary range ra work time pathaunu hola.`;
  }
  return `Aile JobMate ko form/process chaldai cha.\nKripaya aghi sodheko kura ko answer short ma pathaunu hola.`;
}

function buildTrapOpener(trap = "out_of_scope") {
  switch (trap) {
    case "frustration":
      return "Sorry Mitra ji 🙏\n\nAghi ko kura ramro bhayena jasto lagyo. Ma kaam khojna, staff khojna, document/verification ra support ko kura ma help garna sakchu.";

    case "cv_privacy":
      return "Bujhe Mitra ji 🙏\n\nTapai ko CV/document sabai company lai automatically pathauning haina. Relevant employer sanga match bhaye matra, ra tapai ko permission anusar matra share huncha. Document bina profile save garna pani milcha.";

    case "cv_help":
      return "Bujhe Mitra ji 🙏\n\nCV/resume chaina bhane pani profile save garna milcha — name, location, kasto kaam chahiyo, experience ra availability matra pugcha. CV banaune support ko lagi JobMate team lai forward garna milcha.";

    case "fair_labor":
      return "Yo request JobMate rules anusar mildaina 🙏\n\nJobMate le minimum wage ra legal salary anusar matra hiring support garcha. Bina paisa/salary kaam garaunus bhanera match garna mildaina — yo Nepal Labour Act anusar illegal ho.";

    case "unsafe_hiring":
      return "Yo request JobMate rules anusar mildaina 🙏\n\nJobMate le legal, safe ra voluntary employment/hiring process matra support garcha. 18 barsha bhandaa kama umarko worker hire garna mildaina.";

    case "identity":
      return "Ma Aarati ho, JobMate Nepal ko WhatsApp sahayogi 🙏\n\nMa tapai lai kaam khojna, staff khojna, profile save garna, document/verification ra support ma help garna sakchu.";

    case "trust":
      return "Tapai ko chinta thik ho 🙏\n\nJobMate Nepal ma registered ra verified service ho. Tapai ko data safe rakhcha, fake job use gardaina, ra registered employer sanga matra connect garcha.";

    case "memory":
      return "Mitra ji, ma conversation bhitra tapai le pathaeko kura herera help garna sakchu 🙏\n\nTara ma personal memory jasto sabai kura yaad rakhchu bhanera guarantee gardaina.";

    case "call_request":
      return "Ma yahi WhatsApp bata text support dinu ho 🙏\n\nPhone call chahiyo bhane JobMate team lai request forward garna milcha.";

    case "salary_choice":
      return "Tapai salary expectation rakhna saknuhunchha 🙏\n\nTara final salary employer, role, experience ra location anusar decide huncha. JobMate salary guarantee gardaina.";

    case "job_speed":
      return "Job kati chito milcha bhanne kura role, location, employer response ra profile detail ma depend garcha 🙏\n\nJobMate guarantee gardaina, tara suitable match aaye contact garna help garcha.";

    case "interview":
      return "Interview process employer anusar farak huncha 🙏\n\nUsually employer le phone/WhatsApp bata contact garna sakcha, ani basic experience ra salary expectation bare sodhna sakcha.";

    case "out_of_scope":
    default:
      return "Mitra ji, yo kura JobMate ko scope bhanda baahira parcha 🙏\n\nMa kaam khojna, staff khojna, document/verification, pricing ra support ko kura ma matra help garna sakchu.";
  }
}

// ---------------------------------------------------------------------------
// Public exports
// ---------------------------------------------------------------------------

/**
 * Returns the trap category for the given text, or null if safe to parse.
 */
export function detectNoFlowTrap({ text = "", conversation = {} } = {}) {
  const value = normalizeAaratiText(text);
  return detectTrapCategory(value);
}

/**
 * Builds a bounded human reply: trap-specific answer + current step reminder.
 */
export function buildNoFlowTrapReply({ trap = "out_of_scope", conversation = {} } = {}) {
  const opener = buildTrapOpener(trap);
  const reminder = getStepReminder(conversation);
  return `${opener}\n\n${reminder}`.trim();
}

/**
 * Returns true when the message must NOT enter worker-flow parsing
 * (job type, location, availability, document parsing).
 * Only fires when there IS an active worker flow.
 */
export function shouldBlockWorkerFlowParsing({ text = "", conversation = {} } = {}) {
  if (!isInActiveWorkerFlow(conversation)) return false;
  const value = normalizeAaratiText(text);
  return detectTrapCategory(value) !== null;
}

/**
 * Returns true when the message must NOT be saved as business name / role.
 * Only fires when there IS an active employer flow.
 */
export function shouldBlockEmployerFlowParsing({ text = "", conversation = {} } = {}) {
  if (!isInActiveEmployerFlow(conversation)) return false;
  const value = normalizeAaratiText(text);
  return detectTrapCategory(value) !== null;
}

// ===========================================================================
// AARATI-18A — Universal Human Staff Brain classification
// ===========================================================================

const LUMBINI_PLACES =
  /bardaghat|bhardaghat|bardghat|butwal|bhairahawa|siddharthanagar|parasi|ramgram|sunwal|devdaha|tilottama|kapilvastu|taulihawa|palpa|tansen|lumbini\b|rupandehi|nawalparasi/i;

const OUT_OF_REGION_PLACES =
  /kathmandu|\bktm\b|pokhara|chitwan|dharan|biratnagar|birgunj|dhangadhi|nepalgunj|hetauda|janakpur|lalitpur|bhaktapur|dhading|sindhuli/i;

const BYPASS_CATEGORIES = new Set([
  "forbidden_employer_request",
  "out_of_scope_service",
  "cv_privacy_support",
  "frustration_or_insult",
  "identity_capability",
  "small_talk_boundary",
  "respect_trust",
  "pricing_support",
  "out_of_region_location",
  "ambiguous_location",
  "command",
]);

// Safe debug log — never logs tokens, CV content, or personal document numbers.
function logGateDecision({ category, action, bypassFlow, reason, normalizedText }) {
  console.log(
    "AARATI_GATE_DECISION:",
    JSON.stringify({
      category,
      action,
      bypassFlow,
      reason,
      normalizedText: String(normalizedText || "").slice(0, 60),
    })
  );
}

/**
 * Classifies a user message into one of 15 categories before flow routing.
 * Priority order: safety → abuse → privacy → out-of-scope → employer/job/worker.
 *
 * Returns one of:
 *   forbidden_employer_request | out_of_scope_service | cv_privacy_support |
 *   frustration_or_insult | identity_capability | small_talk_boundary |
 *   respect_trust | pricing_support | out_of_region_location |
 *   valid_job_search | valid_employer_hiring | valid_worker_registration |
 *   ambiguous_location | command | unknown
 */
export function classifyAaratiMessage({ text = "", conversation = {} } = {}) {
  const value = normalizeAaratiText(text);
  const rawLower = String(text || "").toLowerCase().trim();

  // ── 1. FORBIDDEN_EMPLOYER_REQUEST ──────────────────────────────────────
  if (
    isAaratiFairLaborViolationText(value) ||
    /bas khana.*kaam|khana.*diye.*kaam|bas khana.*staff|salary pachi herna|salary pachi dinchu|salary pachi heramla|paisa pachi herna|paisa pachi dinu|bina.*paisa.*rakhna.*milcha/i.test(value)
  ) {
    logGateDecision({ category: "forbidden_employer_request", action: "hard_refuse", bypassFlow: true, reason: "fair_labor_or_unpaid", normalizedText: value });
    return "forbidden_employer_request";
  }
  // Underage / unsafe hiring with an employment request
  if (
    (isAaratiUnsafeIllegalText(value) && /worker|staff|helper|manche|manxe|kaam garne|chahiyo|chaiyo|chahiyeko/i.test(value)) ||
    /bachha.*helper|bachha.*staff|bachha.*worker|baccha.*helper/i.test(value)
  ) {
    logGateDecision({ category: "forbidden_employer_request", action: "hard_refuse", bypassFlow: true, reason: "underage_or_unsafe", normalizedText: value });
    return "forbidden_employer_request";
  }

  // ── 2. FRUSTRATION_OR_INSULT ────────────────────────────────────────────
  if (
    isAaratiFrustrationText(value) ||
    /kati bhanne|baulayo kia|baulayo\b|bujhinas\b|useless\b|kasto bot.*ho|yo bot.*ho kya|kina bot.*jastai|ramro.*sanga.*answer.*deu|ramro.*answer.*deu/i.test(value)
  ) {
    logGateDecision({ category: "frustration_or_insult", action: "apologize", bypassFlow: true, reason: "frustration", normalizedText: value });
    return "frustration_or_insult";
  }

  // ── 3. CV_PRIVACY_SUPPORT ───────────────────────────────────────────────
  if (
    isAaratiCvPrivacyQuestion(value) ||
    /cv.*pathauna.*dar|cv.*patauna.*dar|cv.*pathau.*dar|cv.*patau.*dar|dar.*cv|document.*safe.*huncha|cv.*safe.*huncha|document.*misuse|cv.*misuse|citizenship.*pathauna.*parcha|privacy.*ko.*dar|malai.*privacy.*dar|cv.*chaina.*job.*milcha|document.*chaina\b|cv.*banauxau|cv.*banaidinu|cv.*optional/i.test(value)
  ) {
    logGateDecision({ category: "cv_privacy_support", action: "reassure_privacy", bypassFlow: true, reason: "cv_privacy", normalizedText: value });
    return "cv_privacy_support";
  }

  // ── 4. OUT_OF_SCOPE_SERVICE ────────────────────────────────────────────
  if (
    /website.*bana|website.*ban\b|app.*bana\b|mobile.*app.*bana|web.*app.*bana|can you.*website|make.*website|create.*website|develop.*website|code.*garna.*help|coding.*garna.*aauxa|love.*letter|write.*love|girlfriend.*message|assignment.*gard|poem.*lekh|photo.*edit\b/i.test(value) &&
    !/developer.*job|it.*job|tech.*job|coding.*job/i.test(value)
  ) {
    logGateDecision({ category: "out_of_scope_service", action: "scope_boundary", bypassFlow: true, reason: "out_of_scope", normalizedText: value });
    return "out_of_scope_service";
  }

  // ── 5. RESPECT_TRUST ───────────────────────────────────────────────────
  if (
    /respect.*gara|malai.*respect|can you respect|ramro.*sanga.*bol(?!\w)|rude.*nabana|mero.*kura.*sunnu|serious.*answer\b/i.test(value)
  ) {
    logGateDecision({ category: "respect_trust", action: "warm_apology", bypassFlow: true, reason: "respect", normalizedText: value });
    return "respect_trust";
  }

  // ── 6. IDENTITY_CAPABILITY ────────────────────────────────────────────
  if (
    isAaratiIdentityQuestionText(value) ||
    /timro.*kam.*k|aarati.*ko.*kaam|jobmate.*le.*k.*garxa|timi.*staff.*ho|can you help me\b|what is your work|what do you do|timro.*work.*k/i.test(value)
  ) {
    logGateDecision({ category: "identity_capability", action: "explain_role", bypassFlow: true, reason: "identity", normalizedText: value });
    return "identity_capability";
  }

  // ── 7. SMALL_TALK_BOUNDARY ────────────────────────────────────────────
  if (
    isAaratiSmallTalkText(value) ||
    /how old|timro.*age|timi.*umar|where do you live|where.*live|timro.*ghar|ghar.*kata|married.*ho\b|timi.*manxe.*ho|khana.*bbayo|khana.*bayo.*kinae/i.test(value)
  ) {
    logGateDecision({ category: "small_talk_boundary", action: "warm_boundary", bypassFlow: true, reason: "small_talk", normalizedText: value });
    return "small_talk_boundary";
  }

  // ── 8. PRICING_SUPPORT ────────────────────────────────────────────────
  if (
    /pricing\b|paisa.*lagcha|lagcha.*paisa|paisa.*magexa|magexa.*paisa|free.*plan|premium.*kati|employer.*plan|plan.*kati|job.*khojna.*paisa/i.test(value)
  ) {
    logGateDecision({ category: "pricing_support", action: "give_pricing", bypassFlow: true, reason: "pricing_question", normalizedText: value });
    return "pricing_support";
  }

  // ── 9. OUT_OF_REGION_LOCATION ─────────────────────────────────────────
  if (
    OUT_OF_REGION_PLACES.test(value) &&
    /job|kaam|kam|staff|worker|vacancy|hire|chahiyo|chaiyo|milcha/i.test(value)
  ) {
    logGateDecision({ category: "out_of_region_location", action: "explain_lumbini_focus", bypassFlow: true, reason: "out_of_region", normalizedText: value });
    return "out_of_region_location";
  }

  // ── 10. VALID_EMPLOYER_HIRING ─────────────────────────────────────────
  if (
    isAaratiEmployerRequestText(value) ||
    /\d+\s*jana.*chahiyo|\d+\s*jana.*chaiyo|waiter.*chahiyo|cook.*chahiyo|helper.*chahiyo|guard.*chahiyo|driver.*chahiyo|receptionist.*chahiyo/i.test(value)
  ) {
    logGateDecision({ category: "valid_employer_hiring", action: "allow_employer_flow", bypassFlow: false, reason: "employer_request", normalizedText: value });
    return "valid_employer_hiring";
  }

  // ── 11. VALID_JOB_SEARCH ─────────────────────────────────────────────
  if (
    LUMBINI_PLACES.test(value) &&
    /job|kaam|kam|vacancy|cha\b|xa\b|milcha|driver|hotel|security|sales|helper|cook|waiter|guard|receptionist|cashier/i.test(value)
  ) {
    logGateDecision({ category: "valid_job_search", action: "allow_job_search", bypassFlow: false, reason: "lumbini_job_query", normalizedText: value });
    return "valid_job_search";
  }

  // ── 12. VALID_WORKER_REGISTRATION ────────────────────────────────────
  if (
    isAaratiJobSeekerRequestText(value) ||
    /ma.*driver.*ho|ma.*fresher|hotel.*ma.*kaam.*garna.*milcha|job khojdai|kaam khojdai/i.test(value)
  ) {
    logGateDecision({ category: "valid_worker_registration", action: "allow_worker_flow", bypassFlow: false, reason: "jobseeker_request", normalizedText: value });
    return "valid_worker_registration";
  }

  // ── 13. AMBIGUOUS_LOCATION ────────────────────────────────────────────
  if (
    /mero.*area.*ma.*job|mero.*area.*ma.*kaam|najikai.*kaam.*cha|ghar.*najik.*kaam|mero.*najik.*job/i.test(value)
  ) {
    logGateDecision({ category: "ambiguous_location", action: "ask_location", bypassFlow: true, reason: "ambiguous_location", normalizedText: value });
    return "ambiguous_location";
  }

  // ── 14. COMMAND ───────────────────────────────────────────────────────
  if (isAaratiRestartCommandText(rawLower)) {
    logGateDecision({ category: "command", action: "show_greeting", bypassFlow: true, reason: "restart_command", normalizedText: value });
    return "command";
  }

  logGateDecision({ category: "unknown", action: "continue_pipeline", bypassFlow: false, reason: "no_category_matched", normalizedText: value });
  return "unknown";
}

/**
 * Returns true when the category means the message must NOT enter any
 * worker/employer/location/Mapbox/job API flow.
 */
export function shouldBypassAaratiFlow({ category = "" } = {}) {
  return BYPASS_CATEGORIES.has(category);
}
