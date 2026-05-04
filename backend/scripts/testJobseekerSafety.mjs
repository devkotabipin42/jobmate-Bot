import {
  filterSafeJobMatches,
  isSameLocationSafe,
  isSameCategorySafe,
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
  "driver category does not match frontend job",
  isSameCategorySafe(
    { title: "Frontend Developer", category: "IT/Tech", description: "React coding" },
    "Driver/Transport"
  ),
  false
);

assertEqual(
  "IT category matches frontend job",
  isSameCategorySafe(
    { title: "Frontend Developer", category: "IT/Tech", description: "React coding" },
    "IT/Tech"
  ),
  true
);

assertEqual(
  "filter only verified active same-location same-category jobs",
  filterSafeJobMatches({
    requestedLocation: "Butwal",
    requestedJobType: "Driver/Transport",
    jobs: [
      { title: "Frontend", category: "IT/Tech", location: "Butwal", is_verified: true, is_active: true },
      { title: "Driver", category: "Driver/Transport", location: "Butwal", is_verified: true, is_active: true },
      { title: "Driver", category: "Driver/Transport", location: "Bardaghat", is_verified: true, is_active: true },
      { title: "Cook", category: "Hospitality", location: "Butwal", is_verified: false, is_active: true },
      { title: "Waiter", category: "Hospitality", location: "Butwal", is_verified: true, is_active: false },
    ],
  }).map((job) => job.title),
  ["Driver"]
);

console.log(`\nResult: ${failed === 0 ? "ALL PASSED" : `${failed} FAILED`}`);

if (failed > 0) {
  process.exit(1);
}
