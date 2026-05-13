import express from "express";
import jobmateLeadAgentRoutes from "../src/routes/jobmateLeadAgent.routes.js";
import {
  findReplyPolicyIssues,
} from "../src/services/jobmateLeadAgent/replyFormatter.service.js";

const cases = [
  { n: 1, group: "worker_family", sameSession: true, message: "mero bhai lai job chahiyo" },
  { n: 2, group: "worker_family", sameSession: true, message: "age 20 ho" },
  { n: 3, group: "worker_family", sameSession: true, message: "bardaghat ma bascha" },
  { n: 4, group: "worker_family", sameSession: true, message: "shop helper ya hotel helper jasto kaam huncha" },
  { n: 5, group: "worker_family", sameSession: true, message: "experience chaina tara sikna ready cha" },
  { n: 6, group: "worker_family", sameSession: true, message: "salary 12000 dekhi 15000 samma thik cha" },
  { n: 7, group: "worker_family", sameSession: true, message: "phone 9846666666 naam Kiran" },
  { n: 8, group: "worker_family", sameSession: true, message: "aaja dekhi available cha" },
  { n: 9, group: "worker_family", sameSession: true, message: "citizenship cha cv chaina" },
  { n: 10, group: "worker_family", sameSession: true, message: "bardaghat parasi butwal milcha" },

  {
    n: 11,
    group: "employer_one_message",
    sameSession: false,
    message:
      "namaste mero restaurant butwal ma cha naam Sunrise Khaja Ghar owner Deepak phone 9856666666 malai 2 kitchen helper chahiyo salary 15000 timing 7am-7pm khana cha basna chaina urgent 2 din bhitra experience bhaye ramro gender any fee worker join bhayepachi",
  },

  { n: 12, group: "employer_doc_correction", sameSession: true, message: "worker ko document pahilai pathaideu" },
  {
    n: 13,
    group: "employer_doc_correction",
    sameSession: true,
    message:
      "ok document chai human approval pachi matra, malai driver chahiyo company ko lagi, location Parasi, salary 22000, phone 9857777777, contact Suman, 1 jana, timing 8-6, urgent, license mandatory, gender any, fee join pachi",
  },

  { n: 14, group: "sahakari_model", sameSession: true, message: "sahakari sanga jobmate kasari kam garxa?" },
  { n: 15, group: "sahakari_model", sameSession: true, message: "hamro naam Nava Pragati Sahakari ho" },
  { n: 16, group: "sahakari_model", sameSession: true, message: "bardaghat 5 ma cha" },
  { n: 17, group: "sahakari_model", sameSession: true, message: "manager Laxmi ho phone 9847777777" },
  { n: 18, group: "sahakari_model", sameSession: true, message: "member 1200 jati chan" },
  { n: 19, group: "sahakari_model", sameSession: true, message: "business owner members dherai chan" },
  { n: 20, group: "sahakari_model", sameSession: true, message: "saturday 11 baje meeting garna milcha" },
  { n: 21, group: "sahakari_model", sameSession: true, message: "revenue kasari share huncha?" },
  { n: 22, group: "sahakari_model", sameSession: true, message: "first month result aayena bhane?" },

  { n: 23, group: "worker_privacy", sameSession: false, message: "mero data safe huncha?" },
  { n: 24, group: "worker_privacy", sameSession: false, message: "job paune pakka ho?" },
  { n: 25, group: "worker_privacy", sameSession: false, message: "employer lai mero number dinu huncha?" },
  { n: 26, group: "worker_privacy", sameSession: false, message: "CV sabai company lai pathaune ho?" },

  { n: 27, group: "mixed_random", sameSession: false, message: "tapai haru kata ko company ho?" },
  { n: 28, group: "mixed_random", sameSession: false, message: "lumbini bhanda bahira job milcha?" },
  { n: 29, group: "mixed_random", sameSession: false, message: "pokhara ma kaam cha?" },
  { n: 30, group: "mixed_random", sameSession: false, message: "butwal ma driver cha?" },
  { n: 31, group: "mixed_random", sameSession: false, message: "ma employer ho ki jobseeker confuse bhaye" },
  { n: 32, group: "mixed_random", sameSession: false, message: "help" },
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
    const finals = {};

    for (const item of cases) {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          phone: item.sameSession
            ? `different-final-${item.group}`
            : `different-final-${item.group}-${item.n}`,
          displayName: "Mitra",
          message: item.message,
        }),
      });

      const json = await response.json();
      finals[item.group] ||= {};
      if (json.leadDraft) finals[item.group].leadDraft = json.leadDraft;
      if (json.taskDraft) finals[item.group].taskDraft = json.taskDraft;
      finals[item.group].state = json.state;

      rows.push({
        n: item.n,
        group: item.group,
        message: item.message,
        intent: json.intent || null,
        leadDraftType: json.leadDraft?.type || null,
        taskDraftType: json.taskDraft?.type || null,
        nextAction: resolveNextAction(json),
        reply: json.reply || "",
        state: json.state || {},
        json,
      });
    }

    const failures = validateRows({ rows, finals });
    failed = failures.length;

    console.table(
      rows.map((row) => ({
        "#": row.n,
        message: row.message,
        intent: row.intent,
        "leadDraft.type": row.leadDraftType,
        "taskDraft.type": row.taskDraftType,
        nextAction: row.nextAction,
        "pass/fail": failures.some((failure) => failure.n === row.n) ? "FAIL" : "PASS",
      }))
    );

    console.table(
      Object.entries(finals).map(([group, final]) => ({
        group,
        "leadDraft.type": final.leadDraft?.type || null,
        "taskDraft.type": final.taskDraft?.type || null,
        requiresHumanApproval: final.leadDraft?.requiresHumanApproval ?? null,
        summary: summarizeDraft(final.leadDraft),
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

function validateRows({ rows, finals }) {
  const failures = [];
  const byNumber = new Map(rows.map((row) => [row.n, row]));
  const fail = (n, reason) => failures.push({ n, message: byNumber.get(n)?.message || "", reason });

  for (const row of rows) {
    const issues = findReplyPolicyIssues(row.reply);
    if (issues.length) fail(row.n, `reply policy issue: ${issues.join(",")}`);
    if (row.json.leadDraft?.requiresHumanApproval === false) {
      fail(row.n, "lead draft does not require human approval");
    }
  }

  const worker = finals.worker_family?.leadDraft;
  assert(fail, 10, worker?.type === "worker_lead", "worker family draft not created");
  assert(fail, 10, worker?.requiresHumanApproval === true, "worker family draft missing human approval");
  assert(fail, 10, worker?.data?.documentsStatus === "partial", "worker documents not partial");
  assert(fail, 10, worker?.data?.preferredArea === "Bardaghat, Parasi, Butwal", "worker multi-area missing Parasi");

  const employerOne = finals.employer_one_message?.leadDraft;
  assert(fail, 11, employerOne?.type === "employer_lead", "one-message employer draft not created");
  assert(fail, 11, employerOne?.data?.businessName === "Sunrise Khaja Ghar", "one-message businessName wrong");
  assert(fail, 11, employerOne?.data?.contactPerson === "Deepak", "one-message contactPerson wrong");
  assert(fail, 11, employerOne?.data?.providedPhone === "9856666666", "one-message phone missing");
  assert(fail, 11, employerOne?.data?.location?.area === "Butwal", "one-message location missing");
  assert(fail, 11, employerOne?.data?.roleNeeded === "Kitchen Helper", "one-message role wrong");
  assert(fail, 11, employerOne?.data?.numberNeeded === 2, "one-message quantity wrong");
  assert(fail, 11, Boolean(employerOne?.data?.feeUnderstanding), "one-message fee understanding missing");

  const docRefusal = byNumber.get(12);
  assert(fail, 12, docRefusal?.intent === "document_privacy_refusal", "document privacy request not refused");
  assert(fail, 12, !docRefusal?.leadDraftType && !docRefusal?.taskDraftType, "document privacy refusal created draft");

  const corrected = finals.employer_doc_correction?.leadDraft;
  assert(fail, 13, corrected?.type === "employer_lead", "corrected employer draft not created");
  assert(fail, 13, corrected?.data?.roleNeeded === "Driver", "corrected employer role wrong");
  assert(fail, 13, corrected?.data?.location?.area === "Parasi", "corrected employer location wrong");
  assert(fail, 13, corrected?.data?.contactPerson === "Suman", "corrected employer contact wrong");
  assert(fail, 13, corrected?.data?.providedPhone === "9857777777", "corrected employer phone wrong");
  assert(fail, 13, corrected?.data?.numberNeeded === 1, "corrected employer quantity wrong");
  assert(fail, 13, Boolean(corrected?.data?.feeUnderstanding), "corrected employer fee missing");

  const sahakariStart = byNumber.get(14);
  assert(fail, 14, sahakariStart?.intent === "sahakari_partnership", "sahakari model did not start sahakari flow");
  assert(fail, 14, /30-day zero-investment/i.test(sahakariStart?.reply || ""), "sahakari pilot-first wording missing");
  assert(fail, 14, /1 contact person/i.test(sahakariStart?.reply || ""), "sahakari contact-person model missing");
  assert(fail, 14, /50\/50/i.test(sahakariStart?.reply || ""), "sahakari revenue-share model missing");

  const sahakari = finals.sahakari_model?.leadDraft;
  assert(fail, 20, sahakari?.type === "sahakari_lead", "sahakari draft not created");
  assert(fail, 20, finals.sahakari_model?.taskDraft?.type === "sahakari_pilot_followup", "sahakari follow-up task missing");
  assert(fail, 20, sahakari?.data?.sahakariName === "Nava Pragati Sahakari", "sahakari name wrong");
  assert(fail, 20, sahakari?.data?.managerName === "Laxmi", "sahakari manager wrong");
  assert(fail, 20, sahakari?.data?.memberCountApprox === 1200, "sahakari member count wrong");
  assert(fail, 20, sahakari?.data?.preferredMeetingTime === "Saturday 11 Baje", "sahakari meeting wrong");
  assert(fail, 21, byNumber.get(21)?.intent === "sahakari_revenue", "sahakari revenue question not handled");
  assert(fail, 22, byNumber.get(22)?.intent === "sahakari_no_result", "sahakari no-result question not handled");

  assert(fail, 23, byNumber.get(23)?.intent === "data_privacy", "data privacy not handled");
  assert(fail, 24, byNumber.get(24)?.intent === "job_guarantee", "job guarantee variant not handled");
  assert(fail, 25, byNumber.get(25)?.intent === "contact_privacy", "number privacy not handled");
  assert(fail, 26, byNumber.get(26)?.intent === "document_privacy", "CV mass-share privacy not handled");

  assert(fail, 27, byNumber.get(27)?.intent === "company_location", "company location not handled");
  assert(fail, 28, byNumber.get(28)?.intent === "outside_lumbini", "outside Lumbini question not handled");
  assert(fail, 29, byNumber.get(29)?.intent === "pokhara_location", "Pokhara question not handled safely");
  assert(fail, 30, byNumber.get(30)?.intent === "worker_lead", "Butwal driver inquiry did not start worker flow");
  assert(
    fail,
    30,
    ["Driver", "Driver / Transport"].includes(byNumber.get(30)?.state?.data?.jobType),
    "Butwal driver role not captured"
  );
  assert(fail, 30, byNumber.get(30)?.state?.data?.location?.area === "Butwal", "Butwal driver location not captured");
  assert(fail, 31, byNumber.get(31)?.intent === "help_menu", "confusion menu not handled");
  assert(fail, 32, byNumber.get(32)?.intent === "help_menu", "help menu not handled");

  for (const n of [23, 24, 25, 26, 27, 28, 29, 31, 32]) {
    assert(fail, n, !byNumber.get(n)?.leadDraftType && !byNumber.get(n)?.taskDraftType, "policy/menu answer created draft");
  }

  return failures;
}

function assert(fail, n, condition, reason) {
  if (!condition) fail(n, reason);
}

function resolveNextAction(json) {
  if (!json.handled) return "fallback_unhandled";
  if (json.leadDraft?.requiresHumanApproval) return "human_review_lead_draft";
  if (json.taskDraft?.requiresHumanApproval) return "human_review_task_draft";
  if (json.state?.flow && json.state?.step) return `continue_${json.state.flow}_${json.state.step}`;
  if (json.intent === "reset") return "flow_reset";
  if (json.intent?.includes("refusal")) return "hard_safety_refusal_complete";
  return "answer_complete";
}

function summarizeDraft(leadDraft) {
  if (!leadDraft) return null;

  const data = leadDraft.data || {};
  return [
    data.fullName || data.businessName || data.sahakariName,
    data.jobType || data.roleNeeded || data.pilotGoal,
    data.location?.area || data.area?.area,
    data.providedPhone,
  ].filter(Boolean).join(" | ");
}
