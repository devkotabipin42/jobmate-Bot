import { getAaratiHumanIntentFormattedAnswer } from "../src/services/aarati/aaratiHumanIntentFormatter.service.js";

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

const weather = getAaratiHumanIntentFormattedAnswer({
  normalized: normalized("aaja ko weather kasto cha"),
  conversation: idle,
});
assert("weather gets formatted answer", weather?.detectedIntent === "weather", JSON.stringify(weather));
assert("weather does not say generic menu only", /live weather update herna sakdina/i.test(weather?.reply), weather?.reply);

const math = getAaratiHumanIntentFormattedAnswer({
  normalized: normalized("2+2 kati hunxa"),
  conversation: idle,
});
assert("math gets out-of-scope", math?.intent === "out_of_scope", JSON.stringify(math));
assert("math does not solve with 4", !/\b4\b/.test(math?.reply || ""), math?.reply);

const identity = getAaratiHumanIntentFormattedAnswer({
  normalized: normalized("timi ko hau"),
  conversation: idle,
});
assert("identity gets Aarati answer", /Aarati ho|JobMate team/i.test(identity?.reply), identity?.reply);

const guarantee = getAaratiHumanIntentFormattedAnswer({
  normalized: normalized("job guarantee dinchau?"),
  conversation: idle,
});
assert("job guarantee no fake guarantee", /guarantee gardaina/i.test(guarantee?.reply), guarantee?.reply);

const doc = getAaratiHumanIntentFormattedAnswer({
  normalized: normalized("document safe cha?"),
  conversation: idle,
});
assert("document privacy gets formatted answer", /Document compulsory haina|verification/i.test(doc?.reply), doc?.reply);

const unknown = getAaratiHumanIntentFormattedAnswer({
  normalized: normalized("yo system kati trust garna milcha?"),
  conversation: idle,
});
assert("safe unknown question gets bounded answer", /exact answer confirm garna sakdina|JobMate bhitra/i.test(unknown?.reply), unknown?.reply);

const active = getAaratiHumanIntentFormattedAnswer({
  normalized: normalized("document safe cha?"),
  conversation: { currentState: "ask_documents", metadata: { lastAskedField: "documents" } },
});
assert("active flow not intercepted", active === null, JSON.stringify(active));

const jobSearch = getAaratiHumanIntentFormattedAnswer({
  normalized: normalized("Butwal ma driver job cha?"),
  conversation: idle,
});
assert("job search not intercepted", jobSearch === null, JSON.stringify(jobSearch));

console.log(`\nResult: ${failed === 0 ? "ALL PASSED" : `${failed} FAILED`}`);
if (failed > 0) process.exit(1);
