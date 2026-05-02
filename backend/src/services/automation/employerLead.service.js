import { EmployerLead } from "../../models/EmployerLead.model.js";
import { updateConversationState } from "./conversationState.service.js";
import {
  findRole,
  findLocation,
  normalizeCompanyName,
  extractQuantity
} from "../rag/jobmateKnowledge.service.js";

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

const MESSAGES = {
  welcome: (name) =>
    `Namaste ${name || "Mitra"} ji 🙏

Ma Aarati, JobMate team bata.
Tapai lai staff/worker khojna sahayog garna sakchu.

Suruma, tapai ko company/business ko naam ke ho?`,

  askBusinessNameWithSummary: ({ name, ai }) =>
    `Dhanyabaad ${name || "Mitra"} ji 🙏

Tapai ko hiring requirement note bhayo:

👥 Role: ${ai.role || ai.keyword || "staff"}
🔢 Quantity: ${ai.quantity || 1}
📍 Location: ${ai.location || "-"}
💰 Salary: ${formatSalary(ai)}

Aba tapai ko business/company name ke ho?`,

  askVacancy: (businessName) =>
    `Dhanyabaad 🙏
${businessName || "Tapai ko business"} ko details note gariyo.

Tapai lai kun role ko lagi kati jana staff chahinchha?

Example:
- 1 jana Frontend Developer
- 3 jana Driver
- 5 jana Security Guard
- 2 jana Kitchen Helper`,

  askRoleAfterQuantity: (quantity) =>
    `${quantity || 1} jana staff note gariyo 🙏

Kun role ko staff chahinchha?
Example:
- Frontend Developer
- Driver
- Security Guard
- Kitchen Helper`,

  askLocation: `Thik chha, details note gariyo. ✅

Tapai ko business kun area wa district ma chha?
Example: Bardaghat, Butwal, Bhairahawa, Parasi`,

  askUrgency: `Dhanyabaad. 👍

Tapailai employees kahile dekhi chahinchha?

1. Immediate / yo hapta
2. 1-2 hapta bhitra
3. Yo mahina bhitra
4. Exploring / bujhdai`,

  completed: (name, summary) =>
    `Dhanyabaad ${name || "Mitra"} ji! 🙏

Tapai ko hiring details receive bhayo.

${summary}

Phone on rakhnu hola, hamro team le chhittai sampark garchha. 📞`,

  returning: (name) =>
    `Namaste ${name || "Mitra"} ji! 😊

Tapai ko business details hami sanga safe chha.
Yedi thap vacancy wa new information dinu chha bhane yahin message pathaunu hola.`,
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

  if (step === 0 && hasAIEmployerDetails) {
    const vacancy = buildVacancyFromAI(aiExtraction);
    const location = parseLocation(aiExtraction.location || rawText);

    const duplicateCheck = await addHiringNeedIfNotDuplicate({
      contactId: contact._id,
      vacancy,
    });

    leadUpdate = {
      $set: {
        contactPerson: displayName,
        businessType: mapBusinessType(aiExtraction.businessType || aiExtraction.category),
        "location.area": location.area,
        "location.district": location.district,
        "location.province": "Lumbini",
        "location.country": "Nepal",
        leadStatus: "qualifying",
        metadata: {
          aiExtracted: true,
          aiExtraction,
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
    });

    nextStep = 10;
    currentState = "ask_business_name_after_ai";
    scoreAdd = 25;
  } else if (step === 0) {
    messageToSend = MESSAGES.welcome(displayName);
    nextStep = 1;
    currentState = "ask_business_name";
  } else if (step === 1) {
    const businessName = normalizeCompanyName(rawText) || "Name not provided";

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
  } else if (step === 10) {
    const businessName = normalizeCompanyName(rawText) || "Name not provided";

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

    messageToSend = MESSAGES.askUrgency;
    nextStep = 4;
    currentState = "ask_urgency";
    scoreAdd = 10;
  } else if (step === 2) {
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
      const vacancy = hasAIEmployerDetails
        ? buildVacancyFromAI(aiExtraction)
        : parseVacancy(rawText);

      const pendingQuantity = Number(conversation?.metadata?.pendingQuantity || 0);
      if (pendingQuantity && (!vacancy.quantity || vacancy.quantity === 1)) {
        vacancy.quantity = pendingQuantity;
      }

      const duplicateCheck = await addHiringNeedIfNotDuplicate({
        contactId: contact._id,
        vacancy,
      });

      const scoreValue = vacancy.quantity >= 5 ? 20 : vacancy.quantity >= 2 ? 12 : 8;

      leadUpdate = {
        $set: {
          leadStatus: "qualifying",
        },
        $unset: {
          "metadata.pendingQuantity": "",
        },
        ...(duplicateCheck?.shouldPush
          ? {
              $push: {
                hiringNeeds: vacancy,
              },
            }
          : {}),
        $inc: {
          score: duplicateCheck?.shouldPush ? scoreValue : 3,
        },
      };

      messageToSend = MESSAGES.askLocation;
      nextStep = 3;
      currentState = "ask_location";
      scoreAdd = vacancy.quantity >= 5 ? 20 : vacancy.quantity >= 2 ? 12 : 8;
    }
  } else if (step === 20) {
    const vacancy = parseVacancy(rawText);
    const pendingQuantity = Number(conversation?.metadata?.pendingQuantity || 1);
    vacancy.quantity = pendingQuantity || vacancy.quantity || 1;

    const duplicateCheck = await addHiringNeedIfNotDuplicate({
      contactId: contact._id,
      vacancy,
    });

    const scoreValue = vacancy.quantity >= 5 ? 20 : vacancy.quantity >= 2 ? 12 : 8;

    leadUpdate = {
      $set: {
        leadStatus: "qualifying",
      },
      $unset: {
        "metadata.pendingQuantity": "",
      },
      ...(duplicateCheck?.shouldPush
        ? {
            $push: {
              hiringNeeds: vacancy,
            },
          }
        : {}),
      $inc: {
        score: duplicateCheck?.shouldPush ? scoreValue : 3,
      },
    };

    messageToSend = MESSAGES.askLocation;
    nextStep = 3;
    currentState = "ask_location";
    scoreAdd = scoreValue;
  } else if (step === 3) {
    const location = parseLocation(rawText);

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

    const currentLead = await EmployerLead.findOne({
      contactId: contact._id,
      leadStatus: { $nin: ["paid", "closed", "invalid"] },
    }).lean();

    const latestNeed = currentLead?.hiringNeeds?.[currentLead.hiringNeeds.length - 1] || {};
    const roleLabel = formatRoleLabel(latestNeed.role || "staff");
    const quantityLabel = Number(latestNeed.quantity || 1);
    const areaLabel = currentLead?.location?.area || "-";
    const districtLabel = currentLead?.location?.district || "-";

    const summary = `✅ Staff: ${quantityLabel} jana ${formatRoleLabel(roleLabel)}
✅ Location: ${areaLabel}, ${districtLabel}
✅ Urgency: ${urgency.urgency}
✅ Priority: ${urgency.urgencyLevel}`;

    messageToSend = MESSAGES.completed(displayName, summary);
    nextStep = 5;
    currentState = "completed";
    scoreAdd = urgency.scoreAdd;
    urgencyLevel = urgency.urgencyLevel;
    isComplete = true;
    handoffReason = urgency.urgencyLevel === "urgent" ? "high_value_employer" : "qualified_employer";
  } else {
    messageToSend = MESSAGES.returning(displayName);
    nextStep = step;
    currentState = conversation.currentState || "completed";
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
    scoreAdd,
    urgencyLevel,
    isComplete,
    needsHuman: isComplete,
    priority: urgencyLevel === "urgent" ? "urgent" : isComplete ? "high" : "low",
    handoffReason,
  };
}

async function addHiringNeedIfNotDuplicate({ contactId, vacancy }) {
  if (!contactId || !vacancy) return;

  const existingLead = await EmployerLead.findOne({
    contactId,
    leadStatus: { $nin: ["paid", "closed", "invalid"] },
  }).lean();

  const alreadyExists = existingLead?.hiringNeeds?.some((need) => {
    return (
      String(need.role || "") === String(vacancy.role || "") &&
      Number(need.quantity || 1) === Number(vacancy.quantity || 1) &&
      Number(need.salaryMin || 0) === Number(vacancy.salaryMin || 0) &&
      Number(need.salaryMax || 0) === Number(vacancy.salaryMax || 0)
    );
  });

  if (alreadyExists) {
    return {
      shouldPush: false,
    };
  }

  return {
    shouldPush: true,
  };
}

async function upsertEmployerLead({ contact, leadUpdate }) {
  const baseSet = {
    contactId: contact._id,
    phone: contact.phone,
    whatsapp: contact.phone,
    source: "whatsapp",
  };

  const update = {
    $setOnInsert: baseSet,
    ...(leadUpdate || {}),
  };

  return EmployerLead.findOneAndUpdate(
    {
      contactId: contact._id,
      leadStatus: { $nin: ["paid", "closed", "invalid"] },
    },
    update,
    {
      returnDocument: "after",
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );
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
  const value = String(role || "staff").toLowerCase().trim();

  const labels = {
    frontend_developer: "Frontend Developer",
    backend_developer: "Backend Developer",
    fullstack_developer: "Full Stack Developer",
    security_guard: "Security Guard",
    hotel_staff: "Hotel Staff",
    sales_staff: "Sales Staff",
    kitchen_staff: "Kitchen Staff",
    driver: "Driver",
    waiter: "Waiter",
    helper: "Helper",
    cleaner: "Cleaner",
    staff: "Staff",
  };

  if (labels[value]) return labels[value];

  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
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

