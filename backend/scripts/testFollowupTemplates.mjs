import {
  buildFollowupMessage,
  FOLLOWUP_TEMPLATES,
} from "../src/services/followups/followupTemplates.js";

let failed = 0;

function assert(name, condition, details = "") {
  console.log(`\n${condition ? "✅" : "❌"} ${name}`);
  if (!condition) {
    failed += 1;
    if (details) console.log(details);
  }
}

function assertIncludes(name, text, expected) {
  assert(
    name,
    String(text || "").includes(expected),
    `Expected "${text}" to include "${expected}"`
  );
}

const workerMessage = buildFollowupMessage("worker_profile_thank_you", {
  name: "Ram",
  role: "Driver",
  location: "Bardaghat",
});

assertIncludes("worker profile includes name", workerMessage, "Ram");
assertIncludes("worker profile includes role", workerMessage, "Driver");
assertIncludes("worker profile includes location", workerMessage, "Bardaghat");
assertIncludes("worker profile mentions JobMate", workerMessage, "JobMate");

const employerMessage = buildFollowupMessage("employer_lead_thank_you", {
  businessName: "Naya Nepal Pustak Pasal",
});

assertIncludes(
  "employer followup includes business name",
  employerMessage,
  "Naya Nepal Pustak Pasal"
);

const applicationMessage = buildFollowupMessage("job_application_followup", {
  jobTitle: "Frontend Developer",
  companyName: "Tech Nepal",
});

assertIncludes("application followup includes job title", applicationMessage, "Frontend Developer");
assertIncludes("application followup includes company", applicationMessage, "Tech Nepal");

const staleMessage = buildFollowupMessage("stale_profile_check", {
  name: "Sita",
});

assertIncludes("stale profile includes name", staleMessage, "Sita");
assertIncludes("stale profile asks if still looking", staleMessage, "kaam khojdai");

const missingMessage = buildFollowupMessage("missing_template", {});
assert("missing template returns empty string", missingMessage === "");

const templateNames = Object.keys(FOLLOWUP_TEMPLATES);
assert("at least four followup templates exist", templateNames.length >= 4);

const forbiddenProviderPatterns = [
  ["Gemini", /\bgemini\b/i],
  ["OpenAI", /\bopenai\b/i],
  ["model", /\bmodel\b/i],
  ["AI", /\bai\b/i],
];

for (const name of templateNames) {
  const message = buildFollowupMessage(name, {});
  for (const [label, pattern] of forbiddenProviderPatterns) {
    assert(
      `${name} does not mention ${label}`,
      !pattern.test(message),
      message
    );
  }
}

console.log(`\nResult: ${failed === 0 ? "ALL PASSED" : `${failed} FAILED`}`);

if (failed > 0) {
  process.exit(1);
}
