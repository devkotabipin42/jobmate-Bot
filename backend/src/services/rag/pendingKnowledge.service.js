import crypto from "crypto";
import { PendingKnowledge } from "../../models/PendingKnowledge.model.js";

function normalizeText(text = "") {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function makeKey({ type, rawText, suggestedKey, suggestedLabel } = {}) {
  const base = normalizeText(
    suggestedKey ||
      suggestedLabel ||
      rawText ||
      "unknown"
  );

  const compact = base.slice(0, 80);

  if (compact) return compact;

  return crypto
    .createHash("sha1")
    .update(`${type}:${rawText}`)
    .digest("hex")
    .slice(0, 16);
}

async function savePendingKnowledge({
  type,
  rawText,
  suggestedKey = "",
  suggestedLabel = "",
  suggestedValue = {},
  phone = "",
  source = "whatsapp_aarati",
} = {}) {
  if (!type || !rawText) {
    return null;
  }

  const normalizedKey = makeKey({
    type,
    rawText,
    suggestedKey,
    suggestedLabel,
  });

  const example = {
    text: String(rawText || "").trim(),
    phone: String(phone || "").trim(),
    source,
    seenAt: new Date(),
  };

  return PendingKnowledge.findOneAndUpdate(
    {
      type,
      normalizedKey,
    },
    {
      $setOnInsert: {
        type,
        rawText: String(rawText || "").trim(),
        normalizedKey,
        suggestedKey: String(suggestedKey || "").trim().toLowerCase(),
        suggestedLabel: String(suggestedLabel || "").trim(),
        suggestedValue,
        status: "pending",
        firstSeenAt: new Date(),
      },
      $set: {
        lastSeenAt: new Date(),
      },
      $inc: {
        count: 1,
      },
      $push: {
        examples: {
          $each: [example],
          $slice: -10,
        },
      },
    },
    {
      upsert: true,
      returnDocument: "after",
      setDefaultsOnInsert: true,
    }
  );
}

export async function savePendingRoleSuggestion({
  rawText,
  suggestedKey = "",
  suggestedLabel = "",
  phone = "",
  source = "whatsapp_aarati",
} = {}) {
  return savePendingKnowledge({
    type: "role",
    rawText,
    suggestedKey,
    suggestedLabel,
    suggestedValue: {
      role: suggestedKey,
      label: suggestedLabel,
    },
    phone,
    source,
  });
}

export async function savePendingLocationSuggestion({
  rawText,
  suggestedLabel = "",
  district = "",
  province = "Lumbini",
  phone = "",
  source = "whatsapp_aarati",
} = {}) {
  return savePendingKnowledge({
    type: "location",
    rawText,
    suggestedKey: suggestedLabel,
    suggestedLabel,
    suggestedValue: {
      canonical: suggestedLabel,
      district,
      province,
    },
    phone,
    source,
  });
}

export async function savePendingFAQSuggestion({
  rawText,
  suggestedLabel = "",
  phone = "",
  source = "whatsapp_aarati",
} = {}) {
  return savePendingKnowledge({
    type: "faq",
    rawText,
    suggestedKey: suggestedLabel || rawText,
    suggestedLabel,
    suggestedValue: {
      question: rawText,
    },
    phone,
    source,
  });
}

export async function listPendingKnowledge({
  type,
  status = "pending",
  limit = 50,
} = {}) {
  const query = {};

  if (type) query.type = type;
  if (status) query.status = status;

  return PendingKnowledge.find(query)
    .sort({ count: -1, lastSeenAt: -1 })
    .limit(Number(limit || 50))
    .lean();
}
