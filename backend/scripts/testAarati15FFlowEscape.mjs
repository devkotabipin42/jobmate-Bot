/**
 * AARATI-15F — Flow Escape + Command Precedence + State Contamination Guard
 * Pure unit tests — no DB, no WhatsApp, no AI call.
 */

import {
  shouldUseAaratiAiFirstRouter,
  buildAaratiDeterministicFallback,
} from "../src/services/aarati/aaratiAiFirstRouter.service.js";
import {
  normalizeAaratiText,
  isAaratiRestartCommandText,
  isAaratiIdentityQuestionText,
} from "../src/services/aarati/aaratiTextNormalizer.service.js";
import { getAaratiPreFlowQaAnswer } from "../src/services/aarati/aaratiPreFlowQaGuard.service.js";
import { getAaratiActiveFlowSideReply } from "../src/services/aarati/aaratiActiveFlowSideReply.service.js";

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

function makeNorm(text) {
  return { message: { text, normalizedText: text.toLowerCase() } };
}

function makeConv(state = "idle", lastAskedField = "") {
  return { currentState: state, currentIntent: "", metadata: { lastAskedField, collectedData: {} } };
}

// ---------------------------------------------------------------------------
// 1. Restart command: must bypass AI-first router
// ---------------------------------------------------------------------------
section("1. Restart command precedence");

for (const cmd of ["start", "restart", "suru", "menu"]) {
  assert(
    `"${cmd}" → isAaratiRestartCommandText = true`,
    isAaratiRestartCommandText(cmd)
  );
  assert(
    `"${cmd}" → shouldUseAaratiAiFirstRouter = false`,
    !shouldUseAaratiAiFirstRouter({ normalized: makeNorm(cmd), conversation: makeConv() })
  );
}
assert(
  '"hello" is NOT restart command',
  !isAaratiRestartCommandText("hello")
);
assert(
  '"kaam chahiyo" is NOT restart command',
  !isAaratiRestartCommandText("kaam chahiyo")
);

// ---------------------------------------------------------------------------
// 2. "tme koho" normalization → identity
// ---------------------------------------------------------------------------
section("2. tme koho → identity answer");

const tmeNorm = normalizeAaratiText("tme koho");
assert(
  '"tme koho" normalizes to contain "timi ko ho"',
  tmeNorm.includes("timi ko ho"),
  `got: "${tmeNorm}"`
);
assert(
  '"tme koho" isAaratiIdentityQuestionText = true',
  isAaratiIdentityQuestionText("tme koho")
);

const tmeResult = buildAaratiDeterministicFallback("tme koho", normalizeAaratiText("tme koho"));
assert(
  '"tme koho" deterministic → identity intent',
  tmeResult.detectedIntent === "identity",
  `got: ${tmeResult.detectedIntent}`
);
assert(
  '"tme koho" AI-first router skips (not in active flow)',
  shouldUseAaratiAiFirstRouter({ normalized: makeNorm("tme koho"), conversation: makeConv() })
  // returns true → AI-first router handles it with identity reply
);

// ---------------------------------------------------------------------------
// 3. "why i trust you" → trust answer, no state set
// ---------------------------------------------------------------------------
section("3. Trust question → trust answer, no worker_registration state");

const trustResult = buildAaratiDeterministicFallback("why i trust you", normalizeAaratiText("why i trust you"));
assert(
  '"why i trust you" → trust_question intent',
  trustResult.detectedIntent === "trust_question",
  `got: ${trustResult.detectedIntent}`
);
assert(
  '"why i trust you" → intent: unknown (not worker_registration)',
  trustResult.intent === "unknown"
);
assert(
  '"why i trust you" reply mentions JobMate registered/safe',
  /registered|safe|genuine/i.test(trustResult.reply)
);
assert(
  '"why i trust you" → shouldUseAaratiAiFirstRouter=true (idle conv → AI router handles, no old chain)',
  shouldUseAaratiAiFirstRouter({ normalized: makeNorm("why i trust you"), conversation: makeConv() })
);

// ---------------------------------------------------------------------------
// 4. Salary/memory: not trapped in ask_jobType (idle conv handled by AI-first)
// ---------------------------------------------------------------------------
section("4. Salary/memory handled by AI-first (idle) or preFlowQa");

const salaryResult = buildAaratiDeterministicFallback("can i choose salary myself", normalizeAaratiText("can i choose salary myself"));
assert(
  '"can i choose salary myself" → salary_choice_question',
  salaryResult.detectedIntent === "salary_choice_question",
  `got: ${salaryResult.detectedIntent}`
);

const memoryPFQ = getAaratiPreFlowQaAnswer({ normalized: makeNorm("do you remember me"), conversation: makeConv() });
assert(
  '"do you remember me" (idle) → preFlowQa catches it',
  memoryPFQ !== null && memoryPFQ.detectedIntent === "memory"
);

// ---------------------------------------------------------------------------
// 5. Active flow (ask_documents) + informational question → side answer + reminder
// ---------------------------------------------------------------------------
section("5. Active ask_documents + identity/trust → side reply with reminder");

const docsConv = makeConv("ask_documents", "documents");

const identitySide = getAaratiActiveFlowSideReply({ text: "tme koho", conversation: docsConv });
assert(
  'active ask_documents + "tme koho" → side reply returned',
  identitySide !== null,
  "got null"
);
assert(
  'active ask_documents + "tme koho" → reply mentions Aarati/JobMate',
  identitySide !== null && /aarati|jobmate/i.test(identitySide)
);
assert(
  'active ask_documents + "tme koho" → reply includes document step reminder',
  identitySide !== null && /document/i.test(identitySide)
);

const trustSide = getAaratiActiveFlowSideReply({ text: "why should i trust you", conversation: docsConv });
assert(
  'active ask_documents + "why should i trust you" → side reply',
  trustSide !== null
);

// ---------------------------------------------------------------------------
// 6. Active ask_jobType + "interview kasari hunxa" → side reply + reminder
// ---------------------------------------------------------------------------
section("6. Active ask_jobType + interview question → side reply with reminder");

const jobTypeConv = makeConv("ask_jobType", "jobType");

const interviewSide = getAaratiActiveFlowSideReply({ text: "interview kasari hunxa", conversation: jobTypeConv });
assert(
  'active ask_jobType + "interview kasari hunxa" → side reply',
  interviewSide !== null,
  "got null"
);
assert(
  'active ask_jobType + "interview kasari hunxa" → includes interview info',
  interviewSide !== null && /interview/i.test(interviewSide)
);
assert(
  'active ask_jobType + "interview kasari hunxa" → includes job type step reminder',
  interviewSide !== null && /kaam type|job type|IT|Driver|Hotel/i.test(interviewSide)
);

// ---------------------------------------------------------------------------
// 7. Employer ask_business_name + "butwal ma driver job xa" → switch prompt
// ---------------------------------------------------------------------------
section("7. Employer ask_business_name + jobseeker query → switch prompt");

const bizNameConv = makeConv("ask_business_name");

const switchSide = getAaratiActiveFlowSideReply({ text: "butwal ma driver job xa", conversation: bizNameConv });
assert(
  '"butwal ma driver job xa" in ask_business_name → switch prompt returned',
  switchSide !== null,
  "got null"
);
assert(
  'switch prompt mentions staff/job switch',
  switchSide !== null && /staff|job|kaam|switch/i.test(switchSide)
);
assert(
  'switch prompt includes business name reminder',
  switchSide !== null && /business|company/i.test(switchSide)
);

// ---------------------------------------------------------------------------
// 8. "New Nepal Pustak" in ask_business_name → no side reply (normal business name)
// ---------------------------------------------------------------------------
section("8. Legit company name → no side reply in employer flow");

const legitBizSide = getAaratiActiveFlowSideReply({ text: "New Nepal Pustak", conversation: bizNameConv });
assert(
  '"New Nepal Pustak" in ask_business_name → no side reply (goes to handleEmployerLead)',
  legitBizSide === null,
  `got: "${legitBizSide}"`
);

// ---------------------------------------------------------------------------
// 9. "can you provide me staff" → employer flow (shouldUseAaratiAiFirstRouter=false)
// ---------------------------------------------------------------------------
section("9. Employer request bypasses AI router");

assert(
  '"can you provide me staff" → shouldUseAaratiAiFirstRouter=false',
  !shouldUseAaratiAiFirstRouter({ normalized: makeNorm("can you provide me staff"), conversation: makeConv() })
);
assert(
  '"staff chahiyo" → shouldUseAaratiAiFirstRouter=false',
  !shouldUseAaratiAiFirstRouter({ normalized: makeNorm("staff chahiyo"), conversation: makeConv() })
);

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n══════════════════════════════════`);
console.log(`AARATI-15F Tests: ${passed} passed, ${failed} failed`);
console.log(`══════════════════════════════════`);

if (failed > 0) {
  process.exit(1);
}
