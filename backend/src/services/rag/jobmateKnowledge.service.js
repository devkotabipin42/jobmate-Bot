// JSON RAG service for JobMate.
// This keeps localities, roles, and normalization outside core flow logic.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const knowledgeDir = path.resolve(__dirname, "../../data/knowledge");

const localities = loadJSON("lumbini.localities.json");
const roles = loadJSON("jobmate.roles.json");

function loadJSON(fileName) {
  const fullPath = path.join(knowledgeDir, fileName);
  return JSON.parse(fs.readFileSync(fullPath, "utf8"));
}

function normalizeText(text = "") {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesPhrase(text, phrase) {
  const cleanText = normalizeText(text);
  const cleanPhrase = normalizeText(phrase);

  if (!cleanText || !cleanPhrase) return false;

  return cleanText.includes(cleanPhrase);
}

export function extractQuantity(text = "") {
  const value = normalizeText(text);

  const digitMatch = value.match(/\b(\d{1,3})\s*(jana|jna|ota|wota|staff|manxe|manche|worker|employee|kt|kto)\b/i);
  if (digitMatch) return Number(digitMatch[1]);

  const wordMap = {
    aauta: 1,
    auta: 1,
    euta: 1,
    ek: 1,
    dui: 2,
    due: 2,
    duita: 2,
    dueta: 2,
    tin: 3,
    tinta: 3,
    char: 4,
    chaar: 4,
    panch: 5,
    paach: 5,
    das: 10
  };

  for (const [word, number] of Object.entries(wordMap)) {
    if (new RegExp(`\\b${word}\\b`, "i").test(value)) {
      return number;
    }
  }

  return 1;
}

export function normalizeCompanyName(text = "") {
  let value = String(text || "").trim();

  value = value
    .replace(/^ma\s+/i, "")
    .replace(/^mah\s+/i, "")
    .replace(/^mero\s+company\s+ko\s+name\s+chai\s+/i, "")
    .replace(/^company\s+ko\s+name\s+chai\s+/i, "")
    .replace(/^mero\s+chai\s+/i, "")
    .replace(/^mero\s+/i, "")
    .replace(/^hamro\s+chai\s+/i, "")
    .replace(/^hamro\s+/i, "")
    .replace(/^chai\s+/i, "")
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
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

export function cleanRoleQuery(text = "") {
  return normalizeText(text)
    .replace(/^malai\s+/i, "")
    .replace(/^malaai\s+/i, "")
    .replace(/^mero\s+/i, "")
    .replace(/^hamro\s+/i, "")
    .replace(/\b(aauta|auta|euta|ek)\b/g, "")
    .replace(/\b\d+\s*jana\b/g, "")
    .replace(/\b(kt|kto|manxe|manche|staff|worker)\b/g, "")
    .replace(/\b(chaiyako|chayako|chaiyo|chayo|chahiyo|chahiyeko|theo|thiyo|lagi|ko)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function cleanLocationQuery(text = "") {
  return normalizeText(text)
    .replace(/^mero\s+address\s+chai\s+/i, "")
    .replace(/^mero\s+address\s+/i, "")
    .replace(/^mero\s+company\s+ko\s+name\s+chai\s+/i, "")
    .replace(/^company\s+ko\s+name\s+chai\s+/i, "")
    .replace(/^mero\s+chai\s+/i, "")
    .replace(/^malai\s+/i, "")
    .replace(/\b(bhanni|bhanne|thau|ma|parxa|parcha|ho|chai|address)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function findRole(text = "") {
  const clean = cleanRoleQuery(text);

  // Multi-role hiring request: one marketing staff and one cooking/kitchen staff.
  if (
    /(marketing|parchar|promotion|field marketing)/i.test(clean) &&
    /(cooking|cook|khana pakaune|kitchen|khana banaune)/i.test(clean)
  ) {
    return {
      found: true,
      key: "marketing_kitchen_staff",
      label: "Marketing Staff + Kitchen Staff",
      category: "multi_role",
      matchedAlias: "marketing + cooking"
    };
  }

  let best = null;

  for (const [key, role] of Object.entries(roles)) {
    const candidates = [role.label, key, ...(role.aliases || [])];

    for (const alias of candidates) {
      if (includesPhrase(clean, alias) || includesPhrase(text, alias)) {
        const isGenericRole = ["helper", "general_helper", "staff", "house_helper"].includes(key);
        const highPriorityRole = [
          "cook",
          "kitchen_staff",
          "field_promoter",
          "marketing_staff",
          "street_food_vendor",
          "garage_worker"
        ].includes(key);

        const rolePriority = highPriorityRole ? 250 : isGenericRole ? -100 : 100;
        const score = normalizeText(alias).length + rolePriority;

        if (!best || score > best.score) {
          best = {
            key,
            label: role.label,
            category: role.category || "general",
            matchedAlias: alias,
            score
          };
        }
      }
    }
  }

  if (best) {
    return {
      found: true,
      key: best.key,
      label: best.label,
      category: best.category,
      matchedAlias: best.matchedAlias
    };
  }

  return {
    found: false,
    key: "helper",
    label: "General Helper",
    category: "general",
    matchedAlias: null
  };
}

export function findLocation(text = "") {
  const clean = cleanLocationQuery(text);
  let best = null;

  for (const [key, locality] of Object.entries(localities)) {
    const candidates = [
      locality.canonical,
      locality.district,
      key,
      ...(locality.aliases || [])
    ];

    for (const alias of candidates) {
      if (includesPhrase(clean, alias) || includesPhrase(text, alias)) {
        const score = normalizeText(alias).length;
        if (!best || score > best.score) {
          const isDistrictLevel =
            normalizeText(locality.canonical) === normalizeText(locality.district);

          const finalScore = score + (isDistrictLevel ? 0 : 100);

          best = {
            key,
            canonical: locality.canonical,
            district: locality.district,
            province: locality.province || "Lumbini",
            matchedAlias: alias,
            score: finalScore
          };
        }
      }
    }
  }

  if (best) {
    return {
      found: true,
      canonical: best.canonical,
      district: best.district,
      province: best.province,
      matchedAlias: best.matchedAlias,
      isInsideLumbini: best.province === "Lumbini"
    };
  }

  return {
    found: false,
    canonical: "",
    district: "",
    province: "",
    matchedAlias: null,
    isInsideLumbini: false
  };
}

export function buildEmployerUnderstanding(text = "") {
  const role = findRole(text);
  const location = findLocation(text);
  const quantity = extractQuantity(text);

  return {
    intent: "employer_lead",
    quantity,
    role: role.key,
    roleLabel: role.label,
    roleFound: role.found,
    location: location.canonical,
    district: location.district,
    province: location.province,
    locationFound: location.found,
    isInsideLumbini: location.isInsideLumbini,
    matched: {
      roleAlias: role.matchedAlias,
      locationAlias: location.matchedAlias
    }
  };
}

export function getKnowledgeStats() {
  return {
    localities: Object.keys(localities).length,
    roles: Object.keys(roles).length
  };
}
