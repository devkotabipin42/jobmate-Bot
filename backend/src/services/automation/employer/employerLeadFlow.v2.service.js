// Employer Lead Flow V2.
// Clean state machine only.
// Not connected to production yet.

import { EMPLOYER_MESSAGES as MESSAGES } from "./employerLeadMessages.js";
import { buildEmployerLeadSummary } from "./employerLeadSummary.service.js";
import {
  findActiveEmployerLead,
  upsertEmployerLead,
} from "./employerLeadRepository.service.js";
import {
  parseUrgency,
  isUsefulVacancy,
  isUsefulLocation,
} from "./employerLeadMapper.service.js";
import {
  parseHiringNeeds,
} from "../../rag/hiringNeedParser.service.js";
import { normalizeCompanyName } from "../../rag/jobmateKnowledge.service.js";
import { updateConversationState } from "../conversationState.service.js";

export async function handleEmployerLeadFlowV2({
  contact,
  conversation,
  normalizedMessage,
  aaratiBrain = {},
  dryRun = false,
} = {}) {
  const step = Number(conversation?.metadata?.qualificationStep || 0);
  const rawText = normalizedMessage?.message?.text || "";
  const text = normalizedMessage?.message?.normalizedText || rawText;
  const displayName = safeDisplayName(contact?.displayName);

  if (step === 0) {
    const leadUpdate = {
      $set: {
        contactPerson: displayName || "",
        leadStatus: "qualifying",
        hiringNeeds: [],
      },
      $unset: {
        "metadata.pendingQuantity": "",
        "metadata.pendingVacancy": "",
        "metadata.pendingLocation": "",
        "metadata.pendingEmployerBrain": "",
      },
    };

    return finalize({
      contact,
      conversation,
      dryRun,
      currentState: "ask_business_name",
      nextStep: 1,
      messageToSend: MESSAGES.welcome(displayName),
      leadUpdate,
    });
  }

  if (step === 1) {
    const businessName =
      aaratiBrain.companyName ||
      normalizeCompanyName(rawText) ||
      "Name not provided";

    const activeLead = dryRun
      ? null
      : await findActiveEmployerLead({ contactId: contact._id });

    const pendingQuantity = Number(
      conversation?.metadata?.pendingQuantity ||
      activeLead?.metadata?.pendingQuantity ||
      0
    );

    const leadUpdate = {
      $set: {
        businessName,
        contactPerson: displayName || "",
        leadStatus: "qualifying",
      },
      $inc: {
        score: 10,
      },
    };

    if (pendingQuantity > 0) {
      leadUpdate.$set["metadata.pendingQuantity"] = pendingQuantity;

      return finalize({
        contact,
        conversation,
        dryRun,
        currentState: "ask_vacancy_role",
        nextStep: 20,
        messageToSend: MESSAGES.askRoleAfterQuantity(pendingQuantity),
        leadUpdate,
      });
    }

    return finalize({
      contact,
      conversation,
      dryRun,
      currentState: "ask_vacancy",
      nextStep: 2,
      messageToSend: MESSAGES.askVacancy(businessName),
      leadUpdate,
    });
  }

  if (step === 2 || step === 20) {
    const needs = parseHiringNeeds(rawText);
    const activeLead = dryRun
      ? null
      : await findActiveEmployerLead({ contactId: contact._id });

    const pendingQuantity = Number(
      conversation?.metadata?.pendingQuantity ||
      activeLead?.metadata?.pendingQuantity ||
      0
    );

    if (!needs.length) {
      const qty = pendingQuantity || 1;

      const leadUpdate = {
        $set: {
          leadStatus: "qualifying",
          "metadata.pendingQuantity": qty,
        },
      };

      return finalize({
        contact,
        conversation,
        dryRun,
        currentState: "ask_vacancy_role",
        nextStep: 20,
        messageToSend: MESSAGES.askRoleAfterQuantity(qty),
        leadUpdate,
      });
    }

    if (pendingQuantity > 0 && needs.length === 1 && Number(needs[0].quantity || 1) === 1) {
      needs[0].quantity = pendingQuantity;
    }

    const totalQuantity = needs.reduce((sum, need) => sum + Number(need.quantity || 1), 0);
    const scoreValue = totalQuantity >= 5 ? 20 : totalQuantity >= 2 ? 12 : 8;

    const leadUpdate = {
      $set: {
        leadStatus: "qualifying",
      },
      $unset: {
        "metadata.pendingQuantity": "",
      },
      $push: {
        hiringNeeds: {
          $each: needs,
        },
      },
      $inc: {
        score: scoreValue,
      },
    };

    return finalize({
      contact,
      conversation,
      dryRun,
      currentState: "ask_location",
      nextStep: 3,
      messageToSend: MESSAGES.askLocation,
      leadUpdate,
    });
  }

  if (step === 3) {
    const location = {
      area: aaratiBrain.location || rawText,
      district: aaratiBrain.district || "",
    };

    // Keep simple known locations from RAG if brain did not provide district.
    const { parseLocation } = await import("./employerLeadMapper.service.js");
    const mappedLocation = isUsefulLocation(location) ? location : parseLocation(rawText);

    const leadUpdate = {
      $set: {
        "location.area": mappedLocation.area,
        "location.district": mappedLocation.district,
        "location.province": "Lumbini",
        "location.country": "Nepal",
      },
      $inc: {
        score: 10,
      },
    };

    return finalize({
      contact,
      conversation,
      dryRun,
      currentState: "ask_urgency",
      nextStep: 4,
      messageToSend: MESSAGES.askUrgency,
      leadUpdate,
    });
  }

  if (step === 4) {
    const urgency = parseUrgency(text);
    const activeLead = dryRun
      ? {
          hiringNeeds: conversation?.metadata?.hiringNeeds || [],
          location: conversation?.metadata?.location || {},
        }
      : await findActiveEmployerLead({ contactId: contact._id });

    const hiringNeeds = activeLead?.hiringNeeds || [];

    const hasUsefulNeed = hiringNeeds.some((need) => isUsefulVacancy(need));

    if (!hasUsefulNeed) {
      const qty = Number(conversation?.metadata?.pendingQuantity || 1);

      return finalize({
        contact,
        conversation,
        dryRun,
        currentState: "ask_vacancy_role",
        nextStep: 20,
        messageToSend: MESSAGES.askRoleAfterQuantity(qty),
        leadUpdate: {
          $set: {
            leadStatus: "qualifying",
            "metadata.pendingQuantity": qty,
          },
        },
      });
    }

    const summary = buildEmployerLeadSummary({
      hiringNeeds,
      location: activeLead?.location || {},
      urgency,
    });

    const leadUpdate = {
      $set: {
        "hiringNeeds.$[].urgency": urgency.urgency,
        leadStatus: urgency.urgencyLevel === "urgent" ? "hot" : "interested",
        urgencyLevel: urgency.urgencyLevel,
        lastQualifiedAt: new Date(),
      },
      $inc: {
        score: urgency.scoreAdd,
      },
    };

    return finalize({
      contact,
      conversation,
      dryRun,
      currentState: "completed",
      nextStep: 5,
      messageToSend: MESSAGES.completed(displayName, summary),
      leadUpdate,
      isComplete: true,
      urgencyLevel: urgency.urgencyLevel,
      handoffReason:
        urgency.urgencyLevel === "urgent"
          ? "high_value_employer"
          : "qualified_employer",
    });
  }

  return finalize({
    contact,
    conversation,
    currentState: conversation?.currentState || "completed",
    nextStep: step,
    messageToSend: MESSAGES.returning(displayName),
    leadUpdate: {},
  });
}

async function finalize({
  contact,
  conversation,
  dryRun = false,
  currentState,
  nextStep,
  messageToSend,
  leadUpdate,
  isComplete = false,
  urgencyLevel = "unknown",
  handoffReason = "",
}) {
  if (dryRun) {
    return {
      intent: "employer_lead",
      messageToSend,
      nextStep,
      currentState,
      employerLead: null,
      conversation: {
        ...conversation,
        currentState,
        metadata: {
          ...(conversation?.metadata || {}),
          qualificationStep: nextStep,
          lastQuestion: messageToSend,
        },
      },
      leadUpdate,
      scoreAdd: 0,
      urgencyLevel,
      isComplete,
      needsHuman: isComplete,
      priority: urgencyLevel === "urgent" ? "urgent" : isComplete ? "high" : "low",
      handoffReason,
    };
  }

  const employerLead = await upsertEmployerLead({
    contact,
    leadUpdate,
  });

  const updatedConversation = await updateConversationState({
    conversation,
    currentState,
    qualificationStep: nextStep,
    lastQuestion: messageToSend,
  });

  return {
    intent: "employer_lead",
    messageToSend,
    nextStep,
    currentState,
    employerLead,
    conversation: updatedConversation,
    scoreAdd: 0,
    urgencyLevel,
    isComplete,
    needsHuman: isComplete,
    priority: urgencyLevel === "urgent" ? "urgent" : isComplete ? "high" : "low",
    handoffReason,
  };
}

function safeDisplayName(name) {
  const value = String(name || "").trim();

  if (!value || /unknown|recruiter|admin|business/i.test(value)) {
    return "";
  }

  return value;
}
