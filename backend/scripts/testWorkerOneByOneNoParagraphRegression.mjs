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

const contact = {
  _id: "worker-one-question-contact",
  phone: "9840000000",
  displayName: "Mitra",
};

const FORBIDDEN_PARAGRAPH = /Aba kun area ma kaam garna milcha, tapai ko naam, phone number, age/i;
const tests = [];
const replies = [];
const leadDrafts = [];

let conversation = makeConversation();

await test("start -> 1 -> marketing asks location only", async () => {
  await turn("start");
  await turn("1");
  const result = await turn("marketing");
  const reply = result.reply || "";

  assert(result.state?.step === "location", `expected location step, got ${result.state?.step}`);
  assert(result.state?.data?.jobType === "Sales / Marketing", `jobType wrong: ${result.state?.data?.jobType}`);
  assert(/Sales \/ Marketing ko lagi herchhu/i.test(reply), `jobType acknowledgement missing: ${reply}`);
  assert(/Tapai kun district\/area ma kaam garna milchha/i.test(reply), `location question missing: ${reply}`);
  assert(!FORBIDDEN_PARAGRAPH.test(reply), `huge paragraph returned: ${reply}`);
  assert(!/Yo detail note gare/i.test(reply), `generic detail note returned: ${reply}`);
});

await test("jimirbar -> 1 asks documents and never driver", async () => {
  await turn("jimirbar");
  const result = await turn("1");
  const data = result.state?.data || {};
  const reply = result.reply || "";

  assert(data.jobType === "Sales / Marketing", `jobType changed: ${data.jobType}`);
  assert(data.location?.area === "Jimirbar", `area wrong: ${data.location?.area}`);
  assert(data.location?.district === "Nawalparasi West", `district wrong: ${data.location?.district}`);
  assert(data.availability?.value === "full-time", `availability wrong: ${JSON.stringify(data.availability)}`);
  assert(result.state?.step === "documentStatus", `expected documentStatus, got ${result.state?.step}`);
  assert(/Tapai sanga document chha/i.test(reply), `document question missing: ${reply}`);
  assert(!/kaam:\s*Driver|Driver \/ Transport/i.test(reply), `driver leaked: ${reply}`);
});

await test("documents no asks name only", async () => {
  const result = await turn("xaina");
  const reply = result.reply || "";

  assert(result.state?.data?.documentStatus === "not_available", `documents wrong: ${result.state?.data?.documentStatus}`);
  assert(result.state?.step === "fullName", `expected fullName, got ${result.state?.step}`);
  assert(/^Tapai ko naam pathaunus\.$/i.test(reply), `not name-only prompt: ${reply}`);
});

await test("name asks phone only", async () => {
  const result = await turn("Bipin");
  const reply = result.reply || "";

  assert(result.state?.data?.fullName === "Bipin", `name wrong: ${result.state?.data?.fullName}`);
  assert(result.state?.step === "providedPhone", `expected providedPhone, got ${result.state?.step}`);
  assert(/^Tapai ko phone\/WhatsApp number pathaunus\.$/i.test(reply), `not phone-only prompt: ${reply}`);
});

await test("phone asks age only", async () => {
  const result = await turn("9821901533");
  const reply = result.reply || "";

  assert(result.state?.data?.providedPhone === "9821901533", `phone wrong: ${result.state?.data?.providedPhone}`);
  assert(result.state?.step === "age", `expected age, got ${result.state?.step}`);
  assert(/^Tapai ko age kati ho\?$/i.test(reply), `not age-only prompt: ${reply}`);
});

await test("age asks experience only", async () => {
  const result = await turn("19");
  const reply = result.reply || "";

  assert(result.state?.data?.age === 19, `age wrong: ${result.state?.data?.age}`);
  assert(result.state?.step === "experience", `expected experience, got ${result.state?.step}`);
  assert(/^Tapai ko experience kati cha\? Experience chaina bhane 'no experience' lekhnus\.$/i.test(reply), `not experience-only prompt: ${reply}`);
});

await test("experience no asks salary only", async () => {
  const result = await turn("no experience");
  const reply = result.reply || "";

  assert(result.state?.data?.experience?.level === "none", `experience wrong: ${JSON.stringify(result.state?.data?.experience)}`);
  assert(result.state?.step === "expectedSalary", `expected expectedSalary, got ${result.state?.step}`);
  assert(/^Expected salary kati ho\?$/i.test(reply), `not salary-only prompt: ${reply}`);
});

await test("salary shows summary confirmation", async () => {
  const result = await turn("15000");
  const reply = result.reply || "";

  assert(result.state?.step === "confirmation", `expected confirmation, got ${result.state?.step}`);
  assert(/Tapai ko details:/i.test(reply), `summary header missing: ${reply}`);
  assert(/- Kaam: Sales \/ Marketing/i.test(reply), `jobType missing: ${reply}`);
  assert(/- Area: Jimirbar/i.test(reply), `area missing: ${reply}`);
  assert(/- District: Nawalparasi West/i.test(reply), `district missing: ${reply}`);
  assert(/- Availability: Full-time/i.test(reply), `availability missing: ${reply}`);
  assert(/- Documents: no/i.test(reply), `documents missing: ${reply}`);
  assert(/- Name: Bipin/i.test(reply), `name missing: ${reply}`);
  assert(/- Phone: 9821901533/i.test(reply), `phone missing: ${reply}`);
  assert(/- Age: 19/i.test(reply), `age missing: ${reply}`);
  assert(/- Experience: no experience/i.test(reply), `experience missing: ${reply}`);
  assert(/- Expected salary: 15000/i.test(reply), `salary missing: ${reply}`);
  assert(/Yo details thik cha\?\s*1\. Ho, save garnus\s*2\. Edit garnu cha/is.test(reply), `confirmation options missing: ${reply}`);
});

await test("no active worker reply contains huge paragraph", async () => {
  const badReply = replies.find((reply) => FORBIDDEN_PARAGRAPH.test(reply));
  assert(!badReply, `huge paragraph found: ${badReply}`);
});

await test("profile is not saved before confirmation", async () => {
  assert(leadDrafts.length === 0, `lead draft created early: ${JSON.stringify(leadDrafts, null, 2)}`);
});

await test("confirmation saves worker lead draft", async () => {
  const result = await turn("1");

  assert(result.leadDraft?.type === "worker_lead", "worker lead draft not created after confirmation");
  assert(result.leadDraft?.requiresHumanApproval === true, "worker lead draft missing human approval");
  assert(leadDrafts.length === 1, `expected 1 lead draft, got ${leadDrafts.length}`);
});

await test("no AI/model/provider wording", async () => {
  for (const reply of replies) {
    const issues = findReplyPolicyIssues(reply);
    assert(!issues.length, `reply policy issue ${issues.join(", ")} in ${reply}`);
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

async function turn(text) {
  const result = await handleJobMateLeadAgentMessage({
    contact,
    conversation,
    normalizedMessage: {
      message: {
        text,
        normalizedText: String(text || "").toLowerCase(),
        type: "text",
      },
    },
  });

  if (result.handled) {
    conversation = {
      ...conversation,
      currentIntent: result.conversationIntent || "unknown",
      currentState: result.currentState || "idle",
      metadata: {
        ...(conversation.metadata || {}),
        jobmateLeadAgent: result.state,
        lastQuestion: result.reply,
      },
    };
  }

  replies.push(result.reply || "");
  if (result.leadDraft) leadDrafts.push(result.leadDraft);

  return result;
}

function makeConversation() {
  return {
    currentIntent: "unknown",
    currentState: "idle",
    metadata: {},
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
