function getText(normalized = {}) {
  return String(
    normalized?.message?.text ||
      normalized?.message?.normalizedText ||
      ""
  ).trim();
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

function isDirectJobOrHiringFlow(text = "") {
  const value = String(text || "").toLowerCase();

  return (
    /^[1-9]$/.test(value.trim()) ||
    /kaam chahiyo|kam chahiyo|job chahiyo|staff chahiyo|worker chahiyo|apply|register|profile save|cv patha|license patha|document patha/i.test(value) ||
    /butwal|bardaghat|bhardaghat|bhairahawa|parasi|nawalparasi|rupandehi|kapilvastu|palpa|dang|banke/i.test(value) ||
    /driver|hotel|security|sales|helper|it|computer|frontend|backend|restaurant|shop|retail|factory|cleaner|cook|waiter/i.test(value)
  );
}

function isFrustration(text = "") {
  return /are you mad|pagal|risayau|risako|kina bujhena|bujhdainau|wrong|galat|bakwas|stupid|idiot|mad ho|kasto bot|kasto reply/i.test(
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
  return /khana bhayo|khana khayau|khana khanu bhayo|k gardai|k cha|hello|hi|namaste|good morning|good evening|sanchai|thik cha|how are you/i.test(
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
  const value = text.toLowerCase();

  if (!text) return null;

  if (isDirectJobOrHiringFlow(value)) {
    return null;
  }

  if (isFrustration(value)) {
    return {
      intent: "frustrated",
      source: "aarati_human_boundary",
      reply: `Sorry Mitra ji 🙏

Aghi ko reply ramro bhayena jasto lagyo. Ma JobMate team bata kaam khojna, staff khojna, document/verification, pricing ra support ko kura ma help garna sakchu.

Tapai ko main kura ekchoti short ma pathaunu hola, ma sidha answer dinchhu.`,
    };
  }

  if (isIdentityQuestion(value)) {
    return {
      intent: "identity",
      source: "aarati_human_boundary",
      reply: `Ma Aarati ho, JobMate team bata 🙏

Ma tapai lai Nepal/Lumbini area ma kaam khojna, staff khojna, profile save garna, document verification ra support ko kura ma help garna sakchu.

Tapai kaam khojdai hunuhunchha ki staff khojdai hunuhunchha?`,
    };
  }

  if (isWeatherQuestion(value)) {
    return {
      intent: "small_talk",
      source: "aarati_human_boundary",
      reply: `Mitra ji, ma live weather update herna sakdina 🙏

Tara JobMate ko kaam ma help garna sakchu — kaam khojna, staff khojna, document verification, pricing ya support.

Tapai kun location ko job/staff ko lagi sodhdai hunuhunchha?`,
    };
  }

  if (isMathOrHomework(value) || isPoliticsReligionDeep(value)) {
    return {
      intent: "out_of_scope",
      source: "aarati_human_boundary",
      reply: `Mitra ji, yo kura JobMate ko kaam bhanda bahira parcha 🙏

Ma yaha job khojna, staff khojna, document/verification, pricing ra support ko kura ma help garna sakchu.

Tapai kaam khojdai hunuhunchha ki staff khojdai hunuhunchha?`,
    };
  }

  if (!isActiveFlow(conversation) && isSmallTalk(value)) {
    return {
      intent: "small_talk",
      source: "aarati_human_boundary",
      reply: `Hajur Mitra ji, thik cha 🙏

Ma Aarati, JobMate team bata. Kaam khojna, staff khojna, document/verification ya support chahiyo bhane yahi bata help garna sakchu.

Tapai lai kaam khojna ho ki staff khojna ho?`,
    };
  }

  return null;
}
