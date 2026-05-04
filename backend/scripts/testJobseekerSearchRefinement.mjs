import { jobmateConfig } from "../src/configs/jobmate.config.js";

let failed = 0;

function assert(name, condition, details = {}) {
  console.log(`\n${condition ? "✅" : "❌"} ${name}`);
  if (!condition) {
    failed += 1;
    console.log(details);
  }
}

const extracted = await jobmateConfig.extractor({
  text: "butwl ma job cha",
  profile: {},
});

assert("butwl resolves to Butwal", extracted.location === "Butwal", extracted);

const step = await jobmateConfig.searchStep(
  {
    ...extracted,
    location: "Butwal",
    district: "Rupandehi",
    isInsideLumbini: true,
    isOutsideLumbini: false,
    jobSearchDone: false,
  },
  "butwl ma job cha"
);

assert("location-only search asks category first", step?.lastAskedField === "jobType", step);
assert("category message mentions sector", /sector|type/i.test(step?.messageToSend || ""), step);

const parsedJobType = jobmateConfig.requiredFields
  .find((field) => field.key === "jobType")
  .parse("1", {});

assert("category option 1 maps to IT/Tech", parsedJobType === "IT/Tech", { parsedJobType });

console.log(`\nResult: ${failed === 0 ? "ALL PASSED" : `${failed} FAILED`}`);

if (failed > 0) process.exit(1);
