import {
  normalizeAaratiText,
  isAaratiUnsafeIllegalText,
  isAaratiFrustrationText,
  isAaratiMathHomeworkText,
} from "../src/services/aarati/aaratiTextNormalizer.service.js";
import { getAaratiHardSafetyBoundaryAnswer } from "../src/services/aarati/aaratiHardSafetyBoundary.service.js";
import { getAaratiEmployerDirectRoute } from "../src/services/aarati/aaratiEmployerDirectRouter.service.js";

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

assert(
  "normalizes arw typo to are",
  normalizeAaratiText("arw you mad").includes("are you mad"),
  normalizeAaratiText("arw you mad")
);

assert(
  "detects arw you mad as frustration",
  isAaratiFrustrationText("arw you mad"),
  "not detected"
);

const typoAngry = getAaratiHardSafetyBoundaryAnswer({
  normalized: normalized("arw you mad"),
});

assert(
  "hard boundary handles typo anger",
  typoAngry?.intent === "frustrated" && /Sorry Mitra ji/i.test(typoAngry.reply),
  JSON.stringify(typoAngry)
);

assert(
  "detects child worker unsafe",
  isAaratiUnsafeIllegalText("child worker chaiyo"),
  "not detected"
);

const childWorker = getAaratiHardSafetyBoundaryAnswer({
  normalized: normalized("child worker chaiyo"),
});

assert(
  "hard boundary refuses child worker",
  /legal, safe|voluntary|mil्दैन/i.test(childWorker?.reply),
  childWorker?.reply
);

const childEmployerRoute = getAaratiEmployerDirectRoute({
  normalized: normalized("child worker chaiyo"),
  conversation: idle,
});

assert(
  "child worker does not route employer lead",
  childEmployerRoute === null,
  JSON.stringify(childEmployerRoute)
);

assert(
  "detects salary nadine unsafe",
  isAaratiUnsafeIllegalText("salary nadine worker chaiyo"),
  "not detected"
);

const noSalary = getAaratiHardSafetyBoundaryAnswer({
  normalized: normalized("salary nadine worker chaiyo"),
});

assert(
  "hard boundary refuses no-salary worker",
  /legal, safe|voluntary|mil्दैन/i.test(noSalary?.reply),
  noSalary?.reply
);

assert(
  "salary range is not math homework",
  isAaratiMathHomeworkText("14000-15000") === false,
  "salary range treated as math"
);

assert(
  "real math still detected",
  isAaratiMathHomeworkText("2+2 kati hunxa") === true,
  "real math not detected"
);

console.log(`\nResult: ${failed === 0 ? "ALL PASSED" : `${failed} FAILED`}`);
if (failed > 0) process.exit(1);
