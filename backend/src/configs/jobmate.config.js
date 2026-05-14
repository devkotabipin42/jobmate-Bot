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
  "asked_register",
]);

const WORKER_REGISTRATION_FIELDS = new Set([
  "jobType",
  "district",
  "availability",
  "documents",
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

function jobmateWorkerFlowGuard({
  text = "",
  conversation,
  lastAskedField,
  currentState,
} = {}) {
  if (
    !isWorkerRegistrationActiveContext({ conversation, lastAskedField, currentState }) ||
    lastAskedField !== "jobType"
  ) {
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

  if (activeWorkerRegistration && lastAskedField === "jobType") {
    const jobType = parseJobTypeReply(cleanText, profile, {
      conversation,
      lastAskedField,
      currentState,
    });
    if (jobType) {
      updates.jobType = jobType;
    }
    return updates;
  }

  if (activeWorkerRegistration && lastAskedField === "district") {
    const localLocation = resolveLocalLocationFromText(cleanText);
    if (localLocation) {
      Object.assign(updates, locationUpdatesFromResolved(localLocation));
    }
    return updates;
  }

  if (activeWorkerRegistration && lastAskedField === "documents") {
    return updates;
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
  completionMessage: (profile) => MESSAGES.completion(profile),
  onComplete: async ({ contact, profile }) => {
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
