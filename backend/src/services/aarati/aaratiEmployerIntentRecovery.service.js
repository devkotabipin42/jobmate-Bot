const EMPLOYER_INTENT_RE =
  /(staff\s*(kojna|khojna|chahiyo|chaiyo)|worker\s*(chahiyo|chaiyo)|manxe\s*(chahiyo|chaiyo|chayako)|manche\s*(chahiyo|chaiyo|chayako)|manis\s*(chahiyo|chaiyo)|kaam\s*garne\s*(manxe|manche|worker)|malai\s*(aauta|auta|euta|1)?\s*(manxe|manche|staff|worker)\s*(chahiyo|chaiyo|chayako)|hiring\s*garna|employee\s*(chahiyo|chaiyo))/i

const STAFF_ROLE_EXAMPLES =
  "marketing, driver, helper, security, kitchen staff"

function normalizeText(text = "") {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/[।.!?,]/g, " ")
    .replace(/\s+/g, " ")
}

export function detectAaratiEmployerIntentRecovery({ text, conversation }) {
  const value = normalizeText(text)

  if (!value) {
    return {
      shouldHandle: false,
      reason: "empty_text",
    }
  }

  const currentState = conversation?.currentState || "idle"
  const currentIntent = conversation?.currentIntent || "unknown"
  const cd = conversation?.metadata?.collectedData || {}

  // Do not interrupt active follow-up numeric reply.
  if (cd.awaitingFollowupReply === true) {
    return {
      shouldHandle: false,
      reason: "followup_reply_active",
    }
  }

  // Do not hijack active job-search continuation unless user explicitly says staff/worker/manxe.
  const isExplicitEmployer = EMPLOYER_INTENT_RE.test(value)
  if (!isExplicitEmployer) {
    return {
      shouldHandle: false,
      reason: "no_employer_phrase",
    }
  }

  return {
    shouldHandle: true,
    intent: "employer_lead",
    state: "ask_vacancy_role",
    reason: "explicit_employer_staff_request",
    replyText:
      "Hajur 🙏 Kasto role ko staff chahiyo?\n" +
      `Example: ${STAFF_ROLE_EXAMPLES}`,
    statePatch: {
      currentIntent: "employer_lead",
      currentState: "ask_vacancy_role",
      "metadata.qualificationStep": 20,
      "metadata.collectedData.employerIntentRecovered": true,
      "metadata.collectedData.hiringNeedSource": "employer_intent_recovery",
      "metadata.collectedData.pendingJobSearch": null,
      "metadata.lastAskedField": "vacancy_role",
    },
    debug: {
      currentState,
      currentIntent,
      text: value,
    },
  }
}
