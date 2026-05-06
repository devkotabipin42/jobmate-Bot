import {
  normalizeAaratiAiFirstResult,
  shouldUseAaratiAiFirstRouter,
} from "../src/services/aarati/aaratiAiFirstRouter.service.js";

let failed = 0;

function assert(name, condition, details = "") {
  console.log(`\n${condition ? "✅" : "❌"} ${name}`);
  if (!condition) {
    failed += 1;
    if (details) console.log(details);
  }
}

function normalized(text) {
  return { message: { text, normalizedText: text.toLowerCase() } };
}

const idle = { currentState: "idle", metadata: {} };

assert(
  "AI-first router accepts safe random question",
  shouldUseAaratiAiFirstRouter({
    normalized: normalized("what are you saying"),
    conversation: idle,
  }) === true,
  "should be true"
);

// AARATI-15E: "Butwal ma driver job cha?" passes AI-first router as an informational
// question (no explicit "kaam chahiyo"/"job chahiyo"). AI-first or deterministic
// fallback handles it with a bounded reply — it does NOT go to old job_search classifier.
assert(
  "AI-first router handles informational job query (Butwal ma driver job cha?)",
  shouldUseAaratiAiFirstRouter({
    normalized: normalized("Butwal ma driver job cha?"),
    conversation: idle,
  }) === true,
  "informational job query should be handled by AI-first router, not old classifier"
);

assert(
  "AI-first router does not interrupt active flow",
  shouldUseAaratiAiFirstRouter({
    normalized: normalized("khana khanu bhayo"),
    conversation: { currentState: "ask_documents", metadata: { lastAskedField: "documents" } },
  }) === false,
  "active flow should be false"
);

const invalidIntent = normalizeAaratiAiFirstResult({
  intent: "small_talk",
  detectedIntent: "small_talk",
  allowed: true,
  confidence: 0.9,
  reply: "Hajur Mitra ji, thik cha 🙏 Ma Aarati ho.",
});

assert(
  "invalid AI intent maps to unknown",
  invalidIntent.intent === "unknown",
  JSON.stringify(invalidIntent)
);

const providerLeak = normalizeAaratiAiFirstResult({
  intent: "unknown",
  detectedIntent: "safe_unknown",
  allowed: true,
  confidence: 0.9,
  reply: "As an AI language model from OpenAI, I can help.",
});

assert(
  "provider/model leak is replaced by safe fallback",
  !/OpenAI|AI language model|ChatGPT|Gemini/i.test(providerLeak.reply),
  providerLeak.reply
);

const fakeGuarantee = normalizeAaratiAiFirstResult({
  intent: "unknown",
  detectedIntent: "safe_unknown",
  allowed: true,
  confidence: 0.9,
  reply: "Pakka job guarantee dinchu, sure job milcha.",
});

assert(
  "fake guarantee is blocked",
  !/guarantee dinchu|sure job|pakka job/i.test(fakeGuarantee.reply),
  fakeGuarantee.reply
);

const disallowedMoney = normalizeAaratiAiFirstResult({
  intent: "unknown",
  detectedIntent: "personal_money_request",
  allowed: false,
  confidence: 0.9,
  reply: "I can give money.",
});

assert(
  "disallowed money gets JobMate money fallback",
  /loan\/paisa dine service haina|income\/kaam/i.test(disallowedMoney.reply),
  disallowedMoney.reply
);

console.log(`\nResult: ${failed === 0 ? "ALL PASSED" : `${failed} FAILED`}`);
if (failed > 0) process.exit(1);
