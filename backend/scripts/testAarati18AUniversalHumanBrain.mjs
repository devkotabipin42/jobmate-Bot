/**
 * AARATI-18A — Universal Human Staff Brain + Lumbini Rule Firewall
 * Pure unit tests — no DB, no WhatsApp, no AI call.
 * Minimum 80 assertions.
 */

import {
  classifyAaratiMessage,
  shouldBypassAaratiFlow,
} from "../src/services/aarati/aaratiNoFlowTrapGate.service.js";

import {
  buildAaratiClassifiedReply,
} from "../src/services/aarati/aaratiHumanBoundaryReply.service.js";

let passed = 0;
let failed = 0;

function assert(label, condition, detail = "") {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

function section(title) {
  console.log(`\n── ${title} ──`);
}

function classify(text) {
  return classifyAaratiMessage({ text, conversation: { currentState: "idle", metadata: {} } });
}

function bypass(text) {
  return shouldBypassAaratiFlow({ category: classify(text) });
}

function reply(text, cat) {
  return buildAaratiClassifiedReply({ category: cat, text, conversation: {} });
}

// ============================================================
// A. FORBIDDEN EMPLOYER REQUEST (8 inputs)
// ============================================================
section("A. Forbidden employer requests");

const forbiddenCases = [
  "free ma kam garne worker cha",
  "salary nadine worker chaiyo",
  "trial ko paisa nadida hunxa",
  "bina paisa 1 month staff rakhna milcha",
  "age 16 ko helper chaiyo",
  "bachha helper cha",
  "bas khana diye kaam garne manche cha",
  "salary pachi heramla worker chaiyo",
];

for (const text of forbiddenCases) {
  const cat = classify(text);
  assert(`"${text.slice(0, 40)}" → forbidden_employer_request`, cat === "forbidden_employer_request", `got: ${cat}`);
  assert(`"${text.slice(0, 40)}" → bypass=true`, shouldBypassAaratiFlow({ category: cat }));
}

const forbiddenReply = reply("free ma kam garne worker cha", "forbidden_employer_request");
assert("forbidden reply contains 'legal'", /legal/i.test(forbiddenReply));
assert("forbidden reply contains no pricing plans", !/NPR 499|NPR 999|basic plan/i.test(forbiddenReply));
assert("forbidden reply asks for salary/role details", /salary range|role|business name/i.test(forbiddenReply));

// ============================================================
// B. OUT OF SCOPE SERVICE (8 inputs)
// ============================================================
section("B. Out of scope service requests");

const outOfScopeCases = [
  "can you make my website",
  "website banau na",
  "malai code garna help garna sakxau",
  "coding garna aauxa kinae",
  "can you write love letter",
  "girlfriend lai message lekhdinu",
  "poem lekhdinu",
  "assignment gardinu",
];

for (const text of outOfScopeCases) {
  const cat = classify(text);
  assert(`"${text.slice(0, 40)}" → out_of_scope_service`, cat === "out_of_scope_service", `got: ${cat}`);
  assert(`"${text.slice(0, 40)}" → bypass=true`, shouldBypassAaratiFlow({ category: cat }));
}

// "developer job chahiyo" must NOT be out_of_scope
assert(
  '"developer job chahiyo" → NOT out_of_scope_service',
  classify("developer job chahiyo") !== "out_of_scope_service",
  `got: ${classify("developer job chahiyo")}`
);

const websiteReply = reply("website banau", "out_of_scope_service");
assert("website reply mentions scope/JobMate service", /scope|service|JobMate/i.test(websiteReply));
assert("website reply does NOT say 'JobMate ma dherai job'", !/dherai job haru cha/i.test(websiteReply));

// ============================================================
// C. CV PRIVACY / SUPPORT (8 inputs)
// ============================================================
section("C. CV privacy and support");

const cvPrivacyCases = [
  "ma cv patauna dar lagxa",
  "cv pathauda safe huncha",
  "mero document misuse huncha",
  "citizenship pathauna parcha",
  "cv chaina job milcha",
  "cv banauxau",
  "document chaina",
  "malai privacy ko dar cha",
];

for (const text of cvPrivacyCases) {
  const cat = classify(text);
  assert(`"${text.slice(0, 40)}" → cv_privacy_support`, cat === "cv_privacy_support", `got: ${cat}`);
  assert(`"${text.slice(0, 40)}" → bypass=true`, shouldBypassAaratiFlow({ category: cat }));
}

const cvReply = reply("ma cv patauna dar lagxa", "cv_privacy_support");
assert("cv_privacy reply has privacy reassurance", /dar lagnu normal|compulsory chaina|optional/i.test(cvReply));
assert("cv_privacy reply no job type menu", !/1\. IT.*2\. Driver/i.test(cvReply));
assert("cv_privacy reply no Mapbox cue", !/mapbox|location.*api/i.test(cvReply));

// ============================================================
// D. FRUSTRATION OR INSULT (8 inputs)
// ============================================================
section("D. Frustration and insult");

const frustrationCases = [
  "kina bujdainau",
  "kati bhanne",
  "baulayo kia",
  "pagal ho",
  "ramro sanga answer deu",
  "yo bot ho kya",
  "timi useless",
  "bujhinas",
];

for (const text of frustrationCases) {
  const cat = classify(text);
  assert(`"${text.slice(0, 40)}" → frustration_or_insult`, cat === "frustration_or_insult", `got: ${cat}`);
  assert(`"${text.slice(0, 40)}" → bypass=true`, shouldBypassAaratiFlow({ category: cat }));
}

const frustReply = reply("kina bujdainau", "frustration_or_insult");
assert("frustration reply has apology", /sorry/i.test(frustReply));
assert("frustration reply has no location/Mapbox cue", !/mapbox|butwal.*choose|location.*api|district.*step/i.test(frustReply));
assert("frustration reply no generic full menu", !/1\. IT.*2\. Driver/i.test(frustReply));

// Repeated frustration gets human handoff suggestion
const frustReplyRepeated = buildAaratiClassifiedReply({
  category: "frustration_or_insult",
  text: "kina bujdainau",
  conversation: { currentState: "idle", metadata: { frustrationCount: 2 } },
});
assert("repeated frustration suggests human team", /human.*team|team lai connect/i.test(frustReplyRepeated));

// ============================================================
// E. IDENTITY / CAPABILITY (8 inputs)
// ============================================================
section("E. Identity and capability questions");

const identityCases = [
  "timro kam k ho",
  "timro kam kk ho",
  "what is your work in jobmate",
  "timi ko ho",
  "Aarati ko kaam k ho",
  "JobMate le k garxa",
  "timi staff ho",
  "can you help me",
];

for (const text of identityCases) {
  const cat = classify(text);
  assert(`"${text.slice(0, 40)}" → identity_capability`, cat === "identity_capability", `got: ${cat}`);
  assert(`"${text.slice(0, 40)}" → bypass=true`, shouldBypassAaratiFlow({ category: cat }));
}

const identityReply = reply("timi ko ho", "identity_capability");
assert("identity reply mentions Aarati/JobMate staff role", /aarati|jobmate team|staff/i.test(identityReply));
assert("identity reply mentions supported services", /job.*search|staff|cv|pricing|human team/i.test(identityReply));
assert("identity reply has no AI/model mention", !/\bai\b|gemini|openai|chatgpt|language model/i.test(identityReply));
assert("identity reply is not vague 'kehi chahiyo bhane'", !/kehi.*sahayata.*chahiyo bhane\?$/i.test(identityReply));

// ============================================================
// F. SMALL TALK BOUNDARY (8 inputs)
// ============================================================
section("F. Small talk boundary");

const smallTalkCases = [
  "khana khayau",
  "khana bbayo kinae",
  "k gardai chau",
  "how old are you aarati",
  "where do you live",
  "timro ghar kata",
  "married ho",
  "timi manxe ho",
];

for (const text of smallTalkCases) {
  const cat = classify(text);
  assert(`"${text.slice(0, 40)}" → small_talk_boundary`, cat === "small_talk_boundary", `got: ${cat}`);
  assert(`"${text.slice(0, 40)}" → bypass=true`, shouldBypassAaratiFlow({ category: cat }));
}

const smallTalkReply = reply("khana khayau", "small_talk_boundary");
assert("small talk reply no fake 'malai khana khane bela'", !/malai khana|khana khane bela/i.test(smallTalkReply));
assert("small talk reply bridges to JobMate", /job|staff|jobmate/i.test(smallTalkReply));

const ageReply = reply("how old are you aarati", "small_talk_boundary");
assert("age reply no fake personal age claim", !/ma \d+ barsha|mero age \d+|i am \d+/i.test(ageReply));

const locationReply = reply("timro ghar kata", "small_talk_boundary");
assert("location reply no fake home/address claim", !/mero ghar.*ma basta|kathmandu ma basta/i.test(locationReply));

// ============================================================
// G. RESPECT / TRUST (6 inputs)
// ============================================================
section("G. Respect and trust");

const respectCases = [
  "can you respect me",
  "malai respect gara",
  "ramro sanga bol",
  "rude nabana",
  "mero kura sunnu",
  "serious answer deu",
];

for (const text of respectCases) {
  const cat = classify(text);
  assert(`"${text.slice(0, 40)}" → respect_trust`, cat === "respect_trust", `got: ${cat}`);
}

const respectReply = reply("malai respect gara", "respect_trust");
assert("respect reply has warm apology", /sorry|samman/i.test(respectReply));
assert("respect reply no generic full menu spam", !/kaam khojdai.*ki staff khojdai/i.test(respectReply));

// ============================================================
// H. PRICING / SUPPORT (6 inputs)
// ============================================================
section("H. Pricing and support questions");

const pricingCases = [
  "JobMate le paisa magexa",
  "pricing kati ho",
  "employer plan kati",
  "job khojna paisa lagcha",
  "free plan cha",
  "premium kati ho",
];

for (const text of pricingCases) {
  const cat = classify(text);
  assert(`"${text.slice(0, 40)}" → pricing_support`, cat === "pricing_support", `got: ${cat}`);
}

// Free worker request must NOT show pricing
assert(
  '"free ma kam garne worker" NOT pricing',
  classify("free ma kam garne worker cha") !== "pricing_support",
  `got: ${classify("free ma kam garne worker cha")}`
);

const pricingReply = reply("pricing kati ho", "pricing_support");
assert("pricing reply has worker vs employer distinction", /job khojdai|job.*khojne|employer|staff khojne/i.test(pricingReply));
assert("pricing reply has plan info", /NPR|free|basic|premium/i.test(pricingReply));

// ============================================================
// I. VALID JOB SEARCH — Lumbini locations (6 inputs)
// ============================================================
section("I. Valid job search (Lumbini)");

const jobSearchCases = [
  { text: "Butwal ma driver job cha", loc: "butwal" },
  { text: "Bardaghat ma hotel ko kaam cha", loc: "bardaghat" },
  { text: "Bhairahawa ma receptionist job cha", loc: "bhairahawa" },
  { text: "Parasi ma security guard cha", loc: "parasi" },
  { text: "Sunwal ma cashier job cha", loc: "sunwal" },
  { text: "Devdaha ma helper kaam cha", loc: "devdaha" },
];

for (const { text } of jobSearchCases) {
  const cat = classify(text);
  assert(`"${text.slice(0, 40)}" → valid_job_search`, cat === "valid_job_search", `got: ${cat}`);
  assert(`"${text.slice(0, 40)}" → bypass=false (flow allowed)`, !shouldBypassAaratiFlow({ category: cat }));
}

const jobSearchReply = buildAaratiClassifiedReply({ category: "valid_job_search", text: "Butwal ma driver job cha", conversation: {} });
assert("valid_job_search → reply is null (flow continues)", jobSearchReply === null);

// ============================================================
// J. VALID EMPLOYER HIRING — legal requests (6 inputs)
// ============================================================
section("J. Valid employer hiring (legal)");

const employerCases = [
  "can you provide me staff",
  "malai staff chahiyo",
  "Butwal ma 2 jana waiter chahiyo",
  "hotel ko lagi cook chahiyo",
  "Bhairahawa ma driver chahiyo",
  "restaurant ko lagi helper chahiyo",
];

for (const text of employerCases) {
  const cat = classify(text);
  assert(
    `"${text.slice(0, 40)}" → flow allowed (employer/job)`,
    !shouldBypassAaratiFlow({ category: cat }),
    `got category: ${cat}`
  );
}

// First two are unambiguously valid_employer_hiring
assert(
  '"can you provide me staff" → valid_employer_hiring',
  classify("can you provide me staff") === "valid_employer_hiring"
);
assert(
  '"malai staff chahiyo" → valid_employer_hiring',
  classify("malai staff chahiyo") === "valid_employer_hiring"
);

const employerReply = buildAaratiClassifiedReply({ category: "valid_employer_hiring", text: "malai staff chahiyo", conversation: {} });
assert("valid_employer_hiring → reply is null (flow continues)", employerReply === null);

// ============================================================
// K. OUT OF REGION LOCATION (4 inputs)
// ============================================================
section("K. Out-of-region location");

const outOfRegionCases = [
  "Kathmandu ma job cha",
  "Pokhara ma driver job cha",
  "Chitwan ma staff chahiyo",
  "Dharan ma kaam cha",
];

for (const text of outOfRegionCases) {
  const cat = classify(text);
  assert(`"${text.slice(0, 40)}" → out_of_region_location`, cat === "out_of_region_location", `got: ${cat}`);
  assert(`"${text.slice(0, 40)}" → bypass=true`, shouldBypassAaratiFlow({ category: cat }));
}

const outRegionReply = reply("Kathmandu ma job cha", "out_of_region_location");
assert("out_of_region reply mentions Lumbini focus", /lumbini|butwal|bhairahawa|bardaghat/i.test(outRegionReply));
assert("out_of_region reply says no wrong job", /wrong job|confirm garera dekhaina/i.test(outRegionReply));

// ============================================================
// L. AMBIGUOUS / MIXED INTENT (6 inputs)
// ============================================================
section("L. Ambiguous and mixed intent");

// Ambiguous location
assert(
  '"mero area ma job cha" → ambiguous_location',
  classify("mero area ma job cha") === "ambiguous_location"
);
assert(
  '"najikai kaam cha" → ambiguous_location',
  classify("najikai kaam cha") === "ambiguous_location"
);

// Mixed intent — priority order
assert(
  '"staff chahiyo salary pachi heramla" → forbidden (safety first)',
  classify("staff chahiyo salary pachi heramla") === "forbidden_employer_request"
);
assert(
  '"Butwal driver job cha cv pathauna dar lagyo" → cv_privacy (before job search)',
  classify("Butwal driver job cha cv pathauna dar lagyo") === "cv_privacy_support"
);
assert(
  '"website banau ani staff pani khoj" → out_of_scope (before employer)',
  classify("website banau ani staff pani khoj") === "out_of_scope_service"
);
assert(
  '"Kathmandu ma job cha but Lumbini pani milcha" → out_of_region (kathmandu priority)',
  classify("Kathmandu ma job cha but Lumbini pani milcha") === "out_of_region_location"
);

// ============================================================
// M. GLOBAL SAFETY RULES — no fake claims, no AI mention
// ============================================================
section("M. Global safety: no fake personal claims, no AI mention in any reply");

const allBypassCategories = [
  "forbidden_employer_request",
  "out_of_scope_service",
  "cv_privacy_support",
  "frustration_or_insult",
  "identity_capability",
  "small_talk_boundary",
  "respect_trust",
  "pricing_support",
  "out_of_region_location",
  "ambiguous_location",
];

for (const cat of allBypassCategories) {
  const r = buildAaratiClassifiedReply({ category: cat, text: "test", conversation: {} });
  if (r) {
    assert(
      `"${cat}" reply has no AI/model mention`,
      !/\bai\b|gemini|openai|chatgpt|language model|gpt/i.test(r),
      r.slice(0, 80)
    );
    assert(
      `"${cat}" reply has no fake food/age/home claim`,
      !/malai khana khane|mero age \d+|mero ghar.*basta|i am \d+ years old/i.test(r),
      r.slice(0, 80)
    );
    assert(
      `"${cat}" reply is non-empty string`,
      typeof r === "string" && r.length > 10
    );
  }
}

// ============================================================
// N. shouldBypassAaratiFlow correctness
// ============================================================
section("N. shouldBypassAaratiFlow: flow vs bypass categories");

assert("valid_job_search → bypass=false", !shouldBypassAaratiFlow({ category: "valid_job_search" }));
assert("valid_employer_hiring → bypass=false", !shouldBypassAaratiFlow({ category: "valid_employer_hiring" }));
assert("valid_worker_registration → bypass=false", !shouldBypassAaratiFlow({ category: "valid_worker_registration" }));
assert("unknown → bypass=false", !shouldBypassAaratiFlow({ category: "unknown" }));
assert("forbidden_employer_request → bypass=true", shouldBypassAaratiFlow({ category: "forbidden_employer_request" }));
assert("out_of_scope_service → bypass=true", shouldBypassAaratiFlow({ category: "out_of_scope_service" }));
assert("cv_privacy_support → bypass=true", shouldBypassAaratiFlow({ category: "cv_privacy_support" }));
assert("frustration_or_insult → bypass=true", shouldBypassAaratiFlow({ category: "frustration_or_insult" }));
assert("identity_capability → bypass=true", shouldBypassAaratiFlow({ category: "identity_capability" }));
assert("small_talk_boundary → bypass=true", shouldBypassAaratiFlow({ category: "small_talk_boundary" }));
assert("respect_trust → bypass=true", shouldBypassAaratiFlow({ category: "respect_trust" }));
assert("pricing_support → bypass=true", shouldBypassAaratiFlow({ category: "pricing_support" }));
assert("out_of_region_location → bypass=true", shouldBypassAaratiFlow({ category: "out_of_region_location" }));
assert("ambiguous_location → bypass=true", shouldBypassAaratiFlow({ category: "ambiguous_location" }));

// ============================================================
// O. REGRESSION — existing allowed flows not blocked
// ============================================================
section("O. Regression: valid flows not blocked");

assert('"malai kaam chahiyo" → valid_worker_registration', classify("malai kaam chahiyo") === "valid_worker_registration");
assert('"job khojdai chu" → valid_worker_registration', classify("job khojdai chu") === "valid_worker_registration");
assert('"malai staff chahiyo" → valid_employer_hiring', classify("malai staff chahiyo") === "valid_employer_hiring");
assert('"Butwal ma driver job cha" → valid_job_search', classify("Butwal ma driver job cha") === "valid_job_search");
assert('"Parasi ma security guard cha" → valid_job_search', classify("Parasi ma security guard cha") === "valid_job_search");

// ============================================================
// Summary
// ============================================================
console.log(`\n${"═".repeat(50)}`);
console.log(`AARATI-18A Tests: ${passed} passed, ${failed} failed`);
console.log(`${"═".repeat(50)}`);

if (failed > 0) process.exit(1);
