import {
  buildBoundaryReply,
  buildJobGuaranteeReply,
  buildWorkerFeeReply,
} from "./boundaryReply.service.js";

export function getAaratiUnderstandingRagAnswer({
  interpretation = {},
  scopeResult = {},
} = {}) {
  const intent = interpretation.possibleIntent || "";

  if (scopeResult.scope !== "inside_jobmate") {
    return buildBoundaryReply({ scopeResult });
  }

  if (intent === "support_job_guarantee") {
    return buildJobGuaranteeReply();
  }

  if (intent === "support_jobmate_trust") {
    return "Mitra ji, JobMate fake hoina. Hami local job seeker ra staff chahine employer lai connect garne hiring support service ho. Worker registration free cha. Job guarantee chai hudaina. Tapai lai kaam khojna ho ki staff khojna?";
  }

  if (intent === "support_worker_fee") {
    return buildWorkerFeeReply();
  }

  if (intent === "support_document_privacy") {
    return "Document pathaunu compulsory haina 🙏 JobMate team le document sirf verification/hiring process ko lagi herchha. Comfortable hunuhunna bhane document bina pani profile save garna milcha.";
  }

  if (intent === "support_sahakari_info") {
    return "Sahakari partnership bare JobMate team le 30-day zero-investment employment support pilot discuss garna sakcha. Ahile main menu ma job khojna ra staff khojna matra available cha.";
  }

  if (intent === "support_answer") {
    return "JobMate le job khojne worker ra staff khojne employer lai connect garna help garcha. Job khojna ho bhane 1, staff khojna ho bhane 2 channus.";
  }

  return "";
}
