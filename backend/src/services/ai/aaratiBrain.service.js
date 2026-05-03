// Aarati Brain extracts meaning first, then JSON RAG normalizes the result.
// AI is used for understanding only. RAG and rules remain the source of truth.

import { generateJSONWithAI } from "./aiProvider.service.js";
import { getOrSetLLMCache } from "./llmCache.service.js";
import { shouldUseAaratiAI } from "./aaratiBrainGate.service.js";
import {
  findRole,
  findLocation,
  normalizeCompanyName,
  extractQuantity
} from "../rag/jobmateKnowledge.service.js";

const ENABLE_AARATI_AI_BRAIN = process.env.ENABLE_AARATI_AI_BRAIN !== "false";

function slugifyRole(label = "") {
  return String(label || "staff")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, "_")
    .replace(/^_+|_+$/g, "") || "staff";
}

function titleCase(value = "") {
  return String(value || "")
    .replace(/_/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function safeNumber(value, fallback = 1) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function buildPrompt({ text, state, step }) {
  return `
You are Aarati Brain for JobMate, a WhatsApp hiring platform in Lumbini Province, Nepal.

Task:
Extract structured meaning from messy Roman Nepali / Nepali / mixed English user text.

Do not write a user reply.
Return JSON only.

Current conversation state: ${state || "unknown"}
Current step: ${step ?? "unknown"}

User text:
${text}

Extract:
- intent: employer_lead, job_search, worker_registration, faq, off_topic, unknown
- companyName if user gives business/company name
- rawRole if user asks for staff/worker role
- roleLabel as clean English label, e.g. Mill Worker, House Helper, Marketing Staff, TikTok Content Creator
- quantity as number
- rawLocation if user gives location/address
- canonicalLocation if obvious
- district if obvious
- experienceRequired: experienced, fresher_ok, unknown
- urgency: this_week, within_2_weeks, this_month, exploring, unknown
- confidence 0 to 1

Rules:
- "manxe chahiyo", "staff chahiyo", "hired garna", "worker chahiyo" means employer_lead.
- "kaam cha?", "job cha?", "ma job khojdai" means job_search or worker_registration.
- Extract company from phrases like "mero company ko name xyz ho", "mero chai xyz".
- Extract role from phrases like "mill ma kam garne manxe", "ghar ma kam garni", "marketing boy", "tiktok content creator".
- Extract location from phrases like "mero address chai bhardghat dhanewa ho", "nawalparasi jamuniya", "bhardghat 13 bhatauliya".
- If a message contains district + smaller place, choose the smaller place as canonicalLocation.
  Example: "nawalparasi ko semari bhanni thau ma ho" → canonicalLocation = "Semari", district = "Nawalparasi West".
  Example: "nawalparasi jamuniya" → canonicalLocation = "Jamuniya", district = "Nawalparasi West".
  Example: "bhardghat punarbas" → canonicalLocation = "Punarbas, Bardaghat", district = "Nawalparasi West".
- Do not return district as canonicalLocation when a smaller locality is present.
- For location_info state, focus only on extracting location. Do not classify as job_search.
- If unsure, keep raw text in rawRole/rawLocation and use lower confidence.

Return JSON only:
{
  "intent": "employer_lead",
  "companyName": "",
  "rawRole": "",
  "roleLabel": "",
  "quantity": 1,
  "rawLocation": "",
  "canonicalLocation": "",
  "district": "",
  "experienceRequired": "unknown",
  "urgency": "unknown",
  "confidence": 0.0
}
`.trim();
}

async function callAIExtractor({ text, state, step }) {
  if (!ENABLE_AARATI_AI_BRAIN) return null;

  try {
    const prompt = buildPrompt({ text, state, step });

    const result = await getOrSetLLMCache({
      namespace: "aarati_brain_extraction",
      input: { text, state, step },
      factory: async () => generateJSONWithAI({
        taskName: "aarati_brain_extraction",
        prompt
      })
    });

    return result.value || null;
  } catch (error) {
    console.warn("Aarati Brain AI failed, using RAG fallback:", error?.message);
    return null;
  }
}

function normalizeWithRAG({ text, ai = {}, state = "", step = 0 }) {
  const roleQuery = [ai.rawRole, ai.roleLabel, text].filter(Boolean).join(" ");
  const locationQuery = [ai.rawLocation, ai.canonicalLocation, text].filter(Boolean).join(" ");

  const roleResult = findRole(roleQuery);
  const locationResult = findLocation(locationQuery);

  const aiRoleLabel = String(ai.roleLabel || ai.rawRole || "").trim();
  const aiRoleKey = slugifyRole(aiRoleLabel);

  const roleKey = roleResult.found ? roleResult.key : aiRoleKey;
  const roleLabel = roleResult.found
    ? roleResult.label
    : titleCase(aiRoleLabel || "Staff");

  let finalRoleKey = roleKey;
  let finalRoleLabel = roleLabel;

  if (isGenericStaffRole(finalRoleKey, finalRoleLabel)) {
    finalRoleKey = "helper";
    finalRoleLabel = "General Helper";
  }

  // If RAG found a specific role, RAG is the source of truth.
  // This prevents labels like "Marketing Staff + Kitchen Staff" from being treated as generic
  // just because they contain the word "staff".
  if (roleResult.found) {
    finalRoleKey = roleResult.key;
    finalRoleLabel = roleResult.label;
  }

  let quantity = safeNumber(ai.quantity, extractQuantity(text));

  if (finalRoleKey === "marketing_kitchen_staff") {
    quantity = 2;
  }

  const finalIntent =
    ["ask_vacancy", "ask_vacancy_role"].includes(String(state || "")) &&
    finalRoleKey &&
    finalRoleKey !== "helper"
      ? "employer_lead"
      : ai.intent || "unknown";

  const shouldKeepCompany =
    ["ask_business_name", "ask_business_name_after_ai"].includes(String(arguments?.[0]?.state || "")) ||
    /\b(company|business|traders|trade|pasal|shop|store|pvt|ltd|firm)\b/i.test(String(ai.companyName || ""));

  const companyName = shouldKeepCompany && ai.companyName
    ? normalizeCompanyName(ai.companyName)
    : "";

  const isBusinessNameState = ["ask_business_name", "ask_business_name_after_ai"].includes(String(state || ""));

  const location = isBusinessNameState
    ? ""
    : locationResult.found
      ? locationResult.canonical
      : cleanGenericLocation(ai.canonicalLocation || ai.rawLocation || "");

  const district = isBusinessNameState
    ? ""
    : locationResult.found
      ? locationResult.district
      : cleanGenericLocation(ai.district || "");

  return {
    intent: finalIntent,
    confidence: safeNumber(ai.confidence, 0),
    companyName,
    role: finalRoleKey,
    roleLabel: finalRoleLabel,
    quantity,
    location,
    district,
    province: locationResult.found ? locationResult.province : "",
    isInsideLumbini: locationResult.found ? locationResult.isInsideLumbini : false,
    experienceRequired: ai.experienceRequired || detectExperience(text),
    urgency: ai.urgency || "unknown",
    source: ai?.confidence ? "ai_rag" : "rag_only",
    matched: {
      roleFound: roleResult.found,
      roleAlias: roleResult.matchedAlias,
      locationFound: locationResult.found,
      locationAlias: locationResult.matchedAlias
    }
  };
}



function isGenericStaffRole(role = "", roleLabel = "") {
  const value = `${role} ${roleLabel}`.toLowerCase().trim();

  if (!value) return true;

  if (/\b(dua|dui|two|2)\s*jana\s*staff\b/i.test(value)) return true;
  if (/\b\d+\s*jana\s*staff\b/i.test(value)) return true;
  if (/\bstaff\s*chayako\b/i.test(value)) return true;

  return [
    "staff",
    "helper",
    "general helper",
    "worker",
    "manxe",
    "manche",
    "dua_jana_staff",
    "dui_jana_staff",
    "two_staff",
    "2_staff"
  ].some((item) => value === item || value.includes(item));
}


function cleanGenericLocation(value = "") {
  const text = String(value || "").trim();
  const lower = text.toLowerCase();

  const genericLocations = [
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
    "gau gau",
    "gau gau ma",
    "gaun gaun",
    "gaun gaun ma",
    "field",
    "market",
    "area",
    "local area"
  ];

  if (genericLocations.includes(lower)) {
    return "";
  }

  // Reject phrases that describe movement, not a fixed location.
  if (/gau\s+gau|gaun\s+gaun|hidne|hidni|jane|didai/i.test(lower)) {
    return "";
  }

  return text;
}


function detectExperience(text = "") {
  const value = String(text || "").toLowerCase();

  if (/(experience|experienced|sipalu|janni|anubhav|kaam gareko|paila.*kam gareko)/i.test(value)) {
    return "experienced";
  }

  if (/(fresher|naya|training|sikera)/i.test(value)) {
    return "fresher_ok";
  }

  return "unknown";
}


function shouldExtractCompanyName({ text = "", state = "", step = 0 } = {}) {
  const value = String(text || "").toLowerCase();

  if (["ask_business_name", "ask_business_name_after_ai"].includes(state)) {
    return true;
  }

  if (Number(step) === 1 || Number(step) === 10) {
    return true;
  }

  return /\b(company|business|traders|trade|shop|store|hotel|restaurant|clinic|consultancy|pvt|ltd|firm|pasal)\b/i.test(value) ||
    /\bmero\s+chai\b/i.test(value) && !/\b(location|address|staff|manxe|worker|job|kaam|kam|jana)\b/i.test(value);
}


function fallbackUnderstanding({ text, state = "", step = 0 }) {
  const roleResult = findRole(text);
  const locationResult = findLocation(text);

  const isBusinessNameState = ["ask_business_name", "ask_business_name_after_ai"].includes(String(state || ""));
  const isLocationState = String(state || "") === "ask_location";

  const shouldKeepLocation = !isBusinessNameState;
  const shouldKeepCompany = shouldExtractCompanyName({ text, state, step }) && !isLocationState;

  return {
    intent: /(staff|manxe|manche|worker|hired|chahiyo|chayako|chaiyo)/i.test(text)
      ? "employer_lead"
      : "unknown",
    confidence: roleResult.found || locationResult.found ? 0.65 : 0.35,
    companyName: shouldKeepCompany ? normalizeCompanyName(text) : "",
    role: roleResult.key,
    roleLabel: roleResult.label,
    quantity: extractQuantity(text),
    location: shouldKeepLocation ? locationResult.canonical : "",
    district: shouldKeepLocation ? locationResult.district : "",
    province: shouldKeepLocation ? locationResult.province : "",
    isInsideLumbini: shouldKeepLocation ? locationResult.isInsideLumbini : false,
    experienceRequired: detectExperience(text),
    urgency: "unknown",
    source: "rag_fallback",
    matched: {
      roleFound: roleResult.found,
      roleAlias: roleResult.matchedAlias,
      locationFound: shouldKeepLocation ? locationResult.found : false,
      locationAlias: shouldKeepLocation ? locationResult.matchedAlias : null
    }
  };
}

export async function understandEmployerMessage({ text = "", state = "", step = 0 } = {}) {
  const cleanText = String(text || "").trim();

  if (!cleanText) {
    return fallbackUnderstanding({ text: cleanText, state, step });
  }

  const gate = shouldUseAaratiAI({ text: cleanText, state, step });

  if (!gate.useAI) {
    return {
      ...fallbackUnderstanding({ text: cleanText, state, step }),
      aiGate: gate,
    };
  }

  const ai = await callAIExtractor({ text: cleanText, state, step });

  if (!ai || typeof ai !== "object") {
    return {
      ...fallbackUnderstanding({ text: cleanText, state, step }),
      aiGate: gate,
    };
  }

  const normalized = normalizeWithRAG({ text: cleanText, ai, state, step });

  if (!normalized.intent || normalized.intent === "unknown") {
    const fallback = fallbackUnderstanding({ text: cleanText, state, step });

    return {
      ...normalized,
      intent: fallback.intent,
      confidence: Math.max(normalized.confidence || 0, fallback.confidence || 0),
      source: "ai_rag_plus_fallback"
    };
  }

  return {
    ...normalized,
    aiGate: gate,
  };
}
