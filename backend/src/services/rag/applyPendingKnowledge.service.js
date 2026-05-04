// Applies approved PendingKnowledge items into local JSON RAG files.
// Admin-only operation. This is safe for local/dev. For production persistence,
// later move knowledge storage to DB instead of writing source JSON.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PendingKnowledge } from "../../models/PendingKnowledge.model.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const knowledgeDir = path.resolve(__dirname, "../../data/knowledge");

const ROLES_FILE = path.join(knowledgeDir, "jobmate.roles.json");
const LOCALITIES_FILE = path.join(knowledgeDir, "lumbini.localities.json");

function readJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function normalizeKey(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, " ")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .trim();
}

function titleCase(value = "") {
  return String(value || "")
    .replace(/_/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function normalizeAlias(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueAliases(values = []) {
  const seen = new Set();
  const output = [];

  for (const value of values) {
    const clean = normalizeAlias(value);
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    output.push(clean);
  }

  return output;
}

function applyRoleKnowledge(item) {
  const roles = readJSON(ROLES_FILE);

  const suggestedValue = item.suggestedValue || {};
  const key = normalizeKey(item.suggestedKey || suggestedValue.role || item.suggestedLabel);
  const label = item.suggestedLabel || suggestedValue.label || titleCase(key);

  if (!key) {
    throw new Error("Cannot apply role knowledge without suggestedKey or suggestedLabel");
  }

  const existing = roles[key] || {
    label,
    category: "custom",
    aliases: [],
  };

  const examples = Array.isArray(item.examples)
    ? item.examples.map((example) => example.text)
    : [];

  const aliases = uniqueAliases([
    ...(existing.aliases || []),
    item.rawText,
    item.suggestedLabel,
    label,
    ...examples,
  ]);

  roles[key] = {
    ...existing,
    label: existing.label || label,
    category: existing.category || "custom",
    aliases,
  };

  writeJSON(ROLES_FILE, roles);

  return {
    type: "role",
    key,
    label: roles[key].label,
    aliasesCount: roles[key].aliases.length,
    file: "jobmate.roles.json",
  };
}

function applyLocationKnowledge(item) {
  const localities = readJSON(LOCALITIES_FILE);

  const suggestedValue = item.suggestedValue || {};
  const canonical = item.suggestedLabel || suggestedValue.canonical || item.rawText;
  const key = normalizeKey(item.suggestedKey || canonical);
  const district = suggestedValue.district || "";
  const province = suggestedValue.province || "Lumbini";

  if (!key || !canonical) {
    throw new Error("Cannot apply location knowledge without canonical location");
  }

  const existing = localities[key] || {
    canonical,
    district,
    province,
    aliases: [],
  };

  const examples = Array.isArray(item.examples)
    ? item.examples.map((example) => example.text)
    : [];

  const aliases = uniqueAliases([
    ...(existing.aliases || []),
    item.rawText,
    item.suggestedLabel,
    canonical,
    ...examples,
  ]);

  localities[key] = {
    ...existing,
    canonical: existing.canonical || canonical,
    district: existing.district || district,
    province: existing.province || province,
    aliases,
  };

  writeJSON(LOCALITIES_FILE, localities);

  return {
    type: "location",
    key,
    canonical: localities[key].canonical,
    district: localities[key].district,
    province: localities[key].province,
    aliasesCount: localities[key].aliases.length,
    file: "lumbini.localities.json",
  };
}

export async function applyPendingKnowledgeToRAG({
  id,
  reviewedBy = "admin",
  reviewNote = "Applied to RAG",
} = {}) {
  if (!id) {
    throw new Error("Missing pending knowledge id");
  }

  const item = await PendingKnowledge.findById(id);

  if (!item) {
    return {
      ok: false,
      statusCode: 404,
      message: "Pending knowledge item not found",
    };
  }

  if (!["role", "location"].includes(item.type)) {
    return {
      ok: false,
      statusCode: 400,
      message: `Apply is not supported for type: ${item.type}`,
    };
  }

  let applied;

  if (item.type === "role") {
    applied = applyRoleKnowledge(item);
  } else if (item.type === "location") {
    applied = applyLocationKnowledge(item);
  }

  item.status = "approved";
  item.reviewedAt = new Date();
  item.reviewedBy = reviewedBy;
  item.reviewNote = reviewNote;
  item.suggestedValue = {
    ...(item.suggestedValue || {}),
    applied,
  };

  await item.save();

  return {
    ok: true,
    item: item.toObject(),
    applied,
  };
}
