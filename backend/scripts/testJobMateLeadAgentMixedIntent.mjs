import express from "express";
import jobmateLeadAgentRoutes from "../src/routes/jobmateLeadAgent.routes.js";
import {
  findReplyPolicyIssues,
} from "../src/services/jobmateLeadAgent/replyFormatter.service.js";

const cases = [
  {
    n: 1,
    group: "single",
    message: "ma job khojdai pani chu ani mero pasal ko lagi staff pani chahiyo",
    expected: "mixed",
  },
  {
    n: 2,
    group: "single",
    message: "mero bhai lai job chahiyo ani malai shop ko lagi helper chahiyo",
    expected: "mixed",
  },
  {
    n: 3,
    group: "single",
    message: "hamro sahakari ma job khojne member pani chan ani business owner lai staff pani chahiyo",
    expected: "sahakari",
  },
  {
    n: 4,
    group: "single",
    message: "ma employer ho tara mero cousin lai pani job chahiyo",
    expected: "mixed",
  },
  {
    n: 5,
    group: "single",
    message: "staff chahiyo, also ma kaam pani khojdai chu",
    expected: "mixed",
  },
  {
    n: 6,
    group: "single",
    message: "job chahiyo, staff chahiyo, sahakari partnership pani bujna cha",
    expected: "mixed",
  },
  {
    n: 7,
    group: "single",
    message: "hamro company lai 2 waiter chahiyo ani job khojne manche haru pani chan",
    expected: "mixed",
  },
  {
    n: 8,
    group: "single",
    message: "ma sahakari ko manager ho, hamro members lai job chahiyo ra local business lai staff chahiyo",
    expected: "sahakari",
  },
  {
    n: 9,
    group: "single",
    message: "ma job khojdai chu but pachi mero shop ko lagi staff ni chahincha",
    expected: "worker_primary",
  },
  {
    n: 10,
    group: "single",
    message: "malai staff chahiyo but job pani khojdai thiye",
    expected: "employer_primary",
  },
  {
    n: 11,
    group: "choice_1",
    message: "ma job khojdai pani chu ani mero pasal ko lagi staff pani chahiyo",
    expected: "mixed",
  },
  {
    n: 12,
    group: "choice_1",
    message: "1",
    expected: "choice_worker",
  },
  {
    n: 13,
    group: "choice_2",
    message: "ma job khojdai pani chu ani mero pasal ko lagi staff pani chahiyo",
    expected: "mixed",
  },
  {
    n: 14,
    group: "choice_2",
    message: "2",
    expected: "choice_employer",
  },
  {
    n: 15,
    group: "choice_3",
    message: "ma job khojdai pani chu ani mero pasal ko lagi staff pani chahiyo",
    expected: "mixed",
  },
  {
    n: 16,
    group: "choice_3",
    message: "3",
    expected: "choice_sahakari",
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

    for (const item of cases) {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          phone: `mixed-intent-${item.group}-${item.n <= 10 ? item.n : "flow"}`,
          displayName: "Mitra",
          message: item.message,
        }),
      });

      const json = await response.json();
      rows.push({
        n: item.n,
        message: item.message,
        expected: item.expected,
        intent: json.intent || null,
        reply: json.reply || "",
        leadDraftType: json.leadDraft?.type || null,
        taskDraftType: json.taskDraft?.type || null,
        nextAction: resolveNextAction(json),
        state: json.state || {},
        json,
      });
    }

    const failures = validateRows(rows);
    failed = failures.length;

    console.table(
      rows.map((row) => ({
        "#": row.n,
        message: row.message,
        intent: row.intent,
        "reply summary": summarizeReply(row.reply),
        "leadDraft.type": row.leadDraftType,
        "taskDraft.type": row.taskDraftType,
        nextAction: row.nextAction,
        "pass/fail": failures.some((failure) => failure.n === row.n) ? "FAIL" : "PASS",
      }))
    );

    if (failures.length) {
      console.table(failures);
    }

    console.log(`\nResult: ${failed === 0 ? "ALL PASSED" : `${failed} FAILED`}`);
    if (failed > 0) process.exitCode = 1;
  } finally {
    server.close();
  }
});

function validateRows(rows = []) {
  const failures = [];
  const fail = (row, reason) => failures.push({ n: row.n, message: row.message, reason });

  for (const row of rows) {
    const issues = findReplyPolicyIssues(row.reply);
    if (issues.length) fail(row, `reply policy issue: ${issues.join(",")}`);
    if (/job\s+guarantee\s+huncha|staff\s+ready\s+cha|payment\s+final|settlement\s+final/i.test(row.reply)) {
      fail(row, "unsafe promise/finalization language");
    }
    if (row.json.leadDraft?.requiresHumanApproval === false) {
      fail(row, "lead draft missing human approval");
    }
    if (row.json.leadDraft?.paymentSettlement?.finalizedByBot === true) {
      fail(row, "payment finalized by bot");
    }

    if (row.expected === "mixed") {
      assertRow(fail, row, row.intent === "mixed_intent_clarification", "not mixed_intent_clarification");
      assertRow(fail, row, !row.leadDraftType && !row.taskDraftType, "mixed message created draft");
      assertRow(fail, row, hasClarificationMenu(row.reply), "clarification menu missing");
      assertRow(fail, row, !/staff ready/i.test(row.reply), "misrouted to staff-ready");
      assertRow(fail, row, !/business:\s*Lai 2/i.test(row.reply), "fake businessName Lai 2 extracted");
    }

    if (row.expected === "sahakari") {
      assertRow(fail, row, row.intent === "sahakari_partnership", "not sahakari_partnership");
      assertRow(fail, row, !row.leadDraftType && !row.taskDraftType, "sahakari mixed message created draft");
      assertRow(fail, row, /30-day|zero-investment|pilot/i.test(row.reply), "pilot-first reply missing");
    }

    if (row.expected === "worker_primary") {
      assertRow(fail, row, row.intent === "worker_lead", "worker primary did not start worker flow");
      assertRow(fail, row, !row.leadDraftType && !row.taskDraftType, "worker primary created draft");
      assertRow(fail, row, /Pahila job registration garau/i.test(row.reply), "later staff acknowledgement missing");
    }

    if (row.expected === "employer_primary") {
      assertRow(fail, row, row.intent === "employer_lead", "employer primary did not start employer flow");
      assertRow(fail, row, !row.leadDraftType && !row.taskDraftType, "employer primary created draft");
      assertRow(fail, row, /Pahila staff demand register garau/i.test(row.reply), "later job acknowledgement missing");
    }

    if (row.expected === "choice_worker") {
      assertRow(fail, row, row.intent === "worker_lead", "choice 1 did not start worker flow");
      assertRow(fail, row, row.state?.flow === "worker", "choice 1 state not worker");
    }

    if (row.expected === "choice_employer") {
      assertRow(fail, row, row.intent === "employer_lead", "choice 2 did not start employer flow");
      assertRow(fail, row, row.state?.flow === "employer", "choice 2 state not employer");
    }

    if (row.expected === "choice_sahakari") {
      assertRow(fail, row, row.intent === "sahakari_partnership", "choice 3 did not start sahakari flow");
      assertRow(fail, row, row.state?.flow === "sahakari", "choice 3 state not sahakari");
    }
  }

  return failures;
}

function assertRow(fail, row, condition, reason) {
  if (!condition) fail(row, reason);
}

function hasClarificationMenu(reply = "") {
  return /job registration/i.test(reply) &&
    /staff demand/i.test(reply) &&
    /sahakari pilot/i.test(reply) &&
    /1\./.test(reply) &&
    /2\./.test(reply) &&
    /3\./.test(reply);
}

function resolveNextAction(json) {
  if (!json.handled) return "fallback_unhandled";
  if (json.leadDraft?.requiresHumanApproval) return "human_review_lead_draft";
  if (json.taskDraft?.requiresHumanApproval) return "human_review_task_draft";
  if (json.state?.flow && json.state?.step) return `continue_${json.state.flow}_${json.state.step}`;
  if (json.state?.status === "mixed_intent_clarification") return "await_mixed_intent_choice";
  if (json.intent === "reset") return "flow_reset";
  if (json.intent?.includes("refusal")) return "hard_safety_refusal_complete";
  return "answer_complete";
}

function summarizeReply(reply = "") {
  const value = String(reply || "").replace(/\s+/g, " ").trim();
  if (!value) return null;
  return value.length > 100 ? `${value.slice(0, 97)}...` : value;
}
