process.env.USE_NEW_CONVERSATION_ENGINE = "true";
process.env.ENABLE_AARATI_LLM = "false";
process.env.ENABLE_AARATI_AI_BRAIN = "false";
process.env.GEMINI_API_KEY = "";
process.env.GOOGLE_API_KEY = "";
process.env.MONGODB_URI ||= "mongodb://127.0.0.1:27017/jobmate-test";
process.env.META_VERIFY_TOKEN ||= "test-token";
process.env.META_ACCESS_TOKEN ||= "replace_later";
process.env.META_PHONE_NUMBER_ID ||= "test-phone-id";

const {
  resetConversationForRestart,
} = await import("../src/services/automation/conversationState.service.js");
const {
  buildJobMateMainMenuReply,
  resolveMainMenuSelection,
  shouldHandleMainMenuSelection,
} = await import("../src/services/automation/startRestartMenu.service.js");
const {
  handleWorkerRegistration,
} = await import("../src/services/automation/workerRegistration.service.js");
const { WorkerProfile } = await import("../src/models/WorkerProfile.model.js");

class FakeConversation {
  constructor(overrides = {}) {
    this._id = overrides._id || `worker-document-media-${Date.now()}-${Math.random()}`;
    this.currentIntent = overrides.currentIntent ?? "unknown";
    this.currentState = overrides.currentState ?? "idle";
    this.metadata = overrides.metadata || {
      collectedData: {},
      lastAskedField: null,
      activeFlow: null,
      source: "whatsapp",
    };
  }

  async save() {
    return this;
  }

  static async updateOne(_filter, update = {}) {
    if (activeConversation) {
      applyMongoUpdate(activeConversation, update);
    }
    return { acknowledged: true };
  }
}

const contact = {
  _id: "worker-document-media-contact",
  phone: "9840000000",
  displayName: "Ram",
};

const tests = [];
const replies = [];
const savedDocuments = [];
let activeConversation = null;

installDbStubs();

await test("image payload at ask_documents marks document received and asks name", async () => {
  const { conversation, result } = await runToDocumentStepAndSendMedia(mediaNormalized("image"));
  const profile = conversation.metadata?.collectedData || {};
  const reply = result.reply || "";

  assert(conversation.currentState === "ask_fullName", `state wrong: ${conversation.currentState}`);
  assert(conversation.metadata?.lastAskedField === "fullName", `lastAskedField wrong: ${conversation.metadata?.lastAskedField}`);
  assert(profile.documents === "yes", `documents not yes: ${profile.documents}`);
  assert(profile.documentReceived === true, "documentReceived not true");
  assert(profile.documentStatus === "received", `documentStatus wrong: ${profile.documentStatus}`);
  assert(profile.documentAttachment?.mediaId === "image-media-id", "image metadata not stored");
  assert(/^Document photo receive bhayo 🙏\nTapai ko naam pathaunus\.$/i.test(reply), `wrong reply: ${reply}`);
  assertNoDocumentMenu(reply);
  assertNoOcrLeak(reply);
});

await test("document payload at ask_documents marks document received and asks name", async () => {
  const { conversation, result } = await runToDocumentStepAndSendMedia(mediaNormalized("document"));
  const profile = conversation.metadata?.collectedData || {};
  const reply = result.reply || "";

  assert(conversation.currentState === "ask_fullName", `state wrong: ${conversation.currentState}`);
  assert(profile.documents === "yes", `documents not yes: ${profile.documents}`);
  assert(profile.documentReceived === true, "documentReceived not true");
  assert(profile.documentAttachment?.mediaId === "document-media-id", "document metadata not stored");
  assert(/^Document photo receive bhayo 🙏\nTapai ko naam pathaunus\.$/i.test(reply), `wrong reply: ${reply}`);
  assertNoDocumentMenu(reply);
  assertNoOcrLeak(reply);
});

await test("after media document, next text Bipin saves name and asks phone", async () => {
  const { conversation } = await runToDocumentStepAndSendMedia(mediaNormalized("image"));
  const result = await liveTurn(conversation, normalizedText("Bipin"));
  const profile = conversation.metadata?.collectedData || {};
  const reply = result.reply || "";

  assert(profile.fullName === "Bipin", `name not saved: ${profile.fullName}`);
  assert(conversation.currentState === "ask_providedPhone", `state wrong: ${conversation.currentState}`);
  assert(conversation.metadata?.lastAskedField === "providedPhone", `lastAskedField wrong: ${conversation.metadata?.lastAskedField}`);
  assert(/^Tapai ko phone\/WhatsApp number pathaunus\.$/i.test(reply), `phone prompt missing: ${reply}`);
  assertNoDocumentMenu(reply);
});

await test("media upload never repeats document status menu", async () => {
  const mediaReplies = replies.filter((reply) => /Document photo receive bhayo/i.test(reply));
  assert(mediaReplies.length >= 3, "media replies were not captured");

  for (const reply of mediaReplies) {
    assertNoDocumentMenu(reply);
  }
});

await test("media upload reply does not reveal OCR or extracted personal info", async () => {
  for (const reply of replies) {
    assertNoOcrLeak(reply);
  }
});

await test("document metadata is stored without using media as text input", async () => {
  assert(savedDocuments.length >= 3, `document metadata not saved: ${savedDocuments.length}`);
  assert(
    savedDocuments.every((document) => ["image-media-id", "document-media-id"].includes(document.mediaId)),
    `unexpected saved metadata: ${JSON.stringify(savedDocuments)}`
  );
});

console.table(tests);

const failed = tests.filter((row) => row.status !== "PASS");
if (failed.length) {
  console.log(`\nResult: ${failed.length} FAILED`);
  process.exitCode = 1;
} else {
  console.log("\nResult: ALL PASSED");
}

async function runToDocumentStepAndSendMedia(mediaMessage) {
  const conversation = new FakeConversation();
  activeConversation = conversation;

  for (const message of [
    normalizedText("start"),
    normalizedText("1"),
    normalizedText("marketing"),
    normalizedText("bardaghat"),
    normalizedText("1"),
  ]) {
    await liveTurn(conversation, message);
  }

  const result = await liveTurn(conversation, mediaMessage);
  return { conversation, result };
}

async function liveTurn(conversation, normalizedMessage) {
  const text = normalizedMessage?.message?.normalizedText || normalizedMessage?.message?.text || "";
  const value = String(text || "").toLowerCase().trim();

  if (["start", "restart", "menu", "hello", "hi"].includes(value)) {
    const reply = buildJobMateMainMenuReply();
    await resetConversationForRestart(conversation, {
      menuActive: true,
      lastQuestion: reply,
    });
    replies.push(reply);

    return {
      source: "reset",
      reply,
    };
  }

  if (shouldHandleMainMenuSelection({ text, conversation })) {
    const selection = resolveMainMenuSelection(text);
    await resetConversationForRestart(conversation, {
      menuActive: false,
      lastQuestion: null,
    });

    if (selection.flow === "worker") {
      return workerTurn(conversation, normalizedMessage, "menu_worker");
    }
  }

  if (isActiveWorkerRegistration(conversation)) {
    return workerTurn(conversation, normalizedMessage, "active_worker");
  }

  throw new Error(`unexpected non-worker route for message: ${text || normalizedMessage?.message?.type}`);
}

async function workerTurn(conversation, normalizedMessage, source) {
  activeConversation = conversation;
  const result = await handleWorkerRegistration({
    contact,
    conversation,
    normalizedMessage,
  });

  applyWorkerResult(conversation, result);

  const reply = result.messageToSend || result.reply || "";
  replies.push(reply);

  return {
    source,
    reply,
    result,
  };
}

function applyWorkerResult(conversation, result = {}) {
  const metadataUpdate = result.metadataUpdate || result.newMetadata || {};

  conversation.currentIntent = "worker_registration";
  conversation.currentState = result.currentState || metadataUpdate.currentState || conversation.currentState;
  conversation.metadata = {
    ...(conversation.metadata || {}),
    collectedData: metadataUpdate.collectedData || conversation.metadata?.collectedData || {},
    lastAskedField: metadataUpdate.lastAskedField ?? conversation.metadata?.lastAskedField ?? null,
    activeFlow: conversation.currentState === "completed" ? null : "worker_registration",
  };
}

function isActiveWorkerRegistration(conversation = {}) {
  const metadata = conversation.metadata || {};
  return (
    metadata.activeFlow === "worker_registration" ||
    conversation.currentIntent === "worker_registration" ||
    [
      "ask_jobType",
      "ask_district",
      "ask_availability",
      "ask_documents",
      "ask_fullName",
      "ask_providedPhone",
    ].includes(conversation.currentState) ||
    ["jobType", "district", "availability", "documents", "fullName", "providedPhone"].includes(metadata.lastAskedField)
  );
}

function normalizedText(text) {
  return {
    message: {
      text,
      normalizedText: String(text || "").toLowerCase(),
      type: "text",
    },
  };
}

function mediaNormalized(type) {
  const isImage = type === "image";
  return {
    message: {
      type,
      text: "",
      normalizedText: "",
      mediaId: isImage ? "image-media-id" : "document-media-id",
      mediaMimeType: isImage ? "image/jpeg" : "application/pdf",
      mediaFilename: isImage ? "citizenship-number-123456.jpg" : "private-cv-123456.pdf",
      mediaCaption: "citizenship no 123456 private details",
      mediaSha256: isImage ? "image-sha" : "document-sha",
      providerMessageId: isImage ? "wamid.image" : "wamid.document",
    },
  };
}

function installDbStubs() {
  WorkerProfile.findOneAndUpdate = async (_filter, update = {}) => {
    const document = update.$push?.documents;
    if (document) savedDocuments.push(document);

    return {
      _id: "fake-worker-profile",
      phone: contact.phone,
      documentStatus: update.$set?.documentStatus || "ready",
      documents: savedDocuments,
      metadata: update.$set || {},
    };
  };
}

function applyMongoUpdate(target, update = {}) {
  if (update.$set) {
    for (const [path, value] of Object.entries(update.$set)) {
      setPath(target, path, value);
    }
  }
}

function setPath(target, path, value) {
  const parts = String(path || "").split(".").filter(Boolean);
  let cursor = target;

  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = parts[index];
    cursor[part] ||= {};
    cursor = cursor[part];
  }

  cursor[parts[parts.length - 1]] = value;
}

function assertNoDocumentMenu(reply = "") {
  assert(!/Tapai sanga document chha/i.test(reply), `document menu repeated: ${reply}`);
  assert(!/Aile document status choose/i.test(reply), `document menu repeated: ${reply}`);
  assert(!/1\. Chha, photo\/file/i.test(reply), `document option repeated: ${reply}`);
}

function assertNoOcrLeak(reply = "") {
  assert(!/123456/i.test(reply), `personal number leaked: ${reply}`);
  assert(!/citizenship no/i.test(reply), `caption detail leaked: ${reply}`);
  assert(!/private-cv|citizenship-number/i.test(reply), `filename leaked: ${reply}`);
}

async function test(name, fn) {
  try {
    await fn();
    tests.push({ test: name, status: "PASS" });
  } catch (error) {
    tests.push({ test: name, status: "FAIL", reason: error.message });
  }
}

function assert(condition, messageText) {
  if (!condition) throw new Error(messageText);
}
