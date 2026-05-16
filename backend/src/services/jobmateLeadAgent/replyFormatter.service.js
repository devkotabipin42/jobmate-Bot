const SENSITIVE_TECH_REPLACEMENTS = [
  [/\bAI-powered\s+/gi, ""],
  [/\bAI driven\b/gi, "verified"],
  [/\bAI\b/gi, ""],
  [/\bGemini\b/gi, ""],
  [/\bOpenAI\b/gi, ""],
  [/\bChatGPT\b/gi, ""],
  [/\bLLM\b/gi, ""],
  [/\bprovider\b/gi, "service"],
  [/\bmodel\b/gi, "system"],
];

const HINDI_WORD_REPLACEMENTS = [
  [/\bkya\b/gi, "ke"],
  [/\bhai\b/gi, "chha"],
  [/\bnahi\b/gi, "chaina"],
  [/\baap\b/gi, "tapai"],
  [/\bnaukri\b/gi, "job"],
  [/\bchahiye\b/gi, "chahinchha"],
  [/\bkaise\b/gi, "kasari"],
  [/\bmadad\b/gi, "sahayog"],
  [/\bkripya\b/gi, "daya garera"],
  [/\baadhaar\b/gi, "basis"],
];

export function formatReply(input) {
  const raw = Array.isArray(input)
    ? input.filter(Boolean).join("\n\n")
    : String(input || "");

  return sanitizeReply(raw);
}

export function sanitizeReply(reply = "") {
  let value = String(reply || "");

  for (const [pattern, replacement] of SENSITIVE_TECH_REPLACEMENTS) {
    value = value.replace(pattern, replacement);
  }

  for (const [pattern, replacement] of HINDI_WORD_REPLACEMENTS) {
    value = value.replace(pattern, replacement);
  }

  value = repairBrokenReplyPrefix(value);

  return value
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function repairBrokenReplyPrefix(value = "") {
  return String(value || "")
    .replace(/^\s*aste\b/i, "Namaste")
    .replace(/^\s*i\s+kasto\s+kaam/i, "Tapai kasto kaam")
    .replace(/^\s*quest\s+JobMate\s+rules/i, "Yo request JobMate rules");
}

export function findReplyPolicyIssues(reply = "") {
  const value = String(reply || "");
  const issues = [];

  if (/\b(AI|Gemini|OpenAI|ChatGPT|LLM|provider|model)\b/i.test(value)) {
    issues.push("tech_word");
  }

  if (/\b(kya|hai|nahi|aap|naukri|chahiye|kaise|madad|kripya)\b/i.test(value)) {
    issues.push("hindi_word");
  }

  return issues;
}
