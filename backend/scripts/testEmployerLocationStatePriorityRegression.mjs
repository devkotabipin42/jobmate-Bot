process.env.BOT_MODE = "jobmate_hiring";
process.env.ENABLE_AARATI_LLM = "false";
process.env.ENABLE_AARATI_AI_BRAIN = "false";
process.env.GEMINI_API_KEY = "";
process.env.GOOGLE_API_KEY = "";
process.env.MONGODB_URI ||= "mongodb://127.0.0.1:27017/jobmate-test";
process.env.META_VERIFY_TOKEN ||= "test-token";
process.env.META_ACCESS_TOKEN ||= "test-token";
process.env.META_PHONE_NUMBER_ID ||= "test-phone-id";

const {
  getJobMateAutomationActiveFlowRoute,
} = await import("../src/controllers/whatsapp.controller.js");
const {
  handleJobMateLeadAgentMessage,
} = await import("../src/services/jobmateLeadAgent/jobmateLeadAgent.service.js");
const {
  handleEmployerLead,
} = await import("../src/services/automation/employerLead.service.js");
const { EmployerLead } = await import("../src/models/EmployerLead.model.js");
const { Conversation } = await import("../src/models/Conversation.model.js");
const { Notification } = await import("../src/models/Notification.model.js");
const { ScheduledFollowup } = await import("../src/models/ScheduledFollowup.model.js");

class FakeConversation {
  constructor(overrides = {}) {
    this._id = overrides._id || `employer-location-priority-${Date.now()}-${Math.random()}`;
    this.currentIntent = overrides.currentIntent ?? "unknown";
    this.currentState = overrides.currentState ?? "idle";
    this.metadata = overrides.metadata || {};
  }
}

const contact = {
  _id: "507f1f77bcf86cd799439011",
  phone: "9840000000",
  displayName: "Mitra",
};

const tests = [];
const replies = [];
let fakeLead = null;
let activeConversation = null;
let workerRouteCount = 0;
let jobSearchRouteCount = 0;

installDbStubs();

await test("lead-agent defers automation employer ask_location", async () => {
  const conversation = buildEmployerConversation({
    currentState: "ask_location",
    qualificationStep: 3,
  });

  const result = await leadAgentTurn(conversation, "bardaghat");

  assert(result.handled === false, `lead agent handled active employer location: ${result.intent}`);
  assert(result.reason === "active_automation_employer_flow_defer", `wrong defer reason: ${result.reason}`);
});

await test("bardaghat at employer location state stays employer and asks urgency", async () => {
  const { conversation, byMessage } = await runTranscript([
    "start",
    "2",
    "Naya Nepal Pustak Pasal",
    "5 jana marketing",
    "bardaghat",
  ]);
  const finalTurn = byMessage.get("bardaghat");

  assert(conversation.currentIntent === "employer_lead", `intent changed: ${conversation.currentIntent}`);
  assert(conversation.currentState === "ask_urgency", `state wrong: ${conversation.currentState}`);
  assert(finalTurn.route === "employer", `wrong route: ${finalTurn.route}`);
  assert(fakeLead.location?.area === "Bardaghat", `area wrong: ${fakeLead.location?.area}`);
  assert(fakeLead.location?.district === "Nawalparasi West", `district wrong: ${fakeLead.location?.district}`);
  assert(/Tapailai employees kahile/i.test(finalTurn.reply), `urgency prompt missing: ${finalTurn.reply}`);
  assertNoWorkerOrSearchLeak(finalTurn.reply);
  assert(workerRouteCount === 0, `worker route reached ${workerRouteCount} time(s)`);
  assert(jobSearchRouteCount === 0, `job search route reached ${jobSearchRouteCount} time(s)`);
});

await test("jimirbar at employer location state saves Jimirbar and asks urgency", async () => {
  const { conversation, byMessage } = await runTranscript([
    "start",
    "2",
    "Naya Nepal Pustak Pasal",
    "5 jana marketing",
    "jimirbar",
  ]);
  const finalTurn = byMessage.get("jimirbar");

  assert(conversation.currentState === "ask_urgency", `state wrong: ${conversation.currentState}`);
  assert(fakeLead.location?.area === "Jimirbar", `area wrong: ${fakeLead.location?.area}`);
  assert(fakeLead.location?.district === "Nawalparasi West", `district wrong: ${fakeLead.location?.district}`);
  assert(/Tapailai employees kahile/i.test(finalTurn.reply), `urgency prompt missing: ${finalTurn.reply}`);
  assertNoWorkerOrSearchLeak(finalTurn.reply);
});

await test("bardaghat then urgency 1 saves immediate and asks salary", async () => {
  const { conversation, byMessage } = await runTranscript([
    "start",
    "2",
    "Naya Nepal Pustak Pasal",
    "5 jana marketing",
    "bardaghat",
    "1",
  ]);
  const finalTurn = byMessage.get("1");
  const need = fakeLead.hiringNeeds?.[0] || {};

  assert(conversation.currentState === "ask_salary_range", `state wrong: ${conversation.currentState}`);
  assert(need.urgency === "this_week", `urgency wrong: ${need.urgency}`);
  assert(/Salary range kati/i.test(finalTurn.reply), `salary prompt missing: ${finalTurn.reply}`);
  assertNoWorkerOrSearchLeak(finalTurn.reply);
  assert(workerRouteCount === 0, `worker route reached ${workerRouteCount} time(s)`);
});

await test("full employer flow through bardaghat stays out of worker and job search paths", async () => {
  const { conversation } = await runTranscript([
    "start",
    "2",
    "Naya Nepal Pustak Pasal",
    "5 jana marketing",
    "bardaghat",
    "1",
    "13000-17000",
    "1",
  ]);
  const need = fakeLead.hiringNeeds?.[0] || {};

  assert(conversation.currentState === "completed", `flow did not complete: ${conversation.currentState}`);
  assert(fakeLead.businessName === "Naya Nepal Pustak Pasal", `businessName wrong: ${fakeLead.businessName}`);
  assert(roleLabel(need.role) === "Marketing Staff", `role wrong: ${need.role}`);
  assert(Number(need.quantity || 0) === 5, `quantity wrong: ${need.quantity}`);
  assert(fakeLead.location?.area === "Bardaghat", `area wrong: ${fakeLead.location?.area}`);
  assert(fakeLead.location?.district === "Nawalparasi West", `district wrong: ${fakeLead.location?.district}`);
  assert(need.urgency === "this_week", `urgency wrong: ${need.urgency}`);
  assert(need.salaryMin === 13000 && need.salaryMax === 17000, `salary wrong: ${JSON.stringify(need)}`);
  assert(need.workType === "full_time", `work type wrong: ${need.workType}`);
  assert(workerRouteCount === 0, `worker route reached ${workerRouteCount} time(s)`);
  assert(jobSearchRouteCount === 0, `job search route reached ${jobSearchRouteCount} time(s)`);
});

for (const reply of replies) {
  await test(`no worker/search leak: ${reply.slice(0, 40) || "empty"}`, async () => {
    assertNoWorkerOrSearchLeak(reply);
  });
}

console.table(tests);

const failed = tests.filter((row) => row.status !== "PASS");
if (failed.length) {
  console.log(`\nResult: ${failed.length} FAILED`);
  process.exitCode = 1;
} else {
  console.log("\nResult: ALL PASSED");
}

async function runTranscript(messages = []) {
  const conversation = new FakeConversation();
  const byMessage = new Map();
  fakeLead = buildLeadBase();
  activeConversation = conversation;
  workerRouteCount = 0;
  jobSearchRouteCount = 0;

  for (const message of messages) {
    byMessage.set(message, await simulatedControllerTurn(conversation, message));
  }

  return { conversation, byMessage };
}

async function simulatedControllerTurn(conversation, text) {
  const value = String(text || "").toLowerCase().trim();

  if (["start", "restart", "menu", "hello", "hi"].includes(value)) {
    conversation.currentIntent = "unknown";
    conversation.currentState = "idle";
    conversation.metadata = {
      qualificationStep: 0,
      menuContext: {
        type: "jobmate_main_menu",
        active: true,
      },
    };

    return {
      route: "menu",
      reply:
        "Namaste. JobMate ma tapai job khojna ya staff khojna saknuhunchha.\n1. Job khojna\n2. Staff khojna",
    };
  }

  if (value === "2" && conversation.metadata?.menuContext?.active) {
    conversation.metadata.menuContext.active = false;
    return employerTurn(conversation, text, { route: "employer_menu_selection" });
  }

  const route = getJobMateAutomationActiveFlowRoute(conversation);

  if (route === "employer") {
    return employerTurn(conversation, text, { route });
  }

  if (route === "worker") {
    workerRouteCount += 1;
    return {
      route,
      reply: "Tapai kasto kaam khojnu bhayeko ho?",
    };
  }

  const leadAgent = await leadAgentTurn(conversation, text);
  if (leadAgent.handled) {
    jobSearchRouteCount += ["job_search", "worker_start", "worker_lead"].includes(leadAgent.intent) ? 1 : 0;
  }

  return {
    route: "lead_agent",
    reply: leadAgent.reply || "",
    result: leadAgent,
  };
}

async function employerTurn(conversation, text, extra = {}) {
  activeConversation = conversation;

  const result = await handleEmployerLead({
    contact,
    conversation,
    normalizedMessage: normalized(text),
    aiExtraction: null,
  });

  applyEmployerResult(conversation, result);

  const reply = result.messageToSend || result.reply || "";
  replies.push(reply);

  return {
    ...extra,
    reply,
    result,
  };
}

async function leadAgentTurn(conversation, text) {
  return handleJobMateLeadAgentMessage({
    contact,
    conversation,
    normalizedMessage: normalized(text),
  });
}

function buildEmployerConversation({
  currentState = "ask_location",
  qualificationStep = 3,
} = {}) {
  return new FakeConversation({
    currentIntent: "employer_lead",
    currentState,
    metadata: {
      activeFlow: "employer_lead",
      qualificationStep,
    },
  });
}

function applyEmployerResult(conversation, result = {}) {
  conversation.currentIntent = "employer_lead";
  conversation.currentState = result.currentState || conversation.currentState;
  conversation.metadata = {
    ...(conversation.metadata || {}),
    activeFlow: result.currentState === "completed" ? null : "employer_lead",
    qualificationStep: result.nextStep ?? conversation.metadata?.qualificationStep ?? 0,
    lastQuestion: result.messageToSend || result.reply || "",
  };
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
    if (activeConversation) {
      applyMongoUpdate(activeConversation, update);
    }

    return activeConversation;
  };

  Notification.create = async (payload = {}) => ({
    _id: "fake-notification",
    ...payload,
  });

  ScheduledFollowup.findOneAndUpdate = async (_filter, update = {}) => ({
    _id: "fake-followup",
    ...update.$setOnInsert,
    ...update.$set,
  });
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

  if (update.$setOnInsert) {
    for (const [path, value] of Object.entries(update.$setOnInsert)) {
      if (getPath(target, path) === undefined) {
        setPath(target, path, value);
      }
    }
  }

  if (update.$set) {
    for (const [path, value] of Object.entries(update.$set)) {
      setPath(target, path, value);
    }
  }

  if (update.$unset) {
    for (const path of Object.keys(update.$unset)) {
      unsetPath(target, path);
    }
  }

  if (update.$inc) {
    for (const [path, value] of Object.entries(update.$inc)) {
      setPath(target, path, Number(getPath(target, path) || 0) + Number(value || 0));
    }
  }

  if (update.$push) {
    for (const [path, value] of Object.entries(update.$push)) {
      const current = getPath(target, path);
      const arr = Array.isArray(current) ? current : [];
      const values = value && Array.isArray(value.$each) ? value.$each : [value];
      arr.push(...values);
      setPath(target, path, arr);
    }
  }
}

function setPath(target, path, value) {
  if (path.includes(".$[].")) {
    const [arrayPath, childPath] = path.split(".$[].");
    const arr = getPath(target, arrayPath);
    if (Array.isArray(arr)) {
      for (const item of arr) {
        setPath(item, childPath, value);
      }
    }
    return;
  }

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

function assertNoWorkerOrSearchLeak(reply = "") {
  assert(!/job listing check/i.test(reply), `job search text leaked: ${reply}`);
  assert(!/Profile register garna/i.test(reply), `worker profile prompt leaked: ${reply}`);
  assert(!/Tapai kasto kaam khojdai/i.test(reply), `worker job type prompt leaked: ${reply}`);
  assert(!/Tapai kasto kaam khojnu/i.test(reply), `worker job type prompt leaked: ${reply}`);
  assert(!/1\. Driver \/ Transport|2\. Security Guard|Sales \/ Marketing ko lagi herchhu/i.test(reply), `worker menu leaked: ${reply}`);
}

function roleLabel(role = "") {
  const labels = {
    marketing_staff: "Marketing Staff",
    sales_staff: "Sales Staff",
    kitchen_staff: "Kitchen Staff",
  };

  return labels[role] || String(role || "");
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
