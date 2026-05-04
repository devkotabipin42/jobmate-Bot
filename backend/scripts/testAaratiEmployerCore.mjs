import {
  parseHiringNeeds,
  formatHiringNeedsSummary,
} from "../src/services/rag/hiringNeedParser.service.js";

import {
  buildEmployerLeadSummary,
} from "../src/services/automation/employer/employerLeadSummary.service.js";

import {
  parseLocation,
  parseUrgency,
  isUsefulVacancy,
  isUsefulLocation,
} from "../src/services/automation/employer/employerLeadMapper.service.js";

import {
  applyJobMateRoutingGuards,
} from "../src/services/automation/jobmateRoutingGuards.service.js";

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

function rolePairs(needs) {
  return needs
    .map((need) => [need.role, Number(need.quantity || 1)])
    .sort((a, b) => a[0].localeCompare(b[0]));
}

// 1. Multi-role parsing
assertEqual(
  "multi-role: marketing + cooking + driver + seller",
  rolePairs(parseHiringNeeds("malai 5 jana ma 1 jana marketing 2 jana cooking helpers ani 1 jna driver 1 jana selling garne")),
  [
    ["driver", 1],
    ["kitchen_staff", 2],
    ["marketing_staff", 1],
    ["shopkeeper", 1],
  ]
);

assertEqual(
  "multi-role: driver + helper + frontend",
  rolePairs(parseHiringNeeds("malsi 1 jana driver 2 jana helper 3 jana frontend developer")),
  [
    ["driver", 1],
    ["frontend_developer", 3],
    ["helper_staff", 2],
  ]
);

assertEqual(
  "multi-role: marketing + waiter + drivers",
  rolePairs(parseHiringNeeds("malai 1 jana marketing 2 jana waiter 3 Jana drivers")),
  [
    ["driver", 3],
    ["marketing_staff", 1],
    ["waiter", 2],
  ]
);

// 2. Summary formatting
const summary = buildEmployerLeadSummary({
  hiringNeeds: [
    { role: "marketing_staff", quantity: 1 },
    { role: "kitchen_staff", quantity: 2 },
    { role: "driver", quantity: 1 },
    { role: "shopkeeper", quantity: 1 },
  ],
  location: { area: "Butwal", district: "Rupandehi" },
  urgency: { urgency: "within_2_weeks", urgencyLevel: "high" },
});

assertEqual(
  "summary includes clean labels",
  summary,
  `✅ Staff:
- 1 jana Marketing Staff
- 2 jana Kitchen Staff
- 1 jana Driver
- 1 jana Shopkeeper
✅ Location: Butwal, Rupandehi
✅ Urgency: within_2_weeks
✅ Priority: high`
);

// 3. Mapper checks
assertEqual(
  "parseLocation Butwal",
  parseLocation("mero business butwal ma chha"),
  { area: "Butwal", district: "Rupandehi" }
);

assertEqual(
  "parseUrgency 2",
  parseUrgency("2"),
  { urgency: "within_2_weeks", urgencyLevel: "high", scoreAdd: 15 }
);

assertEqual(
  "useful vacancy driver",
  isUsefulVacancy({ role: "driver", quantity: 2 }),
  true
);

assertEqual(
  "generic helper not useful vacancy",
  isUsefulVacancy({ role: "helper", quantity: 2 }),
  false
);

assertEqual(
  "useful location Butwal",
  isUsefulLocation({ area: "Butwal", district: "Rupandehi" }),
  true
);

assertEqual(
  "district-only location not useful",
  isUsefulLocation({ area: "Rupandehi", district: "Rupandehi" }),
  false
);

// 4. Routing guard checks
const helpIntent = { intent: "human_handoff", needsHuman: true, priority: "high" };
applyJobMateRoutingGuards({
  intentResult: helpIntent,
  aiBrain: { intentResult: helpIntent },
  conversation: { currentState: "idle" },
  normalized: { message: { normalizedText: "malai aauta help chaiyo" } },
  env: { BOT_MODE: "jobmate_hiring" },
});

assertEqual(
  "generic help becomes unknown",
  helpIntent.intent,
  "unknown"
);

const employerIntent = { intent: "job_search", needsHuman: false, priority: "low" };
applyJobMateRoutingGuards({
  intentResult: employerIntent,
  aiBrain: { intentResult: employerIntent },
  conversation: { currentState: "ask_location" },
  normalized: { message: { normalizedText: "butwal" } },
  env: { BOT_MODE: "jobmate_hiring" },
});

assertEqual(
  "active employer state locks routing",
  employerIntent.intent,
  "employer_lead"
);


const jobSearchIntent = { intent: "worker_registration", needsHuman: false, priority: "low" };
applyJobMateRoutingGuards({
  intentResult: jobSearchIntent,
  aiBrain: { intentResult: jobSearchIntent },
  conversation: { currentState: "idle" },
  normalized: { message: { normalizedText: "butwal ma job chaiyo" } },
  env: { BOT_MODE: "jobmate_hiring" },
});

assertEqual(
  "location job chaiyo becomes job_search",
  jobSearchIntent.intent,
  "job_search"
);


console.log(`\nResult: ${failed === 0 ? "ALL PASSED" : `${failed} FAILED`}`);

if (failed > 0) {
  process.exit(1);
}
