import {
  getAaratiRawText,
  getAaratiNormalizedText,
  isAaratiSmallTalkText,
  isAaratiFrustrationText,
  isAaratiUnsafeIllegalText,
  isAaratiPersonalMoneyText,
  isAaratiEmployerRequestText,
  isAaratiJobSeekerRequestText,
  isAaratiDirectMenuReply,
} from "./aaratiTextNormalizer.service.js";

function getText(normalized = {}) {
  return getAaratiRawText(normalized);
}

function isActiveFlow(conversation = {}) {
  const state = String(conversation?.currentState || "");
  const lastAskedField = String(conversation?.metadata?.lastAskedField || "");

  if (lastAskedField) return true;

  return [
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
  ].includes(state);
}

function isPersonalMoneyRequest(text = "") {
  return /malai.*paisa.*chah|malai.*paisa.*chai|paisa chayako|paisa chaiyo|loan|rin|ऋण|सापटी/i.test(text);
}

function isUnsafeOrIllegalRequest(text = "") {
  return /manav.*tarkar|manav.*taskar|human.*traffick|traffick|bechna| बेच्न|fake document|fake license|child worker|underage|passport rakh|salary nadine|illegal worker/i.test(text);
}

function isDirectJobOrHiringFlow(text = "") {
  const value = String(text || "").toLowerCase();

  return (
    /^[1-9]$/.test(value.trim()) ||
    /kaam chahiyo|kam chahiyo|job chahiyo|staff chahiyo|worker chahiyo|apply|register|profile save|cv patha|license patha|document patha/i.test(value) ||
    /butwal|bardaghat|bhardaghat|bhairahawa|parasi|nawalparasi|rupandehi|kapilvastu|palpa|dang|banke/i.test(value) ||
    /driver|hotel|security|sales|helper|\bit\b|computer|frontend|backend|restaurant|shop|retail|factory|cleaner|cook|waiter/i.test(value)
  );
}

function isEmployerSalaryStep(conversation = {}) {
  const state = String(conversation?.currentState || "");
  return state === "ask_salary_range" || state === "employer_ask_salary";
}

function isSalaryLikeInput(text = "") {
  const value = String(text || "").toLowerCase().trim();

  return (
    /\b\d{4,6}\s*(?:-|–|to)\s*\d{4,6}\b/i.test(value) ||
    /\b\d{4,6}\s+\d{4,6}\b/i.test(value) ||
    /\b\d{1,3}\s*k\s*(?:-|–|to)\s*\d{1,3}\s*k\b/i.test(value) ||
    /\b\d{4,6}\s*samma\b/i.test(value) ||
    /\b(company anusar|negotiable|market rate|market anusar)\b/i.test(value)
  );
}

function isFrustration(text = "") {
  return /are you mad|pagal|risayau|risako|kina bujhena|bujhdainau|wrong|galat|bakwas|stupid|idiot|bitch|fuck|gali|mad ho|kasto bot|kasto reply|ghus|ghus khanxau|bribe|rishwat|रिसवत|घुस/i.test(
    text
  );
}

function isIdentityQuestion(text = "") {
  return /timi ko hau|timro naam|who are you|what are you|aarati ko ho|tapai ko ho|तिमी को हौ|तपाई को हो/i.test(
    text
  );
}

function isWeatherQuestion(text = "") {
  return /weather|mausam|मौसम|aaja ko weather|aja ko weather|pani parcha|rain huncha|garmi|chiso|weather kasto/i.test(
    text
  );
}

function isSmallTalk(text = "") {
  return /khana bhayo|khana khayau|khana khanu bhayo|khana kanu bhayo|khana khanu vayo|khana khayo|k gardai|k cha|kxa|kbr|khabar|hello|hi|namaste|good morning|good evening|sanchai|thik cha|how are you/i.test(
    text
  );
}

function isMathOrHomework(text = "") {
  return (
    /[0-9]+\s*[\+\-\*\/x]\s*[0-9]+/.test(text) ||
    /homework|essay|assignment|solve this|math|गणित/i.test(text)
  );
}

function isPoliticsReligionDeep(text = "") {
  return /politics|election|president|prime minister|religion|bible|quran|hindu|muslim|christian|धर्म|राजनीति/i.test(
    text
  );
}

export function getAaratiHumanBoundaryAnswer({ normalized, conversation } = {}) {
  const text = getText(normalized);
  const value = getAaratiNormalizedText(normalized);

  if (!text) return null;

  if (isAaratiDirectMenuReply(value)) {
    return null;
  }

  if (isAaratiEmployerRequestText(value) || isAaratiJobSeekerRequestText(value)) {
    return null;
  }

  if (isDirectJobOrHiringFlow(value)) {
    return null;
  }

  if (isEmployerSalaryStep(conversation) && isSalaryLikeInput(value)) {
    return null;
  }

  if (isAaratiUnsafeIllegalText(value) || isUnsafeOrIllegalRequest(value)) {
    return {
      intent: "unknown",
      source: "aarati_human_boundary",
      reply: `Yo request JobMate rules anusar mil्दैन 🙏

JobMate le legal, safe ra voluntary employment/hiring process matra support garcha.

Yedi tapai lai legal business ko lagi staff chahiyeko ho bhane business name, location, role ra salary detail pathaunu hola.`,
    };
  }

  if (isAaratiPersonalMoneyText(value) || isPersonalMoneyRequest(value)) {
    return {
      intent: "unknown",
      source: "aarati_human_boundary",
      reply: `Hajur, bujhe 🙏

JobMate loan/paisa dine service haina. JobMate le kaam khojna, staff khojna, document/verification ra hiring support ma help garcha.

Tapai lai income/kaam chahiyeko ho bhane location ra kasto kaam chahiyo pathaunu hola.`,
    };
  }

  if (isAaratiFrustrationText(value) || isFrustration(value)) {
    return {
      intent: "frustrated",
      source: "aarati_human_boundary",
      reply: `Maaf garnu hola 🙏

Aghi ko reply ramro bhayena jasto lagyo. Ma JobMate team bata kaam khojna, staff khojna, document/verification, pricing ra support ko kura ma help garna sakchu.

Tapai ko main kura ekchoti short ma pathaunu hola, ma sidha answer dinchhu.`,
    };
  }

  if (isIdentityQuestion(value)) {
    return {
      intent: "unknown",
      source: "aarati_human_boundary",
      reply: `Ma Aarati ho, JobMate team bata 🙏

Ma tapai lai Nepal/Lumbini area ma kaam khojna, staff khojna, profile save garna, document verification ra support ko kura ma help garna sakchu.

Tapai kaam khojdai hunuhunchha ki staff khojdai hunuhunchha?`,
    };
  }

  if (isWeatherQuestion(value)) {
    return {
      intent: "unknown",
      source: "aarati_human_boundary",
      reply: `Maaf garnu hola 🙏 Ma live weather update herna sakdina.

Tara JobMate ko kaam ma help garna sakchu — kaam khojna, staff khojna, document verification, pricing ya support.

Tapai kun location ko job/staff ko lagi sodhdai hunuhunchha?`,
    };
  }

  if (isMathOrHomework(value) || isPoliticsReligionDeep(value)) {
    return {
      intent: "unknown",
      source: "aarati_human_boundary",
      reply: `Hajur 🙏 Yo kura JobMate ko main service bhitra direct pardaina.

Ma yaha job khojna, staff khojna, document/verification, pricing ra support ko kura ma help garna sakchu.

Tapai kaam khojdai hunuhunchha ki staff khojdai hunuhunchha?`,
    };
  }

  if (!isActiveFlow(conversation) && (isAaratiSmallTalkText(value) || isSmallTalk(value))) {
    return {
      intent: "unknown",
      source: "aarati_human_boundary",
      reply: `Hajur, thik cha 🙏

Ma Aarati, JobMate Nepal team bata. Kaam khojna, staff khojna, document/verification ya support chahiyo bhane yahi bata help garna sakchu.

Tapai lai kaam khojna ho ki staff khojna ho?`,
    };
  }

  return null;
}
