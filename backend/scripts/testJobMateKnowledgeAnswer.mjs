import { findJobMateKnowledgeAnswer } from "../src/services/rag/jobmateKnowledgeAnswer.service.js";

let failed = 0;

function assert(name, condition, details = "") {
  console.log(`\n${condition ? "✅" : "❌"} ${name}`);

  if (!condition) {
    failed += 1;
    if (details) console.log(details);
  }
}

function ask(text) {
  return findJobMateKnowledgeAnswer({
    normalized: {
      message: { text, normalizedText: text.toLowerCase() },
    },
  });
}

const about = ask("JobMate ke ho?");
assert("answers about JobMate", about?.answer?.includes("AI-powered verified job platform"), about?.answer);

const spacedAbout = ask("job mate k ho?");
assert("answers spaced job mate k ho", spacedAbout?.answer?.includes("AI-powered verified job platform"), spacedAbout?.answer);

const howWorks = ask("kasari kam garxa asle?");
assert("answers how JobMate works", howWorks?.answer?.includes("verified jobs") || howWorks?.answer?.includes("connect"), howWorks?.answer);

const pricing = ask("employer ko price kati ho?");
assert("answers pricing", pricing?.answer?.includes("NPR 499") && pricing?.answer?.includes("NPR 999"), pricing?.answer);

const free = ask("jobseeker lai paisa lagcha?");
assert("answers jobseeker free", free?.answer?.includes("free"), free?.answer);

const privacy = ask("document safe cha?");
assert("answers document privacy", privacy?.answer?.includes("compulsory haina"), privacy?.answer);

const normal = ask("butwal ma job chaiyo");
assert("does not intercept job search", normal === null, JSON.stringify(normal));

console.log(`\nResult: ${failed === 0 ? "ALL PASSED" : `${failed} FAILED`}`);

if (failed > 0) process.exit(1);
