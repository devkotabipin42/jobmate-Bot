import {
  getAaratiRawText,
  getAaratiNormalizedText,
  isAaratiUnsafeIllegalText,
  isAaratiFrustrationText,
  isAaratiFairLaborViolationText,
  isAaratiCvPrivacyQuestion,
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
      reply: `Yo request JobMate rules anusar mildaina 🙏

JobMate le legal, safe ra voluntary employment/hiring process matra support garcha.

Yedi tapai lai legal business ko lagi staff chahiyeko ho bhane business name, location, role ra salary detail pathaunu hola.`,
    };
  }

  // Fair labor violation — refuse hard, do not show pricing or plans
  if (isAaratiFairLaborViolationText(text)) {
    return {
      intent: "unknown",
      source: "aarati_hard_safety_boundary",
      detectedIntent: "fair_labor_violation",
      reply: `Yo request JobMate rules anusar mildaina 🙏

JobMate le minimum wage ra legal salary anusar matra hiring support garcha. Bina paisa/salary kaam garaunus bhanera match garna mildaina — yo Nepal Labour Act anusar illegal ho.

Legal salary ra proper contract sanga staff khojna ho bhane business name, location, role ra salary range pathaunu hola.`,
    };
  }

  // CV privacy question — clear, safe answer about data policy
  if (isAaratiCvPrivacyQuestion(text)) {
    return {
      intent: "unknown",
      source: "aarati_hard_safety_boundary",
      detectedIntent: "cv_privacy_question",
      reply: `Hajur, bujhe 🙏

Tapai ko CV/document sabai company lai automatically share gardaina. Relevant employer sanga match bhaye matra — ra tapai ko permission anusar matra — share huncha. Baher pathauune, leak garauune, wa sell garauune kaam JobMate le gardaina.

Document bina profile save garna pani milcha. Comfortable nahunuhunna bhane document skip garnu hola.`,
    };
  }

  // Very early typo frustration catch before generic fallback / AI classifier.
  if (isAaratiFrustrationText(text)) {
    return {
      intent: "frustrated",
      source: "aarati_hard_safety_boundary",
      detectedIntent: "frustration_or_abuse",
      reply: `Maaf garnu hola 🙏

Aghi ko reply ramro bhayena jasto lagyo. Ma JobMate team bata kaam khojna, staff khojna, document/verification, pricing ra support ko kura ma help garna sakchu.

Tapai ko main kura ekchoti short ma pathaunu hola, ma sidha answer dinchhu.`,
    };
  }

  return null;
}
