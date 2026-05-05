import {
  getAaratiRawText,
  normalizeAaratiText,
  isAaratiEmployerRequestText,
  isAaratiJobSeekerRequestText,
  isAaratiDirectMenuReply,
} from "./aaratiTextNormalizer.service.js";

function isActiveFlow(conversation = {}) {
  const state = String(conversation?.currentState || "");
  const lastAskedField = String(conversation?.metadata?.lastAskedField || "");

  return Boolean(lastAskedField) || [
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

function format({ opener = "Bujhe Mitra ji 🙏", body, next }) {
  return `${opener}

${body}

${next}`.trim();
}

function detectPreFlowQuestion(text = "") {
  const value = normalizeAaratiText(text);

  if (/do you remember me|remember me|malai chineu|malai chinnu/i.test(value)) {
    return "memory";
  }

  if (/can you call me|call me|phone gar|call garnu|malai call/i.test(value)) {
    return "call_request";
  }

  if (/manager|supervisor|owner|human manager|talk.*manager|manager sanga/i.test(value)) {
    return "manager_request";
  }

  if (/are you real|real person|manxe ho|manche ho|bot ho|human ho|timi manxe/i.test(value)) {
    return "identity_real";
  }

  if (/choose salary|salary myself|salary afai|afai salary|salary choose|salary kati rakh/i.test(value)) {
    return "salary_choice";
  }

  if (/how fast.*job|job kati chito|kaam kati chito|kati din ma job|job kahile milcha|kaam kahile milcha/i.test(value)) {
    return "job_timeline";
  }

  if (/interview kasari|interview process|interview hunxa|interview kasto/i.test(value)) {
    return "interview_process";
  }

  if (/make my cv|cv bana|cv banaidinu|resume bana|bio data bana/i.test(value)) {
    return "cv_help";
  }

  if (/document nabhako|document chaina|without document|document bina|no document/i.test(value)) {
    return "no_document";
  }

  if (/employer real|company real|company fake|company cheat|employer fake|cheat garyo/i.test(value)) {
    return "employer_trust";
  }

  if (/worker join|worker audaina|worker run|worker bhagyo|worker chod/i.test(value)) {
    return "worker_reliability";
  }

  return null;
}

function buildReply(intent) {
  switch (intent) {
    case "memory":
      return format({
        body: "Ma conversation bhitra tapai le pathaunu bhayeko kura herera help garna sakchu. Tara ma personal memory jasto sabai kura guarantee garera yaad rakhchu bhanera bhanna mildaina.",
        next: "Tapai job/worker ko kura continue garna chahanu huncha bhane short ma main kura pathaunu hola.",
      });

    case "call_request":
      return format({
        body: "Ma yahi WhatsApp bata help garna sakchu. Phone call chahiyo bhane JobMate team lai request forward garna milcha, tara team available bhayepachi matra contact huncha.",
        next: "Tapai ko problem short ma pathaunu hola, call chahine reason pani lekhnu hola.",
      });

    case "manager_request":
      return format({
        body: "Manager/team sanga kura garnu parne bhaye ma tapai ko issue note garera forward garna sakchu. Pahile tapai ko main kura clear hunuparcha.",
        next: "Ke kura manager/team lai forward garnu parne ho, short ma pathaunu hola.",
      });

    case "identity_real":
      return format({
        opener: "Ma Aarati ho, JobMate team bata 🙏",
        body: "Ma JobMate ko WhatsApp sahayogi ho. Ma tapai lai job khojna, staff khojna, document/verification ra support ma help garna baneko system ho.",
        next: "Tapai kaam khojdai hunuhunchha ki staff khojdai hunuhunchha?",
      });

    case "salary_choice":
      return format({
        body: "Tapai salary expectation rakhna saknuhunchha, tara final salary employer, role, experience, location ra interview anusar decide huncha. JobMate salary guarantee gardaina.",
        next: "Kaam khojna ho bhane location, kaam type ra expected salary pathaunu hola.",
      });

    case "job_timeline":
      return format({
        body: "Job kati chito milcha bhanne kura role, location, employer response ra document/profile detail ma depend garcha. JobMate le guarantee gardaina, tara suitable match aaye contact garna help garcha.",
        next: "Kaam khojna ho bhane location ra kasto kaam chahiyo pathaunu hola.",
      });

    case "interview_process":
      return format({
        body: "Interview process employer anusar farak huncha. Usually employer le phone/WhatsApp bata contact garna sakcha, ani basic experience, time, salary expectation ra document bare sodhna sakcha.",
        next: "Tapai kaam khojna ho bhane location ra kaam type pathaunu hola.",
      });

    case "cv_help":
      return format({
        body: "JobMate le CV file banaidine full CV service guarantee gardaina. Tara tapai ko profile detail save garna, document/CV upload garna ra employer sanga share garna help garna sakcha.",
        next: "CV/document chha bhane WhatsApp ma file/photo pathauna saknuhunchha. Chhaina bhane pani profile save garna milcha.",
      });

    case "no_document":
      return format({
        body: "Document nabhaye pani profile save garna milcha. Document verification optional ho, tara document bhaye employer trust badhna sakcha.",
        next: "Document bina profile save garna chahanu huncha bhane kaam type, location ra availability pathaunu hola.",
      });

    case "employer_trust":
      return format({
        body: "JobMate le employer detail verify/track garna help garcha, tara company 100% guarantee garna mildaina. Suspicious kura bhaye team lai report garna milcha.",
        next: "Kun company/employer bare concern ho, name/location short ma pathaunu hola.",
      });

    case "worker_reliability":
      return format({
        body: "Worker join/continue garne kura worker ko availability, salary, work condition ra agreement ma depend garcha. JobMate le suitable candidate connect garna help garcha, guarantee gardaina.",
        next: "Employer ho bhane business name, role, location, salary ra work time pathaunu hola.",
      });

    default:
      return null;
  }
}

export function getAaratiPreFlowQaAnswer({ normalized, conversation } = {}) {
  const rawText = getAaratiRawText(normalized);
  const text = normalizeAaratiText(rawText);

  if (!rawText) return null;
  if (isActiveFlow(conversation)) return null;
  if (isAaratiDirectMenuReply(text)) return null;

  // Clear commands should go to real flows.
  if (isAaratiJobSeekerRequestText(text) || isAaratiEmployerRequestText(text)) {
    return null;
  }

  const detectedIntent = detectPreFlowQuestion(text);
  if (!detectedIntent) return null;

  return {
    intent: "unknown",
    detectedIntent,
    source: "aarati_pre_flow_qa_guard",
    reply: buildReply(detectedIntent),
  };
}
