import express from "express";
import jobmateLeadAgentRoutes from "../src/routes/jobmateLeadAgent.routes.js";
import {
  findReplyPolicyIssues,
} from "../src/services/jobmateLeadAgent/replyFormatter.service.js";

const cases = [
  {
    n: 72,
    message: "mero citizenship employer lai pathaune ho?",
    expectedIntent: ["document_privacy", "document_privacy_refusal"],
    expectedReply: [/citizenship|personal document/i, /consent bina/i, /employer lai/i],
  },
  {
    n: 73,
    message: "ma cv pathauna dar lagyo",
    expectedIntent: ["document_privacy"],
    expectedReply: [/optional/i, /job matching\/verification/i, /mass share/i, /human team verify/i],
  },
  {
    n: 75,
    message: "gemini use garchau?",
    expectedIntent: ["identity"],
    expectedReply: [/Ma Aarati/i, /JobMate team ko digital sahayogi/i],
  },
];

const app = express();
app.use(express.json());
app.use("/api/jobmate-lead-agent", jobmateLeadAgentRoutes);

let failed = 0;

const server = app.listen(0, "127.0.0.1", async () => {
  const { port } = server.address();
  const endpoint = `http://127.0.0.1:${port}/api/jobmate-lead-agent/message`;

  try {
    const rows = [];
    const failures = [];

    for (const item of cases) {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          phone: `mega-final-${item.n}`,
          displayName: "Mitra",
          message: item.message,
        }),
      });

      const json = await response.json();
      const row = {
        "#": item.n,
        message: item.message,
        intent: json.intent || null,
        "leadDraft.type": json.leadDraft?.type || null,
        "taskDraft.type": json.taskDraft?.type || null,
        nextAction: resolveNextAction(json),
        usedGemini: Boolean(json.usedGemini),
        reply: json.reply || "",
      };
      rows.push(row);

      const rowFailures = validateRow(item, row);
      failures.push(...rowFailures);
    }

    failed = failures.length;

    console.table(
      rows.map((row) => ({
        "#": row["#"],
        message: row.message,
        intent: row.intent,
        "leadDraft.type": row["leadDraft.type"],
        "taskDraft.type": row["taskDraft.type"],
        nextAction: row.nextAction,
        "pass/fail": failures.some((failure) => failure.n === row["#"]) ? "FAIL" : "PASS",
      }))
    );

    console.log(`\nTotal: ${cases.length - failed}/${cases.length} passed`);

    if (failures.length) {
      console.log("\nWeak cases:");
      console.table(failures);
    } else {
      console.log("\nWeak cases: None");
    }

    console.log(`\nResult: ${failed === 0 ? "ALL PASSED" : `${failed} FAILED`}`);
    if (failed > 0) process.exitCode = 1;
  } finally {
    server.close();
  }
});

function validateRow(item, row) {
  const failures = [];
  const fail = (reason) => failures.push({
    n: item.n,
    message: item.message,
    reason,
  });

  if (!item.expectedIntent.includes(row.intent)) {
    fail(`expected intent ${item.expectedIntent.join(" or ")}, got ${row.intent || "-"}`);
  }

  if (row["leadDraft.type"]) fail("leadDraft should not be created");
  if (row["taskDraft.type"]) fail("taskDraft should not be created");
  if (row.usedGemini) fail("Gemini assist should not be used");

  const policyIssues = findReplyPolicyIssues(row.reply);
  if (policyIssues.length) fail(`reply policy issue: ${policyIssues.join(",")}`);

  for (const pattern of item.expectedReply) {
    if (!pattern.test(row.reply)) {
      fail(`reply missing ${pattern}`);
    }
  }

  return failures;
}

function resolveNextAction(json) {
  if (!json.handled) return "fallback_unhandled";
  if (json.leadDraft?.requiresHumanApproval) return "human_review_lead_draft";
  if (json.taskDraft?.requiresHumanApproval) return "human_review_task_draft";
  if (json.intent === "reset") return "flow_reset";
  if (json.intent?.includes("refusal")) return "hard_safety_refusal_complete";
  if (json.state?.status === "mixed_intent_clarification") return "await_mixed_intent_choice";
  if (json.state?.flow && json.state?.step) return `continue_${json.state.flow}_${json.state.step}`;
  return "answer_complete";
}
