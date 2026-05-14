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
  parseSalaryRange,
  parseUrgency,
  parseVacancy,
  detectExperienceRequirement,
} = await import("../src/services/automation/employer/employerLeadMapper.service.js");

const tests = [];
const replies = [];

await test("live employer transcript keeps phone, quantity, urgency, contact and experience correct", async () => {
  const { byMessage, conversation } = await runTranscript([
    "start",
    "2",
    "jimirbar ma aauta marketing ko manxe chaiyo",
    "Naya nepal pustak pasal",
    "9821901533",
    "duty timing 9-18",
    "contact person basanta",
    "food xaina",
    "staff ak due din ma chainxa",
    "no experience",
  ]);

  const afterPhone = byMessage.get("9821901533")?.state?.data || {};
  const afterContact = byMessage.get("contact person basanta")?.state?.data || {};
  const afterUrgency = byMessage.get("staff ak due din ma chainxa")?.state?.data || {};
  const finalData = conversation.metadata.jobmateLeadAgent.data || {};
  const finalReply = byMessage.get("no experience")?.reply || "";

  assert(finalData.businessName === "Naya Nepal Pustak Pasal", `businessName wrong: ${finalData.businessName}`);
  assert(finalData.role === "Marketing Staff", `role wrong: ${finalData.role}`);
  assert(finalData.quantity === 1, `quantity changed from 1: ${finalData.quantity}`);
  assert(finalData.location?.area === "Jimirbar", `area wrong: ${finalData.location?.area}`);
  assert(afterPhone.providedPhone === "9821901533", `phone not saved: ${afterPhone.providedPhone}`);
  assert(!afterPhone.salaryRange, `phone was parsed as salary: ${JSON.stringify(afterPhone.salaryRange)}`);
  assert(finalData.timing === "9-18", `timing wrong: ${finalData.timing}`);
  assert(afterContact.contactPerson === "Basanta", `contact person wrong: ${afterContact.contactPerson}`);
  assert(finalData.contactPerson === "Basanta", `final contact person wrong: ${finalData.contactPerson}`);
  assert(finalData.foodProvided === false, "food xaina not saved as false");
  assert(afterUrgency.quantity === 1, `urgency phrase changed quantity: ${afterUrgency.quantity}`);
  assert(
    afterUrgency.urgency?.value === "within_days" && afterUrgency.urgency?.days === 2,
    `urgency not saved as 1-2 days: ${JSON.stringify(afterUrgency.urgency)}`
  );
  assert(finalData.experienceRequired?.level === "not_required", `experience not saved: ${JSON.stringify(finalData.experienceRequired)}`);
  assert(!/NPR 1533-982190/i.test(JSON.stringify(finalData)), "bad phone-derived salary persisted");
  assert(!/contact person/i.test(finalReply), "contact person was asked again after saving");
  assert(!/kahile dekhi/i.test(finalReply), "urgency was asked again after saving");
  assert(!/experience requirement/i.test(finalReply), "experience was asked again after saving");
});

await test("1-2 day ma staff saves urgency and keeps quantity unchanged", async () => {
  const state = await buildEmployerStateAtUrgency();
  const result = await leadTurn(state.conversation, "1-2 day ma staff");
  const data = result.state?.data || {};

  assert(data.quantity === 1, `quantity changed: ${data.quantity}`);
  assert(data.urgency?.value === "within_days", `urgency value wrong: ${JSON.stringify(data.urgency)}`);
  assert(data.urgency?.days === 2, `urgency days wrong: ${JSON.stringify(data.urgency)}`);
});

await test("recently is accepted as immediate urgency", async () => {
  const state = await buildEmployerStateAtUrgency();
  const result = await leadTurn(state.conversation, "recently");
  const data = result.state?.data || {};

  assert(data.quantity === 1, `quantity changed: ${data.quantity}`);
  assert(data.urgency?.value === "immediate", `recently not immediate: ${JSON.stringify(data.urgency)}`);
});

await test("old employer mapper ignores phone-like salary and urgency quantity", async () => {
  const salary = parseSalaryRange("9821901533");
  const vacancy = parseVacancy("staff ak due din ma chainxa");
  const urgency = parseUrgency("1-2 day ma staff");
  const experience = detectExperienceRequirement("no experience");

  assert(salary.salaryMin === null && salary.salaryMax === null, `phone parsed as salary: ${JSON.stringify(salary)}`);
  assert(vacancy.quantity === 1, `urgency phrase parsed as quantity: ${vacancy.quantity}`);
  assert(urgency.urgency === "within_2_days", `urgency mapper wrong: ${JSON.stringify(urgency)}`);
  assert(experience === "fresher_ok", `no experience mapper wrong: ${experience}`);
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

async function runTranscript(messages = []) {
  const conversation = {
    currentIntent: "unknown",
    currentState: "idle",
    metadata: {},
  };
  const byMessage = new Map();

  for (const message of messages) {
    const result = await leadTurn(conversation, message);
    byMessage.set(message, result);
  }

  return { byMessage, conversation };
}

async function buildEmployerStateAtUrgency() {
  const transcript = [
    "start",
    "2",
    "jimirbar ma aauta marketing ko manxe chaiyo",
    "Naya nepal pustak pasal",
    "9821901533",
    "duty timing 9-18",
    "contact person basanta",
    "food xaina",
  ];

  const { conversation } = await runTranscript(transcript);
  return { conversation };
}

async function leadTurn(conversation, text) {
  const result = await handleJobMateLeadAgentMessage({
    contact: {
      _id: "employer-field-regression-contact",
      phone: "9800000000",
      displayName: "Mitra",
    },
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
