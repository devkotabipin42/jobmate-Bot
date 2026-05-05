import {
  getAaratiRawText,
  getAaratiNormalizedText,
  isAaratiUnsafeIllegalText,
  isAaratiFrustrationText,
} from "./aaratiTextNormalizer.service.js";

export function getAaratiHardSafetyBoundaryAnswer({ normalized } = {}) {
  const rawText = getAaratiRawText(normalized);
  const text = getAaratiNormalizedText(normalized);

  if (!rawText) return null;

  if (isAaratiUnsafeIllegalText(text)) {
    return {
      intent: "unknown",
      source: "aarati_hard_safety_boundary",
      detectedIntent: "unsafe_illegal_hiring",
      reply: `Yo request JobMate rules anusar mil्दैन 🙏

JobMate le legal, safe ra voluntary employment/hiring process matra support garcha.

Yedi tapai lai legal business ko lagi staff chahiyeko ho bhane business name, location, role ra salary detail pathaunu hola.`,
    };
  }

  // Very early typo frustration catch before generic fallback / AI classifier.
  if (isAaratiFrustrationText(text)) {
    return {
      intent: "frustrated",
      source: "aarati_hard_safety_boundary",
      detectedIntent: "frustration_or_abuse",
      reply: `Sorry Mitra ji 🙏

Aghi ko reply ramro bhayena jasto lagyo. Ma JobMate team bata kaam khojna, staff khojna, document/verification, pricing ra support ko kura ma help garna sakchu.

Tapai ko main kura ekchoti short ma pathaunu hola, ma sidha answer dinchhu.`,
    };
  }

  return null;
}
