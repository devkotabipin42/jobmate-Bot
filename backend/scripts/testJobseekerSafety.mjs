import {
  filterSafeJobMatches,
  isSameLocationSafe,
} from "../src/services/jobmate/jobSearchSafety.service.js";

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

assertEqual(
  "same location Butwal matches Butwal",
  isSameLocationSafe("Butwal", "Butwal"),
  true
);

assertEqual(
  "Bardaghat does not match Butwal",
  isSameLocationSafe("Bardaghat", "Butwal"),
  false
);

assertEqual(
  "filter only verified active same-location jobs",
  filterSafeJobMatches({
    requestedLocation: "Butwal",
    jobs: [
      { title: "Frontend", location: "Butwal", is_verified: true, is_active: true },
      { title: "Driver", location: "Bardaghat", is_verified: true, is_active: true },
      { title: "Cook", location: "Butwal", is_verified: false, is_active: true },
      { title: "Waiter", location: "Butwal", is_verified: true, is_active: false },
    ],
  }).map((job) => job.title),
  ["Frontend"]
);

console.log(`\nResult: ${failed === 0 ? "ALL PASSED" : `${failed} FAILED`}`);

if (failed > 0) {
  process.exit(1);
}
