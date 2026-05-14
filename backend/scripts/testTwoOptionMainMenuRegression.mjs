process.env.USE_NEW_CONVERSATION_ENGINE = "true";
process.env.ENABLE_AARATI_LLM = "false";
process.env.ENABLE_AARATI_AI_BRAIN = "false";
process.env.MONGODB_URI ||= "mongodb://127.0.0.1:27017/jobmate-test";
process.env.META_VERIFY_TOKEN ||= "test-token";
process.env.META_ACCESS_TOKEN ||= "test-token";
process.env.META_PHONE_NUMBER_ID ||= "test-phone-id";

const {
  resetConversationForRestart,
} = await import("../src/services/automation/conversationState.service.js");
const {
  buildJobMateMainMenuReply,
  buildUnavailableMainMenuSelectionReply,
  isStartRestartMenuCommand,
  resolveMainMenuSelection,
  shouldHandleMainMenuSelection,
} = await import("../src/services/automation/startRestartMenu.service.js");
const {
  handleWorkerRegistration,
} = await import("../src/services/automation/workerRegistration.service.js");
const {
  handleEmployerLead,
} = await import("../src/services/automation/employerLead.service.js");
const { Message } = await import("../src/models/Message.model.js");
const { EmployerLead } = await import("../src/models/EmployerLead.model.js");
const { Conversation } = await import("../src/models/Conversation.model.js");

class FakeConversation {
  constructor(overrides = {}) {
    this._id = overrides._id || `two-option-menu-${Date.now()}-${Math.random()}`;
    this.currentIntent = overrides.currentIntent ?? "unknown";
    this.currentState = overrides.currentState ?? "idle";
    this.metadata = overrides.metadata || {};
  }

  async save() {
    return this;
  }

  static async updateOne() {
    return { acknowledged: true };
  }
}

const contact = {
  _id: "507f1f77bcf86cd799439011",
  phone: "9840000000",
  displayName: "Mitra",
};

const tests = [];
let activeConversation = null;
let fakeLead = null;

installDbStubs();

await test("start menu shows only options 1 and 2", async () => {
  const { reply } = await resetWithCommand("start");

  assertTwoOptionMenu(reply);
});

await test("restart menu shows only options 1 and 2", async () => {
  const { reply } = await resetWithCommand("restart");

  assertTwoOptionMenu(reply);
});

await test("start -> 3 asks to choose 1 or 2 without invalid Message intent", async () => {
  const { conversation } = await resetWithCommand("start");
  const result = await simulateMainMenuSelection(conversation, "3");
  const validationError = validateMessageIntent(result.intent);

  assert(result.intent === "unknown", `option 3 intent should be unknown, got ${result.intent}`);
  assert(result.flow === "unavailable", `option 3 flow should be unavailable, got ${result.flow}`);
  assert(/1\. Job khojna ra 2\. Staff khojna matra available/i.test(result.reply), "option 3 guidance missing");
  assert(!/sahakari_partnership|Sahakari partnership/i.test(result.reply), "option 3 reply mentioned disabled Sahakari route");
  assert(!validationError, `Message intent validation failed: ${validationError?.message}`);
});

await test("start -> 1 still starts worker flow", async () => {
  const { conversation } = await resetWithCommand("start");
  const result = await simulateMainMenuSelection(conversation, "1");

  assert(result.intent === "worker_registration", `worker intent wrong: ${result.intent}`);
  assert(result.flow === "worker", `worker flow wrong: ${result.flow}`);
  assert(/Tapai kasto kaam|Driver \/ Transport/i.test(result.reply), "worker flow did not ask job type");
});

await test("start -> 2 still starts employer flow", async () => {
  const { conversation } = await resetWithCommand("start");
  const result = await simulateMainMenuSelection(conversation, "2");

  assert(result.intent === "employer_lead", `employer intent wrong: ${result.intent}`);
  assert(result.flow === "employer", `employer flow wrong: ${result.flow}`);
  assert(result.state === "ask_business_name", `employer did not start at business name: ${result.state}`);
  assert(/company\/business ko naam/i.test(result.reply), "employer flow did not ask business name");
});

await test("main menu reply never contains Sahakari partnership", async () => {
  const reply = buildJobMateMainMenuReply();

  assert(!/Sahakari partnership/i.test(reply), "main menu still contains Sahakari partnership");
});

console.table(tests);

const failed = tests.filter((row) => row.status !== "PASS");
if (failed.length) {
  console.log(`\nResult: ${failed.length} FAILED`);
  process.exitCode = 1;
} else {
  console.log("\nResult: ALL PASSED");
}

async function resetWithCommand(command) {
  assert(isStartRestartMenuCommand(command), `${command} is not a reset command`);

  const conversation = new FakeConversation({
    currentIntent: "worker_registration",
    currentState: "ask_documents",
    metadata: {
      collectedData: {
        jobType: "Driver",
      },
    },
  });
  const reply = buildJobMateMainMenuReply();

  await resetConversationForRestart(conversation, {
    menuActive: true,
    lastQuestion: reply,
  });

  return { conversation, reply };
}

async function simulateMainMenuSelection(conversation, text) {
  assert(shouldHandleMainMenuSelection({ text, conversation }), `${text} was not handled as menu selection`);

  const selection = resolveMainMenuSelection(text);
  const resetConversation = await resetConversationForRestart(conversation, {
    menuActive: false,
    lastQuestion: null,
  });

  if (selection.flow === "unavailable") {
    return {
      flow: selection.flow,
      intent: selection.intent,
      state: "idle",
      reply: buildUnavailableMainMenuSelectionReply(),
    };
  }

  if (selection.flow === "worker") {
    const result = await handleWorkerRegistration({
      contact,
      conversation: resetConversation,
      normalizedMessage: normalized(text),
    });

    return {
      flow: selection.flow,
      intent: result.intent,
      state: result.currentState || result.newMetadata?.currentState,
      reply: result.messageToSend || result.reply || "",
    };
  }

  if (selection.flow === "employer") {
    activeConversation = resetConversation;
    fakeLead = buildLeadBase();
    const result = await handleEmployerLead({
      contact,
      conversation: resetConversation,
      normalizedMessage: normalized(text),
      aiExtraction: null,
    });

    return {
      flow: selection.flow,
      intent: result.intent,
      state: result.currentState,
      reply: result.messageToSend || "",
    };
  }

  return {
    flow: selection.flow,
    intent: selection.intent,
    state: "idle",
    reply: "",
  };
}

function assertTwoOptionMenu(reply = "") {
  assert(/Namaste\. JobMate ma tapai job khojna ya staff khojna saknuhunchha\./.test(reply), "main menu opening copy wrong");
  assert(/1\. Job khojna/.test(reply), "main menu missing worker option");
  assert(/2\. Staff khojna/.test(reply), "main menu missing employer option");
  assert(!/3\./.test(reply), "main menu still shows option 3");
  assert(!/Sahakari partnership/i.test(reply), "main menu still mentions Sahakari partnership");
}

function validateMessageIntent(intent) {
  const message = new Message({
    contactId: contact._id,
    direction: "inbound",
    text: "3",
    normalizedText: "3",
    intent,
  });

  return message.validateSync();
}

function installDbStubs() {
  EmployerLead.findOneAndUpdate = async (_filter, update = {}) => {
    fakeLead ||= buildLeadBase();
    applyMongoUpdate(fakeLead, update);
    return fakeLead;
  };

  EmployerLead.findOne = () => ({
    lean: async () => fakeLead,
  });

  Conversation.findByIdAndUpdate = async (_id, update = {}) => {
    applyMongoUpdate(activeConversation, update);
    return activeConversation;
  };
}

function buildLeadBase() {
  return {
    _id: "fake-employer-lead",
    contactId: contact._id,
    phone: contact.phone,
    whatsapp: contact.phone,
    source: "whatsapp",
    leadStatus: "qualifying",
    location: {},
    hiringNeeds: [],
    metadata: {},
    score: 0,
  };
}

function applyMongoUpdate(target, update = {}) {
  if (!target) return;

  for (const [path, value] of Object.entries(update.$setOnInsert || {})) {
    if (getPath(target, path) === undefined) setPath(target, path, value);
  }

  for (const [path, value] of Object.entries(update.$set || {})) {
    setPath(target, path, value);
  }

  for (const path of Object.keys(update.$unset || {})) {
    unsetPath(target, path);
  }

  for (const [path, value] of Object.entries(update.$inc || {})) {
    setPath(target, path, Number(getPath(target, path) || 0) + Number(value || 0));
  }

  for (const [path, value] of Object.entries(update.$push || {})) {
    const current = getPath(target, path);
    const arr = Array.isArray(current) ? current : [];
    const values = value && Array.isArray(value.$each) ? value.$each : [value];
    arr.push(...values);
    setPath(target, path, arr);
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

function getPath(target, path) {
  const parts = String(path || "").split(".").filter(Boolean);
  let cursor = target;

  for (const part of parts) {
    if (!cursor || typeof cursor !== "object" || !(part in cursor)) return undefined;
    cursor = cursor[part];
  }

  return cursor;
}

function unsetPath(target, path) {
  const parts = String(path || "").split(".").filter(Boolean);
  let cursor = target;

  for (let index = 0; index < parts.length - 1; index += 1) {
    cursor = cursor?.[parts[index]];
    if (!cursor || typeof cursor !== "object") return;
  }

  delete cursor[parts[parts.length - 1]];
}

function normalized(text) {
  return {
    message: {
      text,
      normalizedText: String(text || "").toLowerCase(),
      type: "text",
    },
  };
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
