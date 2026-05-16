import {
  getAaratiRawText,
  normalizeAaratiText,
  isAaratiSmallTalkText,
  isAaratiFrustrationText,
  isAaratiUnsafeIllegalText,
  isAaratiPersonalMoneyText,
  isAaratiEmployerRequestText,
  isAaratiJobSeekerRequestText,
  isAaratiWeatherText,
  isAaratiMathHomeworkText,
  isAaratiDirectMenuReply,
} from "./aaratiTextNormalizer.service.js";

function getText(normalized = {}) {
  return getAaratiRawText(normalized);
}

const ACTIVE_FLOW_STATES = new Set([
  "ask_documents",
  "ask_document_status",
  "ask_availability",
  "ask_jobType",
  "ask_job_type",
  "ask_district",
  "ask_location",
  "asked_register",
  "showed_jobs",
  "job_search_results",
  "search_done",
  "ask_business_name",
  "ask_business_name_after_ai",
  "ask_vacancy",
  "ask_vacancy_role",
  "ask_urgency",
  "ask_salary_range",
  "ask_work_type",
]);

function isActiveFlow(conversation = {}) {
  const state = String(conversation?.currentState || "");
  const lastAskedField = String(conversation?.metadata?.lastAskedField || "");

  return Boolean(lastAskedField) || ACTIVE_FLOW_STATES.has(state);
}

function isDirectJobOrHiringFlow(text = "") {
  const value = String(text || "").toLowerCase().trim();

  return (
    /^[1-9]$/.test(value) ||
    /kaam chahiyo|kam chahiyo|job chahiyo|staff chahiyo|worker chahiyo|malai kaam|malai job|malai staff|apply|register|profile save|cv patha|license patha|document patha/i.test(value) ||
    /butwal|bardaghat|bhardaghat|bhairahawa|parasi|nawalparasi|rupandehi|kapilvastu|palpa|dang|banke/i.test(value) ||
    /driver|hotel|security|sales|helper|it|computer|frontend|backend|restaurant|shop|retail|factory|cleaner|cook|waiter/i.test(value)
  );
}

function isQuestionLike(text = "") {
  const value = String(text || "").toLowerCase();

  return (
    /\?/.test(value) ||
    /ke|k ho|kina|kasari|kati|kaha|kahile|hunxa|huncha|garxa|garcha|milxa|milcha|can|do you|what|why|how|who|where|when/i.test(value) ||
    /[0-9]+\s*[\+\-\*\/x]\s*[0-9]+/.test(value)
  );
}

function detectIntent(text = "") {
  const value = normalizeAaratiText(text);

  if (isAaratiFrustrationText(value)) {
    return "frustration_or_abuse";
  }

  if (isAaratiUnsafeIllegalText(value)) {
    return "unsafe_illegal_request";
  }

  if (isAaratiPersonalMoneyText(value)) {
    return "personal_money_request";
  }

  if (isAaratiWeatherText(value)) {
    return "weather";
  }

  if (isAaratiMathHomeworkText(value)) {
    return "homework_or_math";
  }

  if (/bitch|fuck|pagal|stupid|idiot|ghus|ghus khanxau|bribe|rishwat|घुस|रिसवत/i.test(value)) {
    return "frustration_or_abuse";
  }

  if (/manav.*tarkar|manav.*taskar|human.*traffick|traffick|bechna|बेच्न|fake document|fake license|child worker|underage|passport rakh|salary nadine|illegal worker/i.test(value)) {
    return "unsafe_illegal_request";
  }

  if (/malai.*paisa.*chah|malai.*paisa.*chai|paisa chayako|paisa chaiyo|loan|rin|ऋण|सापटी/i.test(value)) {
    return "personal_money_request";
  }

  if (/weather|mausam|मौसम|pani parcha|rain|garmi|chiso|aaja ko weather|aja ko weather/i.test(value)) {
    return "weather";
  }

  if (/[0-9]+\s*[\+\-\*\/x]\s*[0-9]+/.test(value) || /math|homework|assignment|essay|solve/i.test(value)) {
    return "homework_or_math";
  }

  if (/politics|election|president|prime minister|party|religion|dharm|धर्म|राजनीति|bible|quran|hindu|muslim|christian/i.test(value)) {
    return "sensitive_unrelated";
  }

  if (/timi ko hau|timro naam|who are you|what are you|tapai ko ho|aarati/i.test(value)) {
    return "identity";
  }

  if (/jobmate.*guarantee|job guarantee|salary guarantee|guarantee din|sure job/i.test(value)) {
    return "job_guarantee";
  }

  if (/document|privacy|safe|leak|cv|license|citizenship|responsible/i.test(value)) {
    return "document_privacy_unknown";
  }

  if (/price|pricing|paisa|fee|cost|monthly|plan|free|lagcha/i.test(value)) {
    return "pricing_unknown";
  }

  if (/support|team|contact|phone|help|human/i.test(value)) {
    return "support_unknown";
  }

  if (/khana|khana kanu|khana khanu|k gardai|k cha|kxa|kbr|khabar|sanchai|hello|hi|namaste|good morning|good evening|how are you/i.test(value)) {
    return "small_talk";
  }

  if (isQuestionLike(value)) {
    return "safe_unknown_question";
  }

  return null;
}

function formatReply({ opener = "Hajur, bujhe 🙏", body, nextStep }) {
  return `${opener}

${body}

${nextStep}`.trim();
}

function buildReplyForIntent(intent) {
  switch (intent) {
    case "frustration_or_abuse":
      return formatReply({
        opener: "Maaf garnu hola 🙏",
        body: "Aghi ko reply ramro bhayena jasto lagyo. Ma JobMate team bata kaam khojna, staff khojna, document/verification, pricing ra support ko kura ma help garna sakchu.",
        nextStep: "Tapai ko main kura ekchoti short ma pathaunu hola, ma sidha answer dinchhu.",
      });

    case "unsafe_illegal_request":
      return formatReply({
        opener: "Yo request JobMate rules anusar mil्दैन 🙏",
        body: "JobMate le legal, safe ra voluntary employment/hiring process matra support garcha. Manav taskari, fake document, forced work ya illegal hiring ma JobMate le help gardaina.",
        nextStep: "Legal business ko lagi staff chahiyeko ho bhane business name, location, role ra salary detail pathaunu hola.",
      });

    case "personal_money_request":
      return formatReply({
        body: "JobMate loan/paisa dine service haina. JobMate le kaam khojna, staff khojna, document/verification ra hiring support ma help garcha.",
        nextStep: "Tapai lai income/kaam chahiyeko ho bhane location ra kasto kaam chahiyo pathaunu hola.",
      });

    case "weather":
      return formatReply({
        body: "Ma live weather update herna sakdina. Tara JobMate ko kaam ma help garna sakchu — kaam khojna, staff khojna, document verification ya support.",
        nextStep: "Tapai kun location ko job/staff ko lagi sodhdai hunuhunchha?",
      });

    case "homework_or_math":
      return formatReply({
        opener: "Hajur 🙏 Yo kura JobMate ko main service bhitra direct pardaina.",
        body: "Ma yaha math/homework solve garna bhanda pani job khojna, staff khojna, document/verification ra support ma help garna sakchu.",
        nextStep: "Tapai lai JobMate ma kun kura chahiyeko ho?",
      });

    case "sensitive_unrelated":
      return formatReply({
        opener: "Maaf garnu hola 🙏 Yo topic ma JobMate ko rule bhitra basera help garna mildaina.",
        body: "Ma JobMate ko rule bhitra basera job, hiring, worker, employer, document/verification, pricing ra support ko kura ma matra help garchu.",
        nextStep: "Tapai kaam khojdai hunuhunchha ki staff khojdai hunuhunchha?",
      });

    case "identity":
      return formatReply({
        opener: "Ma Aarati ho, JobMate team bata 🙏",
        body: "Ma tapai lai kaam khojna, staff khojna, profile save garna, document/verification ra support ma help garna sakchu.",
        nextStep: "Tapai kaam khojdai hunuhunchha ki staff khojdai hunuhunchha?",
      });

    case "job_guarantee":
      return formatReply({
        body: "JobMate le job guarantee ya salary guarantee gardaina. JobMate le jobseeker ra employer lai connect garna, profile/application manage garna ra verification support garna help garcha.",
        nextStep: "Tapai kaam khojdai hunuhunchha bhane location ra kaam type pathaunu hola.",
      });

    case "document_privacy_unknown":
      return formatReply({
        body: "Document compulsory haina. Document verification/hiring process ko lagi matra use huncha. Tapai comfortable hunuhunna bhane document bina pani profile save garna milcha.",
        nextStep: "Document bina profile save garna 2 lekhnu hola. Document chha bhane yahi WhatsApp ma photo/file pathauna saknuhunchha.",
      });

    case "pricing_unknown":
      return formatReply({
        body: "Jobseeker ko basic profile/application support generally free side ma rakhne JobMate ko approach ho. Employer pricing/service plan chai business need anusar confirm garna parcha.",
        nextStep: "Tapai jobseeker ho bhane kaam type ra location pathaunu hola. Employer ho bhane business name, location ra staff role pathaunu hola.",
      });

    case "support_unknown":
      return formatReply({
        body: "JobMate support ko lagi ma yahi WhatsApp ma basic help garna sakchu. Complex kura bhaye team lai forward garna milcha.",
        nextStep: "Tapai ko problem short ma pathaunu hola, ma sidha help garne try garchu.",
      });

    case "small_talk":
      return formatReply({
        opener: "Hajur, thik cha 🙏",
        body: "Ma Aarati, JobMate Nepal team bata. Small kura garna milcha, tara mero main kaam tapai lai job/hiring support dinu ho.",
        nextStep: "Kaam khojna ho bhane location ra kaam type pathaunu hola. Staff khojna ho bhane business/role pathaunu hola.",
      });

    case "safe_unknown_question":
    default:
      return formatReply({
        body: "Yo kura ma exact confirm garna team check chahina sakcha, tara JobMate bhitra job khojna, staff khojna, document/verification, pricing ra support ko kura ma help garna sakchu.",
        nextStep: "Tapai ko question JobMate/job/hiring sanga related ho bhane ekchoti short ma detail pathaunu hola.",
      });
  }
}

export function getAaratiHumanIntentFormattedAnswer({
  normalized,
  conversation,
} = {}) {
  const text = getText(normalized);

  if (!text) return null;
  if (isActiveFlow(conversation)) return null;
  if (isAaratiDirectMenuReply(text)) return null;
  if (isAaratiEmployerRequestText(text) || isAaratiJobSeekerRequestText(text)) return null;
  if (isDirectJobOrHiringFlow(text)) return null;

  const intent = detectIntent(text);

  if (!intent) return null;

  return {
    intent: "unknown",
    detectedIntent: intent,
    source: "aarati_human_intent_formatter",
    reply: buildReplyForIntent(intent),
  };
}
