// Detects useful unknown knowledge candidates.
// This service does not modify JSON knowledge directly.

import {
  savePendingRoleSuggestion,
  savePendingLocationSuggestion,
  savePendingFAQSuggestion,
} from "./pendingKnowledge.service.js";

function normalizeText(text = "") {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isGenericRole(role = "", label = "") {
  const value = `${role} ${label}`.toLowerCase();

  if (!value.trim()) return true;

  return [
    "helper",
    "staff",
    "general helper",
    "worker",
    "manxe",
    "manche",
  ].some((item) => value === item || value.includes(item));
}

function isUsefulUnknownRole({ role = "", roleLabel = "", matched = {} } = {}) {
  if (!role && !roleLabel) return false;
  if (isGenericRole(role, roleLabel)) return false;

  // If RAG already matched a known role alias, no need to save pending knowledge.
  if (matched?.roleFound) return false;

  return true;
}

function isUsefulUnknownLocation({
  location = "",
  district = "",
  matched = {},
} = {}) {
  const cleanLocation = normalizeText(location);
  const cleanDistrict = normalizeText(district);

  if (!cleanLocation) return false;
  if (["nepal", "lumbini", "lumbini province"].includes(cleanLocation)) return false;
  if (cleanLocation === cleanDistrict) return false;

  // If RAG already matched location, no need to save.
  if (matched?.locationFound) return false;

  return true;
}

export async function learnFromEmployerBrain({
  rawText = "",
  phone = "",
  brain = {},
  source = "whatsapp_aarati",
} = {}) {
  const saved = [];

  if (isUsefulUnknownRole(brain)) {
    const item = await savePendingRoleSuggestion({
      rawText,
      suggestedKey: brain.role || "",
      suggestedLabel: brain.roleLabel || brain.role || "",
      phone,
      source,
    });

    if (item) {
      saved.push({
        type: "role",
        id: item._id,
        suggestedKey: item.suggestedKey,
        suggestedLabel: item.suggestedLabel,
      });
    }
  }

  if (isUsefulUnknownLocation(brain)) {
    const item = await savePendingLocationSuggestion({
      rawText,
      suggestedLabel: brain.location,
      district: brain.district,
      province: brain.province || "Lumbini",
      phone,
      source,
    });

    if (item) {
      saved.push({
        type: "location",
        id: item._id,
        suggestedLabel: item.suggestedLabel,
      });
    }
  }

  return saved;
}

export async function learnFromFAQ({
  rawText = "",
  phone = "",
  suggestedLabel = "",
  source = "whatsapp_aarati",
} = {}) {
  return savePendingFAQSuggestion({
    rawText,
    suggestedLabel,
    phone,
    source,
  });
}
