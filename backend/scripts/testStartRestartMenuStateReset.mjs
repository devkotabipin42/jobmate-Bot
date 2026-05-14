process.env.USE_NEW_CONVERSATION_ENGINE = "true";
process.env.ENABLE_AARATI_LLM = "false";
process.env.ENABLE_AARATI_AI_BRAIN = "false";

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

class FakeConversation {
  static updates = [];

  constructor(overrides = {}) {
    this._id = overrides._id || `fake-conv-${Date.now()}-${Math.random()}`;
    this.currentIntent = overrides.currentIntent ?? "worker_registration";
    this.currentState = overrides.currentState ?? "ask_documents";
    this.metadata = overrides.metadata || buildStaleMetadata();
  }

  async save() {
    FakeConversation.saved = {
      currentIntent: this.currentIntent,
      currentState: this.currentState,
      metadata: this.metadata,
    };
    return this;
  }

  static async updateOne(filter, patch) {
    FakeConversation.updates.push({ filter, patch });
    return { acknowledged: true };
  }
}

const contact = {
  _id: "contact-start-reset",
  phone: "9840000000",
  displayName: "Mitra",
};

const tests = [];

await test("start/restart commands are hard reset commands", async () => {
  assert(isStartRestartMenuCommand("start"), "start not reset command");
  assert(isStartRestartMenuCommand("restart"), "restart not reset command");
  assert(isStartRestartMenuCommand("menu"), "menu not reset command");
  assert(isStartRestartMenuCommand("hello"), "hello not reset command");
  assert(isStartRestartMenuCommand("hi"), "hi not reset command");
});

await test("start -> 1 must not save old profile", async () => {
  const worker = await runResetThenWorker("start");

  assertFreshWorkerAsk(worker.result);
  assertCleared(worker.conversation);
});

await test("restart -> 1 asks fresh first worker question", async () => {
  const worker = await runResetThenWorker("restart");

  assertFreshWorkerAsk(worker.result);
  assert(/kasto kaam|driver|transport/i.test(worker.result.messageToSend || ""), "worker first question missing");
});

await test("start -> 2 must not continue old worker flow", async () => {
  const conversation = await runHardReset("start");
  const selection = resolveMainMenuSelection("2");

  assert(shouldHandleMainMenuSelection({ text: "2", conversation }), "menu 2 not handled after reset");
  assert(selection.intent === "employer_lead", "menu 2 did not select employer flow");
  assert(selection.flow === "employer", "menu 2 did not resolve employer flow");
  assertCleared(conversation);
});

await test("start -> 3 must not continue old worker/employer flow or save disabled intent", async () => {
  const conversation = await runHardReset("start", {
    currentIntent: "employer_lead",
    currentState: "ask_vacancy_role",
  });
  const selection = resolveMainMenuSelection("3");
  const reply = buildUnavailableMainMenuSelectionReply();

  assert(shouldHandleMainMenuSelection({ text: "3", conversation }), "menu 3 not handled after reset");
  assert(selection.intent === "unknown", "menu 3 used invalid enabled intent");
  assert(selection.flow === "unavailable", "menu 3 did not resolve to unavailable flow");
  assert(/1\. Job khojna ra 2\. Staff khojna matra available/i.test(reply), "menu 3 unavailable reply missing");
  assert(!/sahakari_partnership|Sahakari partnership/i.test(reply), "menu 3 reply mentioned disabled Sahakari route");
});

await test("old collectedData exists, start then 1 clears old data", async () => {
  const conversation = await runHardReset("start");
  await resetConversationForRestart(conversation, {
    menuActive: false,
    lastQuestion: null,
  });
  const result = await handleWorkerRegistration({
    contact,
    conversation,
    normalizedMessage: message("1"),
  });

  assertFreshWorkerAsk(result);
  assert(Object.keys(conversation.metadata.collectedData || {}).length === 0, "old collectedData survived reset");
});

await test("repeated start/restart does not re-save old profile", async () => {
  const conversation = await runHardReset("start");
  await resetConversationForRestart(conversation, {
    menuActive: true,
    lastQuestion: buildJobMateMainMenuReply(),
  });
  await resetConversationForRestart(conversation, {
    menuActive: true,
    lastQuestion: buildJobMateMainMenuReply(),
  });

  assertCleared(conversation);
  assert(!/save bhayo/i.test(conversation.metadata.lastQuestion || ""), "repeated reset re-saved profile");
});

await test('"1" without menu but no active state starts worker safely', async () => {
  const conversation = new FakeConversation({
    currentIntent: "unknown",
    currentState: "idle",
    metadata: {
      qualificationStep: 0,
      collectedData: {},
      lastAskedField: null,
      source: "whatsapp",
    },
  });

  assert(shouldHandleMainMenuSelection({ text: "1", conversation }), "idle 1 was not handled safely");
  assert(resolveMainMenuSelection("1")?.intent === "worker_registration", "idle 1 did not select worker");

  const result = await handleWorkerRegistration({
    contact,
    conversation,
    normalizedMessage: message("1"),
  });

  assertFreshWorkerAsk(result);
});

console.table(tests);

const failed = tests.filter((row) => row.status !== "PASS");
if (failed.length) {
  console.log(`\nResult: ${failed.length} FAILED`);
  process.exitCode = 1;
} else {
  console.log("\nResult: ALL PASSED");
}

async function test(name, fn) {
  try {
    await fn();
    tests.push({ test: name, status: "PASS" });
  } catch (error) {
    tests.push({ test: name, status: "FAIL", reason: error.message });
  }
}

async function runResetThenWorker(command) {
  const conversation = await runHardReset(command);

  assert(shouldHandleMainMenuSelection({ text: "1", conversation }), "menu 1 not handled after reset");
  assert(resolveMainMenuSelection("1")?.intent === "worker_registration", "menu 1 did not select worker");

  await resetConversationForRestart(conversation, {
    menuActive: false,
    lastQuestion: null,
  });

  const result = await handleWorkerRegistration({
    contact,
    conversation,
    normalizedMessage: message("1"),
  });

  return { conversation, result };
}

async function runHardReset(command, overrides = {}) {
  const conversation = new FakeConversation(overrides);
  const reply = buildJobMateMainMenuReply();

  assert(isStartRestartMenuCommand(command), `${command} was not recognized as reset`);

  await resetConversationForRestart(conversation, {
    menuActive: true,
    lastQuestion: reply,
  });

  assert(conversation.currentIntent === "unknown", "currentIntent not reset");
  assert(conversation.currentState === "idle", "currentState not reset");
  assert(conversation.metadata.lastQuestion === reply, "main menu was not stored as lastQuestion");
  assert(/1\. Job khojna/.test(reply), "main menu missing worker option");
  assert(/2\. Staff khojna/.test(reply), "main menu missing employer option");
  assert(!/3\./.test(reply), "main menu still shows disabled option 3");
  assert(!/Sahakari partnership/i.test(reply), "main menu still mentions Sahakari partnership");

  return conversation;
}

function buildStaleMetadata() {
  return {
    qualificationStep: 4,
    lastQuestion: "Tapai sanga document chha?",
    lastAskedField: "documents",
    activeFlow: "worker_registration",
    collectedData: {
      jobType: "driver",
      district: "Nawalparasi West",
      availability: "part-time",
      documents: "yes",
      pendingCompletion: true,
      profileSavedFromLastSearch: true,
      lastJobSearch: {
        query: {
          location: "Nawalparasi West",
          keyword: "driver",
        },
      },
    },
    workerRegistration: {
      jobType: "driver",
    },
    employerLead: {
      businessName: "Old Business",
    },
    lastJobSearch: {
      query: {
        location: "Nawalparasi West",
        keyword: "driver",
      },
    },
    selectedJobs: [{ title: "Old Driver" }],
    previousParserResult: {
      intent: "worker_registration",
    },
    pendingCompletion: true,
  };
}

function assertCleared(conversation) {
  const metadata = conversation.metadata || {};

  assert(metadata.qualificationStep === 0, "qualificationStep not cleared");
  assert(metadata.lastAskedField === null, "lastAskedField not cleared");
  assert(Object.keys(metadata.collectedData || {}).length === 0, "collectedData not cleared");
  assert(!metadata.workerRegistration || !Object.keys(metadata.workerRegistration).length, "workerRegistration data not cleared");
  assert(!metadata.employerLead || !Object.keys(metadata.employerLead).length, "employerLead data not cleared");
  assert(metadata.lastJobSearch === null, "lastJobSearch not cleared");
  assert(Array.isArray(metadata.selectedJobs) && metadata.selectedJobs.length === 0, "selectedJobs not cleared");
  assert(metadata.previousParserResult === null, "previous parser result not cleared");
  assert(metadata.pendingCompletion === false, "pending completion not cleared");
}

function assertFreshWorkerAsk(result = {}) {
  const reply = result.messageToSend || result.reply || "";

  assert(result.intent === "worker_registration", "worker flow did not start");
  assert(result.isComplete !== true, "worker flow completed from old data");
  assert(!/Dhanyabaad.*save bhayo|Saved profile/i.test(reply), "worker reply saved old profile");
  assert(!/Kaam:\s*driver|District:\s*Nawalparasi West|Availability:\s*part-time|Documents:\s*yes/i.test(reply), "worker reply leaked old profile values");
  assert(/Tapai kasto kaam|Driver \/ Transport|kaam khojdai/i.test(reply), "worker did not ask fresh first question");
}

function message(text) {
  return {
    message: {
      text,
      normalizedText: String(text || "").toLowerCase(),
      type: "text",
    },
  };
}

function assert(condition, messageText) {
  if (!condition) throw new Error(messageText);
}
