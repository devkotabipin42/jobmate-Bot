import { shouldTryGeneralAIAnswer } from "../src/services/rag/jobmateGeneralAnswer.service.js";

let failed = 0;

function assertEqual(name, actual, expected) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`\n${pass ? "✅" : "❌"} ${name}`);

  if (!pass) {
    failed += 1;
    console.log("Expected:", expected);
    console.log("Actual:", actual);
  }
}

const idle = { currentState: "idle", metadata: {} };

function normalized(text) {
  return { message: { text, normalizedText: text.toLowerCase() } };
}

assertEqual(
  "general question can use AI",
  shouldTryGeneralAIAnswer({
    conversation: idle,
    normalized: normalized("khana khayau?"),
  }),
  true
);

assertEqual(
  "job search does not use general AI",
  shouldTryGeneralAIAnswer({
    conversation: idle,
    normalized: normalized("butwal ma job chaiyo"),
  }),
  false
);

assertEqual(
  "menu reply does not use general AI",
  shouldTryGeneralAIAnswer({
    conversation: { currentState: "ask_jobType", metadata: { lastAskedField: "jobType" } },
    normalized: normalized("1"),
  }),
  false
);

assertEqual(
  "active document state does not use general AI",
  shouldTryGeneralAIAnswer({
    conversation: { currentState: "ask_documents", metadata: { lastAskedField: "documents" } },
    normalized: normalized("document safe cha?"),
  }),
  false
);

console.log(`\nResult: ${failed === 0 ? "ALL PASSED" : `${failed} FAILED`}`);

if (failed > 0) process.exit(1);
