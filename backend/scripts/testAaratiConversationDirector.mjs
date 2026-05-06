/**
 * AARATI-16A — Human Conversation Director tests
 * Pure unit tests — no DB, no WhatsApp, no AI call.
 */

import {
  detectHumanConversationMode,
  buildHumanClarificationReply,
  reduceMenuRepetition,
  rememberLastContextPatch,
  isSafeDirectorReply,
} from "../src/services/aarati/aaratiConversationDirector.service.js";

let passed = 0;
let failed = 0;

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

function makeConv(overrides = {}) {
  return {
    currentState: "idle",
    currentIntent: "",
    metadata: { lastQuestion: "", collectedData: {}, ...overrides },
  };
}

// ---------------------------------------------------------------------------
// 1. Mode detection
// ---------------------------------------------------------------------------
section("1. detectHumanConversationMode");

const modeTests = [
  { text: "why i trust you",           expected: "trust_question" },
  { text: "document leak bhayo bhane?",expected: "document_question" },
  { text: "can you provide staff?",    expected: "employer_question" },
  { text: "ma student ho parttime milxa", expected: "jobseeker_question" },
  { text: "khana khanu bhayo",         expected: "small_talk" },
  { text: "you bitch",                 expected: "frustration" },
  { text: "manxe bechni",              expected: "unsafe_request" },
  { text: "tme koho",                  expected: "identity_question" },
  { text: "price kati ho",             expected: "pricing_question" },
  { text: "support team sanga kura garna milxa", expected: "support_request" },
  { text: "politics kura garau",       expected: "out_of_scope" },
  { text: "afjhalkfj askdj fsd",       expected: "unclear" },
];

for (const { text, expected } of modeTests) {
  const mode = detectHumanConversationMode({ text, conversation: makeConv() });
  assert(
    `"${text}" → mode: ${expected}`,
    mode === expected,
    `got: ${mode}`
  );
}

// ---------------------------------------------------------------------------
// 2. buildHumanClarificationReply — all modes produce non-empty safe replies
// ---------------------------------------------------------------------------
section("2. buildHumanClarificationReply — all modes");

const allModes = [
  "trust_question", "identity_question", "document_question", "pricing_question",
  "support_request", "employer_question", "jobseeker_question", "small_talk",
  "frustration", "unsafe_request", "out_of_scope", "unclear",
];

for (const mode of allModes) {
  const reply = buildHumanClarificationReply({ mode, text: "", conversation: makeConv() });
  assert(`mode "${mode}" → non-empty reply`, typeof reply === "string" && reply.length > 20);
}

// ---------------------------------------------------------------------------
// 3. Safety: no provider/model/fake guarantee in any director reply
// ---------------------------------------------------------------------------
section("3. Safety: no unsafe content in director replies");

const UNSAFE_RE = [
  /gemini/i, /openai/i, /chatgpt/i, /\bgpt\b/i,
  /100%\s*guarantee/i, /guaranteed job/i,
  /salary guarantee dinch/i, /system prompt/i, /language model/i,
];

for (const mode of allModes) {
  const reply = buildHumanClarificationReply({ mode, text: "", conversation: makeConv() });
  const safe = UNSAFE_RE.every((re) => !re.test(reply));
  assert(`mode "${mode}" reply has no unsafe content`, safe, reply.slice(0, 60));
}

assert(
  "isSafeDirectorReply: safe text → true",
  isSafeDirectorReply("Bujhe Mitra ji 🙏")
);
assert(
  "isSafeDirectorReply: 'Gemini le bhanyo' → false",
  !isSafeDirectorReply("Gemini le bhanyo")
);
assert(
  "isSafeDirectorReply: 'guaranteed job dinchhu' → false",
  !isSafeDirectorReply("100% guaranteed job dinchhu")
);

// ---------------------------------------------------------------------------
// 4. Reply format: always has opener + body + next step (3 paragraphs)
// ---------------------------------------------------------------------------
section("4. Reply format: opener + body + next step");

for (const mode of allModes) {
  const reply = buildHumanClarificationReply({ mode, text: "", conversation: makeConv() });
  const paragraphs = reply.split(/\n\n+/).filter(Boolean);
  assert(
    `mode "${mode}" has at least 2 paragraphs`,
    paragraphs.length >= 2,
    `got ${paragraphs.length} paragraphs`
  );
}

// ---------------------------------------------------------------------------
// 5. reduceMenuRepetition
// ---------------------------------------------------------------------------
section("5. reduceMenuRepetition");

const GENERIC_MENU = "Tapai kaam khojdai hunuhunchha ki staff khojdai hunuhunchha?";
const ALSO_MENU_LAST = "kaam khojdai hunuhunchha ki staff khojdai hunuhunchha";

assert(
  "non-menu reply → unchanged",
  reduceMenuRepetition({ reply: "Kasto kaam chahiyo?", conversation: makeConv() }) === "Kasto kaam chahiyo?"
);
assert(
  "menu reply, last was NOT menu → unchanged",
  reduceMenuRepetition({
    reply: GENERIC_MENU,
    conversation: makeConv({ lastQuestion: "Yo JobMate Nepal ko service ho." }),
  }) === GENERIC_MENU
);

const altReply = reduceMenuRepetition({
  reply: GENERIC_MENU,
  conversation: makeConv({ lastQuestion: ALSO_MENU_LAST }),
});
assert(
  "menu reply, last was ALSO menu → alternate human clarification returned",
  altReply !== GENERIC_MENU && altReply.length > 10
);
assert(
  "alternate reply mentions jobseeker/employer",
  /jobseeker|employer|jobseeker ho ki employer/i.test(altReply)
);

// Using lastAaratiReplySignature instead of lastQuestion
const altReply2 = reduceMenuRepetition({
  reply: GENERIC_MENU,
  conversation: makeConv({ lastAaratiReplySignature: ALSO_MENU_LAST }),
});
assert(
  "signature-based repetition also triggers alternate",
  altReply2 !== GENERIC_MENU
);

// ---------------------------------------------------------------------------
// 6. rememberLastContextPatch
// ---------------------------------------------------------------------------
section("6. rememberLastContextPatch");

const patch1 = rememberLastContextPatch({
  text: "butwal ma driver job chahiyo",
  reply: "Bujhe Mitra ji...",
  route: "job_search",
  conversation: makeConv(),
});
assert("patch has lastAaratiMode", typeof patch1.lastAaratiMode === "string");
assert("patch has lastAaratiReplySignature", typeof patch1.lastAaratiReplySignature === "string");
assert("patch extracts location 'butwal'", patch1.lastUsefulLocation === "butwal");
assert("patch extracts role 'driver'", patch1.lastUsefulRole === "driver");
assert("patch has lastUserTopic", patch1.lastUserTopic.length > 0);

const patch2 = rememberLastContextPatch({
  text: "hello",
  reply: "Thik cha",
  route: "unknown",
  conversation: makeConv(),
});
assert("patch without location → no lastUsefulLocation key set", !patch2.lastUsefulLocation);
assert("patch without role → no lastUsefulRole key set", !patch2.lastUsefulRole);

// ---------------------------------------------------------------------------
// 7. Context-aware next step in jobseeker mode
// ---------------------------------------------------------------------------
section("7. Context-aware reply: uses lastUsefulLocation when known");

const convWithLocation = makeConv({ lastUsefulLocation: "butwal" });
const reply = buildHumanClarificationReply({
  mode: "jobseeker_question",
  text: "kaam chahiyo",
  conversation: convWithLocation,
});
assert(
  "jobseeker reply with lastUsefulLocation mentions Butwal",
  /butwal/i.test(reply)
);

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n══════════════════════════════════`);
console.log(`AARATI-16A Director Tests: ${passed} passed, ${failed} failed`);
console.log(`══════════════════════════════════`);

if (failed > 0) process.exit(1);
