import { getAaratiHumanBoundaryAnswer } from "../src/services/aarati/aaratiHumanBoundary.service.js";

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

const weather = getAaratiHumanBoundaryAnswer({
  normalized: normalized("aaja ko weather kasto cha"),
  conversation: idle,
});
assert("weather gets boundary answer", /live weather|weather update/i.test(weather?.reply), weather?.reply);

const identity = getAaratiHumanBoundaryAnswer({
  normalized: normalized("timi ko hau"),
  conversation: idle,
});
assert("identity gets Aarati answer", /Aarati|JobMate team/i.test(identity?.reply), identity?.reply);

const smallTalk = getAaratiHumanBoundaryAnswer({
  normalized: normalized("khana bhayo"),
  conversation: idle,
});
assert("small talk gets human answer", /Mitra ji|Aarati/i.test(smallTalk?.reply), smallTalk?.reply);

const math = getAaratiHumanBoundaryAnswer({
  normalized: normalized("2+2 kati hunxa"),
  conversation: idle,
});
assert("math redirects not solves", /JobMate ko kaam bhanda bahira/i.test(math?.reply) && !/4/.test(math?.reply), math?.reply);

const angry = getAaratiHumanBoundaryAnswer({
  normalized: normalized("are you mad"),
  conversation: idle,
});
assert("frustration apologizes", /Sorry|ramro bhayena|sidha answer/i.test(angry?.reply), angry?.reply);
assert("frustration marks intent", angry?.intent === "frustrated", angry?.intent);

const jobSearch = getAaratiHumanBoundaryAnswer({
  normalized: normalized("Butwal ma driver job cha?"),
  conversation: idle,
});
assert("job search does not get intercepted", jobSearch === null, JSON.stringify(jobSearch));

const activeSmallTalk = getAaratiHumanBoundaryAnswer({
  normalized: normalized("khana bhayo"),
  conversation: { currentState: "ask_documents", metadata: { lastAskedField: "documents" } },
});
assert("active flow small talk does not interrupt", activeSmallTalk === null, JSON.stringify(activeSmallTalk));

console.log(`\nResult: ${failed === 0 ? "ALL PASSED" : `${failed} FAILED`}`);
if (failed > 0) process.exit(1);
