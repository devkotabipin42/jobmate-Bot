import {
  extractQuantity,
  findLocation,
  findRole,
  normalizeCompanyName,
} from "../rag/jobmateKnowledge.service.js";
import { createLeadDraft } from "./leadDraft.service.js";
import { createTaskDraft } from "./taskDraft.service.js";
import { formatReply } from "./replyFormatter.service.js";

const REQUIRED_EMPLOYER_FIELDS = [
  "businessName",
  "contactPerson",
  "providedPhone",
  "location",
  "role",
  "quantity",
  "salaryRange",
  "timing",
  "foodAccommodation",
  "urgency",
  "experienceRequired",
  "genderPreference",
  "feeCondition",
];

export function handleEmployerLeadFlow({
  contact = {},
  state = {},
  text = "",
  startedByIntent = false,
} = {}) {
  const previousData = state?.flow === "employer" ? state.data || {} : {};
  const extracted = extractEmployerDetails({ text, contact });
  const mergedData = removeEmptyValues({
    ...previousData,
    ...extracted,
    phone: contact?.phone || previousData.phone || "",
  });
  const data = applyEmployerSkipAndCorrections({
    data: mergedData,
    previousData,
    currentStep: state?.step,
    text,
  });
  const resultIntent = isEmployerFeeUnderstandingMessage(text)
    ? "employer_fee_understanding"
    : "employer_lead";

  const missing = getMissingEmployerFields(data);

  if (missing.length > 0) {
    const nextState = {
      ...state,
      flow: "employer",
      step: missing[0],
      status: "collecting",
      data,
      updatedAt: new Date().toISOString(),
    };

    return {
      handled: true,
      intent: resultIntent,
      conversationIntent: "employer_lead",
      currentState: `jobmate_employer_${missing[0]}`,
      state: nextState,
      reply: formatReply(buildEmployerPrompt({ missing, data, startedByIntent })),
      needsHuman: false,
      priority: "low",
      reason: startedByIntent ? "employer_flow_started" : "employer_flow_collecting",
    };
  }

  const leadDraft = createLeadDraft({
    type: "employer_lead",
    contact,
    data: {
      ...data,
      roleNeeded: data.role,
      numberNeeded: data.quantity,
      experienceNeeded: data.experienceRequired,
      feeUnderstanding: data.feeCondition,
      leadKind: "employer_hiring_requirement",
      requirementConfirmedByHuman: false,
    },
    notes: [
      "Confirm employer requirement before sharing worker profiles.",
      "Salary, payment, and settlement require human review.",
    ],
  });

  const taskDraft = createTaskDraft({
    type: "employer_requirement_review",
    leadDraft,
    contact,
    title: "Review employer hiring requirement",
    priority: "high",
    data: {
      employerLeadDraftId: leadDraft.id,
      role: data.role,
      quantity: data.quantity,
      location: data.location,
      salaryRange: data.salaryRange,
    },
  });

  const nextState = {
    ...state,
    flow: null,
    step: null,
    status: "employer_draft_pending_human_approval",
    data: {},
    leadDrafts: [...(state.leadDrafts || []), leadDraft].slice(-10),
    taskDrafts: [...(state.taskDrafts || []), taskDraft].slice(-10),
    lastCompletedLeadDraft: leadDraft,
    lastCompletedTaskDraft: taskDraft,
    updatedAt: new Date().toISOString(),
  };

  return {
    handled: true,
    intent: resultIntent,
    conversationIntent: "employer_lead",
    currentState: "jobmate_employer_draft_pending_approval",
    state: nextState,
    leadDraft,
    taskDraft,
    reply: formatReply(
      [
        "Employer lead draft ra review task banayo. Human team le requirement confirm garepachi matra verified profiles share garne process agadi badhchha.",
        "Salary, payment, ra settlement yo assistant le final gardaina.",
      ].join("\n\n")
    ),
    needsHuman: true,
    priority: "high",
    reason: "employer_lead_draft_created",
  };
}

export function buildEmployerResumePrompt({ state = {} } = {}) {
  const data = state?.data || {};
  const missing = getMissingEmployerFields(data);

  if (!missing.length) {
    return "Aghi ko employer detail complete jasto cha. Human team requirement confirm garepachi process agadi badhchha.";
  }

  return buildEmployerPrompt({ missing, data, startedByIntent: false });
}

export function extractEmployerDetails({ text = "" } = {}) {
  const rawRole = findRole(text);
  const role = shouldIgnoreBusinessOnlyRole(text) ? { found: false } : rawRole;
  const fallbackRole = parseEmployerRoleFallback(text);
  const location = findLocation(text);
  const quantity = parseQuantity(text, role?.found || Boolean(fallbackRole));

  return removeEmptyValues({
    businessName: parseBusinessName(text),
    businessSector: parseBusinessSector(text),
    contactPerson: parseContactPerson(text),
    providedPhone: parsePhoneNumber(text),
    role: fallbackRole || (role?.found ? role.label : ""),
    quantity,
    location: location?.found
      ? {
          area: location.canonical,
          district: location.district || "",
          province: location.province || "Lumbini",
          country: "Nepal",
        }
      : parseLooseLocation(text),
    salaryRange: parseSalaryRange(text),
    timing: parseTiming(text),
    foodProvided: parseFoodProvided(text),
    accommodationProvided: parseAccommodationProvided(text),
    urgency: parseUrgency(text),
    experienceRequired: parseExperienceRequired(text),
    genderPreference: parseGenderPreference(text),
    feeCondition: parseFeeCondition(text),
  });
}

function shouldIgnoreBusinessOnlyRole(text = "") {
  const value = String(text || "").toLowerCase();

  return /\bbusiness\b/i.test(value) &&
    !/\b(role|staff|worker|waiter|cook|driver|helper|guard|security|sales|cleaner|receptionist|accountant|teacher|chahiyo|chaiyo|chainxa|chahinxa)\b/i.test(value);
}

function buildEmployerPrompt({ missing = [], data = {}, startedByIntent = false } = {}) {
  const known = [];
  if (data.businessName) known.push(`business: ${data.businessName}`);
  if (data.role) known.push(`role: ${data.role}`);
  if (data.quantity) known.push(`count: ${data.quantity}`);
  if (data.location?.area) known.push(`area: ${data.location.area}`);
  if (data.salaryRange) known.push(`salary: NPR ${data.salaryRange.min}-${data.salaryRange.max}`);
  if (data.timing) known.push(`timing: ${data.timing}`);
  if (typeof data.foodProvided === "boolean") known.push(`food: ${data.foodProvided ? "cha" : "chaina"}`);
  if (data.urgency) known.push(`urgency: ${data.urgency.label}`);

  const askText = missing.map(employerFieldLabel).join(", ");

  if (known.length) {
    return `Yo hiring detail note gare: ${known.join("; ")}.\n\nAba ${askText} pathaunu hola.`;
  }

  if (startedByIntent) {
    return "Staff request note gare. Human team le requirement confirm garepachi matra verified profiles share garne process agadi badhchha.\n\nBusiness name, staff role/count, location, salary range, ra kahile dekhi staff chahinchha pathaunu hola.";
  }

  return `Aba ${askText} pathaunu hola.`;
}

function getMissingEmployerFields(data = {}) {
  return REQUIRED_EMPLOYER_FIELDS.filter((field) => {
    if (field === "location") return !data.location?.area;
    if (field === "foodAccommodation") {
      return typeof data.foodProvided !== "boolean" &&
        typeof data.accommodationProvided !== "boolean" &&
        !isFieldSkipped(data, "foodAccommodation");
    }
    if (isFieldSkipped(data, field)) return false;
    return !data[field];
  });
}

function employerFieldLabel(field) {
  const labels = {
    businessName: "business name",
    contactPerson: "contact person",
    providedPhone: "phone number",
    role: "kun role ko staff chahinchha",
    quantity: "kati jana staff chahinchha",
    location: "business location",
    salaryRange: "salary range",
    timing: "duty timing",
    foodAccommodation: "food/accommodation cha ki chaina",
    urgency: "kahile dekhi staff chahinchha",
    experienceRequired: "experience requirement",
    genderPreference: "gender preference any/male/female",
    feeCondition: "fee/payment worker join pachi human team sanga clear garne ho ki",
  };

  return labels[field] || field;
}

function parseBusinessName(text = "") {
  const value = String(text || "");

  const localName = value.match(/\b(?:pasal|shop|hotel|restaurant|business|company|firm)\s+ko\s+naam\s+(.+?)(?:\s+ho\b|[,.;\n]|$)/i);
  if (localName) {
    const cleaned = cleanBusinessName(localName[1]);
    if (isUsefulBusinessName(cleaned)) {
      return normalizeEmployerBusinessName(cleaned);
    }
  }

  const beforeOwner = value.match(/\b(?:name|naam)\s*(?:is|ho|:)?\s+(.+?)\s+(?:owner|proprietor|sahu)\b/i);
  if (beforeOwner) {
    const cleaned = cleanBusinessName(beforeOwner[1]);
    if (isUsefulBusinessName(cleaned)) {
      return normalizeEmployerBusinessName(cleaned);
    }
  }

  const explicit = value.match(/\b(?:business name|company name|firm name|business|company|firm|name|naam)\s*(?:is|ho|:)?\s+([^,.;\n]+)/i);
  if (explicit) {
    const cleaned = cleanBusinessName(explicit[1]);
    if (isUsefulBusinessName(cleaned)) {
      return normalizeEmployerBusinessName(cleaned);
    }
  }

  const namedPlace = value.match(/\b([a-z][a-z\s&.'-]{1,35}\s+(?:hotel|restaurant|pasal|traders|store|school|factory))\s*(?:ho|cha|chha|xa)?\b/i);
  if (namedPlace) {
    const cleaned = cleanBusinessName(namedPlace[1]);
    if (isUsefulBusinessName(cleaned)) {
      return normalizeEmployerBusinessName(cleaned);
    }
  }

  return "";
}

function parseBusinessSector(text = "") {
  const value = String(text || "").toLowerCase();

  if (/\bhotel|restaurant|cafe|khaja ghar\b/i.test(value)) {
    return "hotel_restaurant";
  }

  if (/\bshop|pasal|store|retail\b/i.test(value)) {
    return "retail_shop";
  }

  if (/\bfactory|industry|manufacturing\b/i.test(value)) {
    return "factory_industry";
  }

  return "";
}

function parseContactPerson(text = "") {
  const match = String(text || "").match(/\b(?:contact\s*(?:person|name)?|owner|proprietor|sahu)\s*(?:is|ho|:)?\s+([a-z][a-z\s.'-]{1,35})/i);
  if (!match) return "";
  return titleCase(cleanPhrase(match[1]));
}

function parsePhoneNumber(text = "") {
  const match = String(text || "").match(/\b(9[678]\d{8})\b/);
  return match?.[1] || "";
}

function parseQuantity(text = "", roleFound = false) {
  const value = String(text || "").toLowerCase();

  const explicit = value.match(/\b(\d{1,3})\s*(jana|staff|worker|employee|manxe|manche|candidate)\b/i);
  if (explicit) return Number(explicit[1]);

  const beforeRole = value.match(/\b(\d{1,3})\s*(waiter|cook|driver|helper|guard|security|sales|cleaner|receptionist|accountant|teacher)\b/i);
  if (beforeRole) return Number(beforeRole[1]);

  const beforeMultiRole = value.match(/\b(\d{1,3})\s*(kitchen\s+helper|shop\s+helper|hotel\s+helper)\b/i);
  if (beforeMultiRole) return Number(beforeMultiRole[1]);

  const numberLabel = value.match(/\bnumber\s*(?:is|ho|:)?\s*(\d{1,3})\b/i);
  if (numberLabel) return Number(numberLabel[1]);

  if (isEmployerFeeUnderstandingMessage(value)) {
    return null;
  }

  if (roleFound || /\b(staff|worker|employee|manxe|manche)\b/i.test(value)) {
    return extractQuantity(value);
  }

  return null;
}

function parseEmployerRoleFallback(text = "") {
  const value = String(text || "").toLowerCase();
  if (
    /\bbusiness\b/i.test(value) &&
    !/\b(role|staff|worker|waiter|cook|driver|helper|guard|security|sales|cleaner|receptionist|accountant|teacher)\b/i.test(value)
  ) {
    return "";
  }

  const roles = [
    ["kitchen helper", "Kitchen Helper"],
    ["shop helper", "Shop Helper"],
    ["hotel helper", "Hotel Helper"],
    ["waiter", "Waiter"],
    ["cook", "Cook"],
    ["kitchen", "Kitchen Staff"],
    ["driver", "Driver"],
    ["security", "Security Guard"],
    ["guard", "Security Guard"],
    ["helper", "Helper"],
    ["cleaner", "Cleaner"],
    ["sales", "Sales Staff"],
    ["shop", "Shop Staff"],
    ["factory", "Factory Worker"],
    ["teacher", "Teacher"],
    ["accountant", "Accountant"],
  ];

  const found = roles.find(([needle]) => value.includes(needle));
  return found?.[1] || "";
}

function parseLooseLocation(text = "") {
  const value = String(text || "");
  const match = value.match(/\b(?:location|address|area|thau)\s*(?:is|ho|:)?\s+([a-z][a-z\s.'-]{1,30})/i);
  if (!match) return null;

  return {
    area: titleCase(cleanPhrase(match[1])),
    district: "",
    province: "Lumbini",
    country: "Nepal",
  };
}

function parseSalaryRange(text = "") {
  const value = String(text || "").toLowerCase();
  const kRange = value.match(/\b(\d{1,3})\s*k\s*(?:-|to|dekhi)\s*(\d{1,3})\s*k\b/i);
  if (kRange) {
    return {
      min: Number(kRange[1]) * 1000,
      max: Number(kRange[2]) * 1000,
      currency: "NPR",
      finalizedByBot: false,
    };
  }

  const range = value.match(/\b(\d{4,6})\s*(?:-|to|dekhi)\s*(\d{4,6})\b/i);
  if (range) {
    return {
      min: Number(range[1]),
      max: Number(range[2]),
      currency: "NPR",
      finalizedByBot: false,
    };
  }

  const single = value.match(/\b(?:salary|talaab|talab|npr|rs)\s*(\d{4,6})\b/i) ||
    value.match(/\b(?:salary|talaab|talab)\s+(?:dinchu|dine|dina)\s*(\d{4,6})\b/i) ||
    value.match(/\b(\d{4,6})\s*(?:salary|npr|rs)\b/i);
  if (single) {
    return {
      min: Number(single[1]),
      max: Number(single[1]),
      currency: "NPR",
      finalizedByBot: false,
    };
  }

  const singleK = value.match(/\b(?:salary|talaab|talab|npr|rs)\s*(\d{1,3})\s*k\b/i) ||
    value.match(/\b(\d{1,3})\s*k\s*(?:salary|npr|rs)?\b/i);
  if (singleK && /salary|talaab|talab|npr|rs|\bk\b/i.test(value)) {
    return {
      min: Number(singleK[1]) * 1000,
      max: Number(singleK[1]) * 1000,
      currency: "NPR",
      finalizedByBot: false,
    };
  }

  return null;
}

function parseTiming(text = "") {
  const value = String(text || "");
  const explicit = value.match(/\btiming\s*(?:is|ho|:)?\s*([0-9]{1,2}\s*(?:am|pm)?\s*-\s*[0-9]{1,2}\s*(?:am|pm)?)/i);
  if (explicit) return explicit[1].replace(/\s+/g, "");

  const explicitTo = value.match(/\btiming\s*(?:is|ho|:)?\s*([0-9]{1,2}\s*(?:am|pm)?\s*(?:to|dekhi)\s*[0-9]{1,2}\s*(?:am|pm)?)/i);
  if (explicitTo) return explicitTo[1].replace(/\s+/g, "");

  const range = value.match(/\b([0-9]{1,2}\s*(?:am|pm)\s*-\s*[0-9]{1,2}\s*(?:am|pm))\b/i);
  if (range) return range[1].replace(/\s+/g, "");

  const rangeTo = value.match(/\b([0-9]{1,2}\s*(?:am|pm)\s*(?:to|dekhi)\s*[0-9]{1,2}\s*(?:am|pm))\b/i);
  if (rangeTo) return rangeTo[1].replace(/\s+/g, "");

  return "";
}

function parseFoodProvided(text = "") {
  const value = String(text || "").toLowerCase();

  if (/\b(food|khana)\s+(cha|chha|xa|included|dinchha|dincha)\b/i.test(value)) {
    return true;
  }

  if (/\bkhana\b.*\b(dincham|dinchu|dinchha|dincha|cha|chha|xa)\b/i.test(value)) {
    return true;
  }

  if (/\b(food|khana)\s+(chaina|chhaina|xaina|not)\b/i.test(value)) {
    return false;
  }

  return null;
}

function parseAccommodationProvided(text = "") {
  const value = String(text || "").toLowerCase();

  if (/\b(accommodation|basne|room)\s+(cha|chha|xa|included|dinchha|dincha)\b/i.test(value)) {
    return true;
  }

  if (/\b(accommodation|basne|basna|room)\s+(chaina|chhaina|xaina|not)\b/i.test(value)) {
    return false;
  }

  return null;
}

function parseExperienceRequired(text = "") {
  const value = String(text || "").toLowerCase();
  const yearMatch = value.match(/\bexperience\s*(?:is|ho|:)?\s*(\d{1,2})\s*(year|years|barsa|barsha)\b/i) ||
    value.match(/\b(\d{1,2})\s*(year|years|barsa|barsha)\s*experience\b/i) ||
    value.match(/\b(\d{1,2})\s*(year|years|barsa|barsha)\b.*\bexperience\b/i);

  if (yearMatch) {
    const years = Number(yearMatch[1]);
    return { years, label: `${years} year${years === 1 ? "" : "s"}` };
  }

  if (/\bexperience\s+(chaina|chhaina|not required|no)\b/i.test(value)) {
    return { level: "none", label: "No experience required" };
  }

  if (/\bexperience\b.*\b(bhaye|bhayeko|ramro|preferred)\b/i.test(value)) {
    return { level: "preferred", label: "Experience preferred" };
  }

  if (/\blicense\b.*\b(mandatory|required|chaincha|chahinchha)\b|\b(mandatory|required)\b.*\blicense\b/i.test(value)) {
    return { level: "license_mandatory", label: "License mandatory" };
  }

  return null;
}

function parseGenderPreference(text = "") {
  const value = String(text || "").toLowerCase();

  if (/\bgender\s*(?:is|ho|:)?\s*any\b/i.test(value)) return "any";
  if (/\bmale\b|\bman\b|\bketa\b/i.test(value)) return "male";
  if (/\bfemale\b|\bwoman\b|\bkt\b/i.test(value)) return "female";

  return "";
}

function parseFeeCondition(text = "") {
  const value = String(text || "").toLowerCase();

  if (isEmployerFeeUnderstandingMessage(value)) {
    return {
      note: "fee worker join bhayepachi",
      finalizedByBot: false,
      requiresHumanReview: true,
    };
  }

  if (/\bfee|commission|payment|settlement\b/i.test(value)) {
    return {
      note: "payment/fee mentioned",
      finalizedByBot: false,
      requiresHumanReview: true,
    };
  }

  return null;
}

function parseUrgency(text = "") {
  const value = String(text || "").toLowerCase();

  if (/\b(immediate|urgent|aaja|aja|today|bholi|voli|tomorrow|asap|turuntai|ahile)\b/i.test(value)) {
    return { value: "immediate", label: "Immediate" };
  }

  const dayMatch = value.match(/\b(\d{1,2})\s*(din|day|days)\s*(bhitra|within)\b/i);
  if (dayMatch) {
    return {
      value: "within_days",
      days: Number(dayMatch[1]),
      label: `${Number(dayMatch[1])} din bhitra`,
    };
  }

  const weekMatch = value.match(/\b(\d{1,2})\s*(week|weeks|hapta)\b/i);
  if (weekMatch) {
    return {
      value: "within_weeks",
      weeks: Number(weekMatch[1]),
      label: `${Number(weekMatch[1])} week bhitra`,
    };
  }

  if (/\b(this week|yo hapta|soon)\b/i.test(value)) {
    return { value: "this_week", label: "This week" };
  }

  return null;
}

export function isEmployerFeeUnderstandingMessage(text = "") {
  const value = String(text || "").toLowerCase();

  return /\b(fee|payment|paisa)\b.*\b(worker\s+)?join\s+(bhayepachi|pachi)|\b(worker\s+)?join\s+(bhayepachi|pachi)\b.*\b(fee|payment|paisa)|\bfee\b.*\bjoin\b|\bfee\s+join\s+pachi\b/i.test(value);
}

function applyEmployerSkipAndCorrections({
  data = {},
  previousData = {},
  currentStep = "",
  text = "",
} = {}) {
  let nextData = data;

  if (isSkipAnswer(text) && currentStep) {
    const skippedFields = new Set(Array.isArray(nextData.skippedFields) ? nextData.skippedFields : []);
    skippedFields.add(currentStep);
    nextData = {
      ...nextData,
      skippedFields: [...skippedFields],
    };
  }

  const hasSafetyCorrection =
    previousData.safetyRefused ||
    previousData.fairLaborCorrection ||
    (nextData.safetyRefused && isPaidCorrectionMessage(text)) ||
    isStandalonePaidCorrectionMessage(text);

  if (hasSafetyCorrection) {
    const skippedFields = new Set(Array.isArray(nextData.skippedFields) ? nextData.skippedFields : []);
    if (!nextData.businessName) skippedFields.add("businessName");
    if (
      typeof nextData.foodProvided !== "boolean" &&
      typeof nextData.accommodationProvided !== "boolean"
    ) {
      skippedFields.add("foodAccommodation");
    }

    nextData = {
      ...nextData,
      fairLaborCorrection: true,
      skippedFields: [...skippedFields],
      genderPreference: nextData.genderPreference || "any",
      experienceRequired: nextData.experienceRequired || {
        level: "not_specified",
        label: "Not specified",
      },
      feeCondition: nextData.feeCondition || {
        note: "paid job confirmed; fee human team confirmation pachi",
        finalizedByBot: false,
        requiresHumanReview: true,
      },
    };
  }

  return nextData;
}

function isPaidCorrectionMessage(text = "") {
  return /\b(no no|paid job|salary\s+\d{4,6}|salary.*dinchu|paid)\b/i.test(String(text || ""));
}

function isStandalonePaidCorrectionMessage(text = "") {
  return /\b(sorry|paid job|salary\s+dinchu|salary\s+dine|human approval pachi|fee\s+join\s+pachi)\b/i.test(String(text || ""));
}

function isSkipAnswer(text = "") {
  return /\b(thaha\s+chaina|pachi\s+dinchu|pachi\s+pathaunchu|later|skip|ahile\s+chaina|aile\s+chaina)\b/i.test(String(text || ""));
}

function isFieldSkipped(data = {}, field = "") {
  return Array.isArray(data.skippedFields) && data.skippedFields.includes(field);
}

function cleanBusinessName(value = "") {
  return cleanPhrase(value)
    .replace(/^(?:naam|name|business|company|firm|pasal\s+ko\s+naam|shop\s+ko\s+naam|hotel\s+ko\s+naam|restaurant\s+ko\s+naam)\s+/i, "")
    .replace(/\s+\bho\b.*$/i, "")
    .replace(/\s+\b(?:bardaghat|butwal|parasi|jimirbar|sunwal|bhairahawa)\b\s+ma\b.*$/i, "")
    .replace(/\b(?:ho|cha|chha|xa)$/i, "")
    .replace(/\b(?:waiter|cook|driver|helper|staff|worker|location|address|salary|urgent|immediate).*$/i, "")
    .trim();
}

function normalizeEmployerBusinessName(value = "") {
  const originalWords = String(value || "").trim().split(/\s+/);
  const normalizedWords = normalizeCompanyName(value).split(/\s+/);

  return normalizedWords
    .map((word, index) => {
      const original = originalWords[index] || "";
      if (/^[A-Z]{2,4}$/.test(original)) return original;
      if (/^[A-Z]{1,3}$/.test(word)) {
        return word.charAt(0) + word.slice(1).toLowerCase();
      }
      return word;
    })
    .join(" ");
}

function isUsefulBusinessName(value = "") {
  const clean = String(value || "").trim();
  if (!clean) return false;
  if (/^(ko lagi|lagi|ko|jana|staff|worker|waiter|helper|urgent)$/i.test(clean)) return false;
  if (/\b(jana|staff|worker|waiter|helper|chainxa|chahiyo|chaiyo|role|salary)\b/i.test(clean)) return false;
  return clean.length >= 2;
}

function cleanPhrase(value = "") {
  return String(value || "")
    .replace(/\b(contact|phone|mobile|number|role|location|address|salary|timing|food|urgent|experience|gender|fee).*$/i, "")
    .replace(/[^\w\s&.'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCase(value = "") {
  return String(value || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function removeEmptyValues(input = {}) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => {
      if (value === null || value === undefined || value === "") return false;
      if (typeof value === "object" && !Array.isArray(value)) {
        return Object.values(value).some((item) => item !== null && item !== undefined && item !== "");
      }
      return true;
    })
  );
}
