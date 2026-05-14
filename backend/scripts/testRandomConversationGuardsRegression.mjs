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
  findReplyPolicyIssues,
  sanitizeReply,
} = await import("../src/services/jobmateLeadAgent/replyFormatter.service.js");

const tests = [];
const replies = [];

await test("worker ask_experience accepts 2 years ko xa", async () => {
  const session = makeSession("random-experience-contact");

  await session.turn("start");
  await session.turn("1");
  await session.turn("marketing");
  await session.turn("bardaghat");
  await session.turn("1");
  await session.turn("2");
  await session.turn("Bipin");
  await session.turn("9821901533");
  await session.turn("25");
  const result = await session.turn("2 years ko xa");

  const data = result.state?.data || {};
  assert(result.state?.step === "expectedSalary", `expected salary step, got ${result.state?.step}`);
  assert(data.experience?.years === 2, `experience not parsed as 2 years: ${JSON.stringify(data.experience)}`);
  assert(/Expected salary kati ho/i.test(result.reply || ""), `salary prompt missing: ${result.reply}`);
});

await test("worker ask_jobType small talk khana does not save jobType", async () => {
  const session = makeSession("random-smalltalk-khana");

  await session.turn("start");
  await session.turn("1");
  const result = await session.turn("khana kanu bhayoi");

  assert(result.state?.step === "jobType", `expected jobType step, got ${result.state?.step}`);
  assert(!result.state?.data?.jobType, `small talk saved jobType: ${result.state?.data?.jobType}`);
  assert(/ma JobMate team bata ho/i.test(result.reply || ""), `small talk reply missing: ${result.reply}`);
  assert(/Driver \/ Transport/i.test(result.reply || ""), `real job category menu missing: ${result.reply}`);
  assert(!/Khana Kanu Bhayoi/i.test(result.reply || ""), `small talk echoed as jobType: ${result.reply}`);
});

await test("worker ask_jobType small talk k xa kbr does not save jobType", async () => {
  const session = makeSession("random-smalltalk-kbr");

  await session.turn("start");
  await session.turn("1");
  const result = await session.turn("k xa kbr");

  assert(result.state?.step === "jobType", `expected jobType step, got ${result.state?.step}`);
  assert(!result.state?.data?.jobType, `small talk saved jobType: ${result.state?.data?.jobType}`);
  assert(/ma JobMate team bata ho/i.test(result.reply || ""), `small talk reply missing: ${result.reply}`);
});

await test("worker ask_jobType hello does not escape active worker guard", async () => {
  const session = makeSession("random-smalltalk-hello");

  await session.turn("start");
  await session.turn("1");
  const result = await session.turn("hello");

  assert(result.state?.step === "jobType", `expected jobType step, got ${result.state?.step}`);
  assert(!result.state?.data?.jobType, `hello saved jobType: ${result.state?.data?.jobType}`);
  assert(/ma JobMate team bata ho/i.test(result.reply || ""), `worker guard did not handle hello: ${result.reply}`);
  assert(/Driver \/ Transport/i.test(result.reply || ""), `real job category menu missing: ${result.reply}`);
});

await test("worker active flow job haina offers staff or main menu", async () => {
  const session = makeSession("random-job-haina");

  await session.turn("start");
  await session.turn("1");
  const result = await session.turn("job haina");

  assert(/1\. Staff khojna/i.test(result.reply || ""), `staff option missing: ${result.reply}`);
  assert(/2\. Main menu/i.test(result.reply || ""), `main menu option missing: ${result.reply}`);
  assert(!/Tapai kasto kaam khojnu bhayeko ho|Driver \/ Transport/i.test(result.reply || ""), `job type loop leaked: ${result.reply}`);
  assert(!result.state?.data?.jobType, `jobType should not be saved: ${JSON.stringify(result.state?.data)}`);
});

await test("jobmate fack ho re returns trust answer without overclaim", async () => {
  const session = makeSession("random-trust");
  const result = await session.turn("jobmate fack ho re");

  assert(/JobMate fake hoina/i.test(result.reply || ""), `trust answer missing: ${result.reply}`);
  assert(/Worker registration free cha/i.test(result.reply || ""), `worker free missing: ${result.reply}`);
  assert(/Job guarantee chai hudaina/i.test(result.reply || ""), `no guarantee missing: ${result.reply}`);
  assert(!/AI-powered|verified platform/i.test(result.reply || ""), `overclaim leaked: ${result.reply}`);
});

await test("manxe marne job refuses illegal work with two-option menu only", async () => {
  const session = makeSession("random-illegal");
  const result = await session.turn("manxe marne job");

  assert(/illegal\/unsafe kaam/i.test(result.reply || ""), `illegal refusal missing: ${result.reply}`);
  assert(/1\. Job khojna/i.test(result.reply || ""), `job option missing: ${result.reply}`);
  assert(/2\. Staff khojna/i.test(result.reply || ""), `staff option missing: ${result.reply}`);
  assert(!/Sahakari pilot|3\. Sahakari|Job registration|Staff demand/i.test(result.reply || ""), `old menu leaked: ${result.reply}`);
});

await test("reply sanitizer repairs broken prefixes", async () => {
  const repaired = [
    sanitizeReply("aste."),
    sanitizeReply("i kasto kaam khojnu bhayeko ho?"),
    sanitizeReply("quest JobMate rules anusar mildaina 🙏"),
  ];

  for (const reply of repaired) {
    assert(!/^(aste|i kasto|quest\s+)/i.test(reply), `broken prefix not repaired: ${reply}`);
  }
});

await test("worker happy path still saves only after confirmation", async () => {
  const session = makeSession("random-worker-happy");
  const transcript = [
    "start",
    "1",
    "marketing",
    "bardaghat",
    "1",
    "2",
    "Bipin",
    "9821901533",
    "25",
    "no experience",
    "13000",
  ];

  for (const message of transcript) {
    await session.turn(message);
  }

  assert(session.leadDrafts.length === 0, `worker lead saved before confirmation: ${session.leadDrafts.length}`);
  const result = await session.turn("1");

  assert(result.leadDraft?.type === "worker_lead", "worker lead draft not created");
  assert(result.leadDraft?.requiresHumanApproval === true, "worker lead requiresHumanApproval missing");
  assert(result.leadDraft?.data?.jobType === "Sales / Marketing", `worker jobType changed: ${result.leadDraft?.data?.jobType}`);
});

await test("employer happy path remains employer flow without old menu leak", async () => {
  const session = makeSession("random-employer-happy");
  const transcript = [
    "start",
    "2",
    "Naya Nepal Pustak Pasal",
    "5 jana marketing",
    "bardaghat",
    "1",
    "12000-14000",
    "1",
  ];
  let result = null;

  for (const message of transcript) {
    result = await session.turn(message);
  }

  const data = result?.state?.data || {};
  assert(data.businessName === "Naya Nepal Pustak Pasal", `businessName wrong: ${data.businessName}`);
  assert(data.location?.area === "Bardaghat", `area wrong: ${JSON.stringify(data.location)}`);
  assert(data.quantity === 5 || data.hiringNeed?.quantity === 5, `quantity wrong: ${JSON.stringify(data)}`);
  assert(result?.state?.flow === "employer", `employer flow lost: ${JSON.stringify(result?.state)}`);
  assert(!/Tapai kasto kaam|Driver \/ Transport|Sahakari pilot|3\. Sahakari/i.test(result?.reply || ""), `wrong menu leaked: ${result?.reply}`);
});

await test("generated replies have no old 3-option menu or broken prefix", async () => {
  for (const reply of replies) {
    assert(!/Sahakari pilot|3\. Sahakari|Job registration|Staff demand/i.test(reply), `old menu leaked: ${reply}`);
    assert(!/^(aste|i kasto|quest\s+)/i.test(String(reply || "").trim()), `broken prefix leaked: ${reply}`);
  }
});

await test("generated replies have no tech/provider wording", async () => {
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

function makeSession(contactId) {
  let conversation = {
    currentIntent: "unknown",
    currentState: "idle",
    metadata: {},
  };
  const contact = {
    _id: contactId,
    phone: "9840000000",
    displayName: "Mitra",
  };
  const leadDrafts = [];

  return {
    get conversation() {
      return conversation;
    },
    leadDrafts,
    async turn(text) {
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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
