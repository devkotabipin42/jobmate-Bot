// JobMate tenant config for Aarati v2.0.
// This file preserves the existing generic conversation engine integration.

import {
  resolveLumbiniLocation,
} from "../services/jobmate/lumbiniLocation.service.js";
import { resolveJobMateLocationSmart } from "../services/location/smartLocationResolver.service.js";
import { extractJobSearchWithAI } from "../services/ai/jobmateJobSearchExtractionAI.service.js";
import { runJobSearchStep } from "../services/jobmate/jobSearchStep.js";
import { findLocation } from "../services/rag/jobmateKnowledge.service.js";
import { WorkerProfile } from "../models/WorkerProfile.model.js";
import { buildWorkerProfileUpdateFromAaratiProfile } from "../services/jobmate/workerProfileMapper.service.js";
import { upsertJobApplicationFromWorkerProfile } from "../services/jobmate/jobApplication.service.js";
import { createNotification } from "../services/notifications/notification.service.js";
import { scheduleFollowup } from "../services/followups/followupScheduler.service.js";
import { generateJSONWithAI } from "../services/ai/aiProvider.service.js";
import {
  AARATI_SAMPLE_REPLIES,
  buildAaratiPrompt,
  formatAaratiJobsList,
  isAaratiIdentityQuestion,
  isAaratiOffTopic,
} from "../personas/aarati.persona.js";
import {
  generateWithNepaliValidation,
  sanitizeAaratiOutput,
} from "../services/ai/nepaliValidator.service.js";
import {
  getOrSetLLMCache,
} from "../services/ai/llmCache.service.js";
import {
  CANONICAL_WORKER_JOB_TYPE_MENU,
  parseCanonicalWorkerJobType,
  WORKER_JOB_TYPE_MAP,
} from "../services/jobmate/workerJobTypeMenu.service.js";
import {
  buildDocumentMetadata,
  buildSafeDocumentAttachmentMetadata,
  isSupportedDocumentMedia,
  saveWorkerDocumentMetadata,
} from "../services/uploads/documentUpload.service.js";

const ENABLE_AARATI_PERSONA = process.env.ENABLE_AARATI_PERSONA !== "false";
const ENABLE_AARATI_LLM = process.env.ENABLE_AARATI_LLM !== "false";

// Job type parsing
const WORKER_REGISTRATION_JOB_TYPES = WORKER_JOB_TYPE_MAP;

const JOB_SEARCH_CATEGORY_TYPES = {
  "1": "IT/Tech",
  "2": "Driver/Transport",
  "3": "Hospitality",
  "4": "Shop/Retail",
  "5": "Security",
  "6": "Construction/Labor",
  "7": "Other",
};

const WORKER_REGISTRATION_STATES = new Set([
  "ask_job_type",
  "ask_jobType",
  "ask_district",
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

const WORKER_REGISTRATION_FIELDS = new Set([
  "jobType",
  "district",
  "availability",
  "documents",
  "fullName",
  "providedPhone",
  "age",
  "experience",
  "expectedSalary",
  "confirmation",
]);

const JOB_SEARCH_TRANSIENT_PROFILE_KEYS = [
  "jobSearchDone",
  "noJobsFound",
  "jobSearchError",
  "jobSearchStrategy",
  "jobSearchResults",
  "searchCategoryAsked",
  "pendingJobSearch",
];

const REGISTER_INTENT_PATTERN = /^(register|registr|profile|save|ho|yes|ok|okay|1|mero detail save|detail save|register garchu|garidinu|garidau)/i;

const OUTSIDE_LUMBINI_ALIASES = [
  "pokhara", "kathmandu", "lalitpur", "bhaktapur", "chitwan", "bharatpur",
  "hetauda", "birgunj", "janakpur", "biratnagar", "dharan", "itahari",
  "damak", "birtamod", "jhapa", "ilam", "dhankuta", "dhangadhi",
  "mahendranagar", "surkhet", "dailekh", "kavre", "banepa", "dhulikhel"
];

function detectOutsideLumbiniLocation(text = "") {
  const value = String(text || "").toLowerCase();
  return OUTSIDE_LUMBINI_ALIASES.find((name) => {
    const pattern = new RegExp(`(^|\\s)${name}(\\s|$)`, "i");
    return pattern.test(value);
  }) || null;
}

function isJobSearchLikeText(text = "") {
  return /(kaam|kam|job|work|jagir|काम|जागिर|cha|chha|xa|milcha|khoj)/i.test(String(text || ""));
}



function getJobSearchCategoryMessage(location = "yo area") {
  return `Hunchha 🙏 ${location} ma kaam khojna sahayog garchhu.

Tapai kun type/sector ko kaam khojdai hunuhunchha?

1. IT / Computer
2. Driver / Transport
3. Hotel / Restaurant
4. Sales / Shop
5. Security Guard
6. Helper / Labor
7. Jun sukai / any`;
}

function normalizeSimpleText(text = "") {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s/-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toDisplayTitle(text = "") {
  return String(text || "")
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word) => {
      if (!word) return word;
      if (word.includes("/")) {
        return word
          .split("/")
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
          .join("/");
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

function parseJobType(text, { workerRegistration = false } = {}) {
  const trimmed = String(text || "").trim();
  if (workerRegistration) {
    return parseCanonicalWorkerJobType(trimmed);
  }

  const numericMap = workerRegistration
    ? WORKER_REGISTRATION_JOB_TYPES
    : JOB_SEARCH_CATEGORY_TYPES;
  if (numericMap[trimmed]) return numericMap[trimmed];

  const lower = normalizeSimpleText(trimmed);
  if (/(marketing|marketting|sales|field marketing|promotion|promoter|parchar)/i.test(lower)) return "Marketing/Sales";
  if (/(hotel|restaurant|waiter|kitchen|cook|cafe)/i.test(lower)) return "Hotel / Restaurant";
  if (/(driver|gadi|license|truck|bus|bike|delivery)/i.test(lower)) return "Driver / Transport";
  if (/(security|guard|watchman)/i.test(lower)) return "Security Guard";
  if (/(farm|agriculture|kheti|krishi)/i.test(lower)) return "Farm / Agriculture";
  if (/(shop|retail|pasal|counter|shop helper)/i.test(lower)) return "Shop / Retail";
  if (/(factory|helper|labor|labour|construction|mistri|plumber|electrician)/i.test(lower)) return "Construction / Labor";
  if (/(frontend|front end|react|developer|\bit\b|computer|software|web|coding|programmer)/i.test(lower)) return "IT/Tech";
  if (/(jun sukai|junsukai|any|other|jasto bhaye pani)/i.test(lower)) return "Other";
  return null;
}

function parseJobTypeReply(text, profile = {}, context = {}) {
  if (isWorkerSmallTalkText(text)) return null;

  const workerRegistration = isWorkerRegistrationActiveContext(context);
  const parsed = parseJobType(text, { workerRegistration });
  if (parsed) return parsed;

  const value = String(text || "").trim();
  const clean = normalizeSimpleText(value);
  if (
    /^[a-zA-Z][a-zA-Z\s/-]{2,40}$/.test(value) &&
    !/(ma|maa|area|district|nawalparasi|rupandehi|kapilvastu|palpa|dang|banke|butwal|parasi|bardaghat|bhardaghat|bhairahawa)$/i.test(clean)
  ) {
    return toDisplayTitle(value);
  }

  return null;
}

function parseAvailability(text) {
  const t = String(text || "").trim().toLowerCase();
  if (t === "1" || /full|din bhari|dinvari/i.test(t)) return "full-time";
  if (t === "2" || /part|aadha|adha/i.test(t)) return "part-time";
  if (t === "3" || /shift/i.test(t)) return "shift";
  if (t === "4" || /jun sukai|junsukai|any/i.test(t)) return "any";
  return null;
}

function parseDocuments(text, profile = {}) {
  const t = String(text || "").trim().toLowerCase();
  const normalized = normalizeSimpleText(t);

  if (
    /trust|leak|leaked|responsible|responsibility|safe|privacy|secure|security|misuse|dar|risk|bharosa|ignore|dekhidaina/i.test(t) ||
    /विश्वास|गोपनीय|सुरक्षित|चुहावट|दुरुपयोग|जिम्मेवारी|डर/i.test(t)
  ) {
    profile.pendingDocumentPrivacyConcern = true;
    return null;
  }

  if (/document bina|without document|bina document|document na/i.test(t)) {
    return "no";
  }

  const hasPositiveDocument =
    /\b(?:xa|cha|chha|छ)\b/i.test(normalized) ||
    /\bphoto\s+pathauna\s+sak(?:chu|chhu|xu|xhu)\b/i.test(normalized);
  const hasNegativeDocument =
    /\b(?:xaina|chaina|chhaina|छैन)\b/i.test(normalized) ||
    /\bpachi\s+(?:dinchu|dinchhu|dina|pathaula|pathaunchu|pathaun?chu)\b/i.test(normalized) ||
    /\bahile\s+(?:xaina|chaina|chhaina)\b/i.test(normalized);

  if (
    t === "3" ||
    /\bpartial\b/i.test(normalized) ||
    /\bkehi\s+(?:xa|cha|chha)\s+kehi\s+(?:xaina|chaina|chhaina)\b/i.test(normalized) ||
    /\bali\s+ali\s+(?:xa|cha|chha)\b/i.test(normalized) ||
    (hasPositiveDocument && hasNegativeDocument)
  ) {
    return "partial";
  }

  if (
    t === "1" ||
    /^(yes|xa|cha|chha|छ|ho)$/i.test(normalized) ||
    /\b(?:document|documents?|citizenship|nagarikta|cv|license)\s+(?:xa|cha|chha|छ)\b/i.test(normalized) ||
    /\bphoto\s+pathauna\s+sak(?:chu|chhu|xu|xhu)\b/i.test(normalized)
  ) {
    return "yes";
  }

  if (
    t === "2" ||
    /^(no|xaina|chaina|chhaina|छैन|hoina)$/i.test(normalized) ||
    /\b(?:document|documents?|citizenship|nagarikta|cv|license)\s+(?:xaina|chaina|chhaina|छैन)\b/i.test(normalized) ||
    /\bahile\s+(?:xaina|chaina|chhaina)\b/i.test(normalized) ||
    /\bpachi\s+(?:dinchu|dinchhu|dina|pathaula|pathaunchu|pathaun?chu)\b/i.test(normalized)
  ) {
    return "no";
  }

  return null;
}

function normalizeDisplayName(contact = {}) {
  const raw = String(contact.displayName || contact.name || "").trim();
  if (!raw || /recruiter|admin|business|unknown/i.test(raw)) return "Mitra";
  return raw;
}

function resolveLocalLocationFromText(cleanText) {
  const raw = String(cleanText || "").trim();

  if (!raw) return null;

  const stripped = raw
    .replace(/^(malai|tapai|hajur|please|pls|ma|hami|mलाई|मलाई)\s+/gi, "")
    .trim();

  const tryResolve = (candidate) => {
    const value = String(candidate || "").trim();
    if (!value || value.length < 3) return null;

    const ragLocation = findLocation(value);

    if (!ragLocation?.found || !ragLocation?.isInsideLumbini) {
      return null;
    }

    return {
      detectedText: ragLocation.canonical,
      resolved: {
        canonical: ragLocation.canonical,
        district: ragLocation.district,
        province: ragLocation.province || "Lumbini",
      },
    };
  };

  // First try full sentence. This catches:
  // "gopigung nawalparasi ma kaam cha", "bhardghat dhanewa", etc.
  const fullMatch = tryResolve(raw);
  if (fullMatch) return fullMatch;

  const strippedMatch = tryResolve(stripped);
  if (strippedMatch) return strippedMatch;

  const cleaned = stripped
    .replace(/\b(ma|maa|मा|tira|side|area|kaam|kam|job|work|jagir|काम|जागिर|cha|chha|xa|milcha|khoj)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  const cleanedMatch = tryResolve(cleaned);
  if (cleanedMatch) return cleanedMatch;

  const locationCandidates = [];
  const patterns = [
    /([A-Za-z\u0900-\u097F]+(?:[\s-][A-Za-z\u0900-\u097F]+)?)\s+(ma|maa|मा)\s+(kaam|kam|job|work|jagir|काम|जागिर)/i,
    /([A-Za-z\u0900-\u097F]+(?:[\s-][A-Za-z\u0900-\u097F]+)?)\s+(tira|side|area)/i,
    /^([A-Za-z\u0900-\u097F]+(?:[\s-][A-Za-z\u0900-\u097F]+)?)$/i,
  ];

  for (const pattern of patterns) {
    const match = stripped.match(pattern);
    if (match?.[1]) {
      locationCandidates.push(match[1].trim());
    }
  }

  for (const candidate of locationCandidates) {
    const resolved = tryResolve(candidate);
    if (resolved) return resolved;
  }

  return null;
}

function locationUpdatesFromResolved(localLocation) {
  const canonical = localLocation?.resolved?.canonical || localLocation?.detectedText || "";
  const district = localLocation?.resolved?.district || canonical;

  return {
    location: canonical,
    area: canonical,
    district,
    province: localLocation?.resolved?.province || "Lumbini",
    isInsideLumbini: true,
    isOutsideLumbini: false,
  };
}

function isWorkerRegistrationActiveContext({
  conversation,
  lastAskedField,
  currentState,
} = {}) {
  const metadata = conversation?.metadata || {};
  const state = currentState || conversation?.currentState || "";

  return (
    conversation?.currentIntent === "worker_registration" ||
    metadata.activeFlow === "worker_registration" ||
    WORKER_REGISTRATION_STATES.has(state) ||
    WORKER_REGISTRATION_FIELDS.has(lastAskedField)
  );
}

function sanitizeWorkerRegistrationProfile({
  profile = {},
  conversation,
  lastAskedField,
  currentState,
  text,
} = {}) {
  const cleaned = { ...profile };

  if (!isWorkerRegistrationActiveContext({ conversation, lastAskedField, currentState })) {
    return cleaned;
  }

  for (const key of JOB_SEARCH_TRANSIENT_PROFILE_KEYS) {
    delete cleaned[key];
  }

  const cleanText = normalizeSimpleText(text);
  if (
    lastAskedField === "jobType" &&
    cleanText &&
    normalizeSimpleText(cleaned.location) === cleanText
  ) {
    delete cleaned.location;
  }

  return cleaned;
}

function shouldRunWorkerRegistrationSearchStep({
  conversation,
  lastAskedField,
  currentState,
} = {}) {
  return !isWorkerRegistrationActiveContext({
    conversation,
    lastAskedField,
    currentState,
  });
}

function parseDistrictReply(text) {
  const t = String(text || "").trim();
  const map = {
    "1": "Nawalparasi West",
    "2": "Rupandehi",
    "3": "Kapilvastu",
    "4": "Palpa",
    "5": "Dang",
    "6": "Banke",
  };

  if (map[t]) return map[t];

  const localLocation = resolveLocalLocationFromText(t);
  if (localLocation) {
    return localLocation.resolved.district || localLocation.resolved.canonical;
  }

  const resolved = resolveLumbiniLocation(t);
  return resolved?.district || resolved?.canonical || t;
}

function buildWorkerEditMenuMessage() {
  return `Kun field edit garnu cha?

1. Kaam / Job type
2. Area / Location
3. Availability
4. Documents
5. Naam
6. Phone
7. Age
8. Experience
9. Expected salary`;
}

function getEditFieldQuestion(field) {
  const questions = {
    jobType: `Naya kaam/job type pathaunus.\n\n${CANONICAL_WORKER_JOB_TYPE_MENU}`,
    district: `Kun district/area ma kaam garna milcha?\n\n1. Nawalparasi West\n2. Rupandehi\n3. Kapilvastu\n4. Palpa\n5. Dang\n6. Banke`,
    availability: `Tapai kati samaya kaam garna milchha?\n\n1. Full-time\n2. Part-time\n3. Shift based\n4. Jun sukai`,
    documents: `Document status ke ho?\n\n1. Chha, photo/file pathauna sakchhu\n2. Chhaina\n3. Kehi chha, kehi chhaina`,
    fullName: "Tapai ko naam pathaunus.",
    providedPhone: "Tapai ko phone/WhatsApp number pathaunus.",
    age: "Tapai ko age kati ho?",
    experience: "Tapai ko experience kati cha? Experience chaina bhane 'no experience' lekhnus.",
    expectedSalary: "Expected salary kati ho? (e.g., 15000, 15000-20000, negotiable)",
  };
  return questions[field] || "Naya value pathaunus.";
}

async function jobmateWorkerFlowGuard({
  text = "",
  contact,
  conversation,
  normalizedMessage,
  lastAskedField,
  currentState,
  profile = {},
} = {}) {
  const activeWorkerContext = isWorkerRegistrationActiveContext({
    conversation,
    lastAskedField,
    currentState,
  });

  if (!activeWorkerContext) {
    return null;
  }

  if (
    (lastAskedField === "confirmation" || currentState === "ask_confirmation") &&
    normalizeSimpleText(text) === "2"
  ) {
    return {
      messageToSend: buildWorkerEditMenuMessage(),
      currentState: "ask_edit_select",
      lastAskedField: "editFieldSelection",
      profileUpdates: {},
    };
  }

  if (lastAskedField === "editFieldSelection" || currentState === "ask_edit_select") {
    const EDIT_FIELD_MAP = {
      "1": "jobType",
      "2": "district",
      "3": "availability",
      "4": "documents",
      "5": "fullName",
      "6": "providedPhone",
      "7": "age",
      "8": "experience",
      "9": "expectedSalary",
    };
    const fieldToEdit = EDIT_FIELD_MAP[normalizeSimpleText(text)];
    if (fieldToEdit) {
      return {
        messageToSend: getEditFieldQuestion(fieldToEdit),
        currentState: `ask_${fieldToEdit}`,
        lastAskedField: fieldToEdit,
        profileUpdates: { [fieldToEdit]: null, confirmation: null },
      };
    }
    return {
      messageToSend: buildWorkerEditMenuMessage(),
      currentState: "ask_edit_select",
      lastAskedField: "editFieldSelection",
      profileUpdates: {},
    };
  }

  if (isWorkerJobNotIntendedText(text)) {
    return {
      messageToSend: "Thik cha Mitra ji. Tapai staff khojna chahanu huncha ki main menu ma jana chahanu huncha?\n1. Staff khojna\n2. Main menu",
      profileUpdates: {
        workerFlowExitOffered: true,
      },
      currentState: "worker_exit_choice",
      lastAskedField: null,
      activeFlow: null,
    };
  }

  if ((lastAskedField === "jobType" || currentState === "ask_jobType" || currentState === "ask_job_type") && isWorkerSmallTalkText(text)) {
    return {
      messageToSend: [
        "Mitra ji, ma JobMate team bata ho 🙏 Aba registration agadi badhauna tapai kasto kaam khojna chahanu huncha?",
        CANONICAL_WORKER_JOB_TYPE_MENU,
      ].join("\n\n"),
      currentState: currentState || "ask_jobType",
      lastAskedField: "jobType",
    };
  }

  if (isSupportedDocumentMedia(normalizedMessage)) {
    const documentMetadata = buildDocumentMetadata(normalizedMessage);
    let savedDocument = documentMetadata;

    try {
      const saved = await saveWorkerDocumentMetadata({
        contact,
        normalized: normalizedMessage,
      });
      savedDocument = saved?.document || documentMetadata;
    } catch (error) {
      console.warn("Worker document metadata save failed:", error?.message);
    }

    const documentProfileUpdates = {
      documentReceived: true,
      documentStatus: "received",
      documentAttachment: buildSafeDocumentAttachmentMetadata(savedDocument),
    };

    if (
      lastAskedField === "documents" ||
      currentState === "ask_documents" ||
      currentState === "ask_document_status"
    ) {
      return {
        messageToSend: "Document photo receive bhayo 🙏\nTapai ko naam pathaunus.",
        profileUpdates: {
          ...documentProfileUpdates,
          documents: "yes",
        },
        currentState: "ask_fullName",
        lastAskedField: "fullName",
      };
    }

    return {
      messageToSend: "Document receive bhayo. Ma JobMate team lai note gardinchhu.",
      profileUpdates: documentProfileUpdates,
      currentState: currentState || conversation?.currentState || "collecting",
      lastAskedField,
    };
  }

  if (lastAskedField === "availability" || currentState === "ask_availability") {
    const availability = parseAvailability(text);
    if (availability) {
      const nextProfile = {
        ...profile,
        availability,
      };

      return {
        messageToSend:
          typeof MESSAGES.askDocuments === "function"
            ? MESSAGES.askDocuments(nextProfile)
            : MESSAGES.askDocuments,
        profileUpdates: {
          availability,
        },
        currentState: "ask_documents",
        lastAskedField: "documents",
      };
    }
  }

  if (lastAskedField !== "jobType") {
    return null;
  }

  if (!isUnrealisticWorkerJobInput(text)) {
    return null;
  }

  return {
    messageToSend: [
      "Mitra ji, yo kaam haru practical/verified job category bhitra pardaina jasto lagyo 🙏 JobMate ma driver, hotel/helper, security, shop/retail, construction/labor, agriculture, sales/marketing jasta real kaam ko lagi registration garna milcha. Tapai sachikai kun kaam khojna chahanu huncha?",
      CANONICAL_WORKER_JOB_TYPE_MENU,
    ].join("\n\n"),
    currentState: currentState || "ask_jobType",
    lastAskedField: "jobType",
  };
}

function isUnrealisticWorkerJobInput(text = "") {
  const value = normalizeSimpleText(text);

  return (
    /train\s+ko\s+chakka.*hawa\s+hal/i.test(value) ||
    /(kukur\s*ko|kukurko)\s+sin.*tel\s+hal/i.test(value) ||
    /(sungur\s*ko|sungurko)\s+kapal.*luga\s+bana/i.test(value) ||
    /sarpa\s*ko\s+khutta|sarpako\s+khutta/i.test(value) ||
    /(kukurko|sungurko|sarpako|kukur|sungur|sarpa|saap|snake|train)\b.*\b(chakka|sin|kapal|khutta)\b.*\b(tel|luga|hawa|malis|banaune|halne)\b/i.test(value)
  );
}

async function jobmateExtractor({ text, profile, conversation, lastAskedField, currentState }) {
  const updates = {};
  const cleanText = String(text || "").trim();

  if (!cleanText) return updates;

  const activeWorkerRegistration = isWorkerRegistrationActiveContext({
    conversation,
    lastAskedField,
    currentState,
  });

  if (activeWorkerRegistration) {
    return extractWorkerActiveStateDetails({
      text: cleanText,
      profile,
      conversation,
      lastAskedField,
      currentState,
    });
  }

  if (isAaratiIdentityQuestion(cleanText)) {
    updates.pendingAaratiReply = AARATI_SAMPLE_REPLIES.botQuestion;
    return updates;
  }

  if (isAaratiOffTopic(cleanText)) {
    updates.pendingAaratiReply = AARATI_SAMPLE_REPLIES.offTopic;
    return updates;
  }

  const stripped = cleanText
    .replace(/^(malai|tapai|hajur|please|pls|ma|hami|mलाई|मलाई)\s+/gi, "")
    .trim();

  const meaninglessWords = [
    "register", "registr", "yes", "ok", "okay", "1", "2", "3", "4",
    "ho", "profile", "save"
  ];

  const isMeaningless = meaninglessWords.includes(stripped.toLowerCase());

  const outsideLocation = detectOutsideLumbiniLocation(cleanText);
  if (outsideLocation && isJobSearchLikeText(cleanText)) {
    updates.location = outsideLocation;
    updates.isOutsideLumbini = true;
    updates.isInsideLumbini = false;
    updates.jobSearchDone = false;
    updates.noJobsFound = false;
    updates.jobSearchResults = [];
    return updates;
  }

  const localLocation = resolveLocalLocationFromText(cleanText);
  if (localLocation && !isMeaningless) {
    const isFreshSearch =
      isJobSearchLikeText(cleanText) ||
      !profile.location ||
      String(profile.location || "").toLowerCase() !== String(localLocation.detectedText || "").toLowerCase();

    if (isFreshSearch) {
      updates.location = localLocation.detectedText;
      updates.area = localLocation.resolved.canonical || localLocation.detectedText;
      updates.district = localLocation.resolved.district || localLocation.resolved.canonical;
      updates.province = localLocation.resolved.province || "Lumbini";
      updates.isInsideLumbini = true;
      updates.isOutsideLumbini = false;
      updates.jobSearchDone = false;
      updates.noJobsFound = false;
      updates.jobSearchResults = [];
      return updates;
    }
  }

  if (isMeaningless) return updates;

  let aiQuery = null;
  try {
    aiQuery = await getOrSetLLMCache({
      namespace: "jobmate_extraction",
      input: { text: cleanText },
      factory: async () => extractJobSearchWithAI({ text: cleanText }),
    }).then((result) => result.value);
  } catch (error) {
    console.warn("AI extraction failed, continuing with rules:", error?.message);
  }

  if (aiQuery?.locationText && isJobSearchLikeText(cleanText)) {
    const outsideFromAI = detectOutsideLumbiniLocation(aiQuery.locationText);
    if (outsideFromAI) {
      updates.location = outsideFromAI;
      updates.isOutsideLumbini = true;
      updates.isInsideLumbini = false;
      updates.jobSearchDone = false;
      updates.noJobsFound = false;
      updates.jobSearchResults = [];
      return updates;
    }

    updates.location = aiQuery.locationText;
    updates.jobSearchDone = false;
    updates.noJobsFound = false;
    updates.jobSearchResults = [];
  } else if (aiQuery?.locationText && !profile.location) {
    updates.location = aiQuery.locationText;
  }

  if (aiQuery?.resolvedLocation) {
    if (!profile.district) {
      updates.district = aiQuery.resolvedLocation.district || aiQuery.resolvedLocation.canonical;
    }
    if (!profile.province) {
      updates.province = aiQuery.resolvedLocation.province || "Lumbini";
    }
    updates.isInsideLumbini = true;
  }

  if (aiQuery?.category && aiQuery.category !== "Other" && !profile.jobType) {
    updates.jobType = aiQuery.category;
  }

  if (aiQuery?.isClearlyOutsideLumbini) {
    updates.isOutsideLumbini = true;
  }

  if (!updates.location && !updates.isOutsideLumbini) {
    const possibleLocation = stripped.match(/^([A-Za-z\u0900-\u097F]+(?:[\s-][A-Za-z\u0900-\u097F]+)?)$/i)?.[1];

    if (possibleLocation && possibleLocation.length >= 3) {
      try {
        const smart = await resolveJobMateLocationSmart(possibleLocation);

        if (smart) {
          updates.location = possibleLocation;

          if (smart.isClearlyOutsideLumbini) {
            updates.isOutsideLumbini = true;
          } else if (smart.isInsideLumbini) {
            updates.isInsideLumbini = true;
            updates.district = smart.district || possibleLocation;
            updates.province = "Lumbini";
          } else {
            updates.isPossiblyLocalNepal = true;
          }
        }
      } catch (error) {
        console.warn("Mapbox resolver failed, continuing:", error?.message);
      }
    }
  }

  return updates;
}

function extractWorkerActiveStateDetails({
  text = "",
  profile = {},
  conversation,
  lastAskedField,
  currentState,
} = {}) {
  const updates = {};
  const cleanText = String(text || "").trim();
  const state = currentState || conversation?.currentState || "";
  const activeField = lastAskedField || state.replace(/^ask_/, "");
  const explicitlyChanging = getWorkerExplicitChangeSet(cleanText);

  if (activeField === "jobType") {
    const jobType = parseJobTypeReply(cleanText, profile, {
      conversation,
      lastAskedField,
      currentState,
    });
    if (jobType) {
      updates.jobType = jobType;
    }
  }

  if (activeField !== "jobType" && explicitlyChanging.has("jobType")) {
    const jobType = parseJobTypeReply(cleanText, profile, {
      conversation,
      lastAskedField: "jobType",
      currentState: "ask_jobType",
    });
    if (jobType) {
      updates.jobType = jobType;
    }
  }

  if (activeField === "district") {
    const localLocation = resolveLocalLocationFromText(cleanText);
    if (localLocation) {
      Object.assign(updates, locationUpdatesFromResolved(localLocation));
    }
  }

  const mixed = parseWorkerMixedDetails(cleanText, { activeField });

  if (
    mixed.location &&
    canUpdateWorkerField({ profile, field: "location", explicitChangeSet: explicitlyChanging })
  ) {
    Object.assign(updates, locationUpdatesFromResolved(mixed.location));
  }

  if (
    mixed.availability &&
    canUpdateWorkerField({ profile, field: "availability", explicitChangeSet: explicitlyChanging })
  ) {
    updates.availability = mixed.availability;
  }

  if (
    mixed.documents &&
    canUpdateWorkerField({ profile, field: "documents", explicitChangeSet: explicitlyChanging })
  ) {
    updates.documents = mixed.documents;
  }

  for (const key of ["fullName", "providedPhone", "phone", "age", "experience", "expectedSalary"]) {
    if (mixed[key] && !profile[key]) updates[key] = mixed[key];
  }

  return updates;
}

function parseWorkerMixedDetails(text = "", { activeField = "" } = {}) {
  const value = String(text || "");
  const updates = {};

  const localLocation = resolveLocalLocationFromText(value);
  if (localLocation) updates.location = localLocation;

  const name = parseWorkerNameDetail(value);
  if (name) updates.fullName = name;

  const phone = parseWorkerPhoneDetail(value);
  if (phone) {
    updates.providedPhone = phone;
    updates.phone = phone;
  }

  const age = parseWorkerAgeDetail(value);
  if (age) updates.age = age;

  const experience = parseWorkerExperienceDetail(value);
  if (experience) updates.experience = experience;

  const expectedSalary = parseWorkerExpectedSalaryDetail(value);
  if (expectedSalary) updates.expectedSalary = expectedSalary;

  const availability = parseWorkerAvailabilityDetail(value);
  if (availability) updates.availability = availability;

  const documents = parseWorkerDocumentDetail(value, { activeField });
  if (documents) updates.documents = documents;

  return updates;
}

function parseWorkerDocumentDetail(text = "", { activeField = "" } = {}) {
  const value = String(text || "").trim();
  const normalized = normalizeSimpleText(value);

  if (activeField === "documents") {
    return parseDocuments(value, {});
  }

  const hasExplicitDocumentContext =
    /\b(?:document|documents?|citizenship|nagarikta|cv|license|photo)\b/i.test(normalized) ||
    /\bkehi\s+(?:xa|cha|chha)\s+kehi\s+(?:xaina|chaina|chhaina)\b/i.test(normalized) ||
    /\bali\s+ali\s+(?:xa|cha|chha)\b/i.test(normalized) ||
    /\bpachi\s+(?:dinchu|dinchhu|dina|pathaula|pathaunchu|pathaun?chu)\b/i.test(normalized) ||
    /\bahile\s+(?:xaina|chaina|chhaina)\b/i.test(normalized);

  return hasExplicitDocumentContext ? parseDocuments(value, {}) : null;
}

function getWorkerExplicitChangeSet(text = "") {
  const value = normalizeSimpleText(text);
  const fields = new Set();

  if (/\b(?:change\s+kaam|kaam\s+change|kaam\s+change\s+garna|job\s+change|role\s+change)\b/i.test(value)) {
    fields.add("jobType");
  }

  if (/\b(?:location\s+change|area\s+change|district\s+change|thau\s+change)\b/i.test(value)) {
    fields.add("location");
  }

  if (/\b(?:availability\s+change|available\s+change|time\s+change)\b/i.test(value)) {
    fields.add("availability");
  }

  if (/\b(?:document\s+status\s+change|documents?\s+change)\b/i.test(value)) {
    fields.add("documents");
  }

  return fields;
}

function canUpdateWorkerField({ profile = {}, field = "", explicitChangeSet = new Set() } = {}) {
  if (explicitChangeSet.has(field)) return true;

  if (field === "location") {
    return !profile.location && !profile.area && !profile.district;
  }

  return !profile[field];
}

function parseWorkerNameDetail(text = "") {
  const match = String(text || "").match(/\b(?:name|naam|mero naam)\s*(?:is|ho|:)?\s*([a-z][a-z\s.'-]{1,35}?)(?=\s*(?:,|;|\n|phone|mobile|num|number|age|umer|experience|salary|availability|available|document|$))/i);
  if (!match) return "";
  return toDisplayTitle(match[1]);
}

function parseWorkerFullNameReply(text = "") {
  const detailed = parseWorkerNameDetail(text);
  if (detailed) return detailed;

  const value = String(text || "").trim();
  const clean = normalizeSimpleText(value);

  if (
    /^[a-zA-Z][a-zA-Z\s.'-]{1,45}$/.test(value) &&
    !/\b(?:phone|mobile|num|number|age|umer|experience|salary|document|kaam|job|full\s*time|part\s*time|shift)\b/i.test(clean)
  ) {
    return toDisplayTitle(value);
  }

  return null;
}

function parseWorkerPhoneDetail(text = "") {
  const match = String(text || "").match(/(?:\b(?:phone(?:\s*num(?:ber)?)?|mobile|number|num)\s*:?\s*)?(?:\+?977[-\s]*)?(9[678]\d{8})\b/i);
  return match?.[1] || "";
}

function parseWorkerPhoneReply(text = "") {
  return parseWorkerPhoneDetail(text) || null;
}

function parseWorkerAgeDetail(text = "") {
  const match = String(text || "").match(/\b(?:age|umer)\s*(?:is|ho|:)?\s*(\d{1,2})\b/i);
  if (!match) return null;

  const age = Number(match[1]);
  return age >= 14 && age <= 80 ? age : null;
}

function parseWorkerAgeReply(text = "") {
  const detailed = parseWorkerAgeDetail(text);
  if (detailed) return detailed;

  const match = String(text || "").trim().match(/^(\d{1,2})$/);
  if (!match) return null;

  const age = Number(match[1]);
  return age >= 14 && age <= 80 ? age : null;
}

function parseWorkerExperienceDetail(text = "") {
  const value = String(text || "").toLowerCase();
  const normalized = normalizeSimpleText(value)
    .replace(/\bexperirnce\b/g, "experience")
    .replace(/\bdui\b/g, "2")
    .replace(/\btin\b/g, "3")
    .replace(/\bek\b/g, "1");

  if (/\bexperience\s*:?\s*(?:no|none|0|chaina|chhaina|xaina)\b/i.test(normalized) ||
    /\b(?:no|zero|0)\s+(?:experience|experirnce|exp)\b/i.test(value) ||
    /\bfresher\b/i.test(normalized)) {
    return { level: "none", label: "No experience" };
  }

  const yearMatch = normalized.match(/\bexperience\s*:?\s*(\d{1,2})\s*(?:year|years|yr|yrs|barsa|barsha)\b/i) ||
    normalized.match(/\b(\d{1,2})\s*(?:year|years|yr|yrs|barsa|barsha)\s*(?:ko\s+)?(?:experience|exp|cha|xa|chha|raicha)?\b/i);
  if (yearMatch) {
    const years = Number(yearMatch[1]);
    return { years, label: `${years} year${years === 1 ? "" : "s"}` };
  }

  const monthMatch = normalized.match(/\bexperience\s*:?\s*(\d{1,2})\s*(?:month|months|mahina)\b/i) ||
    normalized.match(/\b(\d{1,2})\s*(?:month|months|mahina)\s*(?:ko\s+)?(?:experience|exp|cha|xa|chha|raicha)?\b/i);
  if (monthMatch) {
    const months = Number(monthMatch[1]);
    return { months, label: `${months} month${months === 1 ? "" : "s"}` };
  }

  return null;
}

function isWorkerSmallTalkText(text = "") {
  const value = normalizeSimpleText(text);

  return /^(?:khana\s+kha(?:nu|nnu|nu)?\s+bhayo|khana\s+kanu\s+bhayoi|k\s+(?:cha|xa)\s+khabar|k\s+xa\s+kbr|bhok\s+lagyo|hello|hi|namaste|thik\s+cha\??)$/i.test(value);
}

function isWorkerJobNotIntendedText(text = "") {
  return /\b(job|kaam|kam)\s+haina\b|\bhaina\s+(job|kaam|kam)\b/i.test(normalizeSimpleText(text));
}

function parseWorkerExperienceReply(text = "") {
  const detailed = parseWorkerExperienceDetail(text);
  if (detailed) return detailed;

  const value = normalizeSimpleText(text);
  if (/^(?:no|none|0|chaina|chhaina|xaina|experience chaina|no experience|fresher)$/i.test(value)) {
    return { level: "none", label: "No experience" };
  }

  if (/^(?:yes|cha|chha|xa)$/i.test(value)) {
    return { level: "unknown", label: "Experience available" };
  }

  return null;
}

function parseWorkerExpectedSalaryDetail(text = "") {
  const value = String(text || "").toLowerCase().replace(/(?:\+?977[-\s]*)?9[678]\d{8}\b/g, " ");
  const match = value.match(/\b(?:expected\s+salary|salary|talaab|talab|npr|rs)\s*:?\s*(\d{4,6})\b/i);
  if (!match) return null;

  return {
    min: Number(match[1]),
    max: Number(match[1]),
    currency: "NPR",
    finalizedByBot: false,
  };
}

function parseWorkerExpectedSalaryReply(text = "") {
  const value = String(text || "").toLowerCase().replace(/(?:\+?977[-\s]*)?9[678]\d{8}\b/g, " ");
  const detailed = parseWorkerExpectedSalaryDetail(value);
  if (detailed) return detailed;

  const range = value.match(/\b(\d{4,6})\s*(?:-|to|dekhi)\s*(\d{4,6})\b/i);
  if (range) {
    return {
      min: Number(range[1]),
      max: Number(range[2]),
      currency: "NPR",
      finalizedByBot: false,
    };
  }

  const single = value.trim().match(/^(\d{4,6})$/);
  if (single) {
    return {
      min: Number(single[1]),
      max: Number(single[1]),
      currency: "NPR",
      finalizedByBot: false,
    };
  }

  if (/\b(?:negotiable|company anusar|market rate|jasto bhaye pani|junsukai|jun sukai)\b/i.test(value)) {
    return {
      note: toDisplayTitle(value),
      currency: "NPR",
      finalizedByBot: false,
    };
  }

  return null;
}

function parseWorkerConfirmationReply(text = "") {
  const value = normalizeSimpleText(text);
  if (/^(?:1|yes|ho|ok|okay|confirm|save|thik|thik cha|save garnus|garnus)$/i.test(value)) {
    return "confirmed";
  }

  return null;
}

function parseWorkerAvailabilityDetail(text = "") {
  const value = String(text || "").toLowerCase();

  if (/\b(?:availability|available)\s*:?\s*full\s*-?\s*time\b/i.test(value)) return "full-time";
  if (/\b(?:availability|available)\s*:?\s*part\s*-?\s*time\b/i.test(value)) return "part-time";
  if (/\b(?:availability|available)\s*:?\s*shift\b/i.test(value)) return "shift";
  if (/\b(?:availability|available)\s*:?\s*(?:jun sukai|junsukai|any)\b/i.test(value)) return "any";
  if (/\bfull\s*-?\s*time\b/i.test(value)) return "full-time";
  if (/\bpart\s*-?\s*time\b/i.test(value)) return "part-time";

  return null;
}

function formatWorkerExperienceValue(experience) {
  if (!experience) return "-";
  if (typeof experience === "string") return experience;
  return experience.label || experience.level || "-";
}

function formatWorkerExpectedSalaryValue(expectedSalary) {
  if (!expectedSalary) return "-";
  if (typeof expectedSalary === "string") return expectedSalary;
  if (expectedSalary.note) return expectedSalary.note;

  const min = Number(expectedSalary.min || 0);
  const max = Number(expectedSalary.max || 0);
  if (min && max && min !== max) return `NPR ${min}-${max}`;
  if (min || max) return `NPR ${min || max}`;

  return "-";
}

function buildWorkerConfirmationMessage(profile = {}) {
  return `Yo details thik cha?

- Kaam: ${profile.jobType || "-"}
- Area: ${profile.area || profile.location || "-"}
- District: ${profile.district || "-"}
- Availability: ${profile.availability || "-"}
- Documents: ${profile.documents || "-"}
- Naam: ${profile.fullName || "-"}
- Phone: ${profile.providedPhone || profile.phone || "-"}
- Age: ${profile.age || "-"}
- Experience: ${formatWorkerExperienceValue(profile.experience)}
- Expected salary: ${formatWorkerExpectedSalaryValue(profile.expectedSalary)}

1. Ho, save garnus
2. Edit garnu cha`;
}

function buildWorkerCompletionMessage(profile = {}) {
  const privacyNote =
    profile.documents === "privacy_concern"
      ? `\n\nTapai ko chinta thik ho 🙏 Document pathaunu compulsory haina. JobMate team le document sirf verification/hiring process ko lagi herchha. Ahile document bina profile save gareko chhu; pachhi trust bhaye yahi WhatsApp ma pathauna saknuhunchha.`
      : "";

  return `Dhanyabaad 🙏 Tapai ko vivaran JobMate ma save bhayo.

📋 Saved profile:
- Kaam: ${profile.jobType || "-"}
- Area: ${profile.area || profile.location || "-"}
- District: ${profile.district || "-"}
- Availability: ${profile.availability || "-"}
- Documents: ${profile.documents === "privacy_concern" ? "not provided due to privacy concern" : profile.documents || "-"}
- Naam: ${profile.fullName || "-"}
- Phone: ${profile.providedPhone || profile.phone || "-"}
- Age: ${profile.age || "-"}
- Experience: ${formatWorkerExperienceValue(profile.experience)}
- Expected salary: ${formatWorkerExpectedSalaryValue(profile.expectedSalary)}${privacyNote}

Suitable kaam aayepachhi JobMate team le 24-48 ghanta vitra sampark garchha.`;
}

async function generateAaratiAIReply({
  userText,
  profile,
  context,
  fallback,
  instruction,
} = {}) {
  if (!ENABLE_AARATI_LLM) {
    return sanitizeAaratiOutput(fallback);
  }

  return getOrSetLLMCache({
    namespace: "aarati_reply",
    input: { userText, profile, context, instruction },
    factory: async () => generateWithNepaliValidation({
      fallback,
      buildPrompt: ({ attempt, lastReason }) => buildAaratiPrompt({
        userText,
        profile,
        context,
        instruction: `${instruction || "Reply as Aarati."}
Attempt: ${attempt}
Previous rejection: ${lastReason || "none"}
Return a clean reply with no Hindi leakage.`,
      }),
      generator: async ({ prompt }) => {
        const result = await generateJSONWithAI({
          prompt,
          taskName: "aarati_reply",
        });

        return result?.reply || "";
      },
    }),
  }).then((result) => result.value || sanitizeAaratiOutput(fallback));
}

async function aaratiSearchStep(profile, text = "") {
  const selectedNumber = Number(String(text || "").trim());

  if (
    profile.jobSearchDone &&
    !profile.isApplyingToSelectedJob &&
    !profile.selectedJobId &&
    !profile.selectedJob &&
    Array.isArray(profile.jobSearchResults) &&
    profile.jobSearchResults.length > 0 &&
    Number.isInteger(selectedNumber) &&
    selectedNumber >= 1 &&
    selectedNumber <= profile.jobSearchResults.length
  ) {
    const selectedJob = profile.jobSearchResults[selectedNumber - 1];

    return {
      messageToSend: `Ramro 🙏 Tapai le yo job select garnubhayo:

${selectedNumber}. ${selectedJob.title || "Job"}
Company: ${selectedJob?.employer?.company_name || selectedJob?.company_name || "Company"}
Location: ${selectedJob.location || "-"}
Type: ${selectedJob.type || "-"}
Salary: ${
        selectedJob.salary_min && selectedJob.salary_max
          ? `Rs ${Number(selectedJob.salary_min).toLocaleString("en-IN")} - ${Number(selectedJob.salary_max).toLocaleString("en-IN")}`
          : "Company anusar"
      }

Apply/interest submit garna kehi details chahinchha.

Tapai kati samaya kaam garna milchha?

1. Full-time
2. Part-time
3. Shift based
4. Jun sukai`,
      profileUpdates: {
        selectedJob,
        selectedJobId: selectedJob._id || selectedJob.id || "",
        selectedJobTitle: selectedJob.title || "",
        selectedCompanyName:
          selectedJob?.employer?.company_name ||
          selectedJob?.company_name ||
          "",
        jobType: selectedJob.category || selectedJob.title || profile.jobType || "Other",
        location: selectedJob.location || profile.location,
        district: profile.district,
        province: profile.province || "Lumbini",
        isApplyingToSelectedJob: true,
      },
      state: "ask_availability",
      lastAskedField: "availability",
    };
  }

  // If user saw jobs and wants another option/sector, ask category again.
  if (
    profile.jobSearchDone &&
    /^(aru|arko|other|different|sector|category|milena|suitable chaina|man parena|not suitable)/i.test(String(text || "").trim())
  ) {
    return {
      messageToSend: getJobSearchCategoryMessage(profile.location || "yo area"),
      profileUpdates: {
        jobType: "",
        jobSearchDone: false,
        jobSearchResults: [],
        selectedJob: null,
        selectedJobId: "",
        isApplyingToSelectedJob: false,
      },
      state: "ask_jobType",
      lastAskedField: "jobType",
    };
  }

  if (profile.pendingAaratiReply) {
    const reply = profile.pendingAaratiReply;
    delete profile.pendingAaratiReply;

    return {
      messageToSend: sanitizeAaratiOutput(reply),
      profileUpdates: { pendingAaratiReply: undefined },
      state: "aarati_reply",
    };
  }

  const t = String(text || "").toLowerCase().trim();

  if (profile.jobSearchDone && REGISTER_INTENT_PATTERN.test(t)) {
    return null;
  }

  if (
    profile.location &&
    !profile.jobType &&
    !profile.jobSearchDone &&
    isJobSearchLikeText(text)
  ) {
    return {
      messageToSend: getJobSearchCategoryMessage(profile.location),
      profileUpdates: {
        searchCategoryAsked: true,
      },
      state: "ask_jobType",
      lastAskedField: "jobType",
    };
  }

  const result = await runJobSearchStep(profile, text);

  if (!result) return null;

  const nextProfile = {
    ...profile,
    ...(result.profileUpdates || {}),
  };

  if (Array.isArray(nextProfile.jobSearchResults) && nextProfile.jobSearchResults.length > 0) {
    const safeJobs = nextProfile.jobSearchResults.filter((job) => {
      const jobLocation = String(job.location || "").toLowerCase();
      const requested = String(profile.location || "").toLowerCase();

      if (!job.is_active && job.is_active !== undefined) return false;
      if (!job.is_verified && job.is_verified !== undefined) return false;
      if (requested && jobLocation && !jobLocation.includes(requested) && !requested.includes(jobLocation)) {
        return false;
      }

      return true;
    });

    const fallback = formatAaratiJobsList({
      jobs: safeJobs,
      location: profile.location,
    });

    const messageToSend = safeJobs.length
      ? await generateAaratiAIReply({
          userText: text,
          profile,
          context: { jobs: safeJobs, location: profile.location },
          fallback,
          instruction: "Summarize only the trusted jobs. Do not add jobs or salary numbers.",
        })
      : AARATI_SAMPLE_REPLIES.noJobsFound(profile.location);

    return {
      ...result,
      messageToSend: sanitizeAaratiOutput(messageToSend),
      profileUpdates: {
        ...result.profileUpdates,
        jobSearchResults: safeJobs,
      },
    };
  }

  if (nextProfile.noJobsFound) {
    return {
      ...result,
      messageToSend: AARATI_SAMPLE_REPLIES.noJobsFound(profile.location),
    };
  }

  return {
    ...result,
    messageToSend: sanitizeAaratiOutput(result.messageToSend),
  };
}

const MESSAGES = ENABLE_AARATI_PERSONA
  ? AARATI_SAMPLE_REPLIES
  : {
      askJobType: () => `Tapai kasto kaam khojdai hunuhunchha?

${CANONICAL_WORKER_JOB_TYPE_MENU}`,

      askDistrict: (profile) => `Tapai kun district/area ma kaam garna milchha?

1. Nawalparasi West
2. Rupandehi
3. Kapilvastu
4. Palpa
5. Dang
6. Banke
7. Other`,

      askAvailability: () => `Tapai kati samaya kaam garna milchha?

1. Full-time
2. Part-time
3. Shift based
4. Jun sukai`,

      askDocuments: (profile = {}) => {
        if (profile.pendingDocumentPrivacyConcern) {
          return `Tapai ko chinta thik ho 🙏

Document pathaunu compulsory haina.

JobMate team le document sirf verification/hiring process ko lagi herchha. Tapai comfortable hunuhunna bhane document bina pani profile save garna milchha.

Document bina profile save garna 2 lekhnu hola.
Pachhi trust bhaye yahi WhatsApp ma license/CV/citizenship photo pathauna saknuhunchha.`;
        }

        const jobType = String(profile.jobType || "").toLowerCase();

        let hint = "Citizenship/nagarikta, CV, license, certificate jasto document bhaye photo/file yahi WhatsApp ma pathauna saknuhunchha.";

        if (jobType.includes("driver") || jobType.includes("transport")) {
          hint = "Driver/transport kaam ko lagi license ko photo important huncha. License cha bhane yahi WhatsApp ma photo pathauna saknuhunchha.";
        } else if (jobType.includes("it") || jobType.includes("tech") || jobType.includes("office")) {
          hint = "IT/office kaam ko lagi CV bhaye yahi WhatsApp ma file/photo pathauna saknuhunchha.";
        } else if (jobType.includes("security")) {
          hint = "Security kaam ko lagi citizenship/nagarikta वा experience document bhaye yahi WhatsApp ma photo pathauna saknuhunchha.";
        }

        return `Tapai sanga document chha? 🙏

${hint}

Aile document status choose garnu hola:
1. Chha, photo/file pathauna sakchhu
2. Chhaina
3. Kehi chha, kehi chhaina`;
      },

      askName: () => "Tapai ko naam pathaunus.",

      askPhone: () => "Tapai ko phone/WhatsApp number pathaunus.",

      askAge: () => "Tapai ko age kati ho?",

      askExperience: () => "Tapai ko experience kati cha? Experience chaina bhane 'no experience' lekhnus.",

      askExpectedSalary: () => "Expected salary kati ho?",

      completion: (profile) => {
        const privacyNote =
          profile.documents === "privacy_concern"
            ? `\n\nTapai ko chinta thik ho 🙏 Document pathaunu compulsory haina. JobMate team le document sirf verification/hiring process ko lagi herchha. Ahile document bina profile save gareko chhu; pachhi trust bhaye yahi WhatsApp ma pathauna saknuhunchha.`
            : "";

        return `Dhanyabaad 🙏 Tapai ko vivaran JobMate ma save bhayo.

📋 Saved profile:
- Kaam: ${profile.jobType || "-"}
- District: ${profile.district || "-"}
- Availability: ${profile.availability || "-"}
- Documents: ${profile.documents === "privacy_concern" ? "not provided due to privacy concern" : profile.documents || "-"}${privacyNote}

Suitable kaam aayepachhi JobMate team le 24-48 ghanta vitra sampark garchha.`;
      },
    };

export const jobmateConfig = {
  mode: "jobmate_hiring",
  persona: "aarati_v2",
  extractor: jobmateExtractor,
  requiredFields: [
    {
      key: "jobType",
      ask: () => MESSAGES.askJobType,
      parse: parseJobTypeReply,
    },
    {
      key: "district",
      ask: (profile) => MESSAGES.askDistrict(profile),
      parse: parseDistrictReply,
      skipIf: (profile) => Boolean(profile.district),
    },
    {
      key: "availability",
      ask: () => MESSAGES.askAvailability,
      parse: parseAvailability,
    },
    {
      key: "documents",
      ask: (profile) =>
        typeof MESSAGES.askDocuments === "function"
          ? MESSAGES.askDocuments(profile)
          : MESSAGES.askDocuments,
      parse: parseDocuments,
    },
    {
      key: "fullName",
      ask: () =>
        typeof MESSAGES.askName === "function"
          ? MESSAGES.askName()
          : "Tapai ko naam pathaunus.",
      parse: parseWorkerFullNameReply,
    },
    {
      key: "providedPhone",
      ask: () =>
        typeof MESSAGES.askPhone === "function"
          ? MESSAGES.askPhone()
          : "Tapai ko phone/WhatsApp number pathaunus.",
      parse: parseWorkerPhoneReply,
    },
    {
      key: "age",
      ask: () =>
        typeof MESSAGES.askAge === "function"
          ? MESSAGES.askAge()
          : "Tapai ko age kati ho?",
      parse: parseWorkerAgeReply,
    },
    {
      key: "experience",
      ask: () =>
        typeof MESSAGES.askExperience === "function"
          ? MESSAGES.askExperience()
          : "Tapai ko experience kati cha? Experience chaina bhane 'no experience' lekhnus.",
      parse: parseWorkerExperienceReply,
    },
    {
      key: "expectedSalary",
      ask: () =>
        typeof MESSAGES.askExpectedSalary === "function"
          ? MESSAGES.askExpectedSalary()
          : "Expected salary kati ho?",
      parse: parseWorkerExpectedSalaryReply,
    },
    {
      key: "confirmation",
      ask: (profile) => buildWorkerConfirmationMessage(profile),
      parse: parseWorkerConfirmationReply,
    },
  ],
  flowGuard: jobmateWorkerFlowGuard,
  searchStep: aaratiSearchStep,
  shouldRunSearchStep: shouldRunWorkerRegistrationSearchStep,
  sanitizeProfile: sanitizeWorkerRegistrationProfile,
  shortCircuit: (profile) => {
    if (profile.isOutsideLumbini) {
      const loc = profile.location || "tyo area";
      return AARATI_SAMPLE_REPLIES.outsideLumbini(loc);
    }
    return null;
  },
  completionMessage: (profile) => buildWorkerCompletionMessage(profile),
  onComplete: async ({ contact, profile }) => {
    if (profile?.confirmation !== "confirmed") {
      console.warn("onComplete skipped: worker profile not confirmed");
      return;
    }

    if (!contact?._id) {
      console.warn("onComplete skipped: missing contact id");
      return;
    }

    try {
      const mapped = buildWorkerProfileUpdateFromAaratiProfile({
        contact,
        profile,
      });

      const saved = await WorkerProfile.findOneAndUpdate(
        mapped.filter,
        mapped.update,
        mapped.options
      );

      console.log("WorkerProfile saved:", {
        id: saved._id,
        phone: saved.phone,
        area: saved.location?.area,
        district: saved.location?.district,
        availability: saved.availability,
        documentStatus: saved.documentStatus,
      });

      await scheduleFollowup({
        targetType: "WorkerProfile",
        targetId: saved._id,
        phone: saved.phone,
        triggerType: "profile_complete",
        templateName: "worker_profile_thank_you",
        templateData: {
          name: saved.fullName || "hajur",
          role: saved.jobPreferences?.join(", ") || "kaam",
          location: saved.location?.area || saved.location?.district || "tapai ko area",
        },
        scheduledAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      });

      const application = await upsertJobApplicationFromWorkerProfile({
        contact,
        worker: saved,
        profile,
      });

      if (application) {
        console.log("JobApplication saved:", {
          id: application._id,
          jobId: application.jobId,
          jobTitle: application.jobTitle,
          status: application.status,
        });
      }

      await createNotification({
        type: "worker_profile_completed",
        title: `Worker profile completed: ${saved.phone || "Worker"}`,
        message: `${saved.phone || "Worker"} registered for ${(saved.jobPreferences || []).join(", ") || "job"} in ${saved.location?.area || saved.location?.district || "Lumbini"}.`,
        priority: saved.documentStatus === "ready" ? "high" : "medium",
        entityType: "WorkerProfile",
        entityId: saved._id,
        phone: saved.phone,
        metadata: {
          jobPreferences: saved.jobPreferences || [],
          location: saved.location || {},
          availability: saved.availability,
          documentStatus: saved.documentStatus,
          selectedJobTitle: saved.metadata?.selectedJobTitle || "",
          selectedCompanyName: saved.metadata?.selectedCompanyName || "",
          isApplyingToSelectedJob: Boolean(saved.metadata?.isApplyingToSelectedJob),
        },
      });
    } catch (error) {
      console.error("WorkerProfile save failed:", error?.message);
    }
  },
};
