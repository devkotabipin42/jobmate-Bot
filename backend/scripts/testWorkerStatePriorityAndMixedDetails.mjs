process.env.USE_NEW_CONVERSATION_ENGINE = "true";
process.env.ENABLE_AARATI_LLM = "false";
process.env.ENABLE_AARATI_AI_BRAIN = "false";
process.env.GEMINI_API_KEY = "";
process.env.GOOGLE_API_KEY = "";

const { runConversationEngine } = await import("../src/services/automation/conversationEngine.js");
const { jobmateConfig } = await import("../src/configs/jobmate.config.js");
const {
  findReplyPolicyIssues,
} = await import("../src/services/jobmateLeadAgent/replyFormatter.service.js");

class FakeConversation {
  static updates = [];

  constructor(overrides = {}) {
    this._id = overrides._id || `worker-state-priority-${Date.now()}-${Math.random()}`;
    this.currentIntent = overrides.currentIntent ?? "unknown";
    this.currentState = overrides.currentState ?? "idle";
    this.metadata = overrides.metadata || {
      collectedData: {},
      lastAskedField: null,
      activeFlow: null,
      source: "whatsapp",
    };
  }

  static async updateOne(filter, patch) {
    FakeConversation.updates.push({ filter, patch });
    return { acknowledged: true };
  }
}

const contact = {
  _id: "worker-state-priority-contact",
  phone: "9840000000",
  displayName: "Ram",
};

const tests = [];
const replies = [];

await test("state priority numeric availability keeps Sales / Marketing", async () => {
  const { result } = await runTurns(["1", "marketing", "jimirbar", "1"]);
  const profile = result.newMetadata.collectedData || {};

  assert(profile.jobType === "Sales / Marketing", `jobType changed: ${profile.jobType}`);
  assert(profile.location === "Jimirbar" || profile.area === "Jimirbar", "Jimirbar area missing");
  assert(profile.district === "Nawalparasi West", `district wrong: ${profile.district}`);
  assert(profile.availability === "full-time", `availability wrong: ${profile.availability}`);
  assert(profile.jobType !== "Driver / Transport", "availability 1 became Driver / Transport");
  assert(result.newMetadata.currentState === "ask_documents", `did not advance to documents: ${result.newMetadata.currentState}`);
});

await test("text availability keeps Sales / Marketing", async () => {
  const { result } = await runTurns(["1", "marketing", "jimirbar", "maile full time"]);
  const profile = result.newMetadata.collectedData || {};

  assert(profile.jobType === "Sales / Marketing", `jobType changed: ${profile.jobType}`);
  assert(profile.availability === "full-time", `availability wrong: ${profile.availability}`);
  assert(result.newMetadata.currentState === "ask_documents", `did not advance to documents: ${result.newMetadata.currentState}`);
});

await test("mixed details fill missing worker fields without overwriting locked fields", async () => {
  const { result } = await runTurns([
    "1",
    "marketing",
    "jimirbar",
    "1",
    "jimirbar,name Bipin,phone num:9821901533,age:19,experience:no",
  ]);
  const profile = result.newMetadata.collectedData || {};
  const reply = result.messageToSend || "";

  assert(profile.jobType === "Sales / Marketing", `jobType changed: ${profile.jobType}`);
  assert(profile.location === "Jimirbar" || profile.area === "Jimirbar", "Jimirbar area missing");
  assert(profile.district === "Nawalparasi West", `district wrong: ${profile.district}`);
  assert(profile.availability === "full-time", `availability wrong: ${profile.availability}`);
  assert(profile.fullName === "Bipin", `name not parsed: ${profile.fullName}`);
  assert(profile.providedPhone === "9821901533" || profile.phone === "9821901533", `phone not parsed: ${profile.providedPhone || profile.phone}`);
  assert(profile.age === 19, `age not parsed: ${profile.age}`);
  assert(profile.experience?.level === "none", `experience not parsed: ${JSON.stringify(profile.experience)}`);
  assert(!/\b(name|naam|phone|age|experience)\b/i.test(reply), `prompt still asks captured detail: ${reply}`);
});

await test("ask_availability numeric 2 becomes part-time without Security Guard", async () => {
  const { result } = await runTurns(["1", "marketing", "jimirbar", "2"]);
  const profile = result.newMetadata.collectedData || {};

  assert(profile.jobType === "Sales / Marketing", `jobType changed: ${profile.jobType}`);
  assert(profile.availability === "part-time", `availability wrong: ${profile.availability}`);
  assert(profile.jobType !== "Security Guard", "availability 2 became Security Guard");
});

await test("ask_availability numeric 4 becomes any without changing jobType", async () => {
  const { result } = await runTurns(["1", "marketing", "jimirbar", "4"]);
  const profile = result.newMetadata.collectedData || {};

  assert(profile.jobType === "Sales / Marketing", `jobType changed: ${profile.jobType}`);
  assert(profile.availability === "any", `availability wrong: ${profile.availability}`);
});

await test("ask_documents xaina saves no without overwriting locked fields", async () => {
  const result = await documentTurn("xaina");
  const profile = result.newMetadata.collectedData || {};

  assert(result.isComplete === true, "xaina did not complete");
  assert(profile.documents === "no", `documents wrong: ${profile.documents}`);
  assertLockedWorkerFields(profile);
});

await test("ask_documents pachi dinchu saves no without overwriting locked fields", async () => {
  const result = await documentTurn("pachi dinchu");
  const profile = result.newMetadata.collectedData || {};

  assert(result.isComplete === true, "pachi dinchu did not complete");
  assert(profile.documents === "no", `documents wrong: ${profile.documents}`);
  assertLockedWorkerFields(profile);
});

await test("ask_jobType numeric still maps 1 to Driver / Transport", async () => {
  const { result } = await runTurns(["1", "1"]);
  const profile = result.newMetadata.collectedData || {};

  assert(profile.jobType === "Driver / Transport", `jobType wrong: ${profile.jobType}`);
});

await test("ask_district numeric still maps 1 to Nawalparasi West", async () => {
  const { result } = await runTurns(["1", "teacher", "1"]);
  const profile = result.newMetadata.collectedData || {};

  assert(profile.jobType === "Teacher", `jobType wrong: ${profile.jobType}`);
  assert(profile.district === "Nawalparasi West", `district wrong: ${profile.district}`);
});

await test("full happy path teacher Bardaghat full-time documents no", async () => {
  const { result } = await runTurns(["1", "teacher", "maile bhardaghat ma", "maile full time", "xaina"]);
  const profile = result.newMetadata.collectedData || {};

  assert(result.isComplete === true, "happy path did not complete");
  assert(profile.jobType === "Teacher", `jobType wrong: ${profile.jobType}`);
  assert(profile.location === "Bardaghat" || profile.area === "Bardaghat", "Bardaghat missing");
  assert(profile.district === "Nawalparasi West", `district wrong: ${profile.district}`);
  assert(profile.availability === "full-time", `availability wrong: ${profile.availability}`);
  assert(profile.documents === "no", `documents wrong: ${profile.documents}`);
});

await test("replies contain no AI/model/provider wording", async () => {
  for (const reply of replies) {
    const issues = findReplyPolicyIssues(reply);
    assert(!issues.length, `reply policy issue: ${issues.join(", ")} in ${reply}`);
  }
});

console.table(tests);

const failed = tests.filter((row) => row.status !== "PASS");
if (failed.length) {
  console.log(`\nResult: ${failed.length} FAILED`);
  process.exitCode = 1;
} else {
  console.log("\nResult: ALL PASSED");
}

async function runTurns(messages = []) {
  const harness = createHarness();
  const conversation = buildIdleConversation();
  let result = null;

  for (const text of messages) {
    result = await harness.turn(conversation, text);
  }

  return { result, conversation };
}

function createHarness() {
  const config = {
    ...jobmateConfig,
    onComplete: async () => {},
  };

  return {
    async turn(conversation, text) {
      const result = await runConversationEngine({
        contact,
        conversation,
        normalizedMessage: message(text),
        config,
      });

      applyResult(conversation, result);
      replies.push(result.messageToSend || "");
      return result;
    },
  };
}

function buildIdleConversation() {
  return new FakeConversation({
    currentIntent: "unknown",
    currentState: "idle",
    metadata: {
      collectedData: {},
      lastAskedField: null,
      activeFlow: null,
      source: "whatsapp",
    },
  });
}

function buildWorkerConversation({
  currentState = "ask_documents",
  lastAskedField = "documents",
  collectedData = {},
} = {}) {
  return new FakeConversation({
    currentIntent: "worker_registration",
    currentState,
    metadata: {
      collectedData,
      lastAskedField,
      activeFlow: "worker_registration",
      source: "whatsapp",
    },
  });
}

async function documentTurn(text) {
  const harness = createHarness();
  const conversation = buildWorkerConversation({
    collectedData: {
      jobType: "Sales / Marketing",
      location: "Jimirbar",
      area: "Jimirbar",
      district: "Nawalparasi West",
      availability: "full-time",
    },
  });

  return harness.turn(conversation, text);
}

function assertLockedWorkerFields(profile = {}) {
  assert(profile.jobType === "Sales / Marketing", `jobType overwritten: ${profile.jobType}`);
  assert(profile.location === "Jimirbar" || profile.area === "Jimirbar", "location/area overwritten");
  assert(profile.district === "Nawalparasi West", `district overwritten: ${profile.district}`);
  assert(profile.availability === "full-time", `availability overwritten: ${profile.availability}`);
}

function applyResult(conversation, result) {
  const metadata = result.newMetadata || {};

  conversation.currentIntent = "worker_registration";
  conversation.currentState = metadata.currentState || conversation.currentState;
  conversation.metadata = {
    ...(conversation.metadata || {}),
    collectedData: metadata.collectedData || {},
    lastAskedField: metadata.lastAskedField ?? null,
    activeFlow: metadata.currentState === "completed" ? null : "worker_registration",
  };
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
