import { findLocation } from "../rag/jobmateKnowledge.service.js";
import { createLeadDraft } from "./leadDraft.service.js";
import { createTaskDraft } from "./taskDraft.service.js";
import { formatReply } from "./replyFormatter.service.js";

const REQUIRED_SAHAKARI_FIELDS = [
  "sahakariName",
  "area",
  "contactPerson",
  "providedPhone",
  "memberCount",
  "businessOwnerMembers",
  "meeting",
  "pilotGoal",
];

export function handleSahakariLeadFlow({
  contact = {},
  state = {},
  text = "",
  startedByIntent = false,
} = {}) {
  const previousData = state?.flow === "sahakari" ? state.data || {} : {};
  const extracted = extractSahakariDetails({ text, contact });
  const data = removeEmptyValues({
    ...previousData,
    ...extracted,
    pilotGoal: extracted.pilotGoal ||
      previousData.pilotGoal ||
      "30-day employment support pilot",
    phone: contact?.phone || previousData.phone || "",
  });

  const missing = getMissingSahakariFields(data);

  if (missing.length > 0) {
    const nextState = {
      ...state,
      flow: "sahakari",
      step: missing[0],
      status: "collecting",
      data,
      updatedAt: new Date().toISOString(),
    };

    const opening = startedByIntent
      ? "JobMate sahakari partnership ma pahila 30-day zero-investment employment support pilot garna prefer garcha. Sahakari le 1 contact person dincha. JobMate le system, registration, matching, reporting, ra follow-up support dincha. Employer placement successful bhaye pilot ma 50/50 revenue share possible huncha. Franchise discussion proof/result pachi matra huncha."
      : "";

    return {
      handled: true,
      intent: "sahakari_partnership",
      conversationIntent: "unknown",
      currentState: `jobmate_sahakari_${missing[0]}`,
      state: nextState,
      reply: formatReply(
        [opening, buildSahakariPrompt({ missing, data })].filter(Boolean).join("\n\n")
      ),
      needsHuman: false,
      priority: "medium",
      reason: startedByIntent
        ? "sahakari_flow_started"
        : "sahakari_flow_collecting",
    };
  }

  const leadDraft = createLeadDraft({
    type: "sahakari_lead",
    contact,
    data: {
      ...data,
      location: data.area,
      managerName: data.contactPerson,
      memberCountApprox: data.memberCount,
      leadKind: "sahakari_partnership",
      pilotLengthDays: 30,
      franchiseFirst: false,
    },
    notes: [
      "Review 30-day pilot fit before discussing franchise or settlement terms.",
    ],
  });

  const taskDraft = createTaskDraft({
    type: "sahakari_pilot_followup",
    leadDraft,
    contact,
    title: "Review sahakari pilot follow-up",
    priority: "high",
    data: {
      sahakariLeadDraftId: leadDraft.id,
      sahakariName: data.sahakariName,
      area: data.area,
      contactPerson: data.contactPerson,
      preferredMeetingTime: data.preferredMeetingTime || "",
    },
  });

  const nextState = {
    ...state,
    flow: null,
    step: null,
    status: "sahakari_draft_pending_human_approval",
    data: {},
    leadDrafts: [...(state.leadDrafts || []), leadDraft].slice(-10),
    taskDrafts: [...(state.taskDrafts || []), taskDraft].slice(-10),
    lastCompletedLeadDraft: leadDraft,
    lastCompletedTaskDraft: taskDraft,
    updatedAt: new Date().toISOString(),
  };

  return {
    handled: true,
    intent: "sahakari_partnership",
    conversationIntent: "unknown",
    currentState: "jobmate_sahakari_draft_pending_approval",
    state: nextState,
    leadDraft,
    taskDraft,
    reply: formatReply(
      [
        "Sahakari partnership lead draft banayo. Human approval pachi 30-day pilot call/field plan agadi badhchha.",
        "Franchise, payment, ra settlement terms yo assistant le final gardaina.",
      ].join("\n\n")
    ),
    needsHuman: true,
    priority: "high",
    reason: "sahakari_lead_draft_created",
  };
}

export function buildSahakariResumePrompt({ state = {} } = {}) {
  const data = state?.data || {};
  const missing = getMissingSahakariFields(data);

  if (!missing.length) {
    return "Aghi ko sahakari detail complete jasto cha. Human approval pachi pilot planning agadi badhchha.";
  }

  return buildSahakariPrompt({ missing, data });
}

export function extractSahakariDetails({ text = "", contact = {} } = {}) {
  const location = findLocation(text);
  const wardArea = parseWardArea(text);
  const contactPerson = parseContactPerson(text) || safeDisplayName(contact?.displayName);

  return removeEmptyValues({
    sahakariName: parseSahakariName(text),
    area: wardArea
      ? wardArea
      : location?.found
      ? {
          area: location.canonical,
          district: location.district || "",
          province: location.province || "Lumbini",
          country: "Nepal",
      }
      : parseLooseArea(text),
    contactPerson,
    providedPhone: parsePhoneNumber(text),
    memberCount: parseMemberCount(text),
    businessOwnerMembers: parseBusinessOwnerMembers(text),
    meetingInterest: parseMeetingInterest(text),
    preferredMeetingTime: parsePreferredMeetingTime(text),
    pilotGoal: parsePilotGoal(text),
  });
}

function buildSahakariPrompt({ missing = [], data = {} } = {}) {
  const known = [];
  if (data.sahakariName) known.push(`sahakari: ${data.sahakariName}`);
  if (data.area?.area) known.push(`area: ${data.area.area}`);
  if (data.contactPerson) known.push(`contact: ${data.contactPerson}`);
  if (data.memberCount) known.push(`members: ${data.memberCount}`);
  if (typeof data.businessOwnerMembers === "boolean") {
    known.push(`business owner members: ${data.businessOwnerMembers ? "cha" : "chaina"}`);
  }
  if (data.preferredMeetingTime) known.push(`meeting: ${data.preferredMeetingTime}`);
  if (data.pilotGoal) known.push(`goal: ${data.pilotGoal}`);

  const askText = missing.map(sahakariFieldLabel).join(", ");

  if (known.length) {
    return `Yo sahakari detail note gare: ${known.join("; ")}.\n\nAba ${askText} pathaunu hola.`;
  }

  return "Sahakari name, working area, contact person, member size, ra 30-day pilot ko main goal pathaunu hola.";
}

function getMissingSahakariFields(data = {}) {
  return REQUIRED_SAHAKARI_FIELDS.filter((field) => {
    if (field === "area") return !data.area?.area;
    if (field === "meeting") return !data.meetingInterest && !data.preferredMeetingTime;
    if (field === "businessOwnerMembers") return typeof data.businessOwnerMembers !== "boolean";
    return !data[field];
  });
}

function sahakariFieldLabel(field) {
  const labels = {
    sahakariName: "sahakari name",
    area: "working area",
    contactPerson: "contact person",
    providedPhone: "phone number",
    memberCount: "member count approx",
    businessOwnerMembers: "business owner members chan ki chaina",
    meeting: "meeting garna milcha ki preferred time",
    pilotGoal: "30-day pilot ko main goal",
  };

  return labels[field] || field;
}

function parseSahakariName(text = "") {
  const value = String(text || "");

  if (/\b(manager|contact|person)\b.*\bnaam\b/i.test(value)) {
    return "";
  }

  const explicitName = value.match(/\b(?:sahakari\s+)?(?:name|naam)\s*(?:is|ho|:)?\s+(.+?)(?:\s+ho\b|[,.;\n]|$)/i);
  if (explicitName && !/partnership|pilot|garna|garnu/i.test(explicitName[1])) {
    const cleaned = cleanName(explicitName[1]);
    return cleaned ? titleCase(cleaned) : "";
  }

  if (/\bhamro\s+sahakari\b/i.test(value)) {
    return "";
  }

  const explicit = value.match(/\b(?:sahakari|cooperative)\s*(?:name|naam)\s*(?:is|ho|:)?\s+([^,.;\n]+)/i);
  if (explicit && !/partnership|pilot|garna|garnu|cha|chha|xa/i.test(explicit[1])) {
    const cleaned = cleanName(explicit[1]);
    return cleaned ? titleCase(cleaned) : "";
  }

  const suffix = value.match(/\b([a-z][a-z\s&.'-]{2,45}\s+(?:sahakari|cooperative))\b/i);
  if (suffix) {
    const cleaned = cleanName(suffix[1]).replace(/^naam\s+/i, "");
    return cleaned ? titleCase(cleaned) : "";
  }

  return "";
}

function parseLooseArea(text = "") {
  const value = String(text || "");
  const match = value.match(/\b(?:area|location|working area|thau)\s*(?:is|ho|:)?\s+([a-z][a-z\s.'-]{1,30})/i);
  if (!match) return null;

  return {
    area: titleCase(cleanName(match[1])),
    district: "",
    province: "Lumbini",
    country: "Nepal",
  };
}

function parseWardArea(text = "") {
  const match = String(text || "").match(/\b(bardaghat|butwal|parasi|bhairahawa|jimirbar|sunwal)\s+ward\s*(?:no\.?\s*)?(\d{1,2})\b/i);
  if (!match) return null;

  return {
    area: `${titleCase(match[1])} ward ${match[2]}`,
    district: "",
    province: "Lumbini",
    country: "Nepal",
  };
}

function parseContactPerson(text = "") {
  const managerName = String(text || "").match(/\b(?:manager|contact person|contact|person)\s+ko\s+naam\s+([a-z][a-z\s.'-]{1,35}?)(?:\s+ho\b|\s+phone\b|,|$)/i);
  if (managerName) return titleCase(cleanName(managerName[1]));

  const manager = String(text || "").match(/\bmanager\s+(?!ko\s+naam\b)([a-z][a-z\s.'-]{1,35}?)(?:\s+ho\b|\s+phone\b|,|$)/i);
  if (manager) return titleCase(cleanName(manager[1]));

  const match = String(text || "").match(/\b(?:contact person|contact|manager|mero naam|name)\s*(?:is|ho|:)?\s+([a-z][a-z\s.'-]{1,35})/i);
  if (!match) return "";
  return titleCase(cleanName(match[1]));
}

function parsePhoneNumber(text = "") {
  const match = String(text || "").match(/\b(9[678]\d{8})\b/);
  return match?.[1] || "";
}

function parseMemberCount(text = "") {
  const match = String(text || "").match(/\b(\d{2,6})\s*(?:jati|approx|around|karib)?\s*(members?|sadasya|member base)\b/i) ||
    String(text || "").match(/\bmembers?\s+(\d{2,6})\s*(?:jati|approx|around|karib)?\b/i) ||
    String(text || "").match(/\bmember\s+(\d{2,6})\s*(?:jati|approx|around|karib)?\b/i) ||
    String(text || "").match(/\bmembers?\s*(?:approx|around|karib)?\s*(\d{2,6})\b/i);
  return match ? Number(match[1]) : null;
}

function parseBusinessOwnerMembers(text = "") {
  const value = String(text || "").toLowerCase();

  if (/\bbusiness\s+owner\s+members?\b.*\b(cha|chha|chan|xa|pani)\b|\bmembers?\b.*\bbusiness\s+owner\b/i.test(value)) {
    return true;
  }

  if (/\bbusiness\s+owner\s+members?\b.*\b(chaina|chhaina|xaina)\b/i.test(value)) {
    return false;
  }

  return null;
}

function parseMeetingInterest(text = "") {
  const value = String(text || "").toLowerCase();

  if (/\bmeeting\b.*\b(milcha|garna|schedule|time|baje)\b|\b(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday|aitabar|sombar|mangalbar|budhbar|bihibar|sukrabar|sanibar)\b.*\bmeeting\b|\bcall\b.*\b(milcha|garna)\b/i.test(value)) {
    return true;
  }

  return null;
}

function parsePreferredMeetingTime(text = "") {
  const match = String(text || "").match(/\bmeeting\b.*?\b((?:sunday|monday|tuesday|wednesday|thursday|friday|saturday|aitabar|sombar|mangalbar|budhbar|bihibar|sukrabar|sanibar)\s+\d{1,2}\s*(?:baje|am|pm)?)\b/i) ||
    String(text || "").match(/\b((?:sunday|monday|tuesday|wednesday|thursday|friday|saturday|aitabar|sombar|mangalbar|budhbar|bihibar|sukrabar|sanibar)\s+\d{1,2}\s*(?:baje|am|pm)?)\b.*\bmeeting\b/i);
  if (!match) return "";
  return titleCase(cleanName(match[1]));
}

function parsePilotGoal(text = "") {
  const value = String(text || "").toLowerCase();

  if (/\bsahakari\b.*\bjobmate\b.*\b(kasari|kam garxa|kaam garxa|work)\b/i.test(value)) {
    return "30-day employment support pilot";
  }

  if (/worker.*data|data.*worker/i.test(value)) {
    return "worker data collection";
  }

  if (/employer.*connect|business.*connect|matching/i.test(value)) {
    return "local matching pilot";
  }

  if (/pilot|partnership|verification|field/i.test(value)) {
    return "30-day pilot partnership";
  }

  return "";
}

function safeDisplayName(name = "") {
  const value = String(name || "").trim();
  if (!value || /^(mitra|unknown|user|whatsapp user|recruiter|admin)$/i.test(value)) {
    return "";
  }
  return value;
}

function cleanName(value = "") {
  return String(value || "")
    .replace(/\b(ho|cha|chha|xa)$/i, "")
    .replace(/\b(?:area|location|contact|person|phone|mobile|number|members?|sadasya|goal|pilot|partnership).*$/i, "")
    .replace(/[^\w\s&.'-]/g, " ")
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
