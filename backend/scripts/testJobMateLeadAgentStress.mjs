import express from "express";
import jobmateLeadAgentRoutes from "../src/routes/jobmateLeadAgent.routes.js";
import { findReplyPolicyIssues } from "../src/services/jobmateLeadAgent/replyFormatter.service.js";

const cases = [
  { group: "worker", n: 1, message: "kaam xa?" },
  { group: "worker", n: 2, message: "malai job chaiyo but kasto kaam tha xaina" },
  { group: "worker", n: 3, message: "Bardaghat ma kaam pauna sakincha?" },
  { group: "worker", n: 4, message: "ma driver ho license xa" },
  { group: "worker", n: 5, message: "salary kati hunxa?" },
  { group: "worker", n: 6, message: "job guarantee huncha?" },
  { group: "worker", n: 7, message: "registration ko paisa lagcha?" },
  { group: "worker", n: 8, message: "ma documents pathauna dar lagyo" },
  { group: "worker", n: 9, message: "mero naam shyam ho, phone 9841111111, butwal, waiter, 1 barsa exp, 18000 salary, voli dekhi milcha" },

  { group: "employer", n: 10, message: "staff chainxa" },
  { group: "employer", n: 11, message: "helper chahiyo urgent" },
  { group: "employer", n: 12, message: "2 jana waiter chainxa hotel ko lagi" },
  { group: "employer", n: 13, message: "staff ready cha?" },
  { group: "employer", n: 14, message: "paisa kahile tirne?" },
  { group: "employer", n: 15, message: "worker ramro bhayena bhane?" },
  { group: "employer", n: 16, message: "ABC hotel butwal ma 2 waiter, salary 15000, timing 10-8, food xa, urgent, phone 9851111111" },

  { group: "sahakari", n: 17, message: "sahakari saga partnership hunxa?" },
  { group: "sahakari", n: 18, message: "franchise lina parcha?" },
  { group: "sahakari", n: 19, message: "suru mai paisa lagcha sahakari lai?" },
  { group: "sahakari", n: 20, message: "hamro sahakari bardaghat ma xa manager Ram 9842222222 meeting garna milcha" },

  { group: "misc", n: 21, message: "timi ko ho?" },
  { group: "misc", n: 22, message: "website banaidinchau?" },
  { group: "misc", n: 23, message: "love letter lekhdeu" },
  { group: "misc", n: 24, message: "kina bujhdainau?" },
  { group: "misc", n: 25, message: "JobMate ke ho?" },
  { group: "misc", n: 26, message: "start" },
  { group: "misc", n: 27, message: "restart" },
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

    for (const item of cases) {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          phone: `stress-${item.group}`,
          displayName: "Mitra",
          message: item.message,
        }),
      });

      const json = await response.json();
      rows.push(toRow(item, json));
    }

    runAssertions(rows);
    printTable(rows);

    console.log(`\nResult: ${failed === 0 ? "ALL PASSED" : `${failed} FAILED`}`);
    if (failed > 0) process.exitCode = 1;
  } finally {
    server.close();
  }
});

function toRow(item, json) {
  return {
    n: item.n,
    message: item.message,
    intent: json.intent || null,
    reply: json.reply || null,
    leadDraftType: json.leadDraft?.type || null,
    taskDraftType: json.taskDraft?.type || null,
    usedRag: Boolean(json.reason?.includes("rag") || json.source === "jobmate_rag"),
    usedGemini: false,
    requiresHumanApproval:
      json.leadDraft?.requiresHumanApproval ??
      json.taskDraft?.requiresHumanApproval ??
      null,
    nextAction: resolveNextAction(json),
    reason: json.reason || "",
    state: json.state || {},
  };
}

function resolveNextAction(json) {
  if (!json.handled) return "fallback/unhandled";
  if (json.leadDraft?.requiresHumanApproval) return "human_review_lead_draft";
  if (json.taskDraft?.requiresHumanApproval) return "human_review_task_draft";
  if (json.state?.flow && json.state?.step) {
    return `continue_${json.state.flow}_${json.state.step}`;
  }
  if (json.intent === "reset") return "flow_reset";
  return "answer_complete";
}

function runAssertions(rows) {
  const byNumber = new Map(rows.map((row) => [row.n, row]));

  assert("1 starts worker flow", byNumber.get(1)?.intent === "worker_lead");
  assert("10 starts employer flow", byNumber.get(10)?.intent === "employer_lead");
  assert("4 does not extract Driver as area", byNumber.get(4)?.state?.data?.location?.area !== "Driver");
  assert("5 answers worker salary policy", /Salary employer, role, experience, location anusar farak huncha/i.test(byNumber.get(5)?.reply || ""));
  assert("8 answers document privacy", /Document sharing initially optional/i.test(byNumber.get(8)?.reply || ""));
  assert("12 does not set businessName KO Lagi", byNumber.get(12)?.state?.data?.businessName !== "KO Lagi");
  assert("15 answers replacement policy", /Unlimited replacement guarantee hudaina/i.test(byNumber.get(15)?.reply || ""));
  assert("18 answers franchise not first", /Franchise compulsory hoina|First stage ma franchise lina pardaina/i.test(byNumber.get(18)?.reply || ""));
  assert("19 answers sahakari zero-investment", /30-day zero-investment pilot/i.test(byNumber.get(19)?.reply || ""));
  assert("21 answers identity", /Ma Aarati, JobMate team ko digital sahayogi/i.test(byNumber.get(21)?.reply || ""));
  assert("22 out of scope", /Website\/love letter ma help garna mildaina/i.test(byNumber.get(22)?.reply || ""));
  assert("23 out of scope", /Website\/love letter ma help garna mildaina/i.test(byNumber.get(23)?.reply || ""));
  assert("24 confusion fallback", /Maaf garnus, ma clear bujhna khojdai chu/i.test(byNumber.get(24)?.reply || ""));
  assert("25 uses RAG", byNumber.get(25)?.usedRag === true);

  for (const row of rows) {
    const issues = findReplyPolicyIssues(row.reply || "");
    assert(`${row.n} has no tech/Hindi words`, issues.length === 0, issues.join(","));
    assert(`${row.n} does not finalize payment`, !/payment final garcha|settlement final garcha|fee final garcha/i.test(row.reply || ""));
  }

  for (const row of rows.filter((row) => row.leadDraftType)) {
    assert(`${row.n} draft requires human approval`, row.requiresHumanApproval === true);
  }
}

function assert(name, condition, detail = "") {
  if (!condition) {
    failed += 1;
    console.error(`FAIL ${name}${detail ? `: ${detail}` : ""}`);
  }
}

function printTable(rows) {
  const compact = rows.map((row) => ({
    "#": row.n,
    message: row.message,
    intent: row.intent,
    reply: row.reply,
    "leadDraft.type": row.leadDraftType,
    "taskDraft.type": row.taskDraftType,
    usedRag: row.usedRag,
    usedGemini: row.usedGemini,
    requiresHumanApproval: row.requiresHumanApproval,
    nextAction: row.nextAction,
  }));

  console.table(compact);
}
