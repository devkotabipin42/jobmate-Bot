process.env.BOT_MODE = "jobmate_hiring";
process.env.USE_NEW_CONVERSATION_ENGINE = "true";
process.env.ENABLE_AARATI_LLM = "false";
process.env.ENABLE_AARATI_AI_BRAIN = "false";
process.env.GEMINI_API_KEY = "";
process.env.GOOGLE_API_KEY = "";
process.env.MONGODB_URI ||= "mongodb://127.0.0.1:27017/jobmate-test";
process.env.META_VERIFY_TOKEN ||= "test-token";
process.env.META_ACCESS_TOKEN ||= "test-token";
process.env.META_PHONE_NUMBER_ID ||= "test-phone-id";

const {
  handleJobMateLeadAgentMessage,
} = await import("../src/services/jobmateLeadAgent/jobmateLeadAgent.service.js");
const {
  handleEmployerLead,
} = await import("../src/services/automation/employerLead.service.js");
const {
  parseSalaryRange,
  parseWorkType,
} = await import("../src/services/automation/employer/employerLeadMapper.service.js");
const {
  findReplyPolicyIssues,
} = await import("../src/services/jobmateLeadAgent/replyFormatter.service.js");
const { EmployerLead } = await import("../src/models/EmployerLead.model.js");
const { Conversation } = await import("../src/models/Conversation.model.js");
const { Notification } = await import("../src/models/Notification.model.js");
const { ScheduledFollowup } = await import("../src/models/ScheduledFollowup.model.js");

class FakeConversation {
  constructor(overrides = {}) {
    this._id = overrides._id || `employer-priority-${Date.now()}-${Math.random()}`;
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
let activeConversation = null;
let fakeLead = null;

installDbStubs();

await test("lead-agent defers automation employer ask_urgency numeric 1", async () => {
  const conversation = buildEmployerConversation({
    currentState: "ask_urgency",
    qualificationStep: 4,
  });

  const result = await leadAgentTurn(conversation, "1");

  assert(result.handled === false, `lead agent handled active employer turn: ${result.intent}`);
  assert(result.reason === "active_automation_employer_flow_defer", `wrong defer reason: ${result.reason}`);
});

await test("start -> 2 -> business -> role -> location -> 1 saves urgency and asks salary", async () => {
  const { conversation, byMessage } = await runEmployerTranscript([
    "start",
    "2",
    "Naya nepal pustak pasal",
    "2 jana marketing",
    "jimirbar",
    "1",
  ]);

  const finalTurn = byMessage.get("1");
  const reply = finalTurn.reply || "";
  const need = fakeLead.hiringNeeds?.[0] || {};

  assert(conversation.currentIntent === "employer_lead", `activeFlow changed: ${conversation.currentIntent}`);
  assert(conversation.currentState === "ask_salary_range", `state wrong: ${conversation.currentState}`);
  assert(fakeLead.businessName === "Naya Nepal Pustak Pasal", `businessName lost: ${fakeLead.businessName}`);
  assert(roleLabel(need.role) === "Marketing Staff", `role wrong: ${need.role}`);
  assert(Number(need.quantity || 0) === 2, `quantity wrong: ${need.quantity}`);
  assert(fakeLead.location?.area === "Jimirbar", `area wrong: ${fakeLead.location?.area}`);
  assert(need.urgency === "this_week", `urgency wrong: ${need.urgency}`);
  assert(/Salary range kati/i.test(reply), `salary prompt missing: ${reply}`);
  assert(!/Tapai kasto kaam|Driver \/ Transport|Security Guard/i.test(reply), `worker menu leaked: ${reply}`);
});

await test("ask_urgency numeric 2 saves 1-2 hapta bhitra", async () => {
  const conversation = buildEmployerConversation({
    currentState: "ask_urgency",
    qualificationStep: 4,
  });
  seedQualifiedEmployerLead();

  const result = await priorityTurn(conversation, "2");
  const need = fakeLead.hiringNeeds?.[0] || {};

  assert(result.leadAgentHandled === false, "lead agent stole urgency 2");
  assert(conversation.currentState === "ask_salary_range", `state wrong: ${conversation.currentState}`);
  assert(need.urgency === "within_2_weeks", `urgency 2 wrong: ${need.urgency}`);
  assert(/Salary range kati/i.test(result.reply), `salary prompt missing: ${result.reply}`);
});

await test("ask_work_type numeric 1 is Full-time, not worker Driver", async () => {
  const conversation = buildEmployerConversation({
    currentState: "ask_work_type",
    qualificationStep: 6,
  });
  seedQualifiedEmployerLead({
    hiringNeeds: [
      {
        role: "marketing_staff",
        quantity: 2,
        urgency: "this_week",
        salaryMin: 13000,
        salaryMax: 15000,
      },
    ],
    metadata: {
      employerLeadNotificationSent: true,
    },
  });

  const result = await priorityTurn(conversation, "1");
  const need = fakeLead.hiringNeeds?.[0] || {};

  assert(result.leadAgentHandled === false, "lead agent stole work type 1");
  assert(parseWorkType("1") === "full_time", "work type parser maps 1 incorrectly");
  assert(need.workType === "full_time", `work type not saved: ${need.workType}`);
  assert(!/Tapai kasto kaam|Driver \/ Transport/i.test(result.reply), `worker menu leaked: ${result.reply}`);
});

await test("ask_salary range saves salary and stays employer flow", async () => {
  const conversation = buildEmployerConversation({
    currentState: "ask_salary_range",
    qualificationStep: 5,
  });
  seedQualifiedEmployerLead();

  const result = await priorityTurn(conversation, "13000-15000");
  const need = fakeLead.hiringNeeds?.[0] || {};

  assert(result.leadAgentHandled === false, "lead agent stole salary range");
  assert(parseSalaryRange("13000-15000").salaryMin === 13000, "salary parser min wrong");
  assert(conversation.currentState === "ask_work_type", `state wrong: ${conversation.currentState}`);
  assert(need.salaryMin === 13000 && need.salaryMax === 15000, `salary not saved: ${JSON.stringify(need)}`);
  assert(!/Tapai kasto kaam|Driver \/ Transport/i.test(result.reply), `worker menu leaked: ${result.reply}`);
});

for (const reply of replies) {
  await test(`reply policy: ${reply.slice(0, 45) || "empty"}`, async () => {
    const issues = findReplyPolicyIssues(reply);
    assert(!issues.length, `reply contains policy issue: ${issues.join(", ")}`);
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

async function runEmployerTranscript(messages = []) {
  const conversation = new FakeConversation({
    currentIntent: "unknown",
    currentState: "idle",
    metadata: {},
  });
  const byMessage = new Map();
  seedEmptyEmployerLead();

  for (const text of messages) {
    const result = await simulatedControllerTurn(conversation, text);
    byMessage.set(text, result);
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
      reply:
        "Namaste. JobMate ma tapai job khojna, staff khojna, ya sahakari partnership inquiry pathauna saknuhunchha.\n1. Job khojna\n2. Staff khojna\n3. Sahakari partnership",
    };
  }

  if (value === "2" && conversation.metadata?.menuContext?.active) {
    conversation.metadata.menuContext.active = false;
    return employerTurn(conversation, text);
  }

  if (isActiveAutomationEmployerConversation(conversation)) {
    return priorityTurn(conversation, text);
  }

  const leadAgent = await leadAgentTurn(conversation, text);
  return {
    leadAgentHandled: Boolean(leadAgent.handled),
    reply: leadAgent.reply || "",
    result: leadAgent,
  };
}

async function priorityTurn(conversation, text) {
  const leadAgent = await leadAgentTurn(conversation, text);

  if (leadAgent.handled) {
    const reply = leadAgent.reply || "";
    replies.push(reply);
    return {
      leadAgentHandled: true,
      reply,
      result: leadAgent,
    };
  }

  return employerTurn(conversation, text, {
    leadAgentHandled: false,
    leadAgentReason: leadAgent.reason,
  });
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
  currentState = "ask_urgency",
  qualificationStep = 4,
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

function seedEmptyEmployerLead() {
  fakeLead = buildLeadBase();
}

function seedQualifiedEmployerLead(overrides = {}) {
  fakeLead = {
    ...buildLeadBase(),
    businessName: "Naya Nepal Pustak Pasal",
    contactPerson: "Mitra",
    leadStatus: "qualifying",
    location: {
      area: "Jimirbar",
      district: "Nawalparasi West",
      province: "Lumbini",
      country: "Nepal",
    },
    hiringNeeds: [
      {
        role: "marketing_staff",
        quantity: 2,
        urgency: "unknown",
      },
    ],
    ...overrides,
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

function isActiveAutomationEmployerConversation(conversation = {}) {
  const state = String(conversation.currentState || "");
  const activeFlow = conversation.metadata?.activeFlow;
  const step = Number(conversation.metadata?.qualificationStep || 0);

  return (
    conversation.currentIntent === "employer_lead" &&
    activeFlow === "employer_lead" &&
    (["ask_business_name", "ask_vacancy", "ask_vacancy_role", "ask_location", "ask_urgency", "ask_salary_range", "ask_work_type"].includes(state) ||
      (step > 0 && step < 7))
  );
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
