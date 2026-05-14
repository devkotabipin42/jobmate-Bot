process.env.USE_NEW_CONVERSATION_ENGINE = "true";
process.env.ENABLE_AARATI_LLM = "false";
process.env.ENABLE_AARATI_AI_BRAIN = "false";
process.env.GEMINI_API_KEY = "";
process.env.GOOGLE_API_KEY = "";

const {
  handleJobMateLeadAgentMessage,
} = await import("../src/services/jobmateLeadAgent/jobmateLeadAgent.service.js");
const {
  findReplyPolicyIssues,
} = await import("../src/services/jobmateLeadAgent/replyFormatter.service.js");
const {
  handleEmployerLead,
} = await import("../src/services/automation/employerLead.service.js");
const {
  runConversationEngine,
} = await import("../src/services/automation/conversationEngine.js");
const {
  jobmateConfig,
} = await import("../src/configs/jobmate.config.js");
const {
  getAaratiHumanBoundaryAnswer,
} = await import("../src/services/aarati/aaratiHumanBoundary.service.js");
const {
  parseSalaryRange: parseEmployerSalaryRange,
} = await import("../src/services/automation/employer/employerLeadMapper.service.js");

class FakeConversation {
  static updates = [];

  constructor(overrides = {}) {
    this._id = overrides._id || `human-edge-${Date.now()}-${Math.random()}`;
    this.currentIntent = overrides.currentIntent ?? "unknown";
    this.currentState = overrides.currentState ?? "idle";
    this.metadata = overrides.metadata || {};
  }

  static async updateOne(filter, patch) {
    FakeConversation.updates.push({ filter, patch });
    return { acknowledged: true };
  }
}

const contact = {
  _id: "human-edge-contact",
  phone: "9840000000",
  displayName: "Mitra",
};

const tests = [];
const replies = [];

await test("worker flow nonsense input is not saved and shows real category clarification", async () => {
  const conversation = makeLeadConversation();
  await leadTurn(conversation, "malai kam chaiyo");
  const result = await leadTurn(
    conversation,
    "malai train ko chakka maa hawa halne experience xa sathai kukurko sinma tel halne, sungurko kapalko luga banaune, sarpako khutta malis gardine, etc kam haru garna sakxu"
  );

  assert(result.intent === "worker_lead", "worker flow did not stay active");
  assert(result.state?.flow === "worker", "worker flow was reset");
  assert(!result.state?.data?.jobType, "nonsense job was saved as jobType");
  assert(!result.leadDraft, "nonsense job created lead draft");
  assert(/practical\/verified job category/i.test(result.reply), "missing practical category clarification");
  assert(/sales \/ marketing/i.test(result.reply), "real category menu missing Sales / Marketing");
});

await test("worker flow pauxa ta question answers no guarantee without generic repeat", async () => {
  const conversation = makeLeadConversation();
  await leadTurn(conversation, "malai kam chaiyo");
  const result = await leadTurn(conversation, "maile vaneko kam pauxata");

  assert(/guarantee.*dina mildaina|guarantee chai dina mildaina/i.test(result.reply), "no guarantee answer missing");
  assert(/practical\/verified job category/i.test(result.reply), "unrealistic support boundary missing");
  assert(!/Aba kun kaam khojnu bhayo/i.test(result.reply), "generic prompt repeated");
  assert(result.state?.flow === "worker", "worker flow not preserved");
});

await test("worker flow kahile pathaunu answers send now on WhatsApp with format", async () => {
  const conversation = makeLeadConversation();
  await leadTurn(conversation, "malai kam chaiyo");
  const result = await leadTurn(conversation, "kahile pathaunu");

  assert(/Aile yahi WhatsApp ma pathauna milcha/i.test(result.reply), "send-now guidance missing");
  assert(/Naam:|Kaam type:|Area\/location:/i.test(result.reply), "simple format missing");
  assert(result.state?.flow === "worker", "worker flow not preserved");
});

await test("worker flow kasari kaha pathaunu answers send here as text/photo/file", async () => {
  const conversation = makeLeadConversation();
  await leadTurn(conversation, "malai kam chaiyo");
  const result = await leadTurn(conversation, "kasari kaha pathaunu");

  assert(/Yahi WhatsApp ma text\/photo\/file pathaunus/i.test(result.reply), "text/photo/file guidance missing");
  assert(/Format:/i.test(result.reply), "format missing");
  assert(result.state?.flow === "worker", "worker flow not preserved");
});

await test("repeated unclear worker inputs do not repeat long generic prompt", async () => {
  const conversation = makeLeadConversation();
  const start = await leadTurn(conversation, "malai kam chaiyo");
  const first = await leadTurn(conversation, "asdf qwer zzzz");
  const second = await leadTurn(conversation, "hmmmmm tyo k ho");

  const genericLongCount = [start.reply, first.reply, second.reply].filter((reply) =>
    /Job type, area\/location, experience ra availability pathaunus/i.test(reply)
  ).length;

  assert(genericLongCount <= 1, `generic long prompt repeated ${genericLongCount} times`);
  assert(/short ma real job category channus/i.test(second.reply), "second unclear input did not show short menu");
  assert(/Sales \/ Marketing/i.test(second.reply), "short menu missing Sales / Marketing");
});

await test("employer business-name step rejects website design service question", async () => {
  const conversation = makeLeadConversation();
  await leadTurn(conversation, "staff chainxa");
  const result = await leadTurn(conversation, "website design garxau");

  assert(result.state?.flow === "employer", "employer flow not preserved");
  assert(result.state?.step === "businessName", "employer flow advanced from businessName");
  assert(!result.state?.data?.businessName, "website design question saved as businessName");
  assert(/JobMate website design service hoina/i.test(result.reply), "out-of-scope reply missing");
});

await test("employer business-name step still saves real business", async () => {
  const conversation = makeLeadConversation();
  await leadTurn(conversation, "staff chainxa");
  const result = await leadTurn(conversation, "ABC Hotel");

  assert(result.state?.data?.businessName === "ABC Hotel", `businessName not saved: ${result.state?.data?.businessName}`);
  assert(result.state?.step !== "businessName", "real business did not advance");
  assert(/ABC Hotel/i.test(result.reply), "reply did not acknowledge business");
});

await test("start -> 1 -> marketing -> bhardaghat -> 1 -> 1 still works", async () => {
  const harness = createWorkerRegistrationHarness();
  const conversation = buildWorkerRegistrationConversation();

  await harness.turn(conversation, "1");
  await harness.turn(conversation, "marketing");
  await harness.turn(conversation, "bhardaghat");
  await harness.turn(conversation, "1");
  await harness.turn(conversation, "1");
  await harness.turn(conversation, "Ram");
  await harness.turn(conversation, "9840000000");
  await harness.turn(conversation, "22");
  await harness.turn(conversation, "no experience");
  await harness.turn(conversation, "15000");
  const result = await harness.turn(conversation, "1");
  const profile = result.newMetadata.collectedData || {};

  assert(result.isComplete === true, "worker registration flow did not complete");
  assert(["Sales / Marketing", "Marketing/Sales", "Marketing"].includes(profile.jobType), `unexpected jobType ${profile.jobType}`);
  assert(profile.district === "Nawalparasi West", "Bardaghat district not preserved");
  assert(profile.availability === "full-time", "availability not saved");
  assert(profile.documents === "yes", "documents not saved");
});

await test("worker canonical menu after nonsense maps 2 to Security Guard", async () => {
  const { profile, guardReply } = await workerRegistrationNonsenseThen("2");

  assert(/2\. Security Guard/.test(guardReply), "guard reply menu did not show 2 = Security Guard");
  assert(profile.jobType === "Security Guard", `expected Security Guard, got ${profile.jobType}`);
});

await test("worker canonical menu after nonsense maps 5 to Farm / Agriculture", async () => {
  const { profile, guardReply } = await workerRegistrationNonsenseThen("5");

  assert(/5\. Farm \/ Agriculture/.test(guardReply), "guard reply menu did not show 5 = Farm / Agriculture");
  assert(profile.jobType === "Farm / Agriculture", `expected Farm / Agriculture, got ${profile.jobType}`);
});

await test("worker canonical menu after nonsense maps 7 to Sales / Marketing", async () => {
  const { profile, guardReply } = await workerRegistrationNonsenseThen("7");

  assert(/7\. Sales \/ Marketing/.test(guardReply), "guard reply menu did not show 7 = Sales / Marketing");
  assert(profile.jobType === "Sales / Marketing", `expected Sales / Marketing, got ${profile.jobType}`);
});

await test("employer salary 15000-20000 is accepted", async () => {
  const result = await leadSalaryTurn("15000-20000");
  const salary = result.state?.data?.salaryRange || {};

  assert(salary.min === 15000, `salary min not saved: ${salary.min}`);
  assert(salary.max === 20000, `salary max not saved: ${salary.max}`);
  assert(result.state?.step === "timing", `salary did not advance to timing: ${result.state?.step}`);
});

await test("employer salary company anusar is accepted", async () => {
  const result = await leadSalaryTurn("company anusar");
  const salary = result.state?.data?.salaryRange || {};

  assert(salary.note === "company anusar", `company anusar note not saved: ${salary.note}`);
  assert(result.state?.step === "timing", `company anusar did not advance to timing: ${result.state?.step}`);
});

await test("employer salary negotiable is accepted", async () => {
  const result = await leadSalaryTurn("negotiable");
  const salary = result.state?.data?.salaryRange || {};

  assert(salary.note === "negotiable", `negotiable note not saved: ${salary.note}`);
  assert(result.state?.step === "timing", `negotiable did not advance to timing: ${result.state?.step}`);
});

await test("active employer salary range bypasses human boundary math fallback", async () => {
  const boundary = getAaratiHumanBoundaryAnswer({
    normalized: normalized("15000-20000"),
    conversation: {
      currentIntent: "employer_lead",
      currentState: "ask_salary_range",
      metadata: {},
    },
  });

  assert(boundary === null, "salary range was treated as human-boundary out-of-scope");
});

await test("old employer salary parser accepts range and flexible answers", async () => {
  const range = parseEmployerSalaryRange("15000-20000");
  const spaceRange = parseEmployerSalaryRange("15000 20000");
  const kRange = parseEmployerSalaryRange("15k-20k");
  const upper = parseEmployerSalaryRange("15000 samma");
  const company = parseEmployerSalaryRange("company anusar");
  const negotiable = parseEmployerSalaryRange("negotiable");
  const market = parseEmployerSalaryRange("market rate");

  assert(range.salaryMin === 15000 && range.salaryMax === 20000, "15000-20000 not parsed");
  assert(spaceRange.salaryMin === 15000 && spaceRange.salaryMax === 20000, "15000 20000 not parsed");
  assert(kRange.salaryMin === 15000 && kRange.salaryMax === 20000, "15k-20k not parsed");
  assert(upper.salaryMin === null && upper.salaryMax === 15000, "15000 samma not parsed");
  assert(company.salaryCurrency === "NPR", "company anusar not accepted");
  assert(negotiable.salaryCurrency === "NPR", "negotiable not accepted");
  assert(market.salaryCurrency === "NPR", "market rate not accepted");
});

await test("active employer salary step keeps data and accepts salary range", async () => {
  const result = await leadSalaryTurn("15000-20000");
  const data = result.state?.data || {};

  assert(result.state?.step === "timing", `salary step did not advance to timing: ${result.state?.step}`);
  assert(data.businessName === "Naya Rivera", `businessName lost: ${data.businessName}`);
  assert(data.role === "Cook", `role not cook: ${data.role}`);
  assert(data.quantity === 2, `quantity not 2: ${data.quantity}`);
  assert(data.location?.area === "Bardaghat", `location not Bardaghat: ${data.location?.area}`);
  assert(data.urgency?.weeks === 2, `urgency not 1-2 weeks: ${JSON.stringify(data.urgency)}`);
  assert(data.salaryRange?.min === 15000 && data.salaryRange?.max === 20000, "salary range not saved");
  assert(!/JobMate ko kaam bhanda bahira/i.test(result.reply), "salary triggered out-of-scope fallback");
});

await test("start -> 2 -> website design garxau does not enter role-needed step", async () => {
  const conversation = {
    currentIntent: "employer_lead",
    currentState: "ask_business_name",
    metadata: {
      qualificationStep: 1,
    },
  };

  const result = await handleEmployerLead({
    contact,
    conversation,
    normalizedMessage: normalized("website design garxau"),
    aiExtraction: null,
  });

  assert(result.currentState === "ask_business_name", `unexpected state ${result.currentState}`);
  assert(result.nextStep === 1, `unexpected nextStep ${result.nextStep}`);
  assert(result.employerLead === null, "off-scope service created/saved employer lead");
  assert(!/role|vacancy|staff role|kun role/i.test(result.messageToSend), "off-scope service advanced to role-needed prompt");
  replies.push(result.messageToSend || "");
});

for (const reply of replies) {
  const issues = findReplyPolicyIssues(reply);
  await test(`reply policy: ${reply.slice(0, 45) || "empty"}`, async () => {
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

async function test(name, fn) {
  try {
    await fn();
    tests.push({ test: name, status: "PASS" });
  } catch (error) {
    tests.push({ test: name, status: "FAIL", reason: error.message });
  }
}

function makeLeadConversation() {
  return {
    currentIntent: "unknown",
    currentState: "idle",
    metadata: {},
  };
}

async function leadTurn(conversation, text) {
  const result = await handleJobMateLeadAgentMessage({
    contact,
    conversation,
    normalizedMessage: normalized(text),
  });

  if (result.handled) {
    conversation.currentIntent = result.conversationIntent || "unknown";
    conversation.currentState = result.currentState || "idle";
    conversation.metadata = {
      ...(conversation.metadata || {}),
      jobmateLeadAgent: result.state,
      lastQuestion: result.reply,
      lastAskedField: null,
    };
    replies.push(result.reply || "");
  }

  return result;
}

function createWorkerRegistrationHarness() {
  const savedProfiles = [];
  const config = {
    ...jobmateConfig,
    onComplete: async ({ profile }) => {
      savedProfiles.push({ ...profile });
    },
  };

  return {
    savedProfiles,
    async turn(conversation, text) {
      const result = await runConversationEngine({
        contact,
        conversation,
        normalizedMessage: normalized(text),
        config,
      });

      conversation.currentIntent = "worker_registration";
      conversation.currentState = result.newMetadata.currentState || conversation.currentState;
      conversation.metadata = {
        ...(conversation.metadata || {}),
        collectedData: result.newMetadata.collectedData || {},
        lastAskedField: result.newMetadata.lastAskedField ?? null,
        activeFlow: result.newMetadata.currentState === "completed" ? null : "worker_registration",
      };

      return result;
    },
  };
}

async function workerRegistrationNonsenseThen(choice) {
  const harness = createWorkerRegistrationHarness();
  const conversation = buildWorkerRegistrationConversation();

  await harness.turn(conversation, "1");
  const guard = await harness.turn(
    conversation,
    "malai train ko chakka maa hawa halne experience xa sathai kukurko sinma tel halne, sungurko kapalko luga banaune, sarpako khutta malis gardine"
  );
  const result = await harness.turn(conversation, choice);

  return {
    guardReply: guard.messageToSend || "",
    profile: result.newMetadata.collectedData || {},
  };
}

async function leadSalaryTurn(text) {
  const conversation = makeLeadConversation();
  conversation.currentIntent = "employer_lead";
  conversation.currentState = "jobmate_employer_salaryRange";
  conversation.metadata = {
    jobmateLeadAgent: {
      flow: "employer",
      step: "salaryRange",
      status: "collecting",
      data: {
        businessName: "Naya Rivera",
        contactPerson: "Ram",
        providedPhone: "9840000000",
        role: "Cook",
        quantity: 2,
        location: {
          area: "Bardaghat",
          district: "Nawalparasi West",
          province: "Lumbini",
          country: "Nepal",
        },
        urgency: {
          value: "within_weeks",
          weeks: 2,
          label: "1-2 hapta bhitra",
        },
      },
      leadDrafts: [],
      taskDrafts: [],
      updatedAt: new Date().toISOString(),
    },
  };

  return leadTurn(conversation, text);
}

function buildWorkerRegistrationConversation() {
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

function normalized(text) {
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
