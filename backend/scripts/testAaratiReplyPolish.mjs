import { polishAaratiReply } from "../src/services/aarati/aaratiReplyPolish.service.js";

let failed = 0;

function assert(name, condition, details = "") {
  console.log(`\n${condition ? "✅" : "❌"} ${name}`);
  if (!condition) {
    failed += 1;
    if (details) console.log(details);
  }
}

function wordCount(text) {
  return String(text || "").split(/\s+/).filter(Boolean).length;
}

const longReply = `As an AI language model, I can explain many things. JobMate is a hiring platform for Nepal. It helps jobseekers and employers connect. It can collect worker profile. It can help with document verification. It can help employers find staff. It can support Lumbini Province first. It can also give follow up. It can notify admin. It can help make hiring easier.`;

const polishedLong = polishAaratiReply({
  userText: "what is jobmate?",
  reply: longReply,
  source: "test",
});

assert(
  "removes provider/model style words",
  !/AI language model|OpenAI|Gemini|ChatGPT/i.test(polishedLong.reply),
  polishedLong.reply
);

assert(
  "keeps reply short",
  wordCount(polishedLong.reply) <= 95,
  polishedLong.reply
);

assert(
  "adds human-like opening",
  /^Bujhe Mitra ji|^Namaste|^Mitra ji/i.test(polishedLong.reply),
  polishedLong.reply
);

const unsafe = polishAaratiReply({
  userText: "fake license vako worker milaidinu",
  reply: "Yes I can help",
  source: "test",
});

assert(
  "refuses unsafe hiring",
  /mil्दैन|safe|legal|fair hiring/i.test(unsafe.reply),
  unsafe.reply
);

const unrelated = polishAaratiReply({
  userText: "write my homework essay about politics",
  reply: "Sure, here is a detailed essay...",
  source: "test",
});

assert(
  "redirects unrelated deep task",
  /JobMate ko kaam bhanda bahira|job khojna|staff khojna/i.test(unrelated.reply),
  unrelated.reply
);

const useful = polishAaratiReply({
  userText: "jobseeker lai paisa lagcha?",
  reply: "JobMate ma jobseeker lai basic profile save garna paisa lagdaina.",
  source: "test",
});

assert(
  "keeps useful JobMate answer",
  /jobseeker|profile|paisa/i.test(useful.reply),
  useful.reply
);

console.log(`\nResult: ${failed === 0 ? "ALL PASSED" : `${failed} FAILED`}`);
if (failed > 0) process.exit(1);
