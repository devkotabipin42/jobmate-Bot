import { WorkerProfile } from "../../models/WorkerProfile.model.js";
import { updateConversationState } from "./conversationState.service.js";
import {
  parseJobSearchQuery,
  searchJobMateJobs,
  formatJobsForWhatsApp,
} from "../jobmate/jobmateJobsClient.service.js";
import { extractJobSearchWithAI } from "../ai/jobmateJobSearchExtractionAI.service.js";
import { runConversationEngine } from "./conversationEngine.js";
import { jobmateConfig } from "../../configs/jobmate.config.js";
import { scheduleFollowup } from "../followups/followupScheduler.service.js";
import { getActiveFlowSideReply } from "../../policies/aarati.rulebook.js";
import { getAaratiActiveFlowSideReply } from "../aarati/aaratiActiveFlowSideReply.service.js";

// Runtime check (not module-load-time) so dotenv has time to load
function isNewEngineEnabled() {
  return process.env.USE_NEW_CONVERSATION_ENGINE === "true";
}

const JOB_MAP = {
  "1": "driver_transport",
  "2": "security_guard",
  "3": "hotel_restaurant",
  "4": "construction_labor",
  "5": "farm_agriculture",
  "6": "shop_retail",
  "7": "other",
};

const DISTRICT_MAP = {
  "1": "Nawalparasi",
  "2": "Rupandehi",
  "3": "Kapilvastu",
  "4": "Palpa",
  "5": "Arghakhanchi",
  "6": "Other",
};

const AVAILABILITY_MAP = {
  "1": "immediate",
  "2": "within_2_weeks",
  "3": "within_1_month",
  "4": "not_decided",
};

const DOCUMENT_MAP = {
  "1": "ready",
  "2": "available_later",
  "3": "not_available",
};

const MESSAGES = {
  welcome: (name) =>
    `Namaste ${name || "Mitra"} ji! 🙏

JobMate Nepal मा स्वागत छ।
Hami tapailai suitable kaam khojna help garchhaun.

Tapai kasto kaam khojdai hunuhunchha?
Tala bata euta number pathaunu hola:

1. Driver / Transport
2. Security Guard
3. Hotel / Restaurant
4. Construction / Labor
5. Farm / Agriculture
6. Shop / Retail
7. Other`,

  askDistrict: (jobLabel = "kaam") => `Bujhe 🙏 ${jobLabel} khojdai hunuhuncha.

Tapai kun district/area ma kaam garna milcha?

1. Nawalparasi
2. Rupandehi
3. Kapilvastu
4. Palpa
5. Arghakhanchi
6. Other`,

  askAvailability: (districtLabel = "yo area") => `Thik cha 🙏 ${districtLabel} tira kaam garna milne raicha.

Tapai kahile dekhi kaam start garna ready hunuhuncha?

1. Immediate / yo hapta
2. 1-2 hapta bhitra
3. 1 mahina bhitra
4. Not decided yet`,

  askDocument: (availabilityLabel = "soon") => `Ramro 😊 ${availabilityLabel} dekhi ready hunuhuncha vanera note gare.

Tapai sanga document chha? 🙏

License, citizenship/nagarikta, CV, certificate jasto document bhaye yahi WhatsApp ma photo/file pathauna saknuhunchha.

Aile document status choose garnu hola:
1. Chha, photo/file pathauna sakchhu
2. Chhaina
3. Kehi chha, kehi chhaina`,

  completed: (name) =>
    `Dhanyabaad ${name || "Mitra"} ji! 🙏

Tapai ko basic details receive bhayo.
Hamro team le tapailai suitable kaam sanga connect garne prayas garnechha.

Hamibata phone aauna sakchha, kripaya uthaunu hola. 📞`,

  returning: (name) =>
    `Namaste ${name || "Mitra"} ji! 😊

Tapai ko details hami sanga safe chha.
Yedi new information thapnu chha bhane yahin message pathaunu hola.`,
};

export async function handleWorkerRegistration({
  
  contact,
  conversation,
  normalizedMessage,
}) {
  if (isNewEngineEnabled()) {
    console.log("🔧 [NEW ENGINE] handleWorkerRegistration called", {
      currentState: conversation?.currentState,
        collectedData: conversation?.metadata?.collectedData,
      text: normalizedMessage?.message?.normalizedText,
    });
    const result = await runConversationEngine({
      contact,
      conversation,
      normalizedMessage,
      config: jobmateConfig,
    });

    return {
      intent: "worker_registration",
      messageToSend: result.messageToSend,
      nextStep: 0,
      currentState: result.newMetadata.currentState,
      metadataUpdate: result.newMetadata,
      isComplete: result.isComplete,
    };
  }
  const step = Number(conversation?.metadata?.qualificationStep || 0);
  const text = normalizedMessage?.message?.normalizedText || "";


  const activeFlowSideReply = getAaratiActiveFlowSideReply({
    text,
    conversation,
  });

  if (activeFlowSideReply) {
    return {
      handled: true,
      intent: "worker_registration",
      reply: activeFlowSideReply,
      source: "active_flow_side_reply",
    };
  }
  const displayName =
    contact?.displayName && !/recruiter|admin|business/i.test(contact.displayName)
      ? contact.displayName
      : "Mitra";

  let nextStep = step;
  let currentState = conversation.currentState || "idle";
  let messageToSend = "";
  let profileUpdate = {};
  let scoreAdd = 0;
  let isComplete = false;

  const jobSearchInterrupt = await handleJobSearchInterrupt({
    contact,
    conversation,
    text,
    step,
  });

  if (jobSearchInterrupt) {
    return jobSearchInterrupt;
  }

  if (step === 0) {
    messageToSend = MESSAGES.welcome(displayName);
    nextStep = 1;
    currentState = "ask_job_type";
  } else if (step === 1) {
    const jobPreference = parseJobType(text);

    // If location already known from job search, skip district question
    const knownDistrict = conversation?.metadata?.lastJobSearchQuery?.district
      || conversation?.metadata?.lastJobSearchQuery?.location
      || "";

    profileUpdate = {
      $addToSet: {
        jobPreferences: jobPreference,
      },
      $set: {
        profileStatus: "incomplete",
        ...(knownDistrict ? {
          "location.district": knownDistrict,
          "location.province": "Lumbini",
          "location.country": "Nepal",
        } : {}),
      },
      $inc: {
        score: 10,
      },
    };

    if (knownDistrict) {
      // Skip district step — already known
      messageToSend = MESSAGES.askAvailability
        ? MESSAGES.askAvailability(getJobLabel(jobPreference))
        : `Ramro 🙏 ${getJobLabel(jobPreference)} ko kaam ko lagi tapai kati ghanta/din kaam garna milcha?\n\n1. Full-time (din bhar)\n2. Part-time (aadha din)\n3. Shift based\n4. Jun sukai`;
      nextStep = 3;
      currentState = "ask_availability";
    } else {
      messageToSend = MESSAGES.askDistrict(getJobLabel(jobPreference));
      nextStep = 2;
      currentState = "ask_district";
    }
    scoreAdd = 10;
  } else if (step === 2) {
    const district = parseDistrict(text);

    profileUpdate = {
      $set: {
        "location.district": district,
        "location.province": "Lumbini",
        "location.country": "Nepal",
      },
      $inc: {
        score: 10,
      },
    };

    messageToSend = MESSAGES.askAvailability(district);
    nextStep = 3;
    currentState = "ask_availability";
    scoreAdd = 10;
  } else if (step === 3) {
    const availability = parseAvailability(text);

    profileUpdate = {
      $set: {
        availability,
      },
      $inc: {
        score: availability === "immediate" ? 15 : 8,
      },
    };

    messageToSend = MESSAGES.askDocument(getAvailabilityLabel(availability));
    nextStep = 4;
    currentState = "ask_document_status";
    scoreAdd = availability === "immediate" ? 15 : 8;
  } else if (step === 4) {
    const documentStatus = parseDocumentStatus(text);

    profileUpdate = {
      $set: {
        documentStatus,
        profileStatus: "complete",
        lastQualifiedAt: new Date(),
      },
      $inc: {
        score: documentStatus === "ready" ? 15 : 8,
      },
    };

    messageToSend = MESSAGES.completed(displayName);
    nextStep = 5;
    currentState = "completed";
    scoreAdd = documentStatus === "ready" ? 15 : 8;
    isComplete = true;
  } else {
    messageToSend = MESSAGES.returning(displayName);
    nextStep = step;
    currentState = conversation.currentState || "completed";
  }

  const worker = await upsertWorkerProfile({
    contact,
    profileUpdate,
  });

  if (isComplete && worker?._id) {
    await scheduleFollowup({
      targetType: "WorkerProfile",
      targetId: worker._id,
      phone: worker.phone || contact?.phone || "",
      triggerType: "profile_complete",
      templateName: "worker_profile_thank_you",
      templateData: {
        name: worker.fullName || displayName || "hajur",
        role: Array.isArray(worker.jobPreferences) && worker.jobPreferences.length
          ? worker.jobPreferences[worker.jobPreferences.length - 1]
          : "kaam",
        location:
          worker.location?.area ||
          worker.location?.district ||
          "tapai ko area",
      },
    });
  }

  const updatedConversation = await updateConversationState({
    conversation,
    currentState,
    qualificationStep: nextStep,
    lastQuestion: messageToSend,
  });

  return {
    intent: "worker_registration",
    messageToSend,
    nextStep,
    currentState,
    worker,
    conversation: updatedConversation,
    scoreAdd,
    isComplete,
    needsHuman: isComplete,
    priority: isComplete ? "high" : "low",
    handoffReason: isComplete ? "qualified_worker" : "",
  };
}

async function handleJobSearchInterrupt({ contact, conversation, text, step }) {
  const rawText = String(text || "").trim();
  const normalized = rawText.toLowerCase();

  // Do not interrupt simple menu replies like "1", "2", "3".
  if (!normalized || /^[0-9]+$/.test(normalized)) return null;

  const looksLikeJobSearch = includesAny(normalized, [
    "kaam xa",
    "kam xa",
    "kaam cha",
    "kam cha",
    "job xa",
    "job cha",
    "work xa",
    "work cha",
    "jagir xa",
    "jagir cha",
    "vacancy",
    "katai kaam",
    "katai kam",
    "काम छ",
    "जागिर छ",
  ]);

  const aiQuery = await extractJobSearchWithAI({
    text: rawText,
  });

  const isJobSearchIntent =
    looksLikeJobSearch ||
    aiQuery?.intent === "job_search" ||
    aiQuery?.shouldSearchJobs ||
    aiQuery?.needsLocationClarification;

  if (!isJobSearchIntent) return null;

  const ruleQuery = parseJobSearchQuery(normalized);

  const parsedQuery = {
    keyword: aiQuery?.keyword || ruleQuery.keyword || "",
    location: aiQuery?.location || ruleQuery.location || "",
    locationText: aiQuery?.locationText || aiQuery?.location || ruleQuery.location || "",
    category: aiQuery?.category || ruleQuery.category || "",
    resolvedLocation: aiQuery?.resolvedLocation || null,
    shouldSearchJobs: Boolean(aiQuery?.shouldSearchJobs),
    needsLocationClarification: Boolean(aiQuery?.needsLocationClarification),
    isPossiblyLocalNepal: Boolean(aiQuery?.isPossiblyLocalNepal),
    isClearlyOutsideLumbini: Boolean(aiQuery?.isClearlyOutsideLumbini),
    locationSource: aiQuery?.locationSource || "",
    reason: aiQuery?.reason || "",
  };

  console.log("🔎 JobMate search query:", {
    ruleQuery,
    aiQuery,
    finalQuery: parsedQuery,
  });

  if (parsedQuery.needsLocationClarification || !parsedQuery.shouldSearchJobs) {
    const messageToSend = buildLocationClarificationReply(parsedQuery);

    const profileUpdate = buildWorkerProfileUpdateFromSearch({
      parsedQuery,
      text: normalized,
    });

    const worker = await upsertWorkerProfile({
      contact,
      profileUpdate,
    });

    const updatedConversation = await updateConversationState({
      conversation,
      currentState: "ask_location",
      qualificationStep: Math.max(Number(step || 0), 1),
      lastQuestion: messageToSend,
    });

    return {
      intent: "job_search",
      messageToSend,
      nextStep: Math.max(Number(step || 0), 1),
      currentState: "ask_location",
      worker,
      conversation: updatedConversation,
      scoreAdd: 2,
      isComplete: false,
      needsHuman: false,
      priority: "low",
      handoffReason: "",
      jobSearch: {
        query: parsedQuery,
        count: 0,
        strategy: "location_clarification",
      },
    };
  }

  const jobSearchResult = await searchJobMateJobs({
    keyword: parsedQuery.keyword,
    location: parsedQuery.location,
    category: parsedQuery.category,
    limit: 5,
  });

  const hasJobs = jobSearchResult?.jobs?.length > 0;

  const profileUpdate = buildWorkerProfileUpdateFromSearch({
    parsedQuery,
    text: normalized,
  });

  const worker = await upsertWorkerProfile({
    contact,
    profileUpdate,
  });

  let messageToSend = "";

  if (hasJobs) {
    messageToSend = formatJobsForWhatsApp({
      jobs: jobSearchResult.jobs,
      location: parsedQuery.location,
      keyword: parsedQuery.keyword || parsedQuery.category || "kaam",
    });
  } else {
    messageToSend = buildNoJobFoundNaturalReply(parsedQuery);
  }

  const updatedConversation = await updateConversationState({
    conversation,
    currentState: hasJobs ? "job_search_results" : "ask_job_type",
    qualificationStep: hasJobs ? Number(step || 1) : 1,
    lastQuestion: messageToSend,
  });

  return {
    intent: hasJobs ? "job_search" : "worker_registration",
    messageToSend,
    nextStep: hasJobs ? Number(step || 1) : 1,
    currentState: hasJobs ? "job_search_results" : "ask_job_type",
    worker,
    conversation: updatedConversation,
    scoreAdd: 5,
    isComplete: false,
    needsHuman: false,
    priority: "low",
    handoffReason: "",
    jobSearch: {
      query: parsedQuery,
      count: jobSearchResult?.count || 0,
      strategy: jobSearchResult?.strategy || "no_match",
    },
  };
}

function buildWorkerProfileUpdateFromSearch({ parsedQuery, text }) {
  const set = {
    profileStatus: "incomplete",
  };

  if (parsedQuery.resolvedLocation) {
    set["location.area"] = parsedQuery.resolvedLocation.canonical;
    set["location.district"] = parsedQuery.resolvedLocation.district || "";
    set["location.province"] = parsedQuery.resolvedLocation.province || "Lumbini";
    set["location.country"] = "Nepal";
  } else if (parsedQuery.location) {
    set["location.area"] = parsedQuery.location;
    set["location.country"] = "Nepal";
  }

  const jobPreference = categoryToJobPreference(parsedQuery.category, text);

  const update = {
    $set: set,
    $inc: {
      score: 5,
    },
  };

  if (jobPreference) {
    update.$addToSet = {
      jobPreferences: jobPreference,
    };
  }

  return update;
}

function categoryToJobPreference(category = "", text = "") {
  const value = String(category || "").toLowerCase();
  const normalized = String(text || "").toLowerCase();

  if (value.includes("hospitality") || includesAny(normalized, ["hotel", "restaurant", "waiter", "kitchen"])) {
    return "hotel_restaurant";
  }

  if (includesAny(normalized, ["driver", "license", "transport", "gadi"])) {
    return "driver_transport";
  }

  if (includesAny(normalized, ["security", "guard"])) {
    return "security_guard";
  }

  if (includesAny(normalized, ["shop", "retail", "pasal"])) {
    return "shop_retail";
  }

  if (includesAny(normalized, ["construction", "labor", "majduri", "mistri"])) {
    return "construction_labor";
  }

  return "";
}

function buildLocationClarificationReply(parsedQuery = {}) {
  const askedLocation = parsedQuery.locationText || parsedQuery.location || "yo area";

  // If Mapbox did not clearly prove the place is outside Lumbini,
  // do not make the bot look weak by asking "which district?".
  // Treat it as a local/unknown Nepal area and move to follow-up capture.
  if (!parsedQuery.isClearlyOutsideLumbini) {
    return `${askedLocation} tira ahile exact job listing भेटिएन 🙏

Tara ma tapai ko detail JobMate ma save gardinchhu.
Tyo area tira suitable kaam aayo bhane hamro team le contact garcha.

Tapai kun type ko kaam khojdai hunuhuncha?
1. Hotel / Restaurant
2. Factory / Helper
3. Driver / Transport
4. Shop / Sales
5. Security Guard
6. Jun sukai kaam`;
  }

  return `${askedLocation} ko lagi ahile JobMate ko active matching available छैन 🙏

Ahile hamro focus Lumbini Province vitra cha.
Tapai Lumbini vitra kaam khojdai hunuhuncha bhane area ko naam pathaunu hola.`;
}

function buildNoJobFoundNaturalReply(parsedQuery = {}) {
  const locationText = parsedQuery.locationText || parsedQuery.location || "tapai ko area";

  return `${locationText} tira ahile exact job listing bhetiyena 🙏

Tara tension nalinu. Tapai ko detail JobMate ma save gardinchhu, suitable kaam aayo bhane hamro team le contact garnuhuncha.

Tapai kasto kaam garna comfortable hunuhuncha?
1. Driver / Transport
2. Security Guard
3. Hotel / Restaurant
4. Construction / Labor
5. Farm / Agriculture
6. Shop / Retail
7. Jun sukai kaam`;
}

function getCleanJobText(parsedQuery = {}) {
  if (parsedQuery.category) {
    return `${parsedQuery.category} related job`;
  }

  const keyword = String(parsedQuery.keyword || "").toLowerCase();

  if (!keyword || includesAny(keyword, ["kam", "kaam", "job", "work"])) {
    return "tapai le khojeko exact job";
  }

  return `${parsedQuery.keyword} related job`;
}


async function upsertWorkerProfile({ contact, profileUpdate }) {
  const baseSet = {
    contactId: contact._id,
    fullName: contact.displayName || "",
    phone: contact.phone,
    source: "whatsapp",
  };

  const update = {
    $setOnInsert: baseSet,
    ...(profileUpdate || {}),
  };

  return WorkerProfile.findOneAndUpdate(
    { contactId: contact._id },
    update,
    {
      returnDocument: "after",
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );
}

function getJobLabel(jobPreference = "") {
  const labels = {
    driver_transport: "Driver/Transport ko kaam",
    security_guard: "Security Guard ko kaam",
    hotel_restaurant: "Hotel/Restaurant ko kaam",
    construction_labor: "Construction/Labor ko kaam",
    farm_agriculture: "Farm/Agriculture ko kaam",
    shop_retail: "Shop/Retail ko kaam",
    other: "jun sukai kaam",
  };

  return labels[jobPreference] || "kaam";
}

function getAvailabilityLabel(availability = "") {
  const labels = {
    immediate: "immediate/yo hapta",
    within_2_weeks: "1-2 hapta bhitra",
    within_1_month: "1 mahina bhitra",
    not_decided: "time decide bhayepachi",
  };

  return labels[availability] || "soon";
}


function parseJobType(text) {
  if (JOB_MAP[text]) return JOB_MAP[text];

  if (includesAny(text, ["driver", "ड्राइभर", "गाडी"])) return "driver_transport";
  if (includesAny(text, ["security", "guard", "गार्ड"])) return "security_guard";
  if (includesAny(text, ["hotel", "restaurant", "होटल"])) return "hotel_restaurant";
  if (includesAny(text, ["construction", "labor", "मजदुर"])) return "construction_labor";
  if (includesAny(text, ["farm", "agriculture", "कृषि"])) return "farm_agriculture";
  if (includesAny(text, ["shop", "retail", "पसल"])) return "shop_retail";

  return "other";
}

function parseDistrict(text) {
  if (DISTRICT_MAP[text]) return DISTRICT_MAP[text];

  if (includesAny(text, ["nawalparasi", "नवलपरासी", "परासी", "bardaghat"])) return "Nawalparasi";
  if (includesAny(text, ["rupandehi", "रुपन्देही", "butwal", "bhairahawa"])) return "Rupandehi";
  if (includesAny(text, ["kapilvastu", "कपिलवस्तु"])) return "Kapilvastu";
  if (includesAny(text, ["palpa", "पाल्पा"])) return "Palpa";
  if (includesAny(text, ["arghakhanchi", "अर्घाखाँची"])) return "Arghakhanchi";

  return "Other";
}

function parseAvailability(text) {
  if (AVAILABILITY_MAP[text]) return AVAILABILITY_MAP[text];

  if (includesAny(text, ["immediate", "आजै", "तुरुन्त", "yo hapta"])) return "immediate";
  if (includesAny(text, ["2 hapta", "१-२", "1-2"])) return "within_2_weeks";
  if (includesAny(text, ["1 mahina", "month", "महिना"])) return "within_1_month";

  return "not_decided";
}

function parseDocumentStatus(text) {
  if (DOCUMENT_MAP[text]) return DOCUMENT_MAP[text];

  if (includesAny(text, ["ready", "cha", "छ", "yes"])) return "ready";
  if (includesAny(text, ["paxi", "पछि", "later"])) return "available_later";

  return "not_available";
}

function includesAny(text, keywords = []) {
  return keywords.some((keyword) => text.includes(String(keyword).toLowerCase()));
}
