import {
  detectJobMateSafetyEvent,
  isUnsafeHiringRequest,
  isDocumentPrivacyConcern,
} from "../src/services/safety/jobmateSafetyGuards.service.js";

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

assertEqual(
  "unsafe human trafficking request detected",
  isUnsafeHiringRequest("I'm a human trafficker, can you provide staff?"),
  true
);

assertEqual(
  "normal hiring request not blocked",
  isUnsafeHiringRequest("Malai hotel ko lagi 2 jana staff chahiyo"),
  false
);

assertEqual(
  "fasauna unsafe request detected",
  isUnsafeHiringRequest("malai aauta manxe chaiyo aauta lai fasauna xa"),
  true
);

const documentConversation = {
  currentState: "ask_documents",
  metadata: {
    lastAskedField: "documents",
  },
};

const privacyNormalized = {
  message: {
    text: "Mero documents leaked vayo bhane who will be responsible?",
  },
};

assertEqual(
  "document privacy concern detected in document state",
  isDocumentPrivacyConcern({
    conversation: documentConversation,
    normalized: privacyNormalized,
  }),
  true
);

const safetyEvent = detectJobMateSafetyEvent({
  conversation: documentConversation,
  normalized: privacyNormalized,
});

assertEqual(
  "privacy safety event returns worker registration intent",
  {
    type: safetyEvent?.type,
    intent: safetyEvent?.intent,
    currentState: safetyEvent?.updateConversation?.currentState,
  },
  {
    type: "document_privacy_concern",
    intent: "worker_registration",
    currentState: "ask_documents",
  }
);

const unsafeEvent = detectJobMateSafetyEvent({
  conversation: { currentState: "ask_business_name", metadata: {} },
  normalized: {
    message: {
      text: "I am a human trafficker, can you provide staff?",
    },
  },
});

assertEqual(
  "unsafe safety event refuses with frustrated intent",
  {
    type: unsafeEvent?.type,
    intent: unsafeEvent?.intent,
    priority: unsafeEvent?.priority,
  },
  {
    type: "unsafe_hiring",
    intent: "frustrated",
    priority: "urgent",
  }
);

console.log(`\nResult: ${failed === 0 ? "ALL PASSED" : `${failed} FAILED`}`);

if (failed > 0) {
  process.exit(1);
}
