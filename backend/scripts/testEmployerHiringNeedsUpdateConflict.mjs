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
  handleEmployerLead,
} = await import("../src/services/automation/employerLead.service.js");
const { EmployerLead } = await import("../src/models/EmployerLead.model.js");
const { Conversation } = await import("../src/models/Conversation.model.js");
const { Notification } = await import("../src/models/Notification.model.js");
const { ScheduledFollowup } = await import("../src/models/ScheduledFollowup.model.js");

class FakeConversation {
  constructor(overrides = {}) {
    this._id = overrides._id || `employer-hiring-needs-${Date.now()}-${Math.random()}`;
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
let fakeLead = null;
let activeConversation = null;
let updateConflictCount = 0;

installDbStubs();

await test("full employer flow saves hiring need without Mongo update path conflict", async () => {
  const { conversation } = await runTranscript([
    "start",
    "2",
    "Naya Nepal Pustak Pasal",
    "4 jana marketing",
    "jimirbar",
    "1",
    "13000-17000",
    "1",
  ]);

  const need = fakeLead.hiringNeeds?.[0] || {};

  assert(updateConflictCount === 0, `unexpected Mongo update conflict count: ${updateConflictCount}`);
  assert(conversation.currentState === "completed", `flow did not complete: ${conversation.currentState}`);
  assert(fakeLead.businessName === "Naya Nepal Pustak Pasal", `businessName wrong: ${fakeLead.businessName}`);
  assert(roleLabel(need.role) === "Marketing Staff", `role wrong: ${need.role}`);
  assert(Number(need.quantity || 0) === 4, `quantity wrong: ${need.quantity}`);
  assert(fakeLead.location?.area === "Jimirbar", `area wrong: ${fakeLead.location?.area}`);
  assert(fakeLead.urgencyLevel === "urgent", `urgency level wrong: ${fakeLead.urgencyLevel}`);
  assert(need.urgency === "this_week", `urgency wrong: ${need.urgency}`);
  assert(need.salaryMin === 13000 && need.salaryMax === 17000, `salary wrong: ${JSON.stringify(need)}`);
  assert(need.workType === "full_time", `workType wrong: ${need.workType}`);
});

await test("quantity-first employer flow replaces hiringNeeds with one $set, not set plus push", async () => {
  const { conversation } = await runTranscript([
    "start",
    "2",
    "Naya Nepal Pustak Pasal",
    "4",
    "marketing",
    "jimirbar",
    "1",
    "13000-17000",
    "1",
  ]);

  const need = fakeLead.hiringNeeds?.[0] || {};

  assert(updateConflictCount === 0, `Mongo update conflict happened ${updateConflictCount} time(s)`);
  assert(conversation.currentState === "completed", `flow did not complete: ${conversation.currentState}`);
  assert(roleLabel(need.role) === "Marketing Staff", `role wrong: ${need.role}`);
  assert(need.workType === "full_time", `workType wrong: ${need.workType}`);
});

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
  fakeLead = buildLeadBase();
  activeConversation = conversation;
  updateConflictCount = 0;

  for (const message of messages) {
    await turn(conversation, message);
  }

  return { conversation };
}

async function turn(conversation, text) {
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
    return;
  }

  if (value === "2" && conversation.metadata?.menuContext?.active) {
    conversation.metadata.menuContext.active = false;
  }

  activeConversation = conversation;
  const result = await handleEmployerLead({
    contact,
    conversation,
    normalizedMessage: normalized(text),
    aiExtraction: null,
  });

  conversation.currentIntent = "employer_lead";
  conversation.currentState = result.currentState || conversation.currentState;
  conversation.metadata = {
    ...(conversation.metadata || {}),
    activeFlow: result.currentState === "completed" ? null : "employer_lead",
    qualificationStep: result.nextStep ?? conversation.metadata?.qualificationStep ?? 0,
    lastQuestion: result.messageToSend || "",
  };
}

function installDbStubs() {
  EmployerLead.findOneAndUpdate = async (_filter, update = {}) => {
    assertNoHiringNeedsUpdateConflict(update);
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

function assertNoHiringNeedsUpdateConflict(update = {}) {
  const setPaths = Object.keys(update.$set || {});
  const pushPaths = Object.keys(update.$push || {});

  for (const setPath of setPaths) {
    for (const pushPath of pushPaths) {
      if (hasPathConflict(setPath, pushPath)) {
        updateConflictCount += 1;
        throw new Error(`Mongo update path conflict: $set.${setPath} and $push.${pushPath}`);
      }
    }
  }
}

function hasPathConflict(left = "", right = "") {
  return left === right || left.startsWith(`${right}.`) || right.startsWith(`${left}.`);
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
