import { getAaratiPreFlowQaAnswer } from "../src/services/aarati/aaratiPreFlowQaGuard.service.js";

let failed = 0;

function assert(name, condition, details = "") {
  console.log(`\n${condition ? "✅" : "❌"} ${name}`);
  if (!condition) {
    failed += 1;
    if (details) console.log(details);
  }
}

function normalized(text) {
  return { message: { text, normalizedText: text.toLowerCase() } };
}

const idle = { currentState: "idle", metadata: {} };

const tests = [
  ["do you remember me", "memory", /personal memory|conversation/i],
  ["can you call me", "call_request", /Phone call|call/i],
  ["can i talk woth your manager", "manager_request", /Manager|team/i],
  ["are you real person", "identity_real", /Aarati|WhatsApp sahayogi/i],
  ["can i choose salary my self", "salary_choice", /salary expectation|guarantee gardaina/i],
  ["how fast can i get job", "job_timeline", /Job kati chito|guarantee gardaina/i],
  ["interview kasari hunxa", "interview_process", /Interview process/i],
  ["can you make my cv", "cv_help", /CV|profile detail/i],
  ["document nabhako worker milcha", "no_document", /Document nabhaye pani|profile save/i],
];

for (const [message, expectedIntent, expectedPattern] of tests) {
  const result = getAaratiPreFlowQaAnswer({
    normalized: normalized(message),
    conversation: idle,
  });

  assert(
    `${message} -> ${expectedIntent}`,
    result?.detectedIntent === expectedIntent && expectedPattern.test(result?.reply || ""),
    JSON.stringify(result)
  );
}

const jobFlow = getAaratiPreFlowQaAnswer({
  normalized: normalized("Butwal ma driver job cha?"),
  conversation: idle,
});

assert("job search not intercepted", jobFlow === null, JSON.stringify(jobFlow));

const employerFlow = getAaratiPreFlowQaAnswer({
  normalized: normalized("can you provide me staff"),
  conversation: idle,
});

assert("employer request not intercepted", employerFlow === null, JSON.stringify(employerFlow));

const active = getAaratiPreFlowQaAnswer({
  normalized: normalized("can you make my cv"),
  conversation: { currentState: "ask_documents", metadata: { lastAskedField: "documents" } },
});

assert("active flow not intercepted", active === null, JSON.stringify(active));

console.log(`\nResult: ${failed === 0 ? "ALL PASSED" : `${failed} FAILED`}`);
if (failed > 0) process.exit(1);
