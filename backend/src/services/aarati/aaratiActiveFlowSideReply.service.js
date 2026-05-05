import {
  isAaratiSmallTalkText,
  isAaratiFrustrationText,
  isAaratiWeatherText,
  isAaratiMathHomeworkText,
  isAaratiUnsafeIllegalText,
  isAaratiPersonalMoneyText,
  normalizeAaratiText,
} from "./aaratiTextNormalizer.service.js";

function formatActiveReply({ opener, body, reminder }) {
  return `${opener}

${body}

${reminder}`.trim();
}

function getReminderForState({ state = "", lastAskedField = "" } = {}) {
  const key = lastAskedField || state;

  if (key === "jobType" || state === "ask_jobType" || state === "ask_job_type") {
    return `Aile kaam type choose garne step ma cha:
1. IT / Computer
2. Driver / Transport
3. Hotel / Restaurant
4. Sales / Shop
5. Security Guard
6. Helper / Labor
7. Jun sukai / any`;
  }

  if (key === "location" || state === "ask_location" || state === "ask_district") {
    return `Aile location step ma cha.
Kripaya tapai kun area/district ma kaam khojdai hunuhunchha, jastai Butwal, Bardaghat, Bhairahawa, Parasi pathaunu hola.`;
  }

  if (key === "availability" || state === "ask_availability") {
    return `Aile availability step ma cha:
1. Full-time
2. Part-time
3. Shift based
4. Jun sukai`;
  }

  if (key === "documents" || state === "ask_documents" || state === "ask_document_status") {
    return `Aile document step ma cha.
Document pathaunu compulsory haina.
Document bina profile save garna 2 lekhnu hola.
Document chha bhane yahi WhatsApp ma photo/file pathauna saknuhunchha.`;
  }

  if (state === "asked_register") {
    return `Aile profile register garne step ma cha:
1. Ho, register garchhu
2. Pachhi try garchhu`;
  }

  if (state === "ask_business_name" || state === "ask_business_name_after_ai") {
    return `Aile employer/business detail step ma cha.
Kripaya business/company name pathaunu hola.`;
  }

  if (state === "ask_vacancy" || state === "ask_vacancy_role") {
    return `Aile required staff role step ma cha.
Kripaya kasto staff chahiyeko ho, role pathaunu hola.`;
  }

  if (state === "ask_salary_range") {
    return `Aile salary/work detail step ma cha.
Kripaya salary range ra work time pathaunu hola.`;
  }

  return `Aile JobMate ko form/process chaldai cha.
Kripaya aghi sodheko kura ko answer short ma pathaunu hola.`;
}

export function getAaratiActiveFlowSideReply({ text = "", conversation = {} } = {}) {
  const state = String(conversation?.currentState || "");
  const lastAskedField = String(conversation?.metadata?.lastAskedField || "");
  const value = normalizeAaratiText(text);

  if (!state && !lastAskedField) return null;

  const reminder = getReminderForState({ state, lastAskedField });

  if (isAaratiSmallTalkText(value)) {
    return formatActiveReply({
      opener: "Hajur Mitra ji, thik cha 🙏",
      body: "Ma yahi chu. Tapai ko JobMate process bich mai cha, tesaile step skip nagari help garchu.",
      reminder,
    });
  }

  if (isAaratiFrustrationText(value)) {
    return formatActiveReply({
      opener: "Sorry Mitra ji 🙏",
      body: "Aghi ko reply ramro bhayena jasto lagyo. Ma tapai ko process bigarna dinna, yahi step bata help garchu.",
      reminder,
    });
  }

  if (isAaratiWeatherText(value) || isAaratiMathHomeworkText(value)) {
    return formatActiveReply({
      opener: "Bujhe Mitra ji 🙏",
      body: "Yo kura JobMate process bhanda bahira parcha, tara tapai ko form bich mai cha.",
      reminder,
    });
  }

  if (isAaratiUnsafeIllegalText(value)) {
    return formatActiveReply({
      opener: "Yo request JobMate rules anusar mildaina 🙏",
      body: "JobMate legal, safe ra voluntary hiring ko lagi matra ho.",
      reminder,
    });
  }

  if (isAaratiPersonalMoneyText(value)) {
    return formatActiveReply({
      opener: "Bujhe Mitra ji 🙏",
      body: "JobMate loan/paisa dine service haina. Tara kaam khojna help garna sakchu.",
      reminder,
    });
  }

  return null;
}
