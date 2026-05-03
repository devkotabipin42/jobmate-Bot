// Smart gate for deciding when Aarati Brain should call AI.
// AI is expensive and quota-limited, so simple messages use rules/RAG only.

import {
  findRole,
  findLocation,
  extractQuantity,
  normalizeCompanyName
} from "../rag/jobmateKnowledge.service.js";

const SIMPLE_RESTART_RE = /^(start|restart|hi|hello|namaste|namaskar)$/i;
const SIMPLE_NUMBER_RE = /^[1-4]$/;
const EMPLOYER_WORD_RE = /(staff|worker|employee|manxe|manche|hired|hire|chahiyo|chayako|chaiyo|chaheko|kt|kto|helper|driver|guard|marketing|developer|creator|mill|ghar)/i;
const JOBSEEKER_WORD_RE = /(kaam|kam|job|jagir|vacancy|apply|salary|kaam cha|job cha|khojdai)/i;
const COMPANY_HINT_RE = /(company|business|traders|trade|shop|store|hotel|restaurant|clinic|consultancy|pvt|ltd|firm|pasal)/i;
const LOCATION_HINT_RE = /(location|address|thau|area|district|nawalparasi|butwal|bardaghat|bhardaghat|bhardghat|bhairahawa|dhanewa|jamuniya|jimirbar|gopigunj)/i;

function wordCount(text = "") {
  return String(text || "").trim().split(/\s+/).filter(Boolean).length;
}

function isSimpleCompanyName(text = "", state = "", step = 0) {
  const value = String(text || "").trim();

  if (!["ask_business_name", "ask_business_name_after_ai"].includes(state) && ![1, 10].includes(Number(step))) {
    return false;
  }

  if (!value) return false;
  if (wordCount(value) <= 4 && !EMPLOYER_WORD_RE.test(value) && !JOBSEEKER_WORD_RE.test(value)) {
    return true;
  }

  const cleaned = normalizeCompanyName(value);
  return Boolean(cleaned) && wordCount(cleaned) <= 4;
}

function isSimpleLocationAnswer(text = "", state = "", step = 0) {
  if (state !== "ask_location" && Number(step) !== 3) return false;

  const result = findLocation(text);
  if (!result.found) return false;

  const isDistrictOnly =
    String(result.canonical || "").toLowerCase().trim() ===
    String(result.district || "").toLowerCase().trim();

  // If only district matched but user wrote extra locality words,
  // let AI extract the smaller place.
  if (isDistrictOnly && wordCount(text) >= 3) {
    return false;
  }

  return wordCount(text) <= 6;
}

function isSimpleVacancyAnswer(text = "", state = "", step = 0) {
  if (!["ask_vacancy", "ask_vacancy_role"].includes(state) && ![2, 20].includes(Number(step))) return false;

  const role = findRole(text);
  const quantity = extractQuantity(text);

  return role.found && quantity >= 1 && wordCount(text) <= 7;
}

export function shouldUseAaratiAI({ text = "", state = "", step = 0 } = {}) {
  const value = String(text || "").trim();

  if (!value) {
    return { useAI: false, reason: "empty" };
  }

  if (SIMPLE_RESTART_RE.test(value)) {
    return { useAI: false, reason: "restart_or_greeting" };
  }

  if (
    /\bhelp\b|sahayog|madat|help gar|help garnu/i.test(value) &&
    !/human|agent|phone|call|team sanga|manche sanga|manxe sanga|staff|worker|kaam|kam|job/i.test(value)
  ) {
    return { useAI: false, reason: "generic_help_clarification" };
  }

  if (SIMPLE_NUMBER_RE.test(value)) {
    return { useAI: false, reason: "simple_number" };
  }

  if (
    /\b(due|dui|two|2|tin|3|char|4|panch|5)\b/i.test(value) &&
    /\b(staff|manxe|manche|worker)\b/i.test(value) &&
    !/(marketing|cooking|cook|driver|guard|security|developer|kitchen|garage|shop|pasal|promoter|field|sales|helper|house|ghar)/i.test(value)
  ) {
    return { useAI: false, reason: "quantity_only_staff_request" };
  }

  if (isSimpleCompanyName(value, state, step)) {
    return { useAI: false, reason: "simple_company_name" };
  }

  if (isSimpleLocationAnswer(value, state, step)) {
    return { useAI: false, reason: "simple_known_location" };
  }

  if (isSimpleVacancyAnswer(value, state, step)) {
    return { useAI: false, reason: "simple_known_vacancy" };
  }

  const words = wordCount(value);
  const hasMixedEmployerInfo =
    EMPLOYER_WORD_RE.test(value) &&
    (COMPANY_HINT_RE.test(value) || LOCATION_HINT_RE.test(value) || words >= 6);

  const hasNaturalQuestion =
    /\?$|kina|kasari|kati|kun|kaha|kahile|salary|process|document|apply|company/i.test(value);

  const hasMixedJobInfo =
    JOBSEEKER_WORD_RE.test(value) &&
    (LOCATION_HINT_RE.test(value) || words >= 6);

  if (hasMixedEmployerInfo) {
    return { useAI: true, reason: "messy_employer_message" };
  }

  if (hasMixedJobInfo) {
    return { useAI: true, reason: "messy_jobseeker_message" };
  }

  if (hasNaturalQuestion && words >= 4) {
    return { useAI: true, reason: "natural_question" };
  }

  if (words >= 8) {
    return { useAI: true, reason: "long_unclear_message" };
  }

  return { useAI: false, reason: "rag_rules_enough" };
}
