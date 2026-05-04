// Deterministic parser for employer multi-role hiring requests.
// One quantity segment should produce one best role.
// Example: "1 marketing 2 cooking helpers 1 driver" => 3 hiringNeeds.

import { findRole, extractQuantity } from "./jobmateKnowledge.service.js";

const NUMBER_WORDS = {
  aauta: 1,
  auta: 1,
  euta: 1,
  ek: 1,
  one: 1,
  dui: 2,
  due: 2,
  two: 2,
  tin: 3,
  three: 3,
  char: 4,
  chaar: 4,
  four: 4,
  panch: 5,
  five: 5,
};

const NUMBER_PATTERN =
  "(?:\\d+|aauta|auta|euta|ek|one|dui|due|two|tin|three|char|chaar|four|panch|five)";

const ROLE_PATTERNS = [
  {
    role: "street_food_vendor",
    roleLabel: "Street Food Vendor",
    category: "sales_food",
    priority: 100,
    pattern:
      "(?:chaumin|chowmein|momo|street\\s+food|food\\s+seller|bajar\\s+bajar\\s+ma\\s+bechna|market\\s+market\\s+ma\\s+bechna|momo\\s+bechne|chaumin\\s+bechne)",
  },
  {
    role: "frontend_developer",
    roleLabel: "Frontend Developer",
    category: "it",
    priority: 95,
    pattern:
      "(?:frontend|front\\s*end|frontend\\s+developer|react\\s+developer|web\\s+developer|website\\s+developer|ui\\s+developer)",
  },
  {
    role: "kitchen_staff",
    roleLabel: "Kitchen Staff",
    category: "hospitality",
    priority: 90,
    pattern:
      "(?:cooking|cook|cooks|kitchen|kitchen\\s+helper|kitchen\\s+helpers|cooking\\s+helper|cooking\\s+helpers|khana\\s+pakaune|khana\\s+banaune|khana\\s+pakauni)",
  },
  {
    role: "driver",
    roleLabel: "Driver",
    category: "transport",
    priority: 85,
    pattern: "(?:driver|drivers|driving|gadi\\s+chalak|chalak)",
  },
  {
    role: "marketing_staff",
    roleLabel: "Marketing Staff",
    category: "sales_marketing",
    priority: 80,
    pattern: "(?:marketing|marketting|field\\s+marketing|parchar|promotion)",
  },
  {
    role: "waiter",
    roleLabel: "Waiter",
    category: "hospitality",
    priority: 75,
    pattern: "(?:waiter|waiters|service\\s+staff|hotel\\s+waiter|restaurant\\s+waiter)",
  },
  {
    role: "security_guard",
    roleLabel: "Security Guard",
    category: "security",
    priority: 70,
    pattern: "(?:security|guard|guards|security\\s+guard|watchman)",
  },
  {
    role: "field_promoter",
    roleLabel: "Field Promoter",
    category: "sales_marketing",
    priority: 65,
    pattern:
      "(?:field\\s+promoter|promoter|sticker\\s+batne|print\\s+sticker|gau\\s+gau\\s+jane|gaun\\s+gaun\\s+jane|didai\\s+hindxa)",
  },
  {
    role: "shopkeeper",
    roleLabel: "Shopkeeper",
    category: "retail",
    priority: 60,
    pattern:
      "(?:shopkeeper|shop\\s+keeper|seller|selling|selling\\s+garne|sale\\s+garne|sales\\s+garne|bechne|bechni|bechna|saman\\s+bechne|pasal\\s+ma\\s+saman\\s+bechne|dokan\\s+ma\\s+saman\\s+bechni|counter\\s+staff)",
  },
  {
    role: "helper_staff",
    roleLabel: "Helper",
    category: "general",
    priority: 10,
    pattern: "(?:helper|helpers|general\\s+helper|worker\\s+helper|sahayogi|kamdar|kaamdar|labour|labor)",
  },
];

function normalizeText(text = "") {
  return String(text || "")
    .toLowerCase()
    .replace(/[।,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeQuantity(raw = "") {
  const value = String(raw || "").toLowerCase().trim();
  const digit = value.match(/\d+/);
  if (digit) return Number(digit[0]);
  return NUMBER_WORDS[value] || 1;
}

function removeTotalCountPrefix(text = "") {
  return normalizeText(text)
    .replace(
      new RegExp(
        `\\b${NUMBER_PATTERN}\\s*(?:jana|jna)?\\s*(?:staff)?\\s*(?:ma|maa|madhye|vittra|bhitra)\\b`,
        "gi"
      ),
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
}

function preprocess(text = "") {
  return removeTotalCountPrefix(text)
    .replace(/\barko\s+(?:chai|chahi)?\s*/gi, " 1 ")
    .replace(/\bani\b/gi, " ")
    .replace(/\bra\b/gi, " ")
    .replace(/\band\b/gi, " ")
    .replace(/\bchai\b/gi, " ")
    .replace(/\bchahi\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitRoleSegments(text = "") {
  const value = preprocess(text);

  const marked = value.replace(
    new RegExp(`\\b(${NUMBER_PATTERN})\\s*(?:jana|jna)?\\s*(?:chai|chahi)?\\b`, "gi"),
    "|||$1 "
  );

  return marked
    .split("|||")
    .map((part) =>
      part
        .replace(/\b(?:malai|malaai|ko|lagi|chayako|chaiyako|chahiyo|chaiyo|cha|ho)\b/gi, " ")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter(Boolean);
}

function quantityFromSegment(segment = "") {
  const match = normalizeText(segment).match(new RegExp(`\\b(${NUMBER_PATTERN})\\b`, "i"));
  return match ? normalizeQuantity(match[1]) : extractQuantity(segment);
}

function bestRoleFromSegment(segment = "") {
  const clean = normalizeText(segment);
  let best = null;

  for (const roleInfo of ROLE_PATTERNS) {
    const regex = new RegExp(roleInfo.pattern, "i");

    if (!regex.test(clean)) continue;

    const score = roleInfo.priority + roleInfo.pattern.length / 1000;

    if (!best || score > best.score) {
      best = {
        role: roleInfo.role,
        roleLabel: roleInfo.roleLabel,
        category: roleInfo.category,
        score,
      };
    }
  }

  if (best) {
    return {
      role: best.role,
      roleLabel: best.roleLabel,
      category: best.category,
    };
  }

  return null;
}

export function parseHiringNeeds(text = "") {
  const segments = splitRoleSegments(text);
  const needs = [];

  for (const segment of segments) {
    const roleInfo = bestRoleFromSegment(segment);
    if (!roleInfo) continue;

    needs.push({
      role: roleInfo.role,
      roleLabel: roleInfo.roleLabel,
      quantity: Number(quantityFromSegment(segment) || 1),
      experienceRequired: /experience|sipalu|janne|janeko|kaam gareko|paila/i.test(text)
        ? "experienced"
        : "unknown",
      urgency: "unknown",
    });
  }

  if (!needs.length) {
    const role = findRole(text);

    if (role?.found && role.key !== "helper" && role.key !== "marketing_kitchen_staff") {
      needs.push({
        role: role.key,
        roleLabel: role.label,
        quantity: extractQuantity(text),
        experienceRequired: /experience|sipalu|janne|janeko|kaam gareko|paila/i.test(text)
          ? "experienced"
          : "unknown",
        urgency: "unknown",
      });
    }
  }

  const merged = new Map();

  for (const need of needs) {
    if (!merged.has(need.role)) {
      merged.set(need.role, { ...need });
    } else {
      const existing = merged.get(need.role);
      existing.quantity += need.quantity;
      if (need.experienceRequired === "experienced") {
        existing.experienceRequired = "experienced";
      }
    }
  }

  return Array.from(merged.values());
}

export function formatHiringNeedsSummary(needs = []) {
  if (!Array.isArray(needs) || !needs.length) return "";

  return needs
    .map((need) => `- ${need.quantity || 1} jana ${need.roleLabel || need.role}`)
    .join("\n");
}
