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

const ENABLE_AARATI_PERSONA = process.env.ENABLE_AARATI_PERSONA !== "false";
const ENABLE_AARATI_LLM = process.env.ENABLE_AARATI_LLM !== "false";

// Job type parsing
const JOB_TYPES = {
  "1": "IT/Tech",
  "2": "Driver/Transport",
  "3": "Hospitality",
  "4": "Shop/Retail",
  "5": "Security",
  "6": "Construction/Labor",
  "7": "Other",
};

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

function parseJobType(text) {
  const trimmed = String(text || "").trim();
  if (JOB_TYPES[trimmed]) return JOB_TYPES[trimmed];

  const lower = trimmed.toLowerCase();
  if (/(frontend|front end|react|developer|it|computer|software|web|coding|programmer)/i.test(lower)) return "IT/Tech";
  if (/(hotel|restaurant|waiter|kitchen|cook|cafe)/i.test(lower)) return "Hospitality";
  if (/(driver|gadi|license|truck|bus|bike|delivery)/i.test(lower)) return "Driver/Transport";
  if (/(security|guard|watchman)/i.test(lower)) return "Security";
  if (/(shop|sales|retail|pasal|counter)/i.test(lower)) return "Shop/Retail";
  if (/(factory|helper|labor|labour|construction|mistri|plumber|electrician)/i.test(lower)) return "Construction/Labor";
  if (/(farm|agriculture|kheti|krishi)/i.test(lower)) return "Farm/Agriculture";
  if (/(jun sukai|junsukai|any|other|jasto bhaye pani)/i.test(lower)) return "Other";
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

function parseDocuments(text) {
  const t = String(text || "").trim().toLowerCase();
  if (t === "1" || /^(yes|cha|chha|छ|ho)$/i.test(t)) return "yes";
  if (t === "2" || /^(no|chaina|chhaina|छैन|hoina)$/i.test(t)) return "no";
  if (t === "3" || /partial|kehi|ali/i.test(t)) return "partial";
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

async function jobmateExtractor({ text, profile }) {
  const updates = {};
  const cleanText = String(text || "").trim();

  if (!cleanText) return updates;

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
      updates.district = localLocation.resolved.district || localLocation.resolved.canonical;
      updates.province = "Lumbini";
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

1. Driver / Transport
2. Security Guard
3. Hotel / Restaurant
4. Construction / Labor
5. Farm / Agriculture
6. Shop / Retail
7. Other`,

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

      askDocuments: () => `Tapai sanga document chha?

1. Chha
2. Chhaina
3. Kehi chha, kehi chhaina`,

      completion: (profile) => `Dhanyabaad! Tapai ko detail JobMate ma save bhayo.

- Kaam: ${profile.jobType || "-"}
- District: ${profile.district || "-"}
- Availability: ${profile.availability || "-"}
- Documents: ${profile.documents || "-"}`,
    };

export const jobmateConfig = {
  mode: "jobmate_hiring",
  persona: "aarati_v2",
  extractor: jobmateExtractor,
  requiredFields: [
    {
      key: "jobType",
      ask: () => MESSAGES.askJobType,
      parse: parseJobType,
    },
    {
      key: "district",
      ask: (profile) => MESSAGES.askDistrict(profile),
      parse: (text) => {
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

        const resolved = resolveLumbiniLocation(t);
        return resolved?.district || resolved?.canonical || t;
      },
      skipIf: (profile) => Boolean(profile.district),
    },
    {
      key: "availability",
      ask: () => MESSAGES.askAvailability,
      parse: parseAvailability,
    },
    {
      key: "documents",
      ask: () => MESSAGES.askDocuments,
      parse: parseDocuments,
    },
  ],
  searchStep: aaratiSearchStep,
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
    } catch (error) {
      console.error("WorkerProfile save failed:", error?.message);
    }
  },
};
