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
