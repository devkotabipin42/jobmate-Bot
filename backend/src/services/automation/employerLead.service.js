import { EmployerLead } from "../../models/EmployerLead.model.js";
import { updateConversationState } from "./conversationState.service.js";
import { understandEmployerMessage } from "../ai/aaratiBrain.service.js";
import {
  findRole,
  findLocation,
  normalizeCompanyName,
  extractQuantity,
} from "../rag/jobmateKnowledge.service.js";
import {
  parseHiringNeeds,
} from "../rag/hiringNeedParser.service.js";
import { EMPLOYER_MESSAGES as MESSAGES } from "./employer/employerLeadMessages.js";
import {
  buildEmployerLeadSummary,
  formatEmployerRoleLabel,
} from "./employer/employerLeadSummary.service.js";
import {
  addHiringNeedIfNotDuplicate as repoAddHiringNeedIfNotDuplicate,
  upsertEmployerLead as repoUpsertEmployerLead,
  findActiveEmployerLead,
} from "./employer/employerLeadRepository.service.js";

const URGENCY_MAP = {
  "1": {
    urgency: "this_week",
    urgencyLevel: "urgent",
    scoreAdd: 25,
  },
  "2": {
    urgency: "within_2_weeks",
    urgencyLevel: "high",
    scoreAdd: 15,
  },
  "3": {
    urgency: "this_month",
    urgencyLevel: "medium",
    scoreAdd: 8,
  },
  "4": {
    urgency: "exploring",
    urgencyLevel: "low",
    scoreAdd: 3,
  },
};

export async function handleEmployerLead({
  contact,
  conversation,
  normalizedMessage,
  aiExtraction = null,
}) {
  const step = Number(conversation?.metadata?.qualificationStep || 0);
  const text = normalizedMessage?.message?.normalizedText || "";
  const rawText = normalizedMessage?.message?.text || "";
  const displayName = safeDisplayName(contact?.displayName);

  const aaratiBrain = await understandEmployerMessage({
    text: rawText || text,
    state: conversation?.currentState || "idle",
    step,
  });

  console.log("🧠 AARATI EMPLOYER BRAIN:", {
    source: aaratiBrain?.source,
    gate: aaratiBrain?.aiGate,
    intent: aaratiBrain?.intent,
    confidence: aaratiBrain?.confidence,
    companyName: aaratiBrain?.companyName,
    role: aaratiBrain?.role,
    quantity: aaratiBrain?.quantity,
    location: aaratiBrain?.location,
    district: aaratiBrain?.district,
  });

  let nextStep = step;
  let currentState = conversation.currentState || "idle";
  let messageToSend = "";
  let leadUpdate = {};
  let scoreAdd = 0;
  let isComplete = false;
  let urgencyLevel = "unknown";
  let handoffReason = "";

  const hasAIEmployerDetails =
    aiExtraction?.intent === "employer_lead" &&
    aiExtraction?.confidence >= 0.75 &&
    (aiExtraction?.role || aiExtraction?.keyword || aiExtraction?.quantity || aiExtraction?.location);

  if (step === 0 && hasUsefulBrainEmployerDetails(aaratiBrain) && (aaratiBrain.role || aaratiBrain.location || aaratiBrain.companyName)) {
    const vacancy = buildVacancyFromBrain(aaratiBrain, rawText);
    const location = buildLocationFromBrain(aaratiBrain, rawText);

    const duplicateCheck = await repoAddHiringNeedIfNotDuplicate({
      contactId: contact._id,
      vacancy,
    });

    leadUpdate = {
      $set: {
        contactPerson: displayName,
        businessType: mapBusinessType(aaratiBrain.role || aiExtraction?.businessType || aiExtraction?.category),
        "location.area": location.area,
        "location.district": location.district,
        "location.province": "Lumbini",
        "location.country": "Nepal",
        leadStatus: "qualifying",
        metadata: {
          aiExtracted: true,
          aiExtraction,
          aaratiBrain,
          originalMessage: rawText,
        },
      },
      ...(duplicateCheck?.shouldPush
        ? {
            $push: {
              hiringNeeds: vacancy,
            },
          }
        : {}),
      $inc: {
        score: duplicateCheck?.shouldPush ? 25 : 5,
      },
    };

    messageToSend = MESSAGES.askBusinessNameWithSummary({
      name: displayName,
      ai: aiExtraction,
          aaratiBrain,
    });

    nextStep = aaratiBrain.companyName && aaratiBrain.location && aaratiBrain.role ? 4 : 10;
    currentState = aaratiBrain.companyName && aaratiBrain.location && aaratiBrain.role
      ? "ask_urgency"
      : "ask_business_name_after_ai";
    scoreAdd = 25;
  } else if (step === 0) {
    leadUpdate = {
      $set: {
        contactPerson: displayName,
        leadStatus: "qualifying",
        hiringNeeds: [],
      },
      $unset: {
        "metadata.pendingEmployerBrain": "",
        "metadata.pendingVacancy": "",
        "metadata.pendingLocation": "",
        "metadata.pendingQuantity": "",
      },
    };

    messageToSend = MESSAGES.welcome(displayName);
    nextStep = 1;
    currentState = "ask_business_name";
  } else if (step === 1) {
    if (isVacancyOrLocationGivenInsteadOfCompany(aaratiBrain)) {
      const vacancy = buildVacancyFromBrain(aaratiBrain, rawText);
      const location = buildLocationFromBrain(aaratiBrain, rawText);
      const summary = formatBrainSummary(aaratiBrain);

      leadUpdate = {
        $set: {
          contactPerson: displayName,
          leadStatus: "qualifying",
          "metadata.pendingEmployerBrain": aaratiBrain,
          "metadata.pendingVacancy": vacancy,
          "metadata.pendingLocation": location,
        },
        $inc: {
          score: 8,
        },
      };

      messageToSend = `Hunchha 🙏 Maile yo request note gare.

${summary}

Aba company/business ko naam pathaunu hola.`;
      nextStep = 1;
      currentState = "ask_business_name";
      scoreAdd = 8;
    } else {
      const businessName = aaratiBrain.companyName || normalizeCompanyName(rawText) || "Name not provided";

      const existingLeadForPending = await findActiveEmployerLead({
        contactId: contact._id,
      });

      const pendingVacancy =
        conversation?.metadata?.pendingVacancy ||
        existingLeadForPending?.metadata?.pendingVacancy;

      const pendingLocation =
        conversation?.metadata?.pendingLocation ||
        existingLeadForPending?.metadata?.pendingLocation;

      if (pendingVacancy || pendingLocation) {
        leadUpdate = {
          $set: {
            businessName,
            contactPerson: displayName,
            leadStatus: "qualifying",
            ...(pendingLocation
              ? {
                  "location.area": pendingLocation.area,
                  "location.district": pendingLocation.district,
                  "location.province": "Lumbini",
                  "location.country": "Nepal",
                }
              : {}),
          },
          ...(isUsefulVacancy(pendingVacancy)
            ? {
                $push: {
                  hiringNeeds: pendingVacancy,
                },
              }
            : {}),
          $unset: {
            "metadata.pendingEmployerBrain": "",
            "metadata.pendingVacancy": "",
            "metadata.pendingLocation": "",
          },
          $inc: {
            score: 20,
          },
        };

        if (!isUsefulVacancy(pendingVacancy)) {
          const qty = pendingVacancy?.quantity || 1;

          leadUpdate.$set = {
            ...(leadUpdate.$set || {}),
            "metadata.pendingQuantity": qty,
          };

          messageToSend = MESSAGES.askRoleAfterQuantity
            ? MESSAGES.askRoleAfterQuantity(qty)
            : `${qty} jana staff note gariyo 🙏\n\nKun role ko staff chahinchha?`;

          nextStep = 20;
          currentState = "ask_vacancy_role";
        } else if (isUsefulLocation(pendingLocation)) {
          messageToSend = MESSAGES.askUrgency;
          nextStep = 4;
          currentState = "ask_urgency";
        } else {
          messageToSend = MESSAGES.askLocation;
          nextStep = 3;
          currentState = "ask_location";
        }

        scoreAdd = 20;
      } else {
        leadUpdate = {
          $set: {
            businessName,
            contactPerson: displayName,
            leadStatus: "qualifying",
          },
          $inc: {
            score: 10,
          },
        };

        messageToSend = MESSAGES.askVacancy(businessName);
        nextStep = 2;
        currentState = "ask_vacancy";
        scoreAdd = 10;
      }
    }
  } else if (step === 10) {
    const businessName = aaratiBrain.companyName || normalizeCompanyName(rawText) || "Name not provided";

    const existingLeadForPending = await findActiveEmployerLead({
      contactId: contact._id,
    });

    const pending = getPendingHiringRequest(conversation, existingLeadForPending);

    if (pending.vacancy || pending.location) {
      leadUpdate = {
        $set: {
          businessName,
          contactPerson: displayName,
          leadStatus: "qualifying",
          ...(!isUsefulVacancy(pending.vacancy)
            ? {
                "metadata.pendingQuantity": pending?.vacancy?.quantity || 1,
              }
            : {}),
          ...(isUsefulLocation(pending.location)
            ? {
                "location.area": pending.location.area,
                "location.district": pending.location.district,
                "location.province": "Lumbini",
                "location.country": "Nepal",
              }
            : {}),
        },
        ...(isUsefulVacancy(pending.vacancy)
          ? {
              $push: {
                hiringNeeds: pending.vacancy,
              },
            }
          : {}),
        $unset: {
          "metadata.pendingEmployerBrain": "",
          "metadata.pendingVacancy": "",
          "metadata.pendingLocation": "",
        },
        $inc: {
          score: 15,
        },
      };

      if (!isUsefulVacancy(pending.vacancy)) {
        const qty = pending?.vacancy?.quantity || 1;

        messageToSend = MESSAGES.askRoleAfterQuantity
          ? MESSAGES.askRoleAfterQuantity(qty)
          : `${qty} jana staff note gariyo 🙏\n\nKun role ko staff chahinchha?`;

        nextStep = 20;
        currentState = "ask_vacancy_role";
      } else if (isUsefulLocation(pending.location)) {
        messageToSend = MESSAGES.askUrgency;
        nextStep = 4;
        currentState = "ask_urgency";
      } else {
        messageToSend = MESSAGES.askLocation;
        nextStep = 3;
        currentState = "ask_location";
      }

      scoreAdd = 15;
    } else {
      leadUpdate = {
        $set: {
          businessName,
          contactPerson: displayName,
          leadStatus: "qualifying",
        },
        $inc: {
          score: 10,
        },
      };

      messageToSend = MESSAGES.askVacancy(businessName);
      nextStep = 2;
      currentState = "ask_vacancy";
      scoreAdd = 10;
    }
  } else if (step === 2) {
    const existingLeadForPending = await findActiveEmployerLead({
      contactId: contact._id,
    });

    const pending = getPendingHiringRequest(conversation, existingLeadForPending);

    if (isAlreadyGivenText(rawText) && pending.vacancy) {
      leadUpdate = {
        $set: {
          leadStatus: "qualifying",
          ...(isUsefulLocation(pending.location)
            ? {
                "location.area": pending.location.area,
                "location.district": pending.location.district,
                "location.province": "Lumbini",
                "location.country": "Nepal",
              }
            : {}),
        },
        ...(isUsefulVacancy(pending.vacancy)
          ? {
              $push: {
                hiringNeeds: pending.vacancy,
              },
            }
          : {}),
        $unset: {
          "metadata.pendingEmployerBrain": "",
          "metadata.pendingVacancy": "",
          "metadata.pendingLocation": "",
        },
        $inc: {
          score: 15,
        },
      };

      if (isUsefulLocation(pending.location)) {
        messageToSend = MESSAGES.askUrgency;
        nextStep = 4;
        currentState = "ask_urgency";
      } else {
        messageToSend = MESSAGES.askLocation;
        nextStep = 3;
        currentState = "ask_location";
      }

      scoreAdd = 15;
    } else {
      const onlyQuantity = /^\d+$/.test(String(rawText || "").trim());

      if (onlyQuantity) {
        const quantity = Number(String(rawText || "").trim()) || 1;

        leadUpdate = {
          $set: {
            leadStatus: "qualifying",
            "metadata.pendingQuantity": quantity,
          },
          $inc: {
            score: 3,
          },
        };

        messageToSend = MESSAGES.askRoleAfterQuantity(quantity);
        nextStep = 20;
        currentState = "ask_vacancy_role";
        scoreAdd = 3;
      } else {
        const parsedNeeds = parseHiringNeeds(rawText);

        const vacancy = hasUsefulBrainEmployerDetails(aaratiBrain)
          ? buildVacancyFromBrain(aaratiBrain, rawText)
          : hasAIEmployerDetails
            ? buildVacancyFromAI(aiExtraction)
            : parseVacancy(rawText);

        const pendingQuantity = Number(conversation?.metadata?.pendingQuantity || 0);
        if (pendingQuantity && (!vacancy.quantity || vacancy.quantity === 1)) {
          vacancy.quantity = pendingQuantity;
        }

        const needsToSave =
          parsedNeeds.length
            ? parsedNeeds
            : isUsefulVacancy(vacancy)
              ? [vacancy]
              : [];

        const totalQuantity =
          needsToSave.reduce((sum, need) => sum + Number(need.quantity || 1), 0) ||
          vacancy.quantity ||
          pendingQuantity ||
          1;

        const scoreValue = totalQuantity >= 5 ? 20 : totalQuantity >= 2 ? 12 : 8;

        leadUpdate = {
          $set: {
            leadStatus: "qualifying",
          },
          $unset: {
            "metadata.pendingQuantity": "",
          },
          ...(needsToSave.length
            ? {
                $push: {
                  hiringNeeds: {
                    $each: needsToSave,
                  },
                },
              }
            : {}),
          $inc: {
            score: needsToSave.length ? scoreValue : 3,
          },
        };

        if (!needsToSave.length) {
          const qty = pendingQuantity || vacancy.quantity || 1;
          messageToSend = MESSAGES.askRoleAfterQuantity
            ? MESSAGES.askRoleAfterQuantity(qty)
            : `${qty} jana staff note gariyo 🙏\n\nKun role ko staff chahinchha?`;
          nextStep = 20;
          currentState = "ask_vacancy_role";
        } else {
          messageToSend = MESSAGES.askLocation;
          nextStep = 3;
          currentState = "ask_location";
        }

        scoreAdd = scoreValue;
      }
    }
  } else if (step === 20) {
    const parsedNeeds = parseHiringNeeds(rawText);

    const vacancy = hasUsefulBrainEmployerDetails(aaratiBrain)
      ? buildVacancyFromBrain(aaratiBrain, rawText)
      : parseVacancy(rawText);

    const pendingQuantity = Number(conversation?.metadata?.pendingQuantity || 1);
    if (!parsedNeeds.length) {
      vacancy.quantity = pendingQuantity || vacancy.quantity || 1;
    }

    const needsToSave =
      parsedNeeds.length
        ? parsedNeeds
        : isUsefulVacancy(vacancy)
          ? [vacancy]
          : [];

    const totalQuantity =
      needsToSave.reduce((sum, need) => sum + Number(need.quantity || 1), 0) ||
      pendingQuantity ||
      1;

    const scoreValue = totalQuantity >= 5 ? 20 : totalQuantity >= 2 ? 12 : 8;

    leadUpdate = {
      $set: {
        leadStatus: "qualifying",
        hiringNeeds: [],
      },
      $unset: {
        "metadata.pendingQuantity": "",
      },
      ...(needsToSave.length
        ? {
            $push: {
              hiringNeeds: {
                $each: needsToSave,
              },
            },
          }
        : {}),
      $inc: {
        score: needsToSave.length ? scoreValue : 3,
      },
    };

    if (!needsToSave.length) {
      messageToSend = MESSAGES.askRoleAfterQuantity
        ? MESSAGES.askRoleAfterQuantity(pendingQuantity || 1)
        : `${pendingQuantity || 1} jana staff note gariyo 🙏\n\nKun role ko staff chahinchha?`;
      nextStep = 20;
      currentState = "ask_vacancy_role";
    } else {
      messageToSend = MESSAGES.askLocation;
      nextStep = 3;
      currentState = "ask_location";
    }

    scoreAdd = scoreValue;
  } else if (step === 3) {
    const location = buildLocationFromBrain(aaratiBrain, rawText);

    leadUpdate = {
      $set: {
        "location.area": location.area,
        "location.district": location.district,
        "location.province": "Lumbini",
        "location.country": "Nepal",
      },
      $inc: {
        score: 10,
      },
    };

    messageToSend = MESSAGES.askUrgency;
    nextStep = 4;
    currentState = "ask_urgency";
    scoreAdd = 10;
  } else if (step === 4) {
    const leadBeforeUrgency = await findActiveEmployerLead({
      contactId: contact._id,
    });

    const latestNeed =
      leadBeforeUrgency?.hiringNeeds?.[leadBeforeUrgency.hiringNeeds.length - 1];

    if (!latestNeed || isGenericRole(latestNeed.role)) {
      const qty =
        latestNeed?.quantity ||
        conversation?.metadata?.pendingQuantity ||
        1;

      leadUpdate = {
        $set: {
          leadStatus: "qualifying",
          "metadata.pendingQuantity": qty,
        },
      };

      messageToSend = MESSAGES.askRoleAfterQuantity
        ? MESSAGES.askRoleAfterQuantity(qty)
        : `${qty} jana staff note gariyo 🙏\n\nKun role ko staff chahinchha?`;

      nextStep = 20;
      currentState = "ask_vacancy_role";
      scoreAdd = 0;
      isComplete = false;
    } else {
      const urgency = parseUrgency(text || aiExtraction?.urgency || "");

      leadUpdate = {
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

      const allNeeds = Array.isArray(leadBeforeUrgency?.hiringNeeds)
        ? leadBeforeUrgency.hiringNeeds
        : [];

      const summary = buildEmployerLeadSummary({
        hiringNeeds: allNeeds.length ? allNeeds : [latestNeed],
        location: leadBeforeUrgency?.location || {},
        urgency,
      });

      messageToSend = MESSAGES.completed(displayName, summary);
      nextStep = 5;
      currentState = "completed";
      scoreAdd = urgency.scoreAdd;
      urgencyLevel = urgency.urgencyLevel;
      isComplete = true;
      handoffReason =
        urgency.urgencyLevel === "urgent"
          ? "high_value_employer"
          : "qualified_employer";
    }
  } else {
    messageToSend = MESSAGES.returning(displayName);
    nextStep = step;
    currentState = conversation.currentState || "completed";
  }

  const employerLead = await repoUpsertEmployerLead({
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
    scoreAdd,
    urgencyLevel,
    isComplete,
    needsHuman: isComplete,
    priority: urgencyLevel === "urgent" ? "urgent" : isComplete ? "high" : "low",
    handoffReason,
  };
}


function buildVacancyFromAI(ai) {
  return {
    role: normalizeRole(ai.role || ai.keyword || "staff"),
    quantity: Number(ai.quantity || 1),
    salaryMin: ai.salaryMin ?? null,
    salaryMax: ai.salaryMax ?? null,
    salaryCurrency: "NPR",
    experienceRequired: "unknown",
    urgency: mapAIUrgency(ai.urgency),
  };
}


function detectExperienceRequirement(text = "") {
  const value = String(text || "").toLowerCase();

  if (/(experience|experienced|sipalu|anubhav|anubhabi|kaam gareko|काम गरेको)/i.test(value)) {
    return "experienced";
  }

  if (/(fresher|naya|new|training)/i.test(value)) {
    return "fresher_ok";
  }

  return "unknown";
}



function isVacancyOrLocationGivenInsteadOfCompany(brain = {}) {
  return Boolean(
    brain &&
    !brain.companyName &&
    (
      brain.role && brain.role !== "helper" ||
      brain.location ||
      brain.district
    )
  );
}

function formatBrainSummary(brain = {}) {
  const lines = [];

  if (brain.role && !isGenericRole(brain.role)) {
    lines.push(`Staff: ${brain.quantity || 1} jana ${brain.roleLabel || formatRoleLabel(brain.role)}`);
  } else if (brain.quantity && Number(brain.quantity) > 1) {
    lines.push(`Staff: ${brain.quantity} jana`);
  }

  if (brain.location || brain.district) {
    lines.push(`Location: ${[brain.location, brain.district].filter(Boolean).join(", ")}`);
  }

  return lines.length ? lines.join("\n") : "";
}




function isGenericRole(role = "") {
  const value = String(role || "").toLowerCase().trim();

  if (!value) return true;
  if (/(dua|dui|two|2)_?jana_?staff/i.test(value)) return true;
  if (/\d+_?jana_?staff/i.test(value)) return true;

  return ["helper", "staff", "general_helper", "manxe", "manche", "worker"].includes(value);
}

function isUsefulVacancy(vacancy = {}) {
  return Boolean(vacancy?.role && !isGenericRole(vacancy.role));
}


function hasPendingHiringRequest(conversation = {}, lead = {}) {
  return Boolean(
    conversation?.metadata?.pendingVacancy ||
    conversation?.metadata?.pendingLocation ||
    lead?.metadata?.pendingVacancy ||
    lead?.metadata?.pendingLocation
  );
}

function getPendingHiringRequest(conversation = {}, lead = {}) {
  return {
    vacancy: conversation?.metadata?.pendingVacancy || lead?.metadata?.pendingVacancy || null,
    location: conversation?.metadata?.pendingLocation || lead?.metadata?.pendingLocation || null,
  };
}

function isAlreadyGivenText(text = "") {
  return /(agi|aghi|paila|already|bani sake|bni sake|bhanisake|bhaneko|di sake|deko)/i.test(String(text || ""));
}

function isUsefulLocation(location = {}) {
  if (!location?.area || !location?.district) return false;

  const area = String(location.area || "").toLowerCase().trim();
  const district = String(location.district || "").toLowerCase().trim();

  const invalidGenericLocations = new Set([
    "",
    "lumbini",
    "lumbini province",
    "nepal",
    "nawalparasi west",
    "rupandehi",
    "kapilvastu",
    "dang",
    "banke",
    "bardiya",
    "palpa",
    "gulmi",
    "arghakhanchi",
    "pyuthan",
    "rolpa",
    "rukum east"
  ]);

  if (invalidGenericLocations.has(area)) return false;
  if (area === district) return false;

  return true;
}

function buildVacancyFromBrain(brain = {}, fallbackText = "") {
  const role = brain.role || normalizeRole(extractRole(fallbackText));
  const quantity = Number(brain.quantity || extractFirstNumber(fallbackText) || 1);

  return {
    role,
    quantity,
    experienceRequired: brain.experienceRequired || detectExperienceRequirement(fallbackText),
    urgency: brain.urgency || "unknown",
  };
}

function extractSmallLocalityFromText(text = "") {
  const value = String(text || "")
    .toLowerCase()
    .replace(/mero/g, " ")
    .replace(/address/g, " ")
    .replace(/location/g, " ")
    .replace(/chai/g, " ")
    .replace(/bhanni/g, " ")
    .replace(/bhanne/g, " ")
    .replace(/thau/g, " ")
    .replace(/parxa/g, " ")
    .replace(/parcha/g, " ")
    .replace(/ ma /g, " ")
    .replace(/ ho/g, " ")
    .trim();

  const words = value.split(/\s+/).filter(Boolean);
  const stop = new Set(["nawalparasi", "parasi", "west", "ko", "ma", "ho", "chai", "mero"]);

  const candidates = words.filter((word) => !stop.has(word) && word.length >= 3);
  const last = candidates[candidates.length - 1];

  if (!last) return "";

  return last.charAt(0).toUpperCase() + last.slice(1);
}

function buildLocationFromBrain(brain = {}, fallbackText = "") {
  if (brain.location && brain.district) {
    const isDistrictOnly =
      String(brain.location || "").toLowerCase().trim() ===
      String(brain.district || "").toLowerCase().trim();

    if (isDistrictOnly) {
      const smaller = extractSmallLocalityFromText(fallbackText);

      if (smaller) {
        return {
          area: smaller,
          district: brain.district,
        };
      }
    }

    return {
      area: brain.location,
      district: brain.district,
    };
  }

  const parsed = parseLocation(fallbackText);

  if (
    parsed?.area &&
    parsed?.district &&
    String(parsed.area).toLowerCase() === String(parsed.district).toLowerCase()
  ) {
    const smaller = extractSmallLocalityFromText(fallbackText);

    if (smaller) {
      return {
        area: smaller,
        district: parsed.district,
      };
    }
  }

  return parsed;
}

function hasUsefulBrainEmployerDetails(brain = {}) {
  return Boolean(
    brain &&
    brain.intent === "employer_lead" &&
    Number(brain.confidence || 0) >= 0.6 &&
    (
      brain.companyName ||
      (brain.role && !isGenericRole(brain.role)) ||
      brain.location
    )
  );
}


function parseVacancy(text) {
  const roleResult = findRole(text);
  const quantity = extractQuantity(text);

  return {
    role: roleResult.key,
    quantity,
    experienceRequired: detectExperienceRequirement(text),
    urgency: "unknown",
  };
}

function extractRole(text) {
  const cleanText = cleanRoleText(text);

  if (includesAny(cleanText, ["tiktok", "tik tok", "content creator", "video creator", "reels creator", "social media creator"])) return "content_creator";
  if (includesAny(cleanText, ["marketing", "marketting", "sales marketing", "marketing boy", "marketing staff", "field marketing"])) return "marketing_staff";
  if (includesAny(cleanText, ["sales", "salesman", "sales boy", "sales staff"])) return "sales_staff";
  if (includesAny(cleanText, ["driver", "ड्राइभर", "गाडी"])) return "driver";
  if (includesAny(cleanText, ["security", "guard", "गार्ड"])) return "security_guard";
  if (includesAny(cleanText, ["waiter"])) return "waiter";
  if (includesAny(cleanText, ["hotel", "restaurant", "होटल"])) return "hotel_staff";
  if (includesAny(cleanText, ["helper", "कामदार", "मजदुर"])) return "helper";
  if (includesAny(cleanText, ["sales", "shop", "पसल"])) return "sales_staff";
  if (includesAny(cleanText, ["cleaner", "सफाई"])) return "cleaner";

  return cleanText || "staff";
}

function normalizeRole(role) {
  const value = String(role || "").toLowerCase().trim();

  if (!value || /^\d+$/.test(value)) return "staff";

  if (includesAny(value, ["fullstack", "full stack", "mern"])) return "fullstack_developer";
  if (includesAny(value, ["frontend", "front end", "react", "web developer", "developer", "it", "software", "coder", "programmer"])) return "frontend_developer";
  if (includesAny(value, ["backend", "node", "express", "api developer"])) return "backend_developer";
  if (includesAny(value, ["tiktok", "tik tok", "content creator", "video creator", "reels creator", "social media creator"])) return "content_creator";
  if (includesAny(value, ["marketing", "marketting", "sales marketing", "marketing boy", "marketing staff", "field marketing"])) return "marketing_staff";
  if (includesAny(value, ["sales", "salesman", "sales boy", "sales staff"])) return "sales_staff";
  if (includesAny(value, ["waiter"])) return "waiter";
  if (includesAny(value, ["driver"])) return "driver";
  if (includesAny(value, ["security", "guard"])) return "security_guard";
  if (includesAny(value, ["helper"])) return "helper";
  if (includesAny(value, ["cleaner"])) return "cleaner";
  if (includesAny(value, ["cook", "kitchen"])) return "kitchen_staff";

  return value || "staff";
}


function cleanLocationText(text) {
  return String(text || "")
    .replace(/^mero\s+address\s+chai\s+/i, "")
    .replace(/^mero\s+address\s+/i, "")
    .replace(/^malai\s+/i, "")
    .replace(/\s+ma\s+ho$/i, "")
    .replace(/\s+ho$/i, "")
    .trim();
}

function parseLocation(text) {
  const result = findLocation(text);

  if (result.found) {
    return {
      area: result.canonical,
      district: result.district,
    };
  }

  const raw = cleanLocationText(text);

  return {
    area: raw || "Unknown",
    district: "Unknown",
  };
}

function parseUrgency(text) {
  if (URGENCY_MAP[text]) return URGENCY_MAP[text];

  if (includesAny(text, ["urgent", "immediate", "आजै", "तुरुन्त", "yo hapta", "this_week"])) {
    return URGENCY_MAP["1"];
  }

  if (includesAny(text, ["2 hapta", "१-२", "1-2"])) {
    return URGENCY_MAP["2"];
  }

  if (includesAny(text, ["month", "mahina", "महिना", "this_month"])) {
    return URGENCY_MAP["3"];
  }

  return URGENCY_MAP["4"];
}

function mapAIUrgency(value) {
  if (value === "immediate") return "immediate";
  if (value === "this_week") return "this_week";
  if (value === "this_month") return "this_month";
  if (value === "exploring") return "exploring";
  return "unknown";
}

function mapBusinessType(value) {
  const text = String(value || "").toLowerCase();

  if (includesAny(text, ["hotel", "hospitality", "restaurant"])) {
    return "hotel_restaurant";
  }

  if (includesAny(text, ["factory"])) return "factory_industry";
  if (includesAny(text, ["shop", "sales", "retail"])) return "retail_shop";
  if (includesAny(text, ["school", "education"])) return "school_institute";
  if (includesAny(text, ["clinic", "pharmacy"])) return "clinic_pharmacy";
  if (includesAny(text, ["construction"])) return "construction";

  return "unknown";
}

function formatSalary(ai) {
  if (ai.salaryMin && ai.salaryMax && ai.salaryMin !== ai.salaryMax) {
    return `NPR ${Number(ai.salaryMin).toLocaleString()}–${Number(ai.salaryMax).toLocaleString()}`;
  }

  if (ai.salaryMin || ai.salaryMax) {
    return `NPR ${Number(ai.salaryMin || ai.salaryMax).toLocaleString()}`;
  }

  return "-";
}

function extractFirstNumber(text) {
  const match = String(text || "").match(/\d+/);
  return match ? Number(match[0]) : null;
}

function includesAny(text, keywords = []) {
  const lower = String(text || "").toLowerCase();
  return keywords.some((keyword) => lower.includes(String(keyword).toLowerCase()));
}


function formatRoleLabel(role) {
  return formatEmployerRoleLabel(role);
}



function safeDisplayName(name) {
  const value = String(name || "").trim();

  if (!value || /unknown|recruiter|admin|business/i.test(value)) {
    return "Mitra";
  }

  return value;
}

function cleanBusinessName(text) {
  let value = String(text || "").trim();

  value = value
    .replace(/^ma\s+/i, "")
    .replace(/^mah\s+/i, "")
    .replace(/^mero\s+/i, "")
    .replace(/^hamro\s+/i, "")
    .replace(/^mero\s+company\s+ko\s+name\s+/i, "")
    .replace(/^company\s+ko\s+name\s+/i, "")
    .replace(/^company\s+name\s+/i, "")
    .replace(/\s+company\s+bata\s+ho$/i, "")
    .replace(/\s+bata\s+ho$/i, "")
    .replace(/\s+company\s+ho$/i, "")
    .replace(/\s+ho$/i, "")
    .replace(/\s+bata$/i, "")
    .trim();

  if (!value) return "";

  return value
    .split(/\s+/)
    .map((word) => {
      if (word.length <= 3) return word.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

function cleanRoleText(text) {
  let value = String(text || "").toLowerCase().trim();

  value = value
    .replace(/^malai\s+/i, "")
    .replace(/^malaai\s+/i, "")
    .replace(/^mero\s+/i, "")
    .replace(/^hamro\s+/i, "")
    .replace(/^aauta\s+/i, "")
    .replace(/^auta\s+/i, "")
    .replace(/^euta\s+/i, "")
    .replace(/^ek\s+jana\s+/i, "")
    .replace(/^\d+\s+jana\s+/i, "")
    .replace(/\s+ko\s+lagi\s+\d+\s+jana\s+kt\s+manxe/i, "")
    .replace(/\s+ko\s+lagi\s+\d+\s+jana\s+manxe/i, "")
    .replace(/\s+ko\s+lagi/i, "")
    .replace(/\s+\d+\s+jana\s+kt\s+manxe/i, "")
    .replace(/\s+\d+\s+jana\s+manxe/i, "")
    .replace(/\s+kt\s+manxe/i, "")
    .replace(/\s+manxe/i, "")
    .replace(/\s+chaiyako\s+theo$/i, "")
    .replace(/\s+chayako\s+theo$/i, "")
    .replace(/\s+chaiyeko\s+thiyo$/i, "")
    .replace(/\s+chahiyeko\s+thiyo$/i, "")
    .replace(/\s+chahinchha$/i, "")
    .replace(/\s+chaiyo$/i, "")
    .replace(/\s+chayo$/i, "")
    .trim();

  return value;
}

