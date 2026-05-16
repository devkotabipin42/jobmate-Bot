// Pure output validation helpers for Aarati.
// Comments are intentionally English-only.

const HINDI_BLACKLIST = [
  "kal", "aaj", "bujhe", "samajh", "samajhna", "samjha", "samjhe", "samjhana",
  "kripaya", "dhanyavad", "dhanyawaad", "shukriya", "aur", "phir", "fir",
  "hain", "hai", "tha", "thi", "the", "hoon", "hun", "hu", "kuch", "thoda",
  "thodi", "thode", "jyada", "zyada", "jada", "sirf", "bas", "humara",
  "hamara", "tumhara", "tera", "meri", "mera", "mere", "apna", "apni",
  "apne", "haan", "han", "nahi", "nahin", "mat", "kya", "kyā", "kahan",
  "kahaan", "kab", "kyun", "kyu", "kaisa", "kaisi", "kaise", "chahiye",
  "chahie", "milega", "milegi", "milenge", "milna", "batao", "batana",
  "dekho", "dekhna", "ruko", "rukna", "ruk", "idhar", "udhar", "yahan",
  "yahaan", "wahan", "wahaan", "abhi", "lagta", "lagti", "lagte", "lekin",
  "magar", "parantu", "agar", "yadi", "toh", "to", "kyunki", "isliye",
  "iske", "uske", "uska", "iski", "iska", "unka", "unki", "unke", "kaun",
  "kaunsa", "kaunsi", "kaunse", "jaldi", "dheere", "achha", "accha",
  "acha", "achhi", "achhe", "bura", "buri", "bure", "zaroor", "jaroor",
  "zaruri", "jaruri", "madad", "sahayata", "naukri", "kaamyaab", "paisa",
  "rupiya", "rupaye", "dinbhar", "aadha", "aadhi", "poora", "poori",
  "pura", "puri", "sab", "sabhi", "koi", "waise", "vaise", "shayad",
  "filhal", "haal", "sawal", "jawab", "pasand", "napasand", "maalum",
  "pata", "karna", "karo", "karega", "karegi", "karoge", "karungi",
  "karunga", "denge", "dunga", "dungi", "liye", "liyeh", "lao", "lo",
  "chalo", "aao", "jao", "bhejo", "bhejna", "puchho", "puchna",
  "सवाल", "जवाब", "नौकरी", "समझ", "समझे", "कुछ", "और", "फिर", "नहीं",
  "हाँ", "क्या", "कहाँ", "कब", "क्यों", "कैसा", "चाहिए", "मिलेगा"
];

const FORBIDDEN_IDENTITY_TERMS = [
  "chatbot", "bot", "robot", "machine", "gemini", "openai", "language model",
  "llm", "artificial intelligence"
];

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasStandaloneTerm(text, term) {
  const escaped = escapeRegExp(term);
  const regex = new RegExp(`(^|[^\\p{L}\\p{N}_])${escaped}(?=$|[^\\p{L}\\p{N}_])`, "iu");
  return regex.test(String(text || ""));
}

export function getHindiBlacklist() {
  return [...HINDI_BLACKLIST];
}

export function validateHindiFreeOutput(text) {
  const value = String(text || "").trim();

  if (!value) {
    return { ok: false, reason: "empty_output", word: null };
  }

  for (const word of HINDI_BLACKLIST) {
    if (hasStandaloneTerm(value, word)) {
      return { ok: false, reason: "hindi_word_detected", word };
    }
  }

  return { ok: true, reason: null, word: null };
}

export function validateAaratiIdentityOutput(text) {
  const value = String(text || "").trim();

  for (const term of FORBIDDEN_IDENTITY_TERMS) {
    if (hasStandaloneTerm(value, term)) {
      return { ok: false, reason: "forbidden_identity_term", word: term };
    }
  }

  return { ok: true, reason: null, word: null };
}

export function validateAaratiOutput(text) {
  const hindi = validateHindiFreeOutput(text);
  if (!hindi.ok) return hindi;

  const identity = validateAaratiIdentityOutput(text);
  if (!identity.ok) return identity;

  return { ok: true, reason: null, word: null };
}

export function sanitizeAaratiOutput(text, fallbackText = "") {
  const value = String(text || "").trim();
  const validation = validateAaratiOutput(value);

  if (validation.ok) return value;

  const fallback = String(fallbackText || "").trim();
  if (fallback && validateAaratiOutput(fallback).ok) return fallback;

  return "Namaskar 🙏 Ma Aarati, JobMate Nepal team bata. Kaam khojne, salary, company ra profile registration sambandhi kura ma sahayog garna sakchu.";
}

export async function generateWithNepaliValidation({
  generator,
  buildPrompt,
  fallback,
  maxAttempts = 3,
  logger = console,
} = {}) {
  if (typeof generator !== "function") {
    return resolveFallback(fallback);
  }

  let lastReason = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const prompt = typeof buildPrompt === "function"
        ? buildPrompt({ attempt, lastReason })
        : undefined;

      const reply = await generator({ attempt, prompt, lastReason });
      const validation = validateAaratiOutput(reply);

      if (validation.ok) {
        return String(reply || "").trim();
      }

      lastReason = `${validation.reason}:${validation.word || ""}`;
      logger.warn?.("Aarati output rejected", { attempt, lastReason });
    } catch (error) {
      lastReason = error?.message || "generation_failed";
      logger.warn?.("Aarati generation failed", { attempt, lastReason });
    }
  }

  return resolveFallback(fallback);
}

function resolveFallback(fallback) {
  if (typeof fallback === "function") {
    return sanitizeAaratiOutput(fallback());
  }

  return sanitizeAaratiOutput(fallback);
}
