const CONFIRM_WORDS = new Set([
  "ok",
  "okay",
  "ok hubxa",
  "ok hunxa",
  "hunxa",
  "hus",
  "huss",
  "hajur",
  "thik cha",
  "theek cha",
  "save",
  "save gardinus",
  "job chaiyo",
  "register",
  "profile save",
  "yes",
])

const START_WORDS = new Set([
  "start",
  "menu",
  "restart",
  "surugar",
  "suru gara",
  "home",
])

const CANCEL_WORDS = new Set([
  "cancel",
  "stop",
  "x",
  "pardaina",
  "haina",
])

function normalizeControlText(text = "") {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/[।.!?,]/g, "")
    .replace(/\s+/g, " ")
}

function hasJobSearchContext(conversation = {}) {
  const data = conversation?.metadata?.collectedData || {}
  return Boolean(
    data?.lastJobSearch?.query?.location ||
      data?.lastJobSearch?.query?.keyword ||
      data?.pendingJobSearch?.location ||
      data?.pendingJobSearch?.jobType
  )
}

function getLastSearchContext(conversation = {}) {
  const data = conversation?.metadata?.collectedData || {}
  const lastQuery = data?.lastJobSearch?.query || {}
  const pending = data?.pendingJobSearch || {}

  const location =
    lastQuery.location ||
    pending.location ||
    data.location ||
    data.area ||
    ""

  const jobType =
    lastQuery.keyword ||
    lastQuery.category ||
    pending.jobType ||
    data.jobType ||
    data.category ||
    ""

  return {
    location,
    jobType,
  }
}

function isInPostJobSearchState(conversation = {}) {
  const state = conversation?.currentState || ""
  const intent = conversation?.currentIntent || ""

  return (
    intent === "job_search" ||
    state === "job_search_results" ||
    state === "awaiting_job_search_query" ||
    state === "awaiting_job_search_jobtype" ||
    state === "awaiting_job_search_location"
  )
}

export function handleAaratiJobSearchControlGuard({ text, conversation }) {
  const value = normalizeControlText(text)

  if (!value) {
    return {
      shouldHandle: false,
      reason: "empty_text",
    }
  }

  if (!isInPostJobSearchState(conversation)) {
    return {
      shouldHandle: false,
      reason: "not_in_job_search_state",
    }
  }

  const searchContext = getLastSearchContext(conversation)
  const hasContext = hasJobSearchContext(conversation)

  if (START_WORDS.has(value)) {
    return {
      shouldHandle: true,
      intent: "restart",
      reason: "job_search_start_command",
      replyText:
        "Namaskar 🙏\nMa Aarati, JobMate Nepal team bata.\n\nTapai kun help chahanu huncha?\n1. Ma job khojdai chu\n2. Malai staff/worker chahiyo\n3. Human support chahiyo\n\nMilne number pathaunu hola.",
      statePatch: {
        currentIntent: "unknown",
        currentState: "idle",
        "metadata.collectedData.pendingJobSearch": null,
      },
    }
  }

  if (CANCEL_WORDS.has(value)) {
    return {
      shouldHandle: true,
      intent: "unknown",
      reason: "job_search_cancel_command",
      replyText:
        "Thik cha 🙏 Job search aile lai cancel gariyo.\nPachi chahiyo bhane “job khojna cha” lekhnus.",
      statePatch: {
        currentIntent: "unknown",
        currentState: "idle",
        "metadata.collectedData.pendingJobSearch": null,
      },
    }
  }

  if (CONFIRM_WORDS.has(value) && hasContext) {
    const location = searchContext.location || "tapai ko location"
    const jobType = searchContext.jobType || "job"

    return {
      shouldHandle: true,
      intent: "worker_registration",
      reason: "job_search_confirmation_uses_last_context",
      replyText:
        `Thik cha 🙏 Tapai ko ${location} ${jobType} job search ko detail save gardai chu.\n\n` +
        "Availability kahile dekhi cha?\nExample: today, this week, part-time, full-time",
      statePatch: {
        currentIntent: "worker_registration",
        currentState: "ask_availability",
        "metadata.collectedData.location": location,
        "metadata.collectedData.area": location,
        "metadata.collectedData.jobType": jobType,
        "metadata.collectedData.category": jobType,
        "metadata.collectedData.pendingJobSearch": null,
        "metadata.lastAskedField": "availability",
      },
    }
  }

  if (CONFIRM_WORDS.has(value) && !hasContext) {
    return {
      shouldHandle: true,
      intent: "unknown",
      reason: "job_search_confirmation_without_context",
      replyText:
        "Bujhe 🙏 Job search save garna location ra job type chahinchha.\nExample: Butwal ma driver job, Bhardaghat ma marketing job",
      statePatch: {
        currentIntent: "job_search",
        currentState: "awaiting_job_search_query",
      },
    }
  }

  return {
    shouldHandle: false,
    reason: "not_control_or_confirmation_word",
  }
}
