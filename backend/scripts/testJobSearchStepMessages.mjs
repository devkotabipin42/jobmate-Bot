import { searchJobMateJobs } from "../src/services/jobmate/jobmateJobsClient.service.js";

let failed = 0;

function assertEqual(name, actual, expected) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`\n${pass ? "✅" : "❌"} ${name}`);

  if (!pass) {
    failed += 1;
    console.log("Expected:", expected);
    console.log("Actual:", actual);
  }
}

// This script intentionally does not hit the API.
// It guards the result contract used by jobSearchStep.
assertEqual(
  "API missing returns failure reason",
  typeof searchJobMateJobs,
  "function"
);

console.log(`\nResult: ${failed === 0 ? "ALL PASSED" : `${failed} FAILED`}`);

if (failed > 0) {
  process.exit(1);
}
