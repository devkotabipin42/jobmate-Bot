// Employer lead mapper.
// Converts AI/RAG/raw message data into normalized employer lead fields.
// No DB writes. No WhatsApp sending. No state machine decisions.

import {
  findRole,
  findLocation,
  extractQuantity,
} from "../../rag/jobmateKnowledge.service.js";

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

function includesAny(text, keywords = []) {
  const lower = String(text || "").toLowerCase();
  return keywords.some((keyword) => lower.includes(String(keyword).toLowerCase()));
}

function extractFirstNumber(text) {
  const match = String(text || "").match(/\d+/);
  return match ? Number(match[0]) : null;
}

export function detectExperienceRequirement(text = "") {
  const value = String(text || "").toLowerCase();

  if (/(experience|experienced|sipalu|anubhav|anubhabi|kaam gareko|काम गरेको)/i.test(value)) {
    return "experienced";
  }

  if (/(fresher|naya|new|training)/i.test(value)) {
    return "fresher_ok";
  }

  return "unknown";
}

export function isGenericRole(role = "") {
  const value = String(role || "").toLowerCase().trim();

  if (!value) return true;
  if (/(dua|dui|two|2)_?jana_?staff/i.test(value)) return true;
  if (/\d+_?jana_?staff/i.test(value)) return true;

  return ["helper", "staff", "general_helper", "manxe", "manche", "worker"].includes(value);
}

export function isUsefulVacancy(vacancy = {}) {
  return Boolean(vacancy?.role && !isGenericRole(vacancy.role));
}

export function isUsefulLocation(location = {}) {
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
    "rukum east",
  ]);

  if (invalidGenericLocations.has(area)) return false;
  if (area === district) return false;

  return true;
}

export function normalizeRole(role) {
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

export function parseVacancy(text = "") {
  const roleResult = findRole(text);
  const quantity = extractQuantity(text);

  return {
    role: roleResult.key,
    quantity,
    experienceRequired: detectExperienceRequirement(text),
    urgency: "unknown",
  };
}

export function buildVacancyFromAI(ai = {}) {
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

export function buildVacancyFromBrain(brain = {}, fallbackText = "") {
  const role = brain.role || normalizeRole(parseVacancy(fallbackText).role);
  const quantity = Number(brain.quantity || extractFirstNumber(fallbackText) || 1);

  return {
    role,
    quantity,
    experienceRequired: brain.experienceRequired || detectExperienceRequirement(fallbackText),
    urgency: brain.urgency || "unknown",
  };
}

function cleanLocationText(text = "") {
  return String(text || "")
    .replace(/^mero\s+address\s+chai\s+/i, "")
    .replace(/^mero\s+address\s+/i, "")
    .replace(/^malai\s+/i, "")
    .replace(/\s+ma\s+ho$/i, "")
    .replace(/\s+ho$/i, "")
    .trim();
}

export function parseLocation(text = "") {
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

export function buildLocationFromBrain(brain = {}, fallbackText = "") {
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

export function hasUsefulBrainEmployerDetails(brain = {}) {
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

export function isVacancyOrLocationGivenInsteadOfCompany(brain = {}) {
  return Boolean(
    brain &&
      !brain.companyName &&
      (
        (brain.role && !isGenericRole(brain.role)) ||
        brain.location ||
        brain.district
      )
  );
}

export function parseUrgency(text = "") {
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

export function mapAIUrgency(value = "") {
  if (value === "immediate") return "immediate";
  if (value === "this_week") return "this_week";
  if (value === "this_month") return "this_month";
  if (value === "exploring") return "exploring";
  return "unknown";
}

export function mapBusinessType(value = "") {
  const text = String(value || "").toLowerCase();

  if (includesAny(text, ["hotel", "hospitality", "restaurant"])) return "hotel_restaurant";
  if (includesAny(text, ["factory"])) return "factory_industry";
  if (includesAny(text, ["shop", "sales", "retail"])) return "retail_shop";
  if (includesAny(text, ["school", "education"])) return "school_institute";
  if (includesAny(text, ["clinic", "pharmacy"])) return "clinic_pharmacy";
  if (includesAny(text, ["construction"])) return "construction";

  return "unknown";
}

export function formatBrainSummary(brain = {}) {
  const lines = [];

  if (brain.role && !isGenericRole(brain.role)) {
    lines.push(`Staff: ${brain.quantity || 1} jana ${brain.roleLabel || brain.role}`);
  } else if (brain.quantity && Number(brain.quantity) > 1) {
    lines.push(`Staff: ${brain.quantity} jana`);
  }

  if (brain.location || brain.district) {
    lines.push(`Location: ${[brain.location, brain.district].filter(Boolean).join(", ")}`);
  }

  return lines.length ? lines.join("\n") : "";
}


export function parseSalaryRange(text = "") {
  const value = String(text || "").toLowerCase();

  const numbers = [...value.matchAll(/\d{4,6}/g)].map((match) => Number(match[0]));

  if (numbers.length >= 2) {
    return {
      salaryMin: Math.min(numbers[0], numbers[1]),
      salaryMax: Math.max(numbers[0], numbers[1]),
      salaryCurrency: "NPR",
    };
  }

  if (numbers.length === 1) {
    const n = numbers[0];

    if (/samma| samma|up to|maximum|max/i.test(value)) {
      return {
        salaryMin: null,
        salaryMax: n,
        salaryCurrency: "NPR",
      };
    }

    return {
      salaryMin: n,
      salaryMax: n,
      salaryCurrency: "NPR",
    };
  }

  return {
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: "NPR",
  };
}

export function parseWorkType(text = "") {
  const value = String(text || "").toLowerCase().trim();

  if (/^1$|full|fulltime|full-time|din bhari|dinvari/i.test(value)) {
    return "full_time";
  }

  if (/^2$|part|parttime|part-time|aadha|adha/i.test(value)) {
    return "part_time";
  }

  if (/^3$|shift|night|day shift|night shift/i.test(value)) {
    return "shift";
  }

  if (/^4$|flexible|milayera|jun sukai|junsukai/i.test(value)) {
    return "flexible";
  }

  return "unknown";
}

export function formatSalaryRange({ salaryMin = null, salaryMax = null } = {}) {
  if (salaryMin && salaryMax && salaryMin !== salaryMax) {
    return `Rs ${Number(salaryMin).toLocaleString("en-IN")} - ${Number(salaryMax).toLocaleString("en-IN")}`;
  }

  if (salaryMax && !salaryMin) {
    return `Rs ${Number(salaryMax).toLocaleString("en-IN")} samma`;
  }

  if (salaryMin || salaryMax) {
    return `Rs ${Number(salaryMin || salaryMax).toLocaleString("en-IN")}`;
  }

  return "-";
}

export function formatWorkType(workType = "unknown") {
  const labels = {
    full_time: "Full-time",
    part_time: "Part-time",
    shift: "Shift",
    flexible: "Flexible",
    unknown: "-",
  };

  return labels[workType] || "-";
}
