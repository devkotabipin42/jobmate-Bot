process.env.USE_NEW_CONVERSATION_ENGINE = "true";
process.env.ENABLE_AARATI_LLM = "false";
process.env.ENABLE_AARATI_AI_BRAIN = "false";
process.env.GEMINI_API_KEY = "";
process.env.GOOGLE_API_KEY = "";

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
const {
  handleJobMateLeadAgentMessage,
} = await import("../src/services/jobmateLeadAgent/jobmateLeadAgent.service.js");

class FakeConversation {
  constructor(overrides = {}) {
    this._id = overrides._id || `worker-availability-live-${Date.now()}-${Math.random()}`;
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

  static async updateOne() {
    return { acknowledged: true };
  }
}

const contact = {
  _id: "worker-availability-live-contact",
  phone: "9840000000",
  displayName: "Ram",
};

const tests = [];

await test("lead-agent defers automation worker ask_availability numeric 1", async () => {
  const conversation = buildWorkerConversationAtAvailability({
    jobType: "Sales / Marketing",
    area: "Bardaghat",
    location: "Bardaghat",
    district: "Nawalparasi West",
  });

  const result = await handleJobMateLeadAgentMessage({
    contact,
    conversation,
    normalizedMessage: normalized("1"),
  });

  assert(result.handled === false, `lead-agent stole active worker turn: ${result.intent}`);
  assert(result.reason === "active_automation_worker_flow_defer", `wrong defer reason: ${result.reason}`);
});

await test("start -> 1 -> marketing -> bardaghat -> 1 asks documents, not job type menu", async () => {
  const { conversation, result } = await runLiveTranscript([
    "start",
    "1",
    "marketing",
    "bardaghat",
    "1",
  ]);

  assertAvailabilityResult({
    conversation,
    result,
    expectedJobType: "Sales / Marketing",
    expectedArea: "Bardaghat",
    expectedAvailability: "full-time",
  });
});

await test("start -> 1 -> cook -> jimirbar -> 1 keeps Hotel / Restaurant and asks documents", async () => {
  const { conversation, result } = await runLiveTranscript([
    "start",
    "1",
    "cook",
    "jimirbar",
    "1",
  ]);

  assertAvailabilityResult({
    conversation,
    result,
    expectedJobType: "Hotel / Restaurant",
    expectedArea: "Jimirbar",
    expectedAvailability: "full-time",
  });
});

await test("start -> 1 -> teacher -> bhardaghat -> 2 saves part-time and asks documents", async () => {
  const { conversation, result } = await runLiveTranscript([
    "start",
    "1",
    "teacher",
    "bhardaghat",
    "2",
  ]);

  assertAvailabilityResult({
    conversation,
    result,
    expectedJobType: "Teacher",
    expectedArea: "Bardaghat",
    expectedAvailability: "part-time",
  });
});

console.table(tests);

const failed = tests.filter((row) => row.status !== "PASS");
if (failed.length) {
  console.log(`\nResult: ${failed.length} FAILED`);
  process.exitCode = 1;
} else {
  console.log("\nResult: ALL PASSED");
}

async function runLiveTranscript(messages = []) {
  const conversation = new FakeConversation();
  let result = null;

  for (const text of messages) {
    result = await liveTurn(conversation, text);
  }

  return { conversation, result };
}

async function liveTurn(conversation, text) {
  const value = String(text || "").toLowerCase().trim();

  if (["start", "restart", "menu", "hello", "hi"].includes(value)) {
    const reply = buildJobMateMainMenuReply();
    await resetConversationForRestart(conversation, {
      menuActive: true,
      lastQuestion: reply,
    });

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
      return workerTurn(conversation, text, "menu_worker");
    }
  }

  if (isActiveWorkerRegistration(conversation)) {
    const leadAgentProbe = await handleJobMateLeadAgentMessage({
      contact,
      conversation,
      normalizedMessage: normalized(text),
    });

    if (leadAgentProbe.handled) {
      return {
        source: "lead_agent_stole_active_worker_turn",
        reply: leadAgentProbe.reply || "",
        result: leadAgentProbe,
      };
    }

    return workerTurn(conversation, text, "active_worker");
  }

  const leadAgent = await handleJobMateLeadAgentMessage({
    contact,
    conversation,
    normalizedMessage: normalized(text),
  });

  return {
    source: "lead_agent",
    reply: leadAgent.reply || "",
    result: leadAgent,
  };
}

async function workerTurn(conversation, text, source) {
  const result = await handleWorkerRegistration({
    contact,
    conversation,
    normalizedMessage: normalized(text),
  });

  applyWorkerResult(conversation, result);

  return {
    source,
    reply: result.messageToSend || result.reply || "",
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

function assertAvailabilityResult({
  conversation,
  result,
  expectedJobType,
  expectedArea,
  expectedAvailability,
}) {
  const profile = conversation.metadata?.collectedData || {};
  const reply = result.reply || "";

  assert(result.source === "active_worker", `availability turn was not handled by worker flow: ${result.source}`);
  assert(profile.jobType === expectedJobType, `jobType wrong: ${profile.jobType}`);
  assert(profile.area === expectedArea || profile.location === expectedArea, `area wrong: ${profile.area || profile.location}`);
  assert(profile.district === "Nawalparasi West", `district wrong: ${profile.district}`);
  assert(profile.availability === expectedAvailability, `availability wrong: ${profile.availability}`);
  assert(conversation.currentState === "ask_documents", `state should be ask_documents, got ${conversation.currentState}`);
  assert(conversation.metadata?.lastAskedField === "documents", `lastAskedField should be documents, got ${conversation.metadata?.lastAskedField}`);
  assert(/Tapai sanga document chha/i.test(reply), `document question missing: ${reply}`);
  assert(!/Tapai kasto kaam khojnu bhayeko ho/i.test(reply), `job type prompt leaked: ${reply}`);
  assert(!/Driver \/ Transport|Security Guard|Sales \/ Marketing\s*\\n8\.|Yo detail note gare/i.test(reply), `wrong menu/detail reply leaked: ${reply}`);
}

function buildWorkerConversationAtAvailability(collectedData = {}) {
  return new FakeConversation({
    currentIntent: "worker_registration",
    currentState: "ask_availability",
    metadata: {
      activeFlow: "worker_registration",
      lastAskedField: "availability",
      collectedData,
      source: "whatsapp",
    },
  });
}

function isActiveWorkerRegistration(conversation = {}) {
  const metadata = conversation.metadata || {};
  return (
    metadata.activeFlow === "worker_registration" ||
    conversation.currentIntent === "worker_registration" ||
    ["ask_jobType", "ask_district", "ask_availability", "ask_documents"].includes(conversation.currentState) ||
    ["jobType", "district", "availability", "documents"].includes(metadata.lastAskedField)
  );
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
