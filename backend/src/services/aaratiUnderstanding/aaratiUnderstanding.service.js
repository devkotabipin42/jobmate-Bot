import { isStartRestartMenuCommand } from "../automation/startRestartMenu.service.js";
import { interpretQuestion } from "./questionInterpreter.service.js";
import { matchJobMateScope } from "./scopeMatcher.service.js";
import { mapUnderstandingToFlow } from "./flowMapper.service.js";
import { buildBoundaryReply, buildClarificationReply } from "./boundaryReply.service.js";
import { getAaratiUnderstandingRagAnswer } from "./ragAnswer.service.js";

const ACTIVE_FLOW_STATES = new Set([
  "worker_registration",
  "employer_lead",
]);

function getActiveFlow(conversation = {}) {
  return (
    conversation?.metadata?.activeFlow ||
    (ACTIVE_FLOW_STATES.has(conversation?.currentIntent)
      ? conversation.currentIntent
      : "")
  );
}

function isSafeMetaSupportIntent(intent = "") {
  return [
    "support_job_guarantee",
    "support_worker_fee",
    "support_document_privacy",
    "support_sahakari_info",
    "support_answer",
  ].includes(intent);
}

export function decideUnderstandingAction({ text = "", conversation = {} } = {}) {
  const rawText = String(text || "");

  if (isStartRestartMenuCommand(rawText)) {
    return {
      action: "continue_existing",
      mappedFlow: null,
      reply: "",
      confidence: 1,
      reason: "start_restart_menu_source_of_truth",
      preserveActiveFlow: false,
    };
  }

  const interpretation = interpretQuestion({ text: rawText, conversation });
  const activeFlow = getActiveFlow(conversation);

  if (activeFlow === "worker_registration" || activeFlow === "employer_lead") {
    if (isSafeMetaSupportIntent(interpretation.possibleIntent)) {
      const scopeResult = matchJobMateScope({ interpretation });
      const reply = getAaratiUnderstandingRagAnswer({ interpretation, scopeResult });

      if (reply) {
        return {
          action: "reply_only",
          mappedFlow: "support_answer",
          reply,
          confidence: interpretation.confidence,
          reason: `active_flow_safe_meta:${interpretation.possibleIntent}`,
          preserveActiveFlow: true,
        };
      }
    }

    return {
      action: "continue_existing",
      mappedFlow: activeFlow,
      reply: "",
      confidence: interpretation.confidence,
      reason: "active_flow_preserved",
      preserveActiveFlow: true,
    };
  }

  const scopeResult = matchJobMateScope({ interpretation });
  const mapped = mapUnderstandingToFlow({ interpretation, scopeResult });

  if (mapped.action === "boundary") {
    return {
      action: "boundary",
      mappedFlow: mapped.mappedFlow,
      reply: buildBoundaryReply({ scopeResult, interpretation }),
      confidence: interpretation.confidence,
      reason: mapped.reason,
      preserveActiveFlow: false,
    };
  }

  if (mapped.action === "reply_only") {
    return {
      action: "reply_only",
      mappedFlow: mapped.mappedFlow,
      reply: getAaratiUnderstandingRagAnswer({ interpretation, scopeResult }),
      confidence: interpretation.confidence,
      reason: mapped.reason,
      preserveActiveFlow: false,
    };
  }

  if (mapped.action === "clarify") {
    return {
      action: "clarify",
      mappedFlow: mapped.mappedFlow,
      reply: buildClarificationReply(),
      confidence: interpretation.confidence,
      reason: mapped.reason,
      preserveActiveFlow: false,
    };
  }

  return {
    action: mapped.action,
    mappedFlow: mapped.mappedFlow,
    reply: "",
    confidence: interpretation.confidence,
    reason: mapped.reason,
    preserveActiveFlow: false,
  };
}
