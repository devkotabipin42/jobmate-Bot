// Employer Lead Flow V2.
// Clean state-machine layer only.
// This file is not connected yet.

import { EMPLOYER_MESSAGES as MESSAGES } from "./employerLeadMessages.js";
import { buildEmployerLeadSummary } from "./employerLeadSummary.service.js";
import {
  findActiveEmployerLead,
  upsertEmployerLead,
} from "./employerLeadRepository.service.js";
import {
  buildVacancyFromBrain,
  buildLocationFromBrain,
  hasUsefulBrainEmployerDetails,
  isUsefulVacancy,
  isUsefulLocation,
  parseUrgency,
} from "./employerLeadMapper.service.js";
import {
  parseHiringNeeds,
} from "../../rag/hiringNeedParser.service.js";

export async function handleEmployerLeadFlowV2({
  contact,
  conversation,
  normalizedMessage,
  aaratiBrain,
  aiExtraction = null,
} = {}) {
  const step = Number(conversation?.metadata?.qualificationStep || 0);
  const rawText = normalizedMessage?.message?.text || "";
  const displayName = safeDisplayName(contact?.displayName);

  if (step === 0) {
    return {
      intent: "employer_lead",
      messageToSend: MESSAGES.welcome(displayName),
      nextStep: 1,
      currentState: "ask_business_name",
      leadUpdate: {
        $set: {
          contactPerson: displayName,
          leadStatus: "qualifying",
          hiringNeeds: [],
        },
        $unset: {
          "metadata.pendingVacancy": "",
          "metadata.pendingLocation": "",
          "metadata.pendingEmployerBrain": "",
          "metadata.pendingQuantity": "",
        },
      },
    };
  }

  return {
    intent: "employer_lead",
    messageToSend: MESSAGES.returning(displayName),
    nextStep: step,
    currentState: conversation?.currentState || "idle",
    leadUpdate: {},
  };
}

function safeDisplayName(name) {
  const value = String(name || "").trim();

  if (!value || /unknown|recruiter|admin|business/i.test(value)) {
    return "";
  }

  return value;
}
