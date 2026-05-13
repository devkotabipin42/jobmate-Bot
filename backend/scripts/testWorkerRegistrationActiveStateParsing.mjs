process.env.USE_NEW_CONVERSATION_ENGINE = "true";
process.env.ENABLE_AARATI_LLM = "false";
process.env.ENABLE_AARATI_AI_BRAIN = "false";

const { runConversationEngine } = await import("../src/services/automation/conversationEngine.js");
const { jobmateConfig } = await import("../src/configs/jobmate.config.js");

class FakeConversation {
  static updates = [];

  constructor(overrides = {}) {
    this._id = overrides._id || `fake-worker-active-${Date.now()}-${Math.random()}`;
    this.currentIntent = overrides.currentIntent ?? "worker_registration";
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
  _id: "worker-active-state-contact",
  phone: "9840000000",
  displayName: "Ram",
};

const tests = [];

await test("start -> 1 -> marketing stays in worker registration", async () => {
  const harness = createHarness();
  const conversation = buildIdleConversation();

  await harness.turn(conversation, "1");
  harness.resetSearchCalls();

  const result = await harness.turn(conversation, "marketing");
  const profile = result.newMetadata.collectedData || {};

  assert(harness.searchCalls === 0, "job search step ran during ask_jobType");
  assert(/marketing/i.test(profile.jobType || ""), "marketing not saved as jobType");
  assert(normalize(profile.location) !== "marketing", "marketing was saved as location");
  assert(!("jobSearchDone" in profile), "jobSearchDone leaked into worker profile");
  assert(!("jobSearchError" in profile), "jobSearchError leaked into worker profile");
});

await test("start -> 1 -> 1 maps to Driver / Transport", async () => {
  const harness = createHarness();
  const conversation = buildIdleConversation();

  await harness.turn(conversation, "1");
  const result = await harness.turn(conversation, "1");
  const profile = result.newMetadata.collectedData || {};

  assert(profile.jobType === "Driver / Transport", `expected Driver / Transport, got ${profile.jobType}`);
  assert(profile.jobType !== "IT/Tech", "numeric job type 1 still maps to IT/Tech");
});

await test("ask_jobType free text marketing becomes Marketing/Sales or Marketing", async () => {
  const harness = createHarness();
  const conversation = buildWorkerConversation({
    currentState: "ask_jobType",
    lastAskedField: "jobType",
  });

  const result = await harness.turn(conversation, "marketing");
  const profile = result.newMetadata.collectedData || {};

  assert(["Sales / Marketing", "Marketing/Sales", "Marketing"].includes(profile.jobType), `unexpected jobType ${profile.jobType}`);
  assert(result.newMetadata.currentState === "ask_district", "did not advance to district after job type");
});

await test("job search transient keys are removed after job type input", async () => {
  const harness = createHarness();
  const conversation = buildWorkerConversation({
    currentState: "ask_jobType",
    lastAskedField: "jobType",
    collectedData: {
      jobSearchDone: true,
      noJobsFound: false,
      jobSearchError: "API_FAILED",
      jobSearchStrategy: "api_failed_or_timeout",
      jobSearchResults: [{ title: "Old Job" }],
    },
  });

  const result = await harness.turn(conversation, "marketing");
  const profile = result.newMetadata.collectedData || {};

  for (const key of [
    "jobSearchDone",
    "noJobsFound",
    "jobSearchError",
    "jobSearchStrategy",
    "jobSearchResults",
  ]) {
    assert(!(key in profile), `${key} leaked into worker profile`);
  }
});

await test("ask_district -> bhardaghat resolves Bardaghat / Nawalparasi West", async () => {
  const harness = createHarness();
  const conversation = buildWorkerConversation({
    currentState: "ask_district",
    lastAskedField: "district",
    collectedData: {
      jobType: "Driver / Transport",
    },
  });

  const result = await harness.turn(conversation, "bhardaghat");
  const profile = result.newMetadata.collectedData || {};

  assert(profile.district === "Nawalparasi West", `expected district Nawalparasi West, got ${profile.district}`);
  assert(profile.area === "Bardaghat" || profile.location === "Bardaghat", "Bardaghat area/location not saved");
  assert(result.newMetadata.currentState === "ask_availability", "did not advance to availability");
});

await test("asked_register -> 1 continues registration without resetting jobType", async () => {
  const harness = createHarness();
  const conversation = buildWorkerConversation({
    currentState: "asked_register",
    lastAskedField: null,
    collectedData: {
      jobType: "Driver / Transport",
      district: "Nawalparasi West",
      location: "Bardaghat",
      jobSearchDone: true,
      jobSearchError: "API_FAILED",
      jobSearchStrategy: "api_failed_or_timeout",
    },
  });

  const result = await harness.turn(conversation, "1");
  const profile = result.newMetadata.collectedData || {};

  assert(harness.searchCalls === 0, "job search step ran from asked_register");
  assert(profile.jobType === "Driver / Transport", "jobType changed during register confirmation");
  assert(result.newMetadata.currentState === "ask_availability", "register confirmation did not continue registration");
  assert(!("jobSearchError" in profile), "jobSearchError was not removed");
});

await test("full flow numeric saves Driver / Transport, Bardaghat, full-time, yes", async () => {
  const savedProfiles = [];
  const harness = createHarness({ savedProfiles });
  const conversation = buildIdleConversation();

  await harness.turn(conversation, "1");
  await harness.turn(conversation, "1");
  await harness.turn(conversation, "bhardaghat");
  await harness.turn(conversation, "1");
  const result = await harness.turn(conversation, "1");
  const profile = result.newMetadata.collectedData || {};

  assert(result.isComplete === true, "numeric full flow did not complete");
  assert(savedProfiles.length === 1, "completion handler did not receive draft profile");
  assert(profile.jobType === "Driver / Transport", `expected Driver / Transport, got ${profile.jobType}`);
  assert(profile.area === "Bardaghat" || profile.location === "Bardaghat", "Bardaghat not saved");
  assert(profile.district === "Nawalparasi West", "district not saved");
  assert(profile.availability === "full-time", "availability not full-time");
  assert(profile.documents === "yes", "documents not yes");
});

await test("full flow marketing saves Marketing/Sales or Marketing, not IT/Tech", async () => {
  const savedProfiles = [];
  const harness = createHarness({ savedProfiles });
  const conversation = buildIdleConversation();

  await harness.turn(conversation, "1");
  await harness.turn(conversation, "marketing");
  await harness.turn(conversation, "bhardaghat");
  await harness.turn(conversation, "1");
  const result = await harness.turn(conversation, "1");
  const profile = result.newMetadata.collectedData || {};

  assert(result.isComplete === true, "marketing full flow did not complete");
  assert(savedProfiles.length === 1, "completion handler did not receive marketing profile");
  assert(["Sales / Marketing", "Marketing/Sales", "Marketing"].includes(profile.jobType), `unexpected jobType ${profile.jobType}`);
  assert(profile.jobType !== "IT/Tech", "marketing flow saved IT/Tech");
  assert(profile.area === "Bardaghat" || profile.location === "Bardaghat", "Bardaghat not saved");
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

function createHarness({ savedProfiles = [] } = {}) {
  let searchCalls = 0;
  const config = {
    ...jobmateConfig,
    searchStep: async (profile, text) => {
      searchCalls += 1;
      return jobmateConfig.searchStep(profile, text);
    },
    onComplete: async ({ profile }) => {
      savedProfiles.push({ ...profile });
    },
  };

  return {
    get searchCalls() {
      return searchCalls;
    },
    resetSearchCalls() {
      searchCalls = 0;
    },
    async turn(conversation, text) {
      const result = await runConversationEngine({
        contact,
        conversation,
        normalizedMessage: message(text),
        config,
      });

      applyResult(conversation, result);
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
  currentState = "ask_jobType",
  lastAskedField = "jobType",
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

function normalize(value = "") {
  return String(value || "").toLowerCase().trim();
}

function assert(condition, messageText) {
  if (!condition) throw new Error(messageText);
}
