process.env.USE_NEW_CONVERSATION_ENGINE = "true";
process.env.ENABLE_AARATI_LLM = "false";
process.env.ENABLE_AARATI_AI_BRAIN = "false";
process.env.GEMINI_API_KEY = "";
process.env.GOOGLE_API_KEY = "";

const { runConversationEngine } = await import("../src/services/automation/conversationEngine.js");
const { jobmateConfig } = await import("../src/configs/jobmate.config.js");
const {
  handleWorkerLeadFlow,
} = await import("../src/services/jobmateLeadAgent/workerLeadFlow.service.js");
const {
  findReplyPolicyIssues,
} = await import("../src/services/jobmateLeadAgent/replyFormatter.service.js");

class FakeConversation {
  static updates = [];

  constructor(overrides = {}) {
    this._id = overrides._id || `worker-one-by-one-${Date.now()}-${Math.random()}`;
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
  _id: "worker-one-by-one-contact",
  phone: "9840000000",
  displayName: "Ram",
};

const tests = [];
const replies = [];

await test("cook availability numeric 1 asks documents without changing jobType", async () => {
  const { result } = await runTurns(["1", "cook", "jimirbar", "1"]);
  const profile = result.newMetadata.collectedData || {};
  const reply = result.messageToSend || "";

  assert(profile.jobType === "Hotel / Restaurant", `jobType changed: ${profile.jobType}`);
  assert(profile.jobType !== "Driver / Transport", "availability 1 became Driver / Transport");
  assert(profile.area === "Jimirbar" || profile.location === "Jimirbar", "Jimirbar not saved");
  assert(profile.district === "Nawalparasi West", `district wrong: ${profile.district}`);
  assert(profile.availability === "full-time", `availability wrong: ${profile.availability}`);
  assert(result.newMetadata.currentState === "ask_documents", `expected ask_documents, got ${result.newMetadata.currentState}`);
  assert(/document|Chha|Chhaina|Kehi/i.test(reply), "reply did not ask document status");
  assert(!/kaam:\s*Driver \/ Transport/i.test(reply), `reply leaked Driver detail note: ${reply}`);
});

await test("availability numeric 1 keeps Sales / Marketing and asks documents", async () => {
  const { result } = await runTurns(["1", "marketing", "jimirbar", "1"]);
  const profile = result.newMetadata.collectedData || {};
  const reply = result.messageToSend || "";

  assert(profile.jobType === "Sales / Marketing", `jobType changed: ${profile.jobType}`);
  assert(profile.jobType !== "Driver / Transport", "availability 1 became Driver / Transport");
  assert(profile.area === "Jimirbar" || profile.location === "Jimirbar", "Jimirbar not saved");
  assert(profile.district === "Nawalparasi West", `district wrong: ${profile.district}`);
  assert(profile.availability === "full-time", `availability wrong: ${profile.availability}`);
  assert(result.newMetadata.currentState === "ask_documents", `expected ask_documents, got ${result.newMetadata.currentState}`);
  assert(/document|Chha|Chhaina|Kehi/i.test(reply), "reply did not ask document status");
  assert(!/Driver \/ Transport/i.test(reply), `reply leaked Driver: ${reply}`);
});

await test("text availability keeps Sales / Marketing", async () => {
  const { result } = await runTurns(["1", "marketing", "jimirbar", "maile full time"]);
  const profile = result.newMetadata.collectedData || {};

  assert(profile.jobType === "Sales / Marketing", `jobType changed: ${profile.jobType}`);
  assert(profile.availability === "full-time", `availability wrong: ${profile.availability}`);
  assert(result.newMetadata.currentState === "ask_documents", `expected ask_documents, got ${result.newMetadata.currentState}`);
});

await test("documents no asks name next without huge paragraph", async () => {
  const { result } = await runTurns(["1", "teacher", "maile bhardaghat ma", "maile full time", "xaina"]);
  const profile = result.newMetadata.collectedData || {};
  const reply = result.messageToSend || "";

  assert(profile.jobType === "Teacher", `jobType wrong: ${profile.jobType}`);
  assert(profile.area === "Bardaghat" || profile.location === "Bardaghat", "Bardaghat not saved");
  assert(profile.district === "Nawalparasi West", `district wrong: ${profile.district}`);
  assert(profile.availability === "full-time", `availability wrong: ${profile.availability}`);
  assert(profile.documents === "no", `documents wrong: ${profile.documents}`);
  assert(result.isComplete === false, "profile saved before name/phone/confirmation");
  assert(result.newMetadata.currentState === "ask_fullName", `expected ask_fullName, got ${result.newMetadata.currentState}`);
  assert(/naam pathaunus/i.test(reply), `name-only prompt missing: ${reply}`);
  assert(!/kun area ma kaam garna milcha.*phone number.*expected salary/is.test(reply), "huge generic paragraph repeated");
});

await test("after documents no, name asks phone only", async () => {
  const harness = createHarness();
  const conversation = buildIdleConversation();

  for (const text of ["1", "teacher", "maile bhardaghat ma", "maile full time", "xaina"]) {
    await harness.turn(conversation, text);
  }

  const result = await harness.turn(conversation, "Bipin");
  const profile = result.newMetadata.collectedData || {};
  const reply = result.messageToSend || "";

  assert(profile.fullName === "Bipin", `name not saved: ${profile.fullName}`);
  assert(result.newMetadata.currentState === "ask_providedPhone", `expected ask_providedPhone, got ${result.newMetadata.currentState}`);
  assert(/phone\/WhatsApp number/i.test(reply), `phone-only prompt missing: ${reply}`);
  assert(!/\bage\b|experience|Expected salary/i.test(reply), `reply asked more than phone: ${reply}`);
});

await test("mixed details fill missing fields without asking captured fields again", async () => {
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
  assert(profile.area === "Jimirbar" || profile.location === "Jimirbar", "Jimirbar not saved");
  assert(profile.district === "Nawalparasi West", `district wrong: ${profile.district}`);
  assert(profile.availability === "full-time", `availability wrong: ${profile.availability}`);
  assert(profile.fullName === "Bipin", `name not parsed: ${profile.fullName}`);
  assert(profile.providedPhone === "9821901533" || profile.phone === "9821901533", `phone not parsed: ${profile.providedPhone || profile.phone}`);
  assert(profile.age === 19, `age not parsed: ${profile.age}`);
  assert(profile.experience?.level === "none", `experience not parsed: ${JSON.stringify(profile.experience)}`);
  assert(!/\b(name|naam|phone|age|experience)\b/i.test(reply), `reply asks captured fields again: ${reply}`);
});

await test("availability numeric 2 is part-time and not Security Guard", async () => {
  const { result } = await runTurns(["1", "marketing", "jimirbar", "2"]);
  const profile = result.newMetadata.collectedData || {};

  assert(profile.jobType === "Sales / Marketing", `jobType changed: ${profile.jobType}`);
  assert(profile.jobType !== "Security Guard", "availability 2 became Security Guard");
  assert(profile.availability === "part-time", `availability wrong: ${profile.availability}`);
});

await test("availability numeric 4 is any and keeps jobType", async () => {
  const { result } = await runTurns(["1", "marketing", "jimirbar", "4"]);
  const profile = result.newMetadata.collectedData || {};

  assert(profile.jobType === "Sales / Marketing", `jobType changed: ${profile.jobType}`);
  assert(profile.availability === "any", `availability wrong: ${profile.availability}`);
});

await test("lead-agent active availability 1 bypasses generic detail note", async () => {
  const result = leadAvailabilityTurn("1", {
    jobType: "Hotel / Restaurant",
  });
  const data = result.state?.data || {};
  const reply = result.reply || "";

  assert(data.jobType === "Hotel / Restaurant", `jobType changed: ${data.jobType}`);
  assert(data.availability?.value === "full-time", `availability wrong: ${JSON.stringify(data.availability)}`);
  assert(result.state?.step === "documentStatus", `expected documentStatus, got ${result.state?.step}`);
  assert(/document|Chha|Chhaina|Kehi/i.test(reply), "reply did not ask document status");
  assert(!/Yo detail note gare/i.test(reply), `generic detail note returned: ${reply}`);
  assert(!/Driver \/ Transport/i.test(reply), `reply leaked Driver: ${reply}`);
});

await test("lead-agent active availability 2 and 4 keep jobType", async () => {
  const partTime = leadAvailabilityTurn("2");
  const any = leadAvailabilityTurn("4");

  assert(partTime.state?.data?.jobType === "Sales / Marketing", `jobType changed on 2: ${partTime.state?.data?.jobType}`);
  assert(partTime.state?.data?.availability?.value === "part-time", `availability 2 wrong: ${JSON.stringify(partTime.state?.data?.availability)}`);
  assert(any.state?.data?.jobType === "Sales / Marketing", `jobType changed on 4: ${any.state?.data?.jobType}`);
  assert(any.state?.data?.availability?.value === "any", `availability 4 wrong: ${JSON.stringify(any.state?.data?.availability)}`);
});

await test("documents numeric 1 saves yes without overwriting locked fields", async () => {
  const result = await documentTurn("1");
  const profile = result.newMetadata.collectedData || {};

  assert(profile.documents === "yes", `documents wrong: ${profile.documents}`);
  assert(profile.jobType === "Sales / Marketing", `jobType overwritten: ${profile.jobType}`);
  assert(profile.area === "Jimirbar" || profile.location === "Jimirbar", "location overwritten");
  assert(profile.district === "Nawalparasi West", `district overwritten: ${profile.district}`);
  assert(profile.availability === "full-time", `availability overwritten: ${profile.availability}`);
  assert(result.isComplete === false, "profile saved before confirmation");
  assert(result.newMetadata.currentState === "ask_fullName", `expected ask_fullName, got ${result.newMetadata.currentState}`);
});

await test("final confirmation required before save", async () => {
  const savedProfiles = [];
  const harness = createHarness({ savedProfiles });
  const conversation = buildIdleConversation();

  for (const text of [
    "1",
    "teacher",
    "maile bhardaghat ma",
    "maile full time",
    "xaina",
    "Bipin",
    "9821901533",
    "19",
    "no experience",
    "15000",
  ]) {
    await harness.turn(conversation, text);
  }

  assert(savedProfiles.length === 0, "profile saved before confirmation");
  assert(conversation.currentState === "ask_confirmation", `expected ask_confirmation, got ${conversation.currentState}`);

  const result = await harness.turn(conversation, "1");
  const profile = result.newMetadata.collectedData || {};

  assert(result.isComplete === true, "profile did not complete after confirmation");
  assert(savedProfiles.length === 1, "profile was not saved after confirmation");
  assert(profile.confirmation === "confirmed", `confirmation missing: ${profile.confirmation}`);
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

function createHarness({ savedProfiles = [] } = {}) {
  const config = {
    ...jobmateConfig,
    onComplete: async ({ profile }) => {
      savedProfiles.push({ ...profile });
    },
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

function leadAvailabilityTurn(text, dataOverrides = {}) {
  const result = handleWorkerLeadFlow({
    contact,
    state: {
      flow: "worker",
      step: "availability",
      status: "collecting",
      data: {
        jobType: "Sales / Marketing",
        location: {
          area: "Jimirbar",
          district: "Nawalparasi West",
          province: "Lumbini",
          country: "Nepal",
        },
        ...dataOverrides,
      },
    },
    text,
    startedByIntent: false,
  });

  replies.push(result.reply || "");
  return result;
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
