import { getAaratiHumanBoundaryAnswer } from "../src/services/aarati/aaratiHumanBoundary.service.js";
import { getAaratiHumanIntentFormattedAnswer } from "../src/services/aarati/aaratiHumanIntentFormatter.service.js";
import { findJobMateKnowledgeAnswer } from "../src/services/rag/jobmateKnowledgeAnswer.service.js";

let failed = 0;

function normalized(text) {
  return { message: { text, normalizedText: text.toLowerCase() } };
}

function assert(name, condition, details = "") {
  console.log(`\n${condition ? "✅" : "❌"} ${name}`);
  if (!condition) {
    failed += 1;
    if (details) console.log(details);
  }
}

const idle = { currentState: "idle", metadata: {} };

const typoSmallTalk = getAaratiHumanBoundaryAnswer({
  normalized: normalized("ok khana kanu bhayo"),
  conversation: idle,
});
assert("typo small talk handled", /Aarati|Mitra ji|thik/i.test(typoSmallTalk?.reply), typoSmallTalk?.reply);

const abuse = getAaratiHumanBoundaryAnswer({
  normalized: normalized("you bitch"),
  conversation: idle,
});
assert("abuse gets apology boundary", /Sorry Mitra ji|sidha answer/i.test(abuse?.reply), abuse?.reply);

const bribe = getAaratiHumanBoundaryAnswer({
  normalized: normalized("ani ghus kanxau kinae"),
  conversation: idle,
});
assert("bribe/frustration gets apology", /Sorry Mitra ji|sidha answer/i.test(bribe?.reply), bribe?.reply);

const moneyKnowledge = findJobMateKnowledgeAnswer({
  normalized: normalized("malai paisa chayako tgeo"),
});
assert("personal money does not trigger pricing knowledge", moneyKnowledge === null, JSON.stringify(moneyKnowledge));

const moneyFormatter = getAaratiHumanIntentFormattedAnswer({
  normalized: normalized("malai paisa chayako tgeo"),
  conversation: idle,
});
assert("personal money gets bounded formatter", /loan\/paisa dine service haina|income\/kaam/i.test(moneyFormatter?.reply), moneyFormatter?.reply);

const unsafe = getAaratiHumanBoundaryAnswer({
  normalized: normalized("manav tarkar garna sakinxa"),
  conversation: idle,
});
assert("trafficking typo refused", /mil्दैन|legal|safe|voluntary/i.test(unsafe?.reply), unsafe?.reply);

console.log(`\nResult: ${failed === 0 ? "ALL PASSED" : `${failed} FAILED`}`);
if (failed > 0) process.exit(1);
