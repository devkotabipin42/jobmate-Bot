/**
 * AARATI-15E — Provider Fallback + One AI Call Policy
 * Regression tests for deterministic fallback behavior.
 *
 * Pure unit tests — no DB, no WhatsApp, no AI call.
 * Tests that informational questions never route to job_search/worker_registration
 * even when all AI providers are down.
 */

import {
  shouldUseAaratiAiFirstRouter,
  buildAaratiDeterministicFallback,
} from "../src/services/aarati/aaratiAiFirstRouter.service.js";
import { normalizeAaratiText } from "../src/services/aarati/aaratiTextNormalizer.service.js";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function makeNormalized(text) {
  return { message: { text, normalizedText: text } };
}

function makeConversation(state = "idle", lastAskedField = "") {
  return {
    currentState: state,
    currentIntent: "",
    metadata: { lastAskedField, collectedData: {} },
  };
}

function assert(label, condition, detail = "") {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

function section(title) {
  console.log(`\n── ${title} ──`);
}

// ---------------------------------------------------------------------------
// 1. shouldUseAaratiAiFirstRouter routing decisions
// ---------------------------------------------------------------------------

section("1. Routing gate: shouldUseAaratiAiFirstRouter");

const idleConv = makeConversation("idle");
const activeConv = makeConversation("ask_jobType", "jobType");
const employerConv = makeConversation("ask_vacancy");

assert(
  "empty text → false",
  !shouldUseAaratiAiFirstRouter({ normalized: makeNormalized(""), conversation: idleConv })
);
assert(
  "single menu digit '1' → false",
  !shouldUseAaratiAiFirstRouter({ normalized: makeNormalized("1"), conversation: idleConv })
);
assert(
  "active worker flow → false",
  !shouldUseAaratiAiFirstRouter({ normalized: makeNormalized("driver"), conversation: activeConv })
);
assert(
  "active employer flow → false",
  !shouldUseAaratiAiFirstRouter({ normalized: makeNormalized("butwal"), conversation: employerConv })
);
assert(
  "clear jobseeker request → false",
  !shouldUseAaratiAiFirstRouter({ normalized: makeNormalized("malai kaam chahiyo"), conversation: idleConv })
);
assert(
  "clear employer request → false (provide staff)",
  !shouldUseAaratiAiFirstRouter({ normalized: makeNormalized("can you help me provide staff"), conversation: idleConv })
);
assert(
  "informational question → true",
  shouldUseAaratiAiFirstRouter({ normalized: makeNormalized("why i should trust you"), conversation: idleConv })
);
assert(
  "Butwal driver job query → true (passes gate, AI or fallback handles)",
  shouldUseAaratiAiFirstRouter({ normalized: makeNormalized("Butwal ma driver job cha?"), conversation: idleConv })
);
assert(
  "parttime student query → true",
  shouldUseAaratiAiFirstRouter({ normalized: makeNormalized("mah student ho parttime milxa"), conversation: idleConv })
);

// ---------------------------------------------------------------------------
// 2. Deterministic fallback: correct intent detection
// ---------------------------------------------------------------------------

section("2. Deterministic fallback: intent detection");

function getFallback(text) {
  const normalized = normalizeAaratiText(text);
  return buildAaratiDeterministicFallback(text, normalized);
}

const cases = [
  { text: "why i should trust you",      expectedIntent: "trust_question" },
  { text: "do you remember me",          expectedIntent: "memory_question" },
  { text: "can you call me",             expectedIntent: "call_request" },
  { text: "can i choose salary myself",  expectedIntent: "salary_choice_question" },
  { text: "how fast can i get job",      expectedIntent: "job_speed_question" },
  { text: "interview kasari hunxa",      expectedIntent: "interview_question" },
  { text: "can you make my cv",          expectedIntent: "cv_help_question" },
  { text: "mah student ho parttime milxa", expectedIntent: "parttime_question" },
  { text: "Butwal ma driver job cha?",   expectedIntent: "safe_unknown_question" },
];

for (const { text, expectedIntent } of cases) {
  const result = getFallback(text);
  assert(
    `"${text}" → detectedIntent: ${expectedIntent}`,
    result.detectedIntent === expectedIntent,
    `got: ${result.detectedIntent}`
  );
}

// ---------------------------------------------------------------------------
// 3. Deterministic fallback: safety properties
// ---------------------------------------------------------------------------

section("3. Fallback safety: no model/provider mention, no fake guarantees");

// Check for AI provider mentions or fabricated guarantees — but allow
// "fake job use gardaina" (refusal context) so only catch affirmative fake claims.
const UNSAFE_PATTERNS = [
  /gemini/i, /openai/i, /chatgpt/i, /\bgpt\b/i,
  /100%\s*guarantee/i, /guaranteed job/i,
  /job guarantee dinch/i, /salary guarantee dinch/i,
  /verified job cha/i, /company le lincha/i,
  /system prompt/i, /language model/i,
];

for (const { text } of cases) {
  const result = getFallback(text);
  const isSafe = UNSAFE_PATTERNS.every((re) => !re.test(result.reply));
  assert(`"${text}" reply has no unsafe content`, isSafe, result.reply.slice(0, 60));
}

// ---------------------------------------------------------------------------
// 4. Fallback return shape
// ---------------------------------------------------------------------------

section("4. Fallback return shape validation");

for (const { text } of cases) {
  const result = getFallback(text);
  assert(
    `"${text}" has source field`,
    result.source === "aarati_ai_first_router:deterministic_fallback"
  );
  assert(
    `"${text}" has non-empty reply`,
    typeof result.reply === "string" && result.reply.length > 10
  );
  assert(
    `"${text}" intent is bounded DB-safe value`,
    ["unknown", "frustrated"].includes(result.intent),
    `got: ${result.intent}`
  );
}

// ---------------------------------------------------------------------------
// 5. Employer request goes to employer flow (not AI router)
// ---------------------------------------------------------------------------

section("5. Employer / jobseeker commands bypass AI router");

assert(
  '"can you help me provide staff" → skips AI router (employer flow)',
  !shouldUseAaratiAiFirstRouter({
    normalized: makeNormalized("can you help me provide staff"),
    conversation: idleConv,
  })
);
assert(
  '"staff chahiyo" → skips AI router',
  !shouldUseAaratiAiFirstRouter({
    normalized: makeNormalized("staff chahiyo"),
    conversation: idleConv,
  })
);
assert(
  '"kaam chahiyo" → skips AI router',
  !shouldUseAaratiAiFirstRouter({
    normalized: makeNormalized("kaam chahiyo"),
    conversation: idleConv,
  })
);
assert(
  '"job chahiyo" → skips AI router',
  !shouldUseAaratiAiFirstRouter({
    normalized: makeNormalized("job chahiyo"),
    conversation: idleConv,
  })
);

// ---------------------------------------------------------------------------
// 6. Frustration/unsafe: correct intent + handoffNeeded
// ---------------------------------------------------------------------------

section("6. Special intents: frustration & unsafe");

const frustrationResult = getFallback("are you stupid bakwas bot");
assert(
  "frustration → intent: frustrated",
  frustrationResult.intent === "frustrated"
);
assert(
  "frustration → handoffNeeded: true",
  frustrationResult.handoffNeeded === true
);

const unsafeResult = getFallback("human trafficking ma kaam deu");
assert(
  "unsafe → intent: unknown (not routed to hiring flow)",
  unsafeResult.intent === "unknown"
);
assert(
  "unsafe → handoffNeeded: false (handled by boundary, not escalated)",
  unsafeResult.handoffNeeded === false
);
assert(
  "unsafe → reply refuses clearly",
  /mildaina|legal|rules/i.test(unsafeResult.reply)
);

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n══════════════════════════════════`);
console.log(`AARATI-15E Tests: ${passed} passed, ${failed} failed`);
console.log(`══════════════════════════════════`);

if (failed > 0) {
  process.exit(1);
}
