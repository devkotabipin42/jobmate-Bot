import {
  classifyLeadAgentIntent,
  createEmptyLeadAgentState,
  getLeadAgentState,
  isLeadAgentFlowActive,
} from "./intent.service.js";
import {
  buildSafetyReply,
  detectLeadAgentSafetyQuestion,
} from "./safety.service.js";
import {
  buildWorkerResumePrompt,
  handleWorkerLeadFlow,
} from "./workerLeadFlow.service.js";
import {
  buildEmployerResumePrompt,
  handleEmployerLeadFlow,
  isEmployerFeeUnderstandingMessage,
} from "./employerLeadFlow.service.js";
import {
  buildSahakariResumePrompt,
  handleSahakariLeadFlow,
} from "./sahakariLeadFlow.service.js";
import { getJobMateLeadAgentRagAnswer } from "./ragAnswer.service.js";
import { formatReply } from "./replyFormatter.service.js";
import {
  assistWithMessyMessage,
  buildGeminiAssistedText,
  shouldUseGeminiAssist,
} from "./geminiAssist.service.js";
import {
  buildMixedIntentClarificationReply,
  buildPrimaryAcknowledgement,
  detectMixedLeadIntent,
  isMixedIntentClarificationState,
  parseMixedIntentChoice,
} from "./mixedIntent.service.js";
import { handleMidFlowSideQuestion } from "./midFlowSideQuestion.service.js";

export async function handleJobMateLeadAgentMessage({
  contact = {},
  conversation = {},
  normalizedMessage = {},
} = {}) {
  const text = getMessageText(normalizedMessage);
  const currentState = getLeadAgentState(conversation);
  let intentDecision = classifyLeadAgentIntent({ text, state: currentState });

  if (intentDecision.intent === "reset") {
    const resetState = createEmptyLeadAgentState();

    return buildHandledResult({
      intent: "reset",
      conversationIntent: "unknown",
      currentState: "idle",
      state: resetState,
      reply:
        "Namaskar 🙏\nMa Aarati, JobMate Nepal team bata.\n\nTapai job khojna chahanu huncha ki staff/worker khojna?\n\n1. Job khojna\n2. Staff khojna",
      reason: "jobmate_lead_agent_reset",
    });
  }

  if (
    intentDecision.intent === "greeting" &&
    currentState?.flow === "worker" &&
    currentState?.step === "jobType"
  ) {
    intentDecision = {
      intent: "worker_continue",
      confidence: 0.8,
      reason: "active_worker_jobtype_greeting_guard",
    };
  }

  if (intentDecision.intent === "greeting") {
    return buildHandledResult({
      intent: "greeting",
      conversationIntent: conversation.currentIntent || "unknown",
      currentState: conversation.currentState || "idle",
      state: currentState,
      reply:
        "Namaskar 🙏\nMa Aarati, JobMate Nepal team bata.\n\nTapai job khojna chahanu huncha ki staff/worker khojna?",
      reason: "jobmate_lead_agent_greeting",
    });
  }

  if (isAutomationEmployerFlowActive(conversation, currentState)) {
    return {
      handled: false,
      reason: "active_automation_employer_flow_defer",
    };
  }

  if (isAutomationWorkerFlowActive(conversation, currentState)) {
    return {
      handled: false,
      reason: "active_automation_worker_flow_defer",
    };
  }

  const activeFlow = isLeadAgentFlowActive(currentState)
    ? currentState.flow
    : null;
  const contextFlow = activeFlow || getRecentCompletedFlow(currentState);
  const safety = detectLeadAgentSafetyQuestion({ text, activeFlow: contextFlow });

  if (safety?.hardRefusal) {
    const preserveUnsafeEmployerFlow = activeFlow === "employer";
    const nextState = preserveUnsafeEmployerFlow
      ? {
          ...currentState,
          data: {
            ...(currentState.data || {}),
            safetyRefused: true,
          },
          safetyRefused: true,
          lastSafetyRefusal: safety.type,
          status: "collecting",
          updatedAt: new Date().toISOString(),
        }
      : createEmptyLeadAgentState();

    return buildHandledResult({
      intent: safety.type,
      conversationIntent: preserveUnsafeEmployerFlow
        ? conversationIntentForFlow(activeFlow, conversation)
        : "unknown",
      currentState: preserveUnsafeEmployerFlow
        ? preserveCurrentState({ flow: activeFlow, conversation })
        : "idle",
      state: nextState,
      reply: buildSafetyReply({ safety, activeFlow: contextFlow, resumePrompt: "" }),
      reason: `jobmate_lead_agent_safety:${safety.type}`,
      needsHuman: false,
      priority: "low",
      source: "jobmate_lead_agent_safety",
    });
  }

  if (!activeFlow && contextFlow && isPostDraftConfirmation(text)) {
    return buildHandledResult({
      intent: "lead_confirmation",
      conversationIntent: conversationIntentForFlow(contextFlow, conversation),
      currentState: preserveCurrentState({ flow: contextFlow, conversation }),
      state: currentState,
      reply: buildPostDraftConfirmationReply(contextFlow),
      reason: "jobmate_lead_agent_post_draft_confirmation",
      needsHuman: false,
      priority: "low",
    });
  }

  if (!activeFlow && isMixedIntentClarificationState(currentState)) {
    const choice = parseMixedIntentChoice(text);
    if (choice) {
      return buildHandledResult(
        handleMixedIntentChoice({
          choice,
          contact,
          currentState,
        })
      );
    }
  }

  if (activeFlow === "employer" && isEmployerFeeUnderstandingMessage(text)) {
    return buildHandledResult(
      handleEmployerLeadFlow({
        contact,
        state: currentState,
        text,
        startedByIntent: false,
      })
    );
  }

  if (!activeFlow) {
    const mixedIntent = detectMixedLeadIntent(text);
    if (mixedIntent) {
      return buildHandledResult(
        handleMixedLeadIntent({
          mixedIntent,
          contact,
          currentState,
        })
      );
    }
  }

  if (safety) {
    const preserveUnsafeEmployerFlow = safety.hardRefusal && activeFlow === "employer";
    const nextState = preserveUnsafeEmployerFlow
      ? {
          ...currentState,
          data: {
            ...(currentState.data || {}),
            safetyRefused: true,
          },
          safetyRefused: true,
          lastSafetyRefusal: safety.type,
          status: "collecting",
          updatedAt: new Date().toISOString(),
        }
      : safety.clearFlow
      ? createEmptyLeadAgentState()
      : currentState;

    const resumePrompt = activeFlow && !safety.clearFlow && !safety.hardRefusal
      ? buildResumePrompt({ flow: activeFlow, state: currentState })
      : "";

    return buildHandledResult({
      intent: safety.type,
      conversationIntent: safety.clearFlow && !preserveUnsafeEmployerFlow
        ? "unknown"
        : conversationIntentForFlow(activeFlow || contextFlow, conversation),
      currentState: safety.clearFlow && !preserveUnsafeEmployerFlow
        ? "idle"
        : preserveCurrentState({ flow: activeFlow, conversation }),
      state: nextState,
      reply: buildSafetyReply({ safety, activeFlow: contextFlow, resumePrompt }),
      reason: `jobmate_lead_agent_safety:${safety.type}`,
      needsHuman: false,
      priority: "low",
      source: "jobmate_lead_agent_safety",
    });
  }

  if (isAreaRoleOpportunityQuestion(text)) {
    const workerResult = handleWorkerLeadFlow({
      contact,
      state: resetFlowState(currentState, "worker"),
      text,
      startedByIntent: true,
    });

    return buildHandledResult({
      ...workerResult,
      intent: "worker_lead",
      conversationIntent: "worker_registration",
      reply: buildAreaRoleOpportunityReply(text),
      reason: "jobmate_lead_agent_area_role_inquiry",
    });
  }

  if (activeFlow) {
    const sideQuestion = await handleMidFlowSideQuestion({
      text,
      activeFlow,
      state: currentState,
    });

    if (sideQuestion.handled) {
      return buildHandledResult({
        intent: "knowledge_question",
        conversationIntent: conversationIntentForFlow(activeFlow, conversation),
        currentState: preserveCurrentState({ flow: activeFlow, conversation }),
        state: currentState,
        reply: sideQuestion.reply,
        reason: "jobmate_mid_flow_side_question",
        needsHuman: false,
        priority: "low",
      });
    }
  }

  const geminiAssist = shouldUseGeminiAssist({
    message: text,
    intentDecision,
    activeFlow,
  })
    ? await assistWithMessyMessage({
        message: text,
        activeFlow,
        collectedData: currentState.data || {},
      })
    : null;

  if (geminiAssist) {
    const assistedResult = buildAssistedFlowResult({
      assist: geminiAssist,
      intentDecision,
      contact,
      currentState,
      text,
      activeFlow,
    });

    if (assistedResult?.handled) {
      return buildHandledResult({
        ...assistedResult,
        usedGemini: true,
        geminiAssistConfidence: geminiAssist.confidence,
        reason: `${assistedResult.reason || "jobmate_lead_agent_assisted"}:gemini_assist`,
      });
    }
  }

  if (intentDecision.intent === "knowledge_question") {
    const ragAnswer = getJobMateLeadAgentRagAnswer({ normalizedMessage });

    if (ragAnswer) {
      const resumePrompt = activeFlow
        ? buildResumePrompt({ flow: activeFlow, state: currentState })
        : "";

      return buildHandledResult({
        intent: "knowledge_question",
        conversationIntent: conversationIntentForFlow(activeFlow, conversation),
        currentState: preserveCurrentState({ flow: activeFlow, conversation }),
        state: currentState,
        reply: [ragAnswer.reply, resumePrompt].filter(Boolean).join("\n\n"),
        reason: `jobmate_lead_agent_rag:${ragAnswer.topic}`,
        needsHuman: false,
        priority: "low",
        source: ragAnswer.source,
        topic: ragAnswer.topic,
      });
    }
  }

  if (intentDecision.intent === "worker_start") {
    return buildHandledResult(
      handleWorkerLeadFlow({
        contact,
        state: resetFlowState(currentState, "worker"),
        text,
        startedByIntent: true,
      })
    );
  }

  if (intentDecision.intent === "employer_start") {
    return buildHandledResult(
      handleEmployerLeadFlow({
        contact,
        state: resetFlowState(currentState, "employer"),
        text,
        startedByIntent: true,
      })
    );
  }

  if (intentDecision.intent === "disabled_menu_option") {
    return buildHandledResult({
      intent: "disabled_menu_option",
      conversationIntent: "unknown",
      currentState: "idle",
      state: currentState,
      reply:
        "Mitra ji, ahile JobMate ma 1. Job khojna ra 2. Staff khojna matra available cha. Kripaya 1 ya 2 channus.",
      reason: "jobmate_lead_agent_disabled_menu_option",
      needsHuman: false,
      priority: "low",
    });
  }

  if (intentDecision.intent === "sahakari_start") {
    return buildHandledResult(
      handleSahakariLeadFlow({
        contact,
        state: resetFlowState(currentState, "sahakari"),
        text,
        startedByIntent: true,
      })
    );
  }

  if (intentDecision.intent === "worker_continue") {
    return buildHandledResult(
      handleWorkerLeadFlow({
        contact,
        state: currentState,
        text,
        startedByIntent: false,
      })
    );
  }

  if (intentDecision.intent === "employer_continue") {
    return buildHandledResult(
      handleEmployerLeadFlow({
        contact,
        state: currentState,
        text,
        startedByIntent: false,
      })
    );
  }

  if (intentDecision.intent === "sahakari_continue") {
    return buildHandledResult(
      handleSahakariLeadFlow({
        contact,
        state: currentState,
        text,
        startedByIntent: false,
      })
    );
  }

  return {
    handled: false,
    reason: intentDecision.reason,
  };
}

export function buildLeadAgentConversationPatch({
  result,
  inboundMessageId = null,
  outboundMessageId = null,
} = {}) {
  if (!result?.handled) return null;

  const set = {
    currentIntent: result.conversationIntent || "unknown",
    currentState: result.currentState || "idle",
    "metadata.jobmateLeadAgent": result.state || createEmptyLeadAgentState(),
    "metadata.lastQuestion": result.reply || "",
    "metadata.lastAskedField": null,
    lastActivityAt: new Date(),
  };

  if (inboundMessageId) {
    set.lastInboundMessageId = inboundMessageId;
  }

  if (outboundMessageId) {
    set.lastOutboundMessageId = outboundMessageId;
  }

  return { $set: set };
}

function buildHandledResult(result = {}) {
  const reply = formatReply(result.reply || result.messageToSend || "");
  const state = result.state || createEmptyLeadAgentState();
  const currentState = result.currentState || state.step || "idle";
  const conversationIntent =
    result.conversationIntent || conversationIntentForFlow(state.flow);

  return {
    ...result,
    handled: true,
    reply,
    messageToSend: reply,
    state,
    currentState,
    conversationIntent,
    needsHuman: Boolean(result.needsHuman),
    priority: result.priority || (result.needsHuman ? "high" : "low"),
    usedGemini: Boolean(result.usedGemini),
  };
}

function getMessageText(normalizedMessage = {}) {
  const message = normalizedMessage?.message || normalizedMessage || {};
  return String(message.text || message.normalizedText || "").trim();
}

function resetFlowState(state = {}, nextFlow = null) {
  return {
    ...createEmptyLeadAgentState(),
    leadDrafts: Array.isArray(state.leadDrafts) ? state.leadDrafts : [],
    taskDrafts: Array.isArray(state.taskDrafts) ? state.taskDrafts : [],
    flow: nextFlow,
    status: nextFlow ? "collecting" : "idle",
    updatedAt: new Date().toISOString(),
  };
}

function buildResumePrompt({ flow, state } = {}) {
  if (flow === "worker") {
    return buildWorkerResumePrompt({ state });
  }

  if (flow === "employer") {
    return buildEmployerResumePrompt({ state });
  }

  if (flow === "sahakari") {
    return buildSahakariResumePrompt({ state });
  }

  return "";
}

function buildAssistedFlowResult({
  assist = {},
  intentDecision = {},
  contact = {},
  currentState = {},
  text = "",
  activeFlow = null,
} = {}) {
  const assistedText = buildGeminiAssistedText({ message: text, assist });
  const intent = resolveAssistedIntent({ assist, intentDecision, activeFlow });

  if (intent === "worker_continue") {
    return handleWorkerLeadFlow({
      contact,
      state: currentState,
      text: assistedText,
      startedByIntent: false,
    });
  }

  if (intent === "employer_continue") {
    return handleEmployerLeadFlow({
      contact,
      state: currentState,
      text: assistedText,
      startedByIntent: false,
    });
  }

  if (intent === "sahakari_continue") {
    return handleSahakariLeadFlow({
      contact,
      state: currentState,
      text: assistedText,
      startedByIntent: false,
    });
  }

  if (intent === "worker_start") {
    return handleWorkerLeadFlow({
      contact,
      state: resetFlowState(currentState, "worker"),
      text: assistedText,
      startedByIntent: true,
    });
  }

  if (intent === "employer_start") {
    return handleEmployerLeadFlow({
      contact,
      state: resetFlowState(currentState, "employer"),
      text: assistedText,
      startedByIntent: true,
    });
  }

  if (intent === "sahakari_start") {
    return handleSahakariLeadFlow({
      contact,
      state: resetFlowState(currentState, "sahakari"),
      text: assistedText,
      startedByIntent: true,
    });
  }

  return null;
}

function handleMixedLeadIntent({ mixedIntent = {}, contact = {}, currentState = {} } = {}) {
  if (mixedIntent.type === "sahakari_umbrella") {
    return handleSahakariLeadFlow({
      contact,
      state: resetFlowState(currentState, "sahakari"),
      text: mixedIntent.originalMessage || "sahakari partnership garna cha",
      startedByIntent: true,
    });
  }

  if (mixedIntent.type === "worker_primary") {
    const result = handleWorkerLeadFlow({
      contact,
      state: resetFlowState(currentState, "worker"),
      text: mixedIntent.primaryText || "job chahiyo",
      startedByIntent: true,
    });

    return {
      ...result,
      reply: [buildPrimaryAcknowledgement("worker_primary"), result.reply].filter(Boolean).join("\n\n"),
    };
  }

  if (mixedIntent.type === "employer_primary") {
    const result = handleEmployerLeadFlow({
      contact,
      state: resetFlowState(currentState, "employer"),
      text: mixedIntent.primaryText || "staff chahiyo",
      startedByIntent: true,
    });

    return {
      ...result,
      reply: [buildPrimaryAcknowledgement("employer_primary"), result.reply].filter(Boolean).join("\n\n"),
    };
  }

  return {
    handled: true,
    intent: "mixed_intent_clarification",
    conversationIntent: "unknown",
    currentState: "jobmate_mixed_intent_clarification",
    state: {
      ...currentState,
      flow: null,
      step: "choice",
      status: "mixed_intent_clarification",
      data: {
        ...(currentState.data || {}),
        mixedIntentOriginalMessage: mixedIntent.originalMessage || "",
      },
      updatedAt: new Date().toISOString(),
    },
    reply: buildMixedIntentClarificationReply(),
    needsHuman: false,
    priority: "low",
    reason: "jobmate_lead_agent_mixed_intent_clarification",
  };
}

function handleMixedIntentChoice({ choice = "", contact = {}, currentState = {} } = {}) {
  if (choice === "worker") {
    return handleWorkerLeadFlow({
      contact,
      state: resetFlowState(currentState, "worker"),
      text: "job chahiyo",
      startedByIntent: true,
    });
  }

  if (choice === "employer") {
    return handleEmployerLeadFlow({
      contact,
      state: resetFlowState(currentState, "employer"),
      text: "staff chahiyo",
      startedByIntent: true,
    });
  }

  return handleSahakariLeadFlow({
    contact,
    state: resetFlowState(currentState, "sahakari"),
    text: "sahakari partnership garna cha",
    startedByIntent: true,
  });
}

function resolveAssistedIntent({ assist = {}, intentDecision = {}, activeFlow = null } = {}) {
  if (activeFlow === "worker") return "worker_continue";
  if (activeFlow === "employer") return "employer_continue";
  if (activeFlow === "sahakari") return "sahakari_continue";

  if (["worker_start", "employer_start", "sahakari_start"].includes(intentDecision?.intent)) {
    return intentDecision.intent;
  }

  if (["worker_lead", "worker_registration"].includes(assist.intentSuggestion)) {
    return "worker_start";
  }

  if (assist.intentSuggestion === "employer_lead") {
    return "employer_start";
  }

  if (assist.intentSuggestion === "sahakari_partnership") {
    return "sahakari_start";
  }

  return null;
}

function conversationIntentForFlow(flow, conversation = {}) {
  if (flow === "worker") return "worker_registration";
  if (flow === "employer") return "employer_lead";
  if (flow === "sahakari") return "unknown";

  return conversation?.currentIntent || "unknown";
}

function getRecentCompletedFlow(state = {}) {
  const type = state?.lastCompletedLeadDraft?.type;

  if (type === "worker_lead") return "worker";
  if (type === "employer_lead") return "employer";
  if (type === "sahakari_lead") return "sahakari";

  return null;
}

function preserveCurrentState({ flow, conversation = {} } = {}) {
  if (conversation?.currentState && conversation.currentState !== "idle") {
    return conversation.currentState;
  }

  if (flow === "worker") return "jobmate_worker_collecting";
  if (flow === "employer") return "jobmate_employer_collecting";
  if (flow === "sahakari") return "jobmate_sahakari_collecting";

  return "idle";
}

const AUTOMATION_EMPLOYER_ACTIVE_STATES = new Set([
  "ask_business_name",
  "ask_business_name_after_ai",
  "ask_vacancy",
  "ask_vacancy_role",
  "ask_role",
  "ask_location",
  "ask_business_location",
  "ask_area",
  "ask_district",
  "ask_urgency",
  "ask_salary_range",
  "ask_work_type",
  "completed",
]);

const AUTOMATION_WORKER_ACTIVE_STATES = new Set([
  "ask_job_type",
  "ask_jobType",
  "ask_district",
  "ask_location",
  "ask_availability",
  "ask_document_status",
  "ask_documents",
  "ask_fullName",
  "ask_providedPhone",
  "ask_age",
  "ask_experience",
  "ask_expectedSalary",
  "ask_confirmation",
  "asked_register",
]);

const AUTOMATION_WORKER_ACTIVE_FIELDS = new Set([
  "jobType",
  "district",
  "location",
  "availability",
  "documents",
  "fullName",
  "providedPhone",
  "age",
  "experience",
  "expectedSalary",
  "confirmation",
]);

function isAutomationWorkerFlowActive(conversation = {}, leadAgentState = {}) {
  if (isLeadAgentFlowActive(leadAgentState)) return false;

  const currentIntent = String(conversation?.currentIntent || "");
  const currentState = String(conversation?.currentState || "");
  const activeFlow = String(conversation?.metadata?.activeFlow || "");
  const lastAskedField = String(conversation?.metadata?.lastAskedField || "");

  if (["employer_lead", "employer"].includes(currentIntent) || activeFlow === "employer_lead") {
    return false;
  }
  if (["", "idle", "completed"].includes(currentState)) return false;

  const workerOwned =
    currentIntent === "worker_registration" ||
    activeFlow === "worker_registration" ||
    AUTOMATION_WORKER_ACTIVE_FIELDS.has(lastAskedField);

  if (!workerOwned) return false;

  return (
    activeFlow === "worker_registration" ||
    AUTOMATION_WORKER_ACTIVE_STATES.has(currentState) ||
    AUTOMATION_WORKER_ACTIVE_FIELDS.has(lastAskedField)
  );
}

function isAutomationEmployerFlowActive(conversation = {}, leadAgentState = {}) {
  if (isLeadAgentFlowActive(leadAgentState)) return false;

  const currentIntent = String(conversation?.currentIntent || "");
  const currentState = String(conversation?.currentState || "");
  const activeFlow = String(conversation?.metadata?.activeFlow || "");
  const qualificationStep = Number(conversation?.metadata?.qualificationStep || 0);

  if (!["employer_lead", "employer"].includes(currentIntent) && activeFlow !== "employer_lead") {
    return false;
  }

  return (
    AUTOMATION_EMPLOYER_ACTIVE_STATES.has(currentState) ||
    (qualificationStep > 0 && qualificationStep < 7)
  );
}

function isAreaRoleOpportunityQuestion(text = "") {
  const value = String(text || "").toLowerCase();

  if (
    value.length > 90 ||
    /\b(chahiyo|chaiyo|chayo|chainxa|chahinxa|salary|phone|owner|contact|business|naam|name|fee|timing)\b/i.test(value)
  ) {
    return false;
  }

  return /\b(butwal|bardaghat|parasi|bhairahawa|jimirbar|sunwal)\b.*\b(driver|waiter|helper|cleaner|cook|kitchen|security|guard|sales)\b.*\b(cha|chha|xa)\b/i.test(value) ||
    /\b(driver|waiter|helper|cleaner|cook|kitchen|security|guard|sales)\b.*\b(butwal|bardaghat|parasi|bhairahawa|jimirbar|sunwal)\b.*\b(cha|chha|xa)\b/i.test(value);
}

function buildAreaRoleOpportunityReply(text = "") {
  const value = String(text || "").toLowerCase();
  const area = value.match(/\b(butwal|bardaghat|parasi|bhairahawa|jimirbar|sunwal)\b/i)?.[1] || "yo area";
  const role = value.match(/\b(driver|waiter|helper|cleaner|cook|kitchen|security|guard|sales)\b/i)?.[1] || "job";
  const areaLabel = titleCase(area);
  const roleLabel = role === "kitchen" ? "kitchen" : role;

  return `${areaLabel} side ko ${roleLabel} opportunity confirm garna requirement/database check garnuparcha. Tapai ${roleLabel} job khojdai hunuhuncha bhane name, phone, experience, license/document, ra salary expectation pathaunus.`;
}

function isPostDraftConfirmation(text = "") {
  return /\b(thik cha|theek cha|ok|okay|register gardinus|register garidinus|note garnus|submit garnus|agadi badhaunus)\b/i.test(String(text || ""));
}

function buildPostDraftConfirmationReply(flow = "") {
  if (flow === "worker") {
    return "Registration draft note bhayo. JobMate human team le verify garera follow-up garcha. Job guarantee chai hudaina.";
  }

  if (flow === "employer") {
    return "Lead draft note bhayo. JobMate human team le requirement verify garera follow-up garcha. Payment/settlement human confirmation pachi matra clear huncha.";
  }

  if (flow === "sahakari") {
    return "Sahakari partnership draft note bhayo. JobMate human team le verify garera follow-up garcha. Final partnership terms human confirmation pachi matra clear huncha.";
  }

  return "Draft note bhayo. JobMate human team le verify garera follow-up garcha.";
}

function titleCase(value = "") {
  return String(value || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}
