import express from "express";
import jobmateLeadAgentRoutes from "../src/routes/jobmateLeadAgent.routes.js";
import {
  findReplyPolicyIssues,
} from "../src/services/jobmateLeadAgent/replyFormatter.service.js";

const conversation = [
  { n: 1, message: "restart" },
  { n: 2, message: "ajob kojna" },
  { n: 3, message: "marketing" },
  { n: 4, message: "jimirbar ma" },
  { n: 5, message: "mero naam Ram ho phone 9840000000 age 22" },
  {
    n: 6,
    message:
      "experience chaina salary 15000 bholi dekhi available citizenship cha cv chaina bardaghat butwal milcha",
  },
];

const app = express();
app.use(express.json());
app.use("/api/jobmate-lead-agent", jobmateLeadAgentRoutes);

let failed = 0;

const server = app.listen(0, "127.0.0.1", async () => {
  const { port } = server.address();
  const endpoint = `http://127.0.0.1:${port}/api/jobmate-lead-agent/message`;
  const phone = `live-worker-regression-${Date.now()}`;

  try {
    const rows = [];
    let finalLeadDraft = null;

    for (const item of conversation) {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          phone,
          displayName: "Mitra",
          message: item.message,
        }),
      });

      const json = await response.json();
      if (json.leadDraft) finalLeadDraft = json.leadDraft;

      rows.push({
        n: item.n,
        message: item.message,
        intent: json.intent || null,
        reply: json.reply || "",
        flow: json.state?.flow || null,
        step: json.state?.step || null,
        jobType: json.state?.data?.jobType || null,
        roleInterest: json.state?.data?.roleInterest || json.leadDraft?.data?.roleInterest || null,
        location: json.state?.data?.location?.area || json.leadDraft?.data?.location?.area || null,
        currentLocation: json.leadDraft?.data?.currentLocation?.area || null,
        leadDraftType: json.leadDraft?.type || null,
        requiresHumanApproval: json.leadDraft?.requiresHumanApproval ?? null,
        nextAction: resolveNextAction(json),
        json,
      });
    }

    const failures = validateRows({ rows, finalLeadDraft });
    failed = failures.length;

    console.table(
      rows.map((row) => ({
        "#": row.n,
        message: row.message,
        intent: row.intent,
        flow: row.flow,
        step: row.step,
        jobType: row.jobType,
        location: row.location,
        "leadDraft.type": row.leadDraftType,
        nextAction: row.nextAction,
        "pass/fail": failures.some((failure) => failure.n === row.n) ? "FAIL" : "PASS",
      }))
    );

    console.table([
      {
        "leadDraft.type": finalLeadDraft?.type || null,
        requiresHumanApproval: finalLeadDraft?.requiresHumanApproval ?? null,
        roleInterest: finalLeadDraft?.data?.roleInterest || null,
        location: finalLeadDraft?.data?.location?.area || null,
        currentLocation: finalLeadDraft?.data?.currentLocation?.area || null,
        preferredArea: finalLeadDraft?.data?.preferredArea || null,
      },
    ]);

    if (failures.length) {
      console.table(failures);
    }

    console.log(`\nResult: ${failed === 0 ? "ALL PASSED" : `${failed} FAILED`}`);
    if (failed > 0) process.exitCode = 1;
  } finally {
    server.close();
  }
});

function validateRows({ rows = [], finalLeadDraft = null } = {}) {
  const failures = [];
  const byNumber = new Map(rows.map((row) => [row.n, row]));
  const fail = (n, reason) => failures.push({ n, message: byNumber.get(n)?.message || "", reason });

  for (const row of rows) {
    const issues = findReplyPolicyIssues(row.reply);
    if (issues.length) fail(row.n, `reply policy issue: ${issues.join(",")}`);
    if (hasJobGuaranteePromise(row.reply)) fail(row.n, "job guarantee promise in reply");
  }

  assert(fail, 1, byNumber.get(1)?.intent === "reset", "restart did not show menu");
  assert(fail, 2, byNumber.get(2)?.intent === "worker_lead", "ajob kojna did not start worker lead");
  assert(fail, 2, byNumber.get(2)?.flow === "worker", "worker flow not active after typo intent");
  assert(
    fail,
    2,
    /Tapai kasto kaam khojnu bhayeko ho\? Job type, area\/location, experience ra availability pathaunus\./i.test(byNumber.get(2)?.reply || ""),
    "worker start prompt mismatch"
  );
  assert(fail, 3, byNumber.get(3)?.jobType === "Marketing", "marketing not saved as jobType");
  assert(fail, 3, byNumber.get(3)?.roleInterest === "Marketing", "marketing not saved as roleInterest");
  assert(fail, 3, byNumber.get(3)?.step === "location", "marketing did not advance to location step");
  assert(fail, 4, byNumber.get(4)?.location === "Jimirbar", "jimirbar ma not saved as Jimirbar location");
  assert(fail, 4, byNumber.get(4)?.step === "fullName", "location did not advance to remaining details");
  assert(fail, 6, finalLeadDraft?.type === "worker_lead", "final worker lead draft not created");
  assert(fail, 6, finalLeadDraft?.requiresHumanApproval === true, "final worker lead missing human approval");
  assert(fail, 6, finalLeadDraft?.data?.roleInterest === "Marketing", "final roleInterest not Marketing");
  assert(fail, 6, finalLeadDraft?.data?.location?.area === "Jimirbar", "final location not Jimirbar");
  assert(fail, 6, finalLeadDraft?.data?.currentLocation?.area === "Jimirbar", "final currentLocation not Jimirbar");
  assert(fail, 6, finalLeadDraft?.data?.preferredArea === "Bardaghat, Butwal", "preferred area not captured");
  assert(fail, 6, finalLeadDraft?.data?.fullName === "Ram", "worker name not captured");
  assert(fail, 6, finalLeadDraft?.data?.providedPhone === "9840000000", "worker phone not captured");
  assert(fail, 6, finalLeadDraft?.data?.age === 22, "worker age not captured");

  return failures;
}

function assert(fail, n, condition, reason) {
  if (!condition) fail(n, reason);
}

function hasJobGuaranteePromise(reply = "") {
  return /\bjob\s+guarantee\s+(huncha|hunxa|cha|chha|xa)\b|\bpakka\s+job\b|\bjob\s+pakka\b/i.test(String(reply || ""));
}

function resolveNextAction(json = {}) {
  if (!json.handled) return "fallback_unhandled";
  if (json.leadDraft?.requiresHumanApproval) return "human_review_lead_draft";
  if (json.taskDraft?.requiresHumanApproval) return "human_review_task_draft";
  if (json.state?.flow && json.state?.step) return `continue_${json.state.flow}_${json.state.step}`;
  if (json.intent === "reset") return "flow_reset";
  if (json.intent?.includes("refusal")) return "hard_safety_refusal_complete";
  return "answer_complete";
}
