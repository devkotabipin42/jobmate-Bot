import { findLocation, findRole } from "../rag/jobmateKnowledge.service.js";
import { createLeadDraft } from "./leadDraft.service.js";
import { createTaskDraft } from "./taskDraft.service.js";
import { formatReply } from "./replyFormatter.service.js";
import {
  CANONICAL_WORKER_JOB_TYPE_MENU,
  parseCanonicalWorkerJobType,
} from "../jobmate/workerJobTypeMenu.service.js";

const REQUIRED_WORKER_FIELDS = [
  "jobType",
  "location",
  "fullName",
  "providedPhone",
  "age",
  "experience",
  "expectedSalary",
  "availability",
  "documentStatus",
  "mobilityPreference",
];

const WORKER_AREA_ALIASES = [
  ["jimirbar", "Jimirbar"],
  ["jimirebar", "Jimirbar"],
  ["jimirbaar", "Jimirbar"],
  ["bardaghat", "Bardaghat"],
  ["butwal", "Butwal"],
  ["parasi", "Parasi"],
  ["bhairahawa", "Bhairahawa"],
  ["sunwal", "Sunwal"],
];

const REAL_WORKER_CATEGORY_MENU = CANONICAL_WORKER_JOB_TYPE_MENU;

export function handleWorkerLeadFlow({
  contact = {},
  state = {},
  text = "",
  startedByIntent = false,
} = {}) {
  const previousData = state?.flow === "worker" ? state.data || {} : {};
  const activeGuard = detectWorkerActiveFlowGuard({
    text,
    state,
    previousData,
    startedByIntent,
  });

  if (activeGuard) {
    return buildWorkerActiveFlowGuardResult({
      guard: activeGuard,
      state,
      data: previousData,
    });
  }

  const rawExtracted = extractWorkerDetails({ text, contact, currentStep: state?.step });
  const extracted = normalizeWorkerStepExtraction({
    extracted: rawExtracted,
    previousData,
    currentStep: state?.step,
  });
  const unclearCount = getNextWorkerUnclearCount({
    state,
    text,
    extracted,
    startedByIntent,
  });

  if (unclearCount > 1) {
    return buildWorkerActiveFlowGuardResult({
      guard: {
        type: "repeated_unclear",
        workerUnclearCount: unclearCount,
      },
      state,
      data: previousData,
    });
  }

  const mergedData = removeEmptyValues({
    ...previousData,
    ...extracted,
    phone: contact?.phone || previousData.phone || "",
  });
  const data = normalizeWorkerLeadData(applySkipForCurrentStep({
    data: mergedData,
    currentStep: state?.step,
    text,
  }));

  const missing = getMissingWorkerFields(data);

  if (missing.length > 0) {
    const nextState = {
      ...state,
      flow: "worker",
      step: missing[0],
      status: "collecting",
      data,
      guard: {
        ...(state?.guard || {}),
        workerUnclearCount: unclearCount,
      },
      updatedAt: new Date().toISOString(),
    };

    return {
      handled: true,
      intent: "worker_lead",
      conversationIntent: "worker_registration",
      currentState: `jobmate_worker_${missing[0]}`,
      state: nextState,
      reply: formatReply(buildWorkerPrompt({ missing, data, startedByIntent })),
      needsHuman: false,
      priority: "low",
      reason: startedByIntent ? "worker_flow_started" : "worker_flow_collecting",
    };
  }

  const leadDraft = createLeadDraft({
    type: "worker_lead",
    contact,
    data: {
      ...data,
      roleInterest: data.jobType,
      currentLocation: data.location,
      documentsStatus: data.documentStatus,
      leadKind: "worker_jobseeker",
    },
    notes: [
      "Approve this worker lead before matching with employer requirements.",
    ],
  });

  const taskDraft = createTaskDraft({
    type: "worker_lead_review",
    leadDraft,
    contact,
    title: "Review worker lead draft",
    priority: "high",
    data: {
      workerLeadDraftId: leadDraft.id,
      requestedRole: data.jobType,
      location: data.location,
      availability: data.availability,
    },
  });

  const nextState = {
    ...state,
    flow: null,
    step: null,
    status: "worker_draft_pending_human_approval",
    data: {},
    leadDrafts: [...(state.leadDrafts || []), leadDraft].slice(-10),
    taskDrafts: [...(state.taskDrafts || []), taskDraft].slice(-10),
    lastCompletedLeadDraft: leadDraft,
    lastCompletedTaskDraft: taskDraft,
    updatedAt: new Date().toISOString(),
  };

  return {
    handled: true,
    intent: "worker_lead",
    conversationIntent: "worker_registration",
    currentState: "jobmate_worker_draft_pending_approval",
    state: nextState,
    leadDraft,
    taskDraft,
    reply: formatReply(
      [
        "Tapai ko worker lead draft banayo. Human team le approve garepachi matra matching process agadi badhchha.",
        "Job guarantee hudaina, tara suitable opportunity aayo bhane JobMate team le contact garcha.",
      ].join("\n\n")
    ),
    needsHuman: true,
    priority: "high",
    reason: "worker_lead_draft_created",
  };
}

export function buildWorkerResumePrompt({ state = {} } = {}) {
  const data = state?.data || {};
  const missing = getMissingWorkerFields(data);

  if (!missing.length) {
    return "Aghi ko worker detail complete jasto cha. Human approval pachi process agadi badhchha.";
  }

  return buildWorkerPrompt({ missing, data, startedByIntent: false });
}

export function extractWorkerDetails({ text = "", contact = {}, currentStep = "" } = {}) {
  const role = findRole(text);
  const fallbackRole = parseWorkerRoleFallback(text);
  const location = findLocation(text);
  const locationValue = location?.found
    ? {
        area: location.canonical,
        district: location.district || "",
        province: location.province || "Lumbini",
        country: "Nepal",
      }
    : parseLooseLocation(text);
  const preferredArea = parsePreferredArea(text) ||
    (currentStep === "mobilityPreference" ? preferredAreaFromLocation(locationValue) : "");
  const shouldCaptureLocation = currentStep !== "mobilityPreference" || !preferredArea;
  const name = parsePersonName(text) || safeDisplayName(contact?.displayName);

  return removeEmptyValues({
    fullName: name,
    providedPhone: parsePhoneNumber(text),
    age: parseAge(text),
    jobType: resolveWorkerJobType({ role, fallbackRole }),
    ...(shouldCaptureLocation ? { location: locationValue } : {}),
    experience: parseExperience(text),
    availability: parseAvailability(text),
    expectedSalary: parseSalaryRange(text),
    documentStatus: parseDocumentStatus(text),
    travelPreference: parseTravelPreference(text),
    preferredArea,
  });
}

function buildWorkerPrompt({ missing = [], data = {}, startedByIntent = false } = {}) {
  const known = [];
  if (data.jobType) known.push(`kaam: ${data.jobType}`);
  if (data.location?.area) known.push(`area: ${data.location.area}`);
  if (data.experience) known.push(`experience: ${data.experience.label}`);
  if (data.availability) known.push(`availability: ${data.availability.label}`);
  if (data.documentStatus) known.push(`documents: ${workerDocumentLabel(data.documentStatus)}`);
  if (data.preferredArea) known.push(`preferred area: ${data.preferredArea}`);
  if (data.travelPreference) known.push(`travel: ${workerTravelLabel(data.travelPreference)}`);

  const askText = missing.map(workerFieldLabel).join(", ");

  if (known.length) {
    return `Yo detail note gare: ${known.join("; ")}.\n\nAba ${askText} pathaunu hola.`;
  }

  if (startedByIntent) {
    return "Tapai kasto kaam khojnu bhayeko ho? Job type, area/location, experience ra availability pathaunus.";
  }

  return `Aba ${askText} pathaunu hola.`;
}

function detectWorkerActiveFlowGuard({
  text = "",
  state = {},
  previousData = {},
  startedByIntent = false,
} = {}) {
  if (startedByIntent || state?.flow !== "worker") return null;

  if (isUnrealisticWorkerInput(text)) {
    return { type: "unrealistic_job_input" };
  }

  if (isWorkerGuaranteeQuestion(text)) {
    return { type: "worker_job_guarantee_question" };
  }

  if (isWorkerWhenToSendQuestion(text)) {
    return { type: "worker_when_to_send_question" };
  }

  if (isWorkerWhereHowToSendQuestion(text)) {
    return { type: "worker_where_how_to_send_question" };
  }

  return null;
}

function buildWorkerActiveFlowGuardResult({
  guard = {},
  state = {},
  data = {},
} = {}) {
  const nextState = {
    ...state,
    flow: "worker",
    step: state?.step || "jobType",
    status: "collecting",
    data: {
      ...(data || {}),
    },
    guard: {
      ...(state?.guard || {}),
      workerUnclearCount: guard.workerUnclearCount || state?.guard?.workerUnclearCount || 0,
      lastWorkerGuard: guard.type,
    },
    updatedAt: new Date().toISOString(),
  };

  const currentState = `jobmate_worker_${nextState.step}`;

  return {
    handled: true,
    intent: "worker_lead",
    conversationIntent: "worker_registration",
    currentState,
    state: nextState,
    reply: buildWorkerGuardReply(guard.type),
    needsHuman: false,
    priority: "low",
    reason: `worker_active_flow_guard:${guard.type}`,
  };
}

function buildWorkerGuardReply(type = "") {
  if (type === "unrealistic_job_input") {
    return [
      "Mitra ji, yo kaam haru practical/verified job category bhitra pardaina jasto lagyo 🙏 JobMate ma driver, hotel/helper, security, shop/retail, construction/labor, agriculture, sales/marketing jasta real kaam ko lagi registration garna milcha. Tapai sachikai kun kaam khojna chahanu huncha?",
      REAL_WORKER_CATEGORY_MENU,
    ].join("\n\n");
  }

  if (type === "worker_job_guarantee_question") {
    return [
      "Mitra ji, job guarantee chai dina mildaina 🙏 Tapai le vaneko kaam practical/verified job category bhitra parena bhane JobMate le support garna sakdaina.",
      "Real kaam ko lagi register garna chahanu huncha bhane kun category ho channus:",
      REAL_WORKER_CATEGORY_MENU,
    ].join("\n\n");
  }

  if (type === "worker_when_to_send_question") {
    return [
      "Aile yahi WhatsApp ma pathauna milcha 🙏",
      "Format yesto pathaunus:\nNaam:\nKaam type:\nArea/location:\nExperience:\nAvailability:\nPhone:\nDocuments cha/chaina:",
    ].join("\n\n");
  }

  if (type === "worker_where_how_to_send_question") {
    return [
      "Yahi WhatsApp ma text/photo/file pathaunus 🙏 Text details pani yahi message ma pathauna milcha.",
      "Format:\nNaam:\nKaam type:\nArea/location:\nExperience:\nAvailability:\nPhone:\nDocuments cha/chaina:",
    ].join("\n\n");
  }

  return [
    "Mitra ji, short ma real job category channus ani registration agadi badhaunchu:",
    REAL_WORKER_CATEGORY_MENU,
  ].join("\n\n");
}

function getNextWorkerUnclearCount({
  state = {},
  text = "",
  extracted = {},
  startedByIntent = false,
} = {}) {
  if (startedByIntent || state?.flow !== "worker") return 0;
  if (isSkipAnswer(text)) return 0;
  if (!String(text || "").trim()) return 0;
  if (hasMeaningfulWorkerExtraction({ extracted, text })) return 0;

  return Number(state?.guard?.workerUnclearCount || 0) + 1;
}

function hasMeaningfulWorkerExtraction({ extracted = {}, text = "" } = {}) {
  const meaningfulKeys = [
    "jobType",
    "location",
    "providedPhone",
    "age",
    "experience",
    "expectedSalary",
    "availability",
    "documentStatus",
    "travelPreference",
    "preferredArea",
  ];

  if (meaningfulKeys.some((key) => Boolean(extracted[key]))) return true;

  return Boolean(extracted.fullName && /\b(naam|name|mero naam)\b/i.test(String(text || "")));
}

function isUnrealisticWorkerInput(text = "") {
  const value = normalizeGuardText(text);

  return (
    /train\s+ko\s+chakka.*hawa\s+hal/i.test(value) ||
    /(kukur\s*ko|kukurko)\s+sin.*tel\s+hal/i.test(value) ||
    /(sungur\s*ko|sungurko)\s+kapal.*luga\s+bana/i.test(value) ||
    /sarpa\s*ko\s+khutta/i.test(value) ||
    /sarpako\s+khutta/i.test(value) ||
    /(kukurko|sungurko|sarpako|kukur|sungur|sarpa|saap|snake|train)\b.*\b(chakka|sin|kapal|khutta)\b.*\b(tel|luga|hawa|malis|banaune|halne)\b/i.test(value)
  );
}

function isWorkerGuaranteeQuestion(text = "") {
  const value = normalizeGuardText(text);

  return (
    /\b(maile\s+vaneko|yo|tyo)?\s*(kaam|kam|job)\s+(pauxa|pauxata|pauncha|paincha|painxa|milcha|milchha)\b/i.test(value) ||
    /\b(guarantee|pakka)\b.*\b(job|kaam|kam|paune|pauxa|paincha)\b/i.test(value) ||
    /\b(job|kaam|kam)\b.*\b(guarantee|pakka)\b/i.test(value)
  );
}

function isWorkerWhenToSendQuestion(text = "") {
  return /\b(kahile|kaile)\s+(pathaunu|pathaune|send)\b/i.test(normalizeGuardText(text));
}

function isWorkerWhereHowToSendQuestion(text = "") {
  const value = normalizeGuardText(text);
  return (
    /\b(kasari|kaha|kata)\b.*\b(pathaunu|pathaune|send)\b/i.test(value) ||
    /\b(document|details?)\s+(kaha|kata|kasari)\b/i.test(value)
  );
}

function normalizeGuardText(text = "") {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getMissingWorkerFields(data = {}) {
  return REQUIRED_WORKER_FIELDS.filter((field) => {
    if (field === "location") return !data.location?.area;
    if (field === "mobilityPreference") {
      return !data.preferredArea &&
        !data.travelPreference &&
        !isFieldSkipped(data, "mobilityPreference");
    }
    if (isFieldSkipped(data, field)) return false;
    return !data[field];
  });
}

function workerFieldLabel(field) {
  const labels = {
    jobType: "kun kaam khojnu bhayo",
    location: "kun area ma kaam garna milcha",
    fullName: "tapai ko naam",
    providedPhone: "phone number",
    age: "age",
    experience: "experience kati cha",
    expectedSalary: "expected salary",
    availability: "kahile bata available hunuhunchha",
    documentStatus: "license/citizenship/CV documents cha ki pachi dinu huncha",
    mobilityPreference: "preferred area ya travel garna milcha ki mildaina",
  };

  return labels[field] || field;
}

function parsePersonName(text = "") {
  const match = String(text || "").match(/\b(?:mero naam|name|naam)\s+([a-z][a-z\s.'-]{1,35})/i);
  if (!match) return "";
  return titleCase(cleanPhrase(match[1]));
}

function parsePhoneNumber(text = "") {
  const match = String(text || "").match(/\b(9[678]\d{8})\b/);
  return match?.[1] || "";
}

function parseAge(text = "") {
  const match = String(text || "").match(/\bage\s*(?:is|ho|:)?\s*(\d{2})\b/i) ||
    String(text || "").match(/\b(\d{2})\s*(?:years?\s*old|barsa|barsha)\b/i);
  if (!match) return null;

  const age = Number(match[1]);
  return age >= 14 && age <= 80 ? age : null;
}

function parseWorkerRoleFallback(text = "") {
  const value = String(text || "").toLowerCase();
  const compact = value.replace(/[?.]+$/g, "").trim();

  if (/\b(jasto\s+sukai|jun\s+sukai|j\s+sukai|any\s+work|jasto\s+ni|je\s+pani)\b/i.test(value)) {
    return "General Helper / Any suitable work";
  }

  if (/\bshop\s+helper\b/i.test(value) && /\bhotel\b/i.test(value)) {
    return "Shop Helper / Hotel Helper";
  }

  if (/^(marketing|marketting)$/.test(compact)) {
    return "Marketing";
  }

  const canonicalRole = parseCanonicalWorkerJobType(compact);
  if (canonicalRole) {
    return canonicalRole;
  }

  const roles = [
    ["waiter", "Waiter"],
    ["cook", "Cook"],
    ["kitchen", "Kitchen Staff"],
    ["driver", "Driver"],
    ["security", "Security Guard"],
    ["guard", "Security Guard"],
    ["helper", "Helper"],
    ["cleaner", "Cleaner"],
    ["sales", "Sales Staff"],
    ["shop", "Shop Staff"],
    ["factory", "Factory Worker"],
    ["teacher", "Teacher"],
    ["accountant", "Accountant"],
  ];

  const found = roles.find(([needle]) => value.includes(needle));
  return found?.[1] || "";
}

function resolveWorkerJobType({ role = {}, fallbackRole = "" } = {}) {
  if (fallbackRole === "Marketing" || fallbackRole.includes(" / ")) {
    return fallbackRole;
  }

  if (role?.found) return role.label;

  return fallbackRole;
}

function parseLooseLocation(text = "") {
  const value = String(text || "");
  const match = value.match(/\b(?:area|location|thau)\s+([a-z][a-z\s.'-]{1,30})/i);
  if (!match) return null;

  return {
    area: titleCase(cleanPhrase(match[1])),
    district: "",
    province: "Lumbini",
    country: "Nepal",
  };
}

function parseExperience(text = "") {
  const value = String(text || "").toLowerCase();

  if (/\b(no|zero|0)\s+(experience|exp)|experience\s+chaina|naya chu|new chu/i.test(value)) {
    return { level: "none", label: "No experience" };
  }

  const yearMatch = value.match(/\b(\d{1,2})\s*(year|years|barsa|barsha|yrs?)\b/i);
  if (yearMatch) {
    const years = Number(yearMatch[1]);
    return { years, label: `${years} year${years === 1 ? "" : "s"}` };
  }

  const monthMatch = value.match(/\b(\d{1,2})\s*(month|months|mahina)\b/i);
  if (monthMatch) {
    const months = Number(monthMatch[1]);
    const sector = /\bhotel\b/i.test(value) ? "hotel" : "";
    return {
      months,
      label: `${months} month${months === 1 ? "" : "s"}${sector ? ` ${sector} experience` : ""}`,
      ...(sector ? { sector } : {}),
    };
  }

  if (/\bexperienced|experience cha|kaam gareko|kaam garechu/i.test(value)) {
    return { level: "experienced", label: "Experienced" };
  }

  return null;
}

function parseAvailability(text = "") {
  const value = String(text || "").toLowerCase();

  if (/\b(immediate|turuntai|aaja|aja|today|bholi|voli|tomorrow|ready|ahile|now)\b/i.test(value)) {
    return { value: "immediate", label: "Immediate" };
  }

  const weekMatch = value.match(/\b(\d{1,2})\s*(week|weeks|hapta)\b/i);
  if (weekMatch && hasAvailabilityContext(value)) {
    return {
      value: "within_weeks",
      weeks: Number(weekMatch[1]),
      label: `${Number(weekMatch[1])} week bhitra`,
    };
  }

  const monthMatch = value.match(/\b(\d{1,2})\s*(month|months|mahina)\b/i);
  if (monthMatch && hasAvailabilityContext(value)) {
    return {
      value: "within_months",
      months: Number(monthMatch[1]),
      label: `${Number(monthMatch[1])} month bhitra`,
    };
  }

  return null;
}

function hasAvailabilityContext(value = "") {
  return /\b(bhitra|within|pachi|dekhi|available|ready|join|start)\b/i.test(value);
}

function parseSalaryRange(text = "") {
  const value = String(text || "").toLowerCase();
  const range = value.match(/\b(\d{4,6})\s*(?:-|to|dekhi)\s*(\d{4,6})\b/i);
  if (range) {
    return {
      min: Number(range[1]),
      max: Number(range[2]),
      currency: "NPR",
      finalizedByBot: false,
    };
  }

  const single = value.match(/\b(\d{4,6})\s*(salary|npr|rs)?\b/i);
  if (single && /salary|talaab|talab|npr|rs/i.test(value)) {
    return {
      min: Number(single[1]),
      max: Number(single[1]),
      currency: "NPR",
      finalizedByBot: false,
    };
  }

  const singleK = value.match(/\b(?:salary|talaab|talab|npr|rs)\s*(\d{1,3})\s*k\b/i) ||
    value.match(/\b(\d{1,3})\s*k\s*(?:salary|npr|rs)?\b/i);
  if (singleK && /salary|talaab|talab|npr|rs|\bk\b/i.test(value)) {
    return {
      min: Number(singleK[1]) * 1000,
      max: Number(singleK[1]) * 1000,
      currency: "NPR",
      finalizedByBot: false,
    };
  }

  return null;
}

function parseDocumentStatus(text = "") {
  const value = String(text || "").toLowerCase();
  const hasDocumentWord = /\b(documents?|document|license|citizenship|nagarikta|cv)\b/i.test(value);
  const hasPositive = /\b(documents?|document|license|citizenship|nagarikta|cv)\b.*\b(cha|chha|xa|ready)\b/i.test(value);
  const hasNegative = /\b(documents?|document|license|citizenship|nagarikta|cv)\b.*\b(chaina|chhaina|xaina)\b/i.test(value);

  if (/\b(documents?|document|license|citizenship|cv)\b.*\b(partial|aadha|kehi)\b/i.test(value)) {
    return "partial";
  }

  if (hasDocumentWord && hasPositive && hasNegative) {
    return "partial";
  }

  if (hasPositive) {
    return "available";
  }

  if (hasNegative) {
    return "not_available";
  }

  return "";
}

function parseTravelPreference(text = "") {
  const value = String(text || "").toLowerCase();

  if (/\btravel\s+garna\s+milcha|travel\s+ok|travel\s+garna\s+ready\b|\barea\s+milcha\b|\bduita\s+milcha\b/i.test(value)) {
    return "can_travel";
  }

  if (/\btravel\s+garna\s+mil(daina|deina)|travel\s+chaina\b/i.test(value)) {
    return "cannot_travel";
  }

  return "";
}

function parsePreferredArea(text = "") {
  const value = String(text || "");
  const explicit = value.match(/\bpreferred\s+area\s*(?:is|ho|:)?\s+([a-z][a-z\s.'-]{1,30})/i);
  if (explicit) return titleCase(cleanPhrase(explicit[1]));

  const slashArea = value.match(/\b([a-z][a-z\s.'-]{1,25}\s*\/\s*[a-z][a-z\s.'-]{1,25})\s*(?:area\s*)?(?:milcha|ok|thik|huncha|hunchha)\b/i);
  if (slashArea) {
    return slashArea[1]
      .split("/")
      .map((part) => titleCase(cleanPhrase(part)))
      .filter(Boolean)
      .join("/");
  }

  const knownAreas = findKnownWorkerAreaMentions(value);
  if (knownAreas.length >= 2 && /\b(duita|duba?i|milcha|milchha|ok|thik|huncha|hunchha)\b/i.test(value)) {
    return knownAreas.join(", ");
  }

  const areaMilcha = value.match(/\b([a-z][a-z\s.'-]{1,30})\s+area\s+(?:milcha|ok|thik|huncha|hunchha)\b/i);
  if (!areaMilcha) return "";

  return titleCase(cleanPhrase(areaMilcha[1]));
}

function preferredAreaFromLocation(location = null) {
  return location?.area || "";
}

function findKnownWorkerAreaMentions(text = "") {
  const value = String(text || "").toLowerCase();
  const mentions = [];

  for (const [alias, canonical] of WORKER_AREA_ALIASES) {
    const pattern = new RegExp(`\\b${escapeRegExp(alias)}\\b`, "gi");
    let match = pattern.exec(value);

    while (match) {
      mentions.push({ index: match.index, canonical });
      match = pattern.exec(value);
    }
  }

  const seen = new Set();
  return mentions
    .sort((a, b) => a.index - b.index)
    .map((mention) => mention.canonical)
    .filter((canonical) => {
      if (seen.has(canonical)) return false;
      seen.add(canonical);
      return true;
    });
}

function escapeRegExp(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeWorkerLeadData(data = {}) {
  if (!data.jobType) return data;

  return {
    ...data,
    roleInterest: data.jobType,
  };
}

function normalizeWorkerStepExtraction({
  extracted = {},
  previousData = {},
  currentStep = "",
} = {}) {
  let normalized = { ...extracted };

  if (
    currentStep !== "location" &&
    previousData?.location?.area &&
    normalized?.location?.area
  ) {
    const { location, ...rest } = normalized;
    normalized = rest;
  }

  if (
    currentStep !== "jobType" &&
    previousData?.jobType &&
    normalized?.jobType
  ) {
    const { jobType, ...rest } = normalized;
    normalized = rest;
  }

  return normalized;
}

function applySkipForCurrentStep({ data = {}, currentStep = "", text = "" } = {}) {
  if (!isSkipAnswer(text) || !currentStep) return data;

  const skippedFields = new Set(Array.isArray(data.skippedFields) ? data.skippedFields : []);
  skippedFields.add(currentStep);

  return {
    ...data,
    skippedFields: [...skippedFields],
  };
}

function isSkipAnswer(text = "") {
  return /\b(thaha\s+chaina|pachi\s+dinchu|pachi\s+pathaunchu|later|skip|ahile\s+chaina|aile\s+chaina)\b/i.test(String(text || ""));
}

function isFieldSkipped(data = {}, field = "") {
  return Array.isArray(data.skippedFields) && data.skippedFields.includes(field);
}

function workerDocumentLabel(status = "") {
  const labels = {
    available: "available",
    partial: "partial",
    not_available: "not available",
  };

  return labels[status] || status;
}

function workerTravelLabel(status = "") {
  const labels = {
    can_travel: "can travel",
    cannot_travel: "cannot travel",
  };

  return labels[status] || status;
}

function safeDisplayName(name = "") {
  const value = String(name || "").trim();
  if (!value || /^(mitra|unknown|user|whatsapp user|recruiter|admin)$/i.test(value)) {
    return "";
  }
  return value;
}

function cleanPhrase(value = "") {
  return String(value || "")
    .replace(/\b(ho|phone|mobile|number|job|kaam|kam|area|location|experience|available|age|salary|documents?|travel|preferred).*$/i, "")
    .replace(/[^\w\s.'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCase(value = "") {
  return String(value || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function removeEmptyValues(input = {}) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => {
      if (value === null || value === undefined || value === "") return false;
      if (typeof value === "object" && !Array.isArray(value)) {
        return Object.values(value).some((item) => item !== null && item !== undefined && item !== "");
      }
      return true;
    })
  );
}
