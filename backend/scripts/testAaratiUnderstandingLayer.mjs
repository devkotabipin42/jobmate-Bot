const {
  decideUnderstandingAction,
} = await import("../src/services/aaratiUnderstanding/aaratiUnderstanding.service.js");

const tests = [];
const replies = [];

await test("malai kaam chahiyo maps to worker_registration", () => {
  const result = decide("malai kaam chahiyo");

  assert(result.action === "start_flow", `action wrong: ${result.action}`);
  assert(result.mappedFlow === "worker_registration", `mappedFlow wrong: ${result.mappedFlow}`);
  assert(result.preserveActiveFlow === false, "unexpected preserveActiveFlow");
});

await test("staff chahiyo maps to employer_lead", () => {
  const result = decide("staff chahiyo");

  assert(result.action === "start_flow", `action wrong: ${result.action}`);
  assert(result.mappedFlow === "employer_lead", `mappedFlow wrong: ${result.mappedFlow}`);
});

await test("malai 5 jana marketing staff chahiyo maps to employer_lead", () => {
  const result = decide("malai 5 jana marketing staff chahiyo");

  assert(result.action === "start_flow", `action wrong: ${result.action}`);
  assert(result.mappedFlow === "employer_lead", `mappedFlow wrong: ${result.mappedFlow}`);
});

await test("website design garxau gets boundary and no employer flow", () => {
  const result = decide("website design garxau?");

  assert(result.action === "boundary", `action wrong: ${result.action}`);
  assert(result.mappedFlow === "boundary_reply", `mappedFlow wrong: ${result.mappedFlow}`);
  assert(!/businessName|companyName|employer_lead/i.test(JSON.stringify(result)), "boundary looked like employer save");
  assert(/JobMate ko kaam bhanda bahira|staff khojne employer/i.test(result.reply), `boundary reply missing: ${result.reply}`);
  replies.push(result.reply);
});

await test("love letter lekhdeu gets boundary", () => {
  const result = decide("love letter lekhdeu");

  assert(result.action === "boundary", `action wrong: ${result.action}`);
  assert(result.mappedFlow === "boundary_reply", `mappedFlow wrong: ${result.mappedFlow}`);
  assert(/JobMate ko kaam bhanda bahira/i.test(result.reply), `boundary reply missing: ${result.reply}`);
  replies.push(result.reply);
});

await test("salary nadine worker chahiyo gets risky reply", () => {
  const result = decide("salary nadine worker chahiyo");

  assert(result.action === "boundary", `action wrong: ${result.action}`);
  assert(result.mappedFlow === "boundary_reply", `mappedFlow wrong: ${result.mappedFlow}`);
  assert(/bina salary|free labor|fair salary/i.test(result.reply), `risky reply missing: ${result.reply}`);
  replies.push(result.reply);
});

await test("job guarantee huncha gets no guarantee support answer", () => {
  const result = decide("job guarantee huncha?");

  assert(result.action === "reply_only", `action wrong: ${result.action}`);
  assert(result.mappedFlow === "support_answer", `mappedFlow wrong: ${result.mappedFlow}`);
  assert(/guarantee dina sakdaina/i.test(result.reply), `no guarantee reply missing: ${result.reply}`);
  replies.push(result.reply);
});

await test("worker bata paisa lincha gets free worker support answer", () => {
  const result = decide("worker bata paisa lincha?");

  assert(result.action === "reply_only", `action wrong: ${result.action}`);
  assert(result.mappedFlow === "support_answer", `mappedFlow wrong: ${result.mappedFlow}`);
  assert(/free ho|registration fee linna/i.test(result.reply), `worker free reply missing: ${result.reply}`);
  replies.push(result.reply);
});

await test("active worker ask_availability numeric 1 is not intercepted", () => {
  const result = decide("1", {
    currentIntent: "worker_registration",
    currentState: "ask_availability",
    metadata: {
      activeFlow: "worker_registration",
      lastAskedField: "availability",
    },
  });

  assert(result.action === "continue_existing", `action wrong: ${result.action}`);
  assert(result.mappedFlow === "worker_registration", `mappedFlow wrong: ${result.mappedFlow}`);
  assert(result.preserveActiveFlow === true, "active worker flow not preserved");
  assert(!result.reply, `unexpected reply: ${result.reply}`);
});

await test("active employer ask_urgency numeric 1 is not intercepted", () => {
  const result = decide("1", {
    currentIntent: "employer_lead",
    currentState: "ask_urgency",
    metadata: {
      activeFlow: "employer_lead",
      qualificationStep: 4,
    },
  });

  assert(result.action === "continue_existing", `action wrong: ${result.action}`);
  assert(result.mappedFlow === "employer_lead", `mappedFlow wrong: ${result.mappedFlow}`);
  assert(result.preserveActiveFlow === true, "active employer flow not preserved");
  assert(!result.reply, `unexpected reply: ${result.reply}`);
});

await test("start/restart/menu is not handled by understanding layer", () => {
  for (const text of ["start", "restart", "menu"]) {
    const result = decide(text);
    assert(result.action === "continue_existing", `${text} action wrong: ${result.action}`);
    assert(result.reason === "start_restart_menu_source_of_truth", `${text} reason wrong: ${result.reason}`);
  }
});

await test("no reply contains AI/model/provider wording", () => {
  for (const reply of replies) {
    assert(!/\b(ai|model|provider|gemini|openai)\b/i.test(reply), `provider wording leaked: ${reply}`);
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

function decide(text, conversation = {}) {
  return decideUnderstandingAction({ text, conversation });
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
