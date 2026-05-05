import {
  normalizeAaratiText,
  isAaratiSmallTalkText,
  isAaratiEmployerRequestText,
  isAaratiUnsafeIllegalText,
  isAaratiPersonalMoneyText,
} from "../src/services/aarati/aaratiTextNormalizer.service.js";
import { getAaratiActiveFlowSideReply } from "../src/services/aarati/aaratiActiveFlowSideReply.service.js";
import { getAaratiEmployerDirectRoute } from "../src/services/aarati/aaratiEmployerDirectRouter.service.js";
import { reduceRepeatedAaratiReply } from "../src/services/aarati/aaratiRepetitionGuard.service.js";

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

assert(
  "normalizes k h to k ho",
  normalizeAaratiText("jobmate k h").includes("jobmate k ho"),
  normalizeAaratiText("jobmate k h")
);

assert(
  "detects typo small talk",
  isAaratiSmallTalkText("ok khana kanu bhayo"),
  "not detected"
);

assert(
  "detects personal money request",
  isAaratiPersonalMoneyText("malai paisa chayako tgeo"),
  "not detected"
);

assert(
  "detects unsafe typo",
  isAaratiUnsafeIllegalText("manav tarkar garna sakinxa"),
  "not detected"
);

assert(
  "detects employer request",
  isAaratiEmployerRequestText("can you provide me a staff"),
  "not detected"
);

const activeDoc = getAaratiActiveFlowSideReply({
  text: "khana khanu bhayo",
  conversation: { currentState: "ask_documents", metadata: { lastAskedField: "documents" } },
});

assert(
  "active flow side reply keeps document step",
  /document step|Document bina profile save garna 2/i.test(activeDoc),
  activeDoc
);

const employerRoute = getAaratiEmployerDirectRoute({
  normalized: normalized("can you provide me a staff"),
  conversation: { currentState: "idle", metadata: {} },
});

assert(
  "employer direct route returns employer_lead",
  employerRoute?.intent === "employer_lead",
  JSON.stringify(employerRoute)
);

const repeated = reduceRepeatedAaratiReply({
  reply: 'Hunchha 🙏 Tapai lai kun kura ma sahayog chahiyeko ho? Kaam khojna ho ki staff/worker khojna ho? Sajilo ko lagi yesto lekhna saknuhunchha: - "malai kaam chahiyo" - "malai staff chahiyo"',
  conversation: {
    metadata: {
      lastAaratiReply: 'Hunchha 🙏 Tapai lai kun kura ma sahayog chahiyeko ho? Kaam khojna ho ki staff/worker khojna ho? Sajilo ko lagi yesto lekhna saknuhunchha: - "malai kaam chahiyo" - "malai staff chahiyo"',
    },
  },
});

assert(
  "repetition guard changes repeated menu",
  /repeat nagari sidha help/i.test(repeated),
  repeated
);

console.log(`\nResult: ${failed === 0 ? "ALL PASSED" : `${failed} FAILED`}`);
if (failed > 0) process.exit(1);
