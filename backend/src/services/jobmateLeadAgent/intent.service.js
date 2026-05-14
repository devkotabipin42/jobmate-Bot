export function normalizeLeadAgentText(text = "") {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s?.-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function createEmptyLeadAgentState() {
  return {
    flow: null,
    step: null,
    data: {},
    leadDrafts: [],
    taskDrafts: [],
    status: "idle",
    updatedAt: new Date().toISOString(),
  };
}

export function getLeadAgentState(conversation = {}) {
  const existing = conversation?.metadata?.jobmateLeadAgent;

  if (!existing || typeof existing !== "object") {
    return createEmptyLeadAgentState();
  }

  return {
    ...createEmptyLeadAgentState(),
    ...existing,
    data: {
      ...(existing.data || {}),
    },
    leadDrafts: Array.isArray(existing.leadDrafts) ? existing.leadDrafts : [],
    taskDrafts: Array.isArray(existing.taskDrafts) ? existing.taskDrafts : [],
  };
}

export function isLeadAgentFlowActive(state = {}) {
  return ["worker", "employer", "sahakari"].includes(state?.flow);
}

export function classifyLeadAgentIntent({ text = "", state = {} } = {}) {
  const value = normalizeLeadAgentText(text);

  if (!value) {
    return { intent: "unknown", confidence: 0, reason: "empty_text" };
  }

  if (/^(start|restart|reset|menu|surugarnu|suru garau|suru garna)$/i.test(value)) {
    return { intent: "reset", confidence: 1, reason: "reset_command" };
  }

  if (isGreeting(value)) {
    return { intent: "greeting", confidence: 0.85, reason: "greeting" };
  }

  if (isLeadAgentFlowActive(state)) {
    return {
      intent: `${state.flow}_continue`,
      confidence: 0.8,
      reason: "active_flow_continuation",
    };
  }

  if (value === "1") {
    return { intent: "worker_start", confidence: 0.9, reason: "main_menu_worker_selection" };
  }

  if (value === "2") {
    return { intent: "employer_start", confidence: 0.9, reason: "main_menu_employer_selection" };
  }

  if (value === "3") {
    return { intent: "sahakari_start", confidence: 0.9, reason: "main_menu_sahakari_selection" };
  }

  if (isSahakariStart(value)) {
    return {
      intent: "sahakari_start",
      confidence: 0.95,
      reason: "sahakari_partnership_phrase",
    };
  }

  if (isKnowledgeQuestion(value)) {
    return {
      intent: "knowledge_question",
      confidence: 0.85,
      reason: "jobmate_knowledge_question",
    };
  }

  if (isEmployerStart(value)) {
    return {
      intent: "employer_start",
      confidence: 0.9,
      reason: "employer_hiring_phrase",
    };
  }

  if (isWorkerStart(value)) {
    return {
      intent: "worker_start",
      confidence: 0.9,
      reason: "worker_job_phrase",
    };
  }

  return { intent: "unknown", confidence: 0, reason: "no_jobmate_lead_agent_match" };
}

function isGreeting(value = "") {
  return /^(hello|hi|hey|namaste|namaskar|start gareko)$/i.test(value);
}

function isWorkerStart(value = "") {
  const normalizedValue = value.replace(/[?.]+$/g, "").trim();
  const commonWorkerVariants = new Set([
    "ajob kojna",
    "job kojna",
    "kaam kojna",
    "kam kojna",
    "job khojna",
    "kaam khojna",
    "kam khojna",
    "kaam xa",
    "job xa",
    "rojgar chahiyo",
    "jagir chahiyo",
  ]);

  return (
    commonWorkerVariants.has(normalizedValue) ||
    /\b(a?job|kaam|kam|work|jagir|rojgar)\s+(khojna|kojna|khojdai|chahiyo|chaiyo|chayo|chaincha|chahinchha|xa|cha|chha|available)\b/i.test(value) ||
    /\b(kaam|kam|job|work|jagir)\s+(xa|cha|chha|available)\b/i.test(value) ||
    /\b(kaam|kam|job|work|jagir)\b.*\b(painxa|paincha|pauxa|pauna|mila|milcha|milchha)\b/i.test(value) ||
    /\b(job|kaam|kam|work|jagir)\s+(chahiyo|chaiyo|chayo|khojdai|khojeko|khojna|chaincha|chahinchha)\b/i.test(value) ||
    /\b(kaam|kam|job|work|jagir)\s+khojdai\s+(chu|chhu|chum|xu)\b/i.test(value) ||
    /\bmalai\s+(kaam|kam|job|work|jagir)\b/i.test(value)
  );
}

function isEmployerStart(value = "") {
  if (/\b(job|kaam|kam|work|jagir)\s+(chahiyo|chaiyo|khojdai|khojna)\b/i.test(value)) {
    return false;
  }

  return (
    /\b(staff|worker|employee|manxe|manche|candidate|helper)\s+(chahiyo|chaiyo|chayo|chaincha|chainxa|chahinxa|khojna|khojdai)\b/i.test(value) ||
    /\b(hire|hiring|vacancy|recruit|requirement)\b/i.test(value) ||
    /\b(?:malai\s+)?(?:\d{1,3}\s*(?:jana\s*)?)?(waiter|cook|driver|helper|guard|security|sales|cleaner|receptionist|accountant|teacher|staff|worker)\s+(chahiyo|chaiyo|chaincha|chainxa|chahinxa|chayo)\b/i.test(value)
  );
}

function isSahakariStart(value = "") {
  return /\b(sahakari|cooperative|co op|coop)\b.*\b(partnership|partner|pilot|collab|sanga kaam|garna|kasari|kam garxa|kaam garxa)\b/i.test(value) ||
    /\b(partnership|pilot|collab)\b.*\b(sahakari|cooperative|co op|coop)\b/i.test(value);
}

function isKnowledgeQuestion(value = "") {
  return /\b(job\s*mate|jobmate)\b.*\b(ke ho|k ho|barema|kasari|what|about)\b/i.test(value) ||
    /\b(ke ho|k ho)\b.*\b(job\s*mate|jobmate)\b/i.test(value);
}
