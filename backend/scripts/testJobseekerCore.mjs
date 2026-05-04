import {
  findLocation,
} from "../src/services/rag/jobmateKnowledge.service.js";

function assertEqual(name, actual, expected) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);

  console.log(`\n${pass ? "✅" : "❌"} ${name}`);

  if (!pass) {
    console.log("Expected:", expected);
    console.log("Actual:", actual);
    process.exitCode = 1;
  }
}

function safeJobFilter({ jobs = [], requestedLocation = "" } = {}) {
  const requested = String(requestedLocation || "").toLowerCase().trim();

  return jobs.filter((job) => {
    const jobLocation = String(job.location || "").toLowerCase().trim();

    if (job.is_active === false) return false;
    if (job.is_verified === false) return false;

    if (!requested || !jobLocation) return false;

    return jobLocation.includes(requested) || requested.includes(jobLocation);
  });
}

assertEqual(
  "location typo butwl resolves to Butwal",
  (() => {
    const loc = findLocation("butwl ma kaam cha");
    return {
      canonical: loc.canonical,
      district: loc.district,
      inside: loc.isInsideLumbini,
    };
  })(),
  {
    canonical: "Butwal",
    district: "Rupandehi",
    inside: true,
  }
);

assertEqual(
  "location bhardghat resolves to Bardaghat",
  (() => {
    const loc = findLocation("bhardghat ma driver kaam cha");
    return {
      canonical: loc.canonical,
      district: loc.district,
      inside: loc.isInsideLumbini,
    };
  })(),
  {
    canonical: "Bardaghat",
    district: "Nawalparasi West",
    inside: true,
  }
);

assertEqual(
  "strict job filter only keeps same location verified active",
  safeJobFilter({
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

console.log("\nJobseeker core tests completed.");
