import {
  getAaratiRawText,
  isAaratiEmployerRequestText,
  isAaratiJobSeekerRequestText,
} from "./aaratiTextNormalizer.service.js";

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

export function getAaratiEmployerDirectRoute({ normalized, conversation } = {}) {
  const text = getAaratiRawText(normalized);
  const state = String(conversation?.currentState || "");

  if (!text) return null;
  if (ACTIVE_WORKER_STATES.has(state)) return null;
  if (isAaratiJobSeekerRequestText(text)) return null;

  if (!isAaratiEmployerRequestText(text)) return null;

  return {
    intent: "employer_lead",
    source: "aarati_employer_direct_router",
    reason: "direct_employer_staff_request",
  };
}
