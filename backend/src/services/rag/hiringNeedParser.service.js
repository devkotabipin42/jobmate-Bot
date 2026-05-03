// Deterministic parser for employer multi-role hiring requests.
// AI may understand the sentence, but this parser preserves separate roles:
// "1 cooking 2 driver 1 marketing" => 3 hiringNeeds.

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

const NUMBER_PATTERN = "(?:\\d+|aauta|auta|euta|ek|one|dui|due|two|tin|three|char|chaar|four|panch|five)";

const ROLE_PATTERNS = [
  {
    role: "kitchen_staff",
    roleLabel: "Kitchen Staff",
    category: "hospitality",
    pattern: "(?:cooking|cook|kitchen|khana\\s+pakaune|khana\\s+banaune|khana\\s+pakauni)",
  },
  {
    role: "driver",
    roleLabel: "Driver",
    category: "transport",
    pattern: "(?:driver|driving|gadi\\s+chalak|chalak)",
  },
  {
    role: "marketing_staff",
    roleLabel: "Marketing Staff",
    category: "sales_marketing",
    pattern: "(?:marketing|marketting|field\\s+marketing|parchar|promotion)",
  },
  {
    role: "security_guard",
    roleLabel: "Security Guard",
    category: "security",
    pattern: "(?:security|guard|security\\s+guard|watchman)",
  },
  {
    role: "field_promoter",
    roleLabel: "Field Promoter",
    category: "sales_marketing",
    pattern: "(?:field\\s+promoter|promoter|sticker\\s+batne|print\\s+sticker|gau\\s+gau\\s+jane)",
  },
  {
    role: "shopkeeper",
    roleLabel: "Shopkeeper",
    category: "retail",
    pattern: "(?:shopkeeper|shop\\s+keeper|seller|selling|selling\\s+garne|sale\\s+garne|sales\\s+garne|bechne|bechni|bechna|saman\\s+bechne|pasal\\s+ma\\s+saman\\s+bechne|dokan\\s+ma\\s+saman\\s+bechni|counter\\s+staff)",
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
      new RegExp(`\\b${NUMBER_PATTERN}\\s*(?:jana|jna)?\\s*(?:staff)?\\s*(?:ma|maa|madhye|vittra|bhitra)\\b`, "gi"),
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
}

function preprocess(text = "") {
  return removeTotalCountPrefix(text)
    // "arko chai cooking" means another 1 cooking.
    .replace(/\barko\s+(?:chai|chahi)?\s*/gi, " 1 ")
    .replace(/\bani\b/gi, " ")
    .replace(/\bra\b/gi, " ")
    .replace(/\band\b/gi, " ")
    .replace(/\bchai\b/gi, " ")
    .replace(/\bchahi\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getExplicitQuantityForRole(text, rolePattern) {
  const quantityBeforeRole = new RegExp(
    `\\b(${NUMBER_PATTERN})\\s*(?:jana|jna)?\\s*(?:chai|chahi)?\\s*${rolePattern}\\b`,
    "i"
  );

  const beforeMatch = text.match(quantityBeforeRole);
  if (beforeMatch?.[1]) return normalizeQuantity(beforeMatch[1]);

  return null;
}

function hasRole(text, rolePattern) {
  return new RegExp(rolePattern, "i").test(text);
}

export function parseHiringNeeds(text = "") {
  const clean = preprocess(text);
  const needs = [];

  for (const roleInfo of ROLE_PATTERNS) {
    if (!hasRole(clean, roleInfo.pattern)) continue;

    const explicitQuantity = getExplicitQuantityForRole(clean, roleInfo.pattern);
    const quantity = explicitQuantity || 1;

    needs.push({
      role: roleInfo.role,
      roleLabel: roleInfo.roleLabel,
      quantity,
      experienceRequired: /experience|sipalu|janne|janeko|kaam gareko|paila/i.test(clean)
        ? "experienced"
        : "unknown",
      urgency: "unknown",
    });
  }

  // Fallback for true single-role messages that are not covered above.
  if (!needs.length) {
    const role = findRole(text);

    if (role?.found && role.key !== "helper" && role.key !== "marketing_kitchen_staff") {
      needs.push({
        role: role.key,
        roleLabel: role.label,
        quantity: extractQuantity(text),
        experienceRequired: /experience|sipalu|janne|janeko|kaam gareko|paila/i.test(clean)
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

function formatRoleLabel(role = "") {
  const labels = {
    kitchen_staff: "Kitchen Staff",
    cook: "Cook",
    driver: "Driver",
    marketing_staff: "Marketing Staff",
    field_promoter: "Field Promoter",
    shopkeeper: "Shopkeeper",
    security_guard: "Security Guard",
    garage_worker: "Garage Worker",
    street_food_vendor: "Street Food Vendor",
    house_helper: "House Helper",
    helper: "General Helper",
  };

  const value = String(role || "").trim();

  if (labels[value]) return labels[value];

  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatHiringNeedsSummary(needs = []) {
  if (!Array.isArray(needs) || !needs.length) return "";

  return needs
    .map((need) => {
      const label = need.roleLabel && !String(need.roleLabel).includes("_")
        ? need.roleLabel
        : formatRoleLabel(need.role);

      return `- ${need.quantity || 1} jana ${label}`;
    })
    .join("\n");
}
