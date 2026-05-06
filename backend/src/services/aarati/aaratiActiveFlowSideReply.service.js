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

function isInformationalQuestionInsideFlow(value = "") {
  return (
    /trust|vishwas|believe|genuine|legit|scam|cheat|bharosa|why.*trust|kyun.*trust/i.test(value) ||
    /remember.*me|yaad.*tapai|recall|recognize|pehchaan|tapai.*chinnu|do you remember/i.test(value) ||
    /can you call|call me|phone gar|call garnu|malai call/i.test(value) ||
    /choose salary|salary.*myself|salary.*afai|afai.*salary|salary.*choose/i.test(value) ||
    /how fast.*job|kati chitto.*job|kati din.*job|job kahile.*milcha|job.*kati.*din/i.test(value) ||
    /interview kasari|interview process|interview hunxa|interview kasto/i.test(value) ||
    /make my cv|cv.*bana|cv.*banai|resume.*bana|bio.*data.*bana/i.test(value) ||
    /timi ko ho|timi ko hau|tapai ko ho|who are you|what are you|aarati.*k.*ho|are you real|bot ho\b|human ho/i.test(value)
  );
}

function buildInformationalSideBody(value = "") {
  if (/trust|vishwas|believe|genuine|legit|scam|cheat|bharosa/i.test(value)) {
    return "JobMate Nepal ma registered ra operated service ho. Tapai ko data safe rakhcha, fake job/employer use gardaina, ra registered employer sanga matra connect garcha.";
  }
  if (/remember.*me|recall|recognize|pehchaan|tapai.*chinnu|do you remember/i.test(value)) {
    return "Ma conversation bhitra tapai le pathaunu bhayeko kura herera help garna sakchu. Tara ma personal memory jasto sabai kura yaad rakhchu bhanera guarantee gardaina.";
  }
  if (/can you call|call me|phone gar|call garnu|malai call/i.test(value)) {
    return "Ma yahi WhatsApp bata text support dinu ho. Phone call chahiyo bhane JobMate team lai request forward garna milcha.";
  }
  if (/choose salary|salary.*myself|salary.*afai|afai.*salary|salary.*choose/i.test(value)) {
    return "Tapai salary expectation rakhna saknuhunchha, tara final salary employer, role, experience ra location anusar decide huncha. JobMate salary guarantee gardaina.";
  }
  if (/how fast.*job|kati chitto.*job|kati din.*job|job kahile.*milcha|job.*kati.*din/i.test(value)) {
    return "Job kati chito milcha bhanne kura role, location, employer response ra profile detail ma depend garcha. JobMate guarantee gardaina, tara suitable match aaye contact garna help garcha.";
  }
  if (/interview kasari|interview process|interview hunxa|interview kasto/i.test(value)) {
    return "Interview process employer anusar farak huncha. Usually employer le phone/WhatsApp bata contact garna sakcha, ani basic experience ra salary expectation bare sodhna sakcha.";
  }
  if (/make my cv|cv.*bana|cv.*banai|resume.*bana|bio.*data.*bana/i.test(value)) {
    return "JobMate le full CV banaidine service guarantee gardaina. Tara tapai ko profile detail save garna, document upload garna ra employer sanga share garna help garna sakcha.";
  }
  if (/timi ko ho|timi ko hau|tapai ko ho|who are you|what are you|aarati.*k.*ho|are you real|bot ho\b|human ho/i.test(value)) {
    return "Ma Aarati ho, JobMate team bata. Ma tapai lai kaam khojna, staff khojna, profile save garna, document/verification ra support ma help garna sakchu.";
  }
  return null;
}

function isStrongJobseekerSearchInEmployerFlow(value = "", state = "") {
  const isEmployerNameStep = /ask_business_name/.test(state);
  if (!isEmployerNameStep) return false;

  const hasLocation = /butwal|bardaghat|bhardaghat|bhairahawa|parasi|nawalparasi|rupandehi|kapilvastu|palpa|dang|banke|pokhara|kathmandu|chitwan|hetauda/i.test(value);
  const hasRole = /driver|hotel|security|sales|helper|restaurant|shop|factory|cleaner|cook|waiter|guard|labor|construction/i.test(value);
  const hasJobWord = /\bjob\b|job cha|job xa|kaam cha|vacancy|job chahiyo/i.test(value);

  return hasLocation && hasRole && hasJobWord;
}

export function getAaratiActiveFlowSideReply({ text = "", conversation = {} } = {}) {
  const state = String(conversation?.currentState || "");
  const lastAskedField = String(conversation?.metadata?.lastAskedField || "");
  const value = normalizeAaratiText(text);

  if (!state && !lastAskedField) return null;

  const reminder = getReminderForState({ state, lastAskedField });

  // Employer flow: user sends a clear jobseeker job search query (e.g. "butwal ma driver job xa")
  if (isStrongJobseekerSearchInEmployerFlow(value, state)) {
    return formatActiveReply({
      opener: "Bujhe Mitra ji 🙏",
      body: "Tapai staff khojdai hunuhunthyo, tara yo message job khojna jasto lagyo. Kaam khojna ho bhane location ra kaam type clear ma pathaunu hola.",
      reminder,
    });
  }

  // Informational questions inside any active flow — answer briefly + remind current step
  if (isInformationalQuestionInsideFlow(value)) {
    const body = buildInformationalSideBody(value);
    if (body) {
      return formatActiveReply({
        opener: "Bujhe Mitra ji 🙏",
        body,
        reminder,
      });
    }
  }

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
