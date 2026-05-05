import {
  detectConversationRepairEvent,
  isAaratiIdentityQuestion,
  isFrustrationOrAbuse,
  isIgnoredComplaint,
  isHumanRequest,
} from "../src/services/safety/jobmateConversationRepair.service.js";

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

const conversation = {
  currentState: "ask_documents",
  metadata: { lastAskedField: "documents" },
};

assertEqual("identity question detected", isAaratiIdentityQuestion("timi ko ho?"), true);
assertEqual("ignored complaint detected", isIgnoredComplaint("mero msg dekhidaina ki ignore gareko?"), true);
assertEqual("human request detected", isHumanRequest("manche sanga kura garna paryo"), true);
assertEqual("frustration detected", isFrustrationOrAbuse("yo kasto pattu jasto reply ho"), true);

const identityEvent = detectConversationRepairEvent({
  conversation,
  normalized: { message: { text: "timi ko ho?" } },
});

assertEqual(
  "identity event reply keeps next step",
  {
    type: identityEvent?.type,
    intent: identityEvent?.intent,
    needsHuman: identityEvent?.needsHuman,
    hasNextStep: identityEvent?.reply?.includes("Document bina profile save garna 2"),
  },
  {
    type: "identity_question",
    intent: "worker_registration",
    needsHuman: false,
    hasNextStep: true,
  }
);

const ignoredEvent = detectConversationRepairEvent({
  conversation,
  normalized: { message: { text: "mero msg dekhidaina ki ignore gareko?" } },
});

assertEqual(
  "ignored complaint creates human review",
  {
    type: ignoredEvent?.type,
    intent: ignoredEvent?.intent,
    needsHuman: ignoredEvent?.needsHuman,
  },
  {
    type: "ignored_complaint",
    intent: "frustrated",
    needsHuman: true,
  }
);

console.log(`\nResult: ${failed === 0 ? "ALL PASSED" : `${failed} FAILED`}`);

if (failed > 0) {
  process.exit(1);
}
