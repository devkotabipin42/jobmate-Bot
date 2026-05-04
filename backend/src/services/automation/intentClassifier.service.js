const INTENT_KEYWORDS = {
  job_search: [
    "job cha",
    "job xa",
    "job chha",
    "vacancy cha",
    "vacancy xa",
    "kaam cha",
    "kaam xa",
    "kaam chha",
    "kam cha",
    "kam xa",
    "kam chha",
    "kaam xaina",
    "kam xaina",
    "काम छ",
    "जागिर छ",
    "hiring cha",
    "available job",
    "k kun job",
  ],

  worker_registration: [
    "काम",
    "जागिर",
    "रोजगार",
    "काम चाहियो",
    "जागिर चाहियो",
    "काम खोज्दै",
    "kaam",
    "kam",
    "rojgar",
    "need job",
    "need a job",
    "job seeker",
  ],

  employer_lead: [
    "staff chahiyo",
    "staff chaiyo",
    "worker chahiyo",
    "worker chaiyo",
    "employee chahiyo",
    "employee chaiyo",
    "waiter chahiyo",
    "waiter chaiyo",
    "helper chahiyo",
    "helper chaiyo",
    "driver chahiyo",
    "driver chaiyo",
    "guard chahiyo",
    "guard chaiyo",
    "jana waiter",
    "jana staff",
    "jana worker",
    "hire",
    "hiring",
    "vacancy post",

    "staff",
    "staff chahiyo",
    "स्टाफ",
    "स्टाफ चाहियो",
    "कर्मचारी",
    "कर्मचारी चाहियो",
    "मान्छे चाहियो",
    "manche chahiyo",
    "कामदार",
    "कामदार चाहियो",
    "worker chahiyo",
    "employee",
    "employee chahiyo",
    "need staff",
    "need worker",
    "hire",
    "hiring",
    "vacancy",
    "employer",
    "waiter chahiyo",
    "helper chahiyo",
    
    "manxe chayako",
    "manche chahiyo",
    "manxe chahiyo",
    "manche chayako",
    "koi manxe",
    "koi manche",
    "aauta manxe",
    "auta manxe",
    "euta manxe",
    "aauta manche",
    "staff nabhayera",
    "staff nabhyara",
    "staff ko problem",
    "worker chahiyo",
    "worker chayako",
    "employee chahiyo",
    "employees chahiyo",
    "frontend staff",
    "frontend ko staff",
    "frontend developer chahiyo",
    "developer chahiyo",
    "developer staff",
    "it staff",
    "software developer",
    "react developer",
    "web developer",
  ],

  human_handoff: [
    "मान्छेसँग कुरा",
    "फोन गर्नुहोस्",
    "सम्पर्क गर्नुहोस्",
    "call garnu",
    "call gara",
    "samparka garnu",
    "human",
    "agent",
    "support",
    
  ],

  opt_out: [
    "बन्द गर्नुहोस्",
    "रोक्नुहोस्",
    "सन्देश नपठाउनुहोस्",
    "मलाई नपठाउनुहोस्",
    "चाहिँदैन",
    "stop",
    "unsubscribe",
    "opt out",
    "optout",
  ],

  restart: [
    "start",
    "restart",
    "surugaram",
    "suru garam",
    "feri",
    "फेरि",
    "सुरु",
  ],

  frustrated: [
    "ठगी",
    "धोका",
    "बेकार",
    "नक्कली",
    "विश्वास लागेन",
    "झुटो",
    "काम लागेन",
    "fraud",
    "fake",
    "cheat",
    "useless",
    "scam",
  ],
};

const INTERACTIVE_MAP = {
  need_job: "worker_registration",
  seeker: "worker_registration",
  job_seeker: "worker_registration",
  kaam_chaiyo: "worker_registration",

  need_staff: "employer_lead",
  employer: "employer_lead",
  hire_staff: "employer_lead",
  vacancy: "employer_lead",

  human: "human_handoff",
  talk_to_agent: "human_handoff",
  call_me: "human_handoff",

  stop: "opt_out",
  unsubscribe: "opt_out",
};

const POSITIVE_WORDS = ["1", "yes", "ok", "okay", "ho", "हुन्छ", "ठिक", "ठीक"];
const NEGATIVE_WORDS = ["2", "no", "nai", "hoina", "छैन", "हुँदैन", "होइन"];
const DEFER_WORDS = ["later", "busy", "पछि", "पछि गरौं", "अहिले होइन", "व्यस्त छु"];

const UNSUPPORTED_TYPES = ["image", "audio", "video", "document", "sticker", "location", "contacts"];

export function classifyIntent(input = {}) {
  const phone = safeString(input.phone);
  const messageType = safeString(input.messageType || input.type || "unknown");
  const text = normalizeText(input.text || input.normalizedText || "");
  const buttonId = normalizeText(input.buttonId || input.interactiveReplyId || "");
  const listId = normalizeText(input.listId || "");

  if (!phone) {
    return buildResult("unknown", {
      needsHuman: true,
      priority: "high",
      reason: "Missing phone number",
    });
  }

  const interactiveKey = buttonId || listId;

  if (interactiveKey && INTERACTIVE_MAP[interactiveKey]) {
    return buildResult(INTERACTIVE_MAP[interactiveKey]);
  }

  if (!text && UNSUPPORTED_TYPES.includes(messageType)) {
    return buildResult("unsupported", {
      needsHuman: true,
      priority: "medium",
      reason: "Unsupported message type received",
    });
  }

  if (!text && messageType === "unknown") {
    return buildResult("unknown", {
      needsHuman: false,
      priority: "low",
      reason: "Empty or unknown message",
    });
  }

  if (exactAny(text, INTENT_KEYWORDS.restart)) {
    return buildResult("restart");
  }

  if (containsAny(text, INTENT_KEYWORDS.opt_out)) {
    return buildResult("opt_out");
  }

  if (containsAny(text, INTENT_KEYWORDS.frustrated)) {
    return buildResult("frustrated", {
      needsHuman: true,
      priority: "high",
      reason: "User appears frustrated",
    });
  }

  if (containsAny(text, INTENT_KEYWORDS.human_handoff)) {
    return buildResult("human_handoff", {
      needsHuman: true,
      priority: "high",
      reason: "User requested human support",
    });
  }

  // Important: employer check before job seeker check.
  if (containsAny(text, INTENT_KEYWORDS.employer_lead)) {
    return buildResult("employer_lead", {
      needsHuman: false,
      priority: "low",
      reason: "Employer inquiry detected",
    });
  }

  if (looksLikeLocationJobSearch(text)) {
    return buildResult("job_search");
  }

  // Direct job availability search must win before worker registration.
  // Examples: "Bardaghat ma kaam xa?", "Butwal ma job cha?"
  const clearJobAvailabilitySearch =
    looksLikeJobAvailabilitySearch(text) ||
    /\\b[a-zA-Z\\u0900-\\u097F]+\\s+(ma|maa|मा)\\s+(kaam|kam|job|jagir|काम|जागिर)\\s+(xa|cha|chha|xaina|chaina|छ|छैन)\\b/i.test(text) ||
    /\\b(kaam|kam|job|jagir|काम|जागिर)\\s+(xa|cha|chha|xaina|chaina|छ|छैन)\\b/i.test(text);

  if (clearJobAvailabilitySearch) {
    return buildResult("job_search");
  }

  // "job chaiyo / kaam chahiyo" means user wants to register as job seeker.
  // Avoid broad words like only "kaam/kam" forcing registration.
  if (looksLikeWorkerRegistration(text) || containsClearWorkerRegistration(text)) {
    return buildResult("worker_registration");
  }

  if (containsAny(text, INTENT_KEYWORDS.job_search) || looksLikeJobAvailabilitySearch(text)) {
    return buildResult("job_search");
  }

  if (exactAny(text, POSITIVE_WORDS)) {
    return buildResult("positive");
  }

  if (exactAny(text, NEGATIVE_WORDS)) {
    return buildResult("negative");
  }

  if (containsAny(text, DEFER_WORDS)) {
    return buildResult("defer");
  }

  return buildResult("unknown", {
    needsHuman: false,
    priority: "low",
    reason: "Intent not clear. Show menu.",
  });
}


function looksLikeLocationJobSearch(text = "") {
  const value = String(text || "").toLowerCase().trim();

  const hasJobWord = /\b(job|kaam|kam|work|jagir|vacancy)\b/i.test(value);
  const hasAvailabilityOrNeedWord = /\b(cha|chha|xa|chaiyo|chayio|chahiyo|chayeko|milcha|paiencha|paincha)\b/i.test(value);
  const hasLocationMarker = /\b(ma|maa|tira|area|side)\b/i.test(value);

  return hasJobWord && hasAvailabilityOrNeedWord && hasLocationMarker;
}


function buildResult(intent, options = {}) {
  return {
    intent,
    needsHuman: options.needsHuman || false,
    priority: options.priority || "low",
    reason: options.reason || "",
  };
}

function safeString(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeText(value) {
  return safeString(value).toLowerCase().replace(/\s+/g, " ").trim();
}

function containsAny(text, keywords = []) {
  return keywords.some((keyword) => text.includes(normalizeText(keyword)));
}

function exactAny(text, values = []) {
  return values.map(normalizeText).includes(text);
}



function containsClearWorkerRegistration(text) {
  return containsAny(text, [
    "काम चाहियो",
    "जागिर चाहियो",
    "रोजगार चाहियो",
    "kaam chahiyo",
    "kaam chaiyo",
    "kam chahiyo",
    "kam chaiyo",
    "job chahiyo",
    "job chaiyo",
    "need job",
    "need a job",
    "job seeker",
    "kaam khojna",
    "kam khojna",
    "kaam khojdai",
    "kam khojdai",
  ]);
}

function looksLikeJobAvailabilitySearch(text) {
  // "job chaiyo / kaam chahiyo" means user needs/registers for a job,
  // not asking whether jobs are available.
  const wantsJob = containsAny(text, [
    "chaiyo",
    "chahiyo",
    "chahincha",
    "chahinxa",
    "चाहियो",
    "चाहिन्छ",
    "need job",
    "need a job",
  ]);

  if (wantsJob) return false;

  const hasJobWord = containsAny(text, [
    "job",
    "kaam",
    "kam",
    "काम",
    "jagir",
    "vacancy",
    "hotel",
    "restaurant",
    "driver",
    "security",
    "frontend",
    "it",
  ]);

  const availabilityPatterns = [
    /\bcha\b/,
    /\bxa\b/,
    /\bchha\b/,
    /\bxaina\b/,
    /\bchaina\b/,
    /छ/,
    /छैन/,
    /\?/,
  ];

  const hasAvailabilityWord = availabilityPatterns.some((pattern) =>
    pattern.test(text)
  );

  return hasJobWord && hasAvailabilityWord;
}


function looksLikeWorkerRegistration(text) {
  const wantsJobPatterns = [
    /\bjob\s+(chaiyo|chahiyo|chahincha|chahinxa)\b/,
    /\bkaam\s+(chaiyo|chahiyo|chahincha|chahinxa)\b/,
    /\bkam\s+(chaiyo|chahiyo|chahincha|chahinxa)\b/,
    /\bmalai\s+.*(job|kaam|kam).*\b(chaiyo|chahiyo|chahincha|chahinxa)\b/,
    /काम\s*चाहियो/,
    /जागिर\s*चाहियो/,
  ];

  return wantsJobPatterns.some((pattern) => pattern.test(text));
}


function looksLikeEmployerHiringRequest(text) {
  const hasHiringWord = containsAny(text, [
    "chahiyo",
    "chaiyo",
    "chaincha",
    "chahincha",
    "चाहियो",
    "hire",
    "hiring",
  ]);

  const hasRoleWord = containsAny(text, [
    "staff",
    "worker",
    "employee",
    "waiter",
    "helper",
    "driver",
    "guard",
    "security",
    "cook",
    "cleaner",
    "hotel",
    "factory",
    "jana",
  ]);

  return hasHiringWord && hasRoleWord;
}
