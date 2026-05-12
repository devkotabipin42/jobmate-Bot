import { normalizeLeadAgentText } from "./intent.service.js";
import { formatReply } from "./replyFormatter.service.js";

export function detectLeadAgentSafetyQuestion({ text = "", activeFlow = null } = {}) {
  const value = normalizeLeadAgentText(text);

  if (!value) return null;

  const hardSafety = detectHardSafetyRefusal(value);
  if (hardSafety) {
    return {
      type: hardSafety,
      preserveFlow: false,
      clearFlow: true,
      hardRefusal: true,
    };
  }

  if (/\btimro\s+malik\s+ko\s+ho\b|\bowner\s+ko\s+ho\b|\bjobmate\s+ko\s+(owner|malik)\b/i.test(value)) {
    return { type: "company_owner", preserveFlow: Boolean(activeFlow) };
  }

  if (/\btimi ko ho\b|\bko ho\b.*\btimi\b|\bwho are you\b|\btimi\s+ai\s+ho\b|\bai\s+ho\b|\bgemini\b.*\b(use|garchau|chalauchau)\b/i.test(value)) {
    return { type: "identity", preserveFlow: Boolean(activeFlow) };
  }

  if (/^(help|menu|sahayog)$/i.test(value) || /\b(employer|jobseeker)\b.*\bconfuse\b|\bconfuse\b.*\b(employer|jobseeker)\b/i.test(value)) {
    return { type: "help_menu", preserveFlow: Boolean(activeFlow) };
  }

  if (/website\s+banai|website\s+bana|love\s+letter|letter\s+lekh/i.test(value)) {
    return { type: "out_of_scope", preserveFlow: Boolean(activeFlow) };
  }

  if (/kina\s+bujh(dainau|dainas|na)|bujhdainau|bujhna\s+sakdainau/i.test(value)) {
    return { type: "confusion", preserveFlow: Boolean(activeFlow) };
  }

  if (/\b(job|kaam|kam|placement)\b.*\b(guarantee|pakka)\b|\b(guarantee|pakka)\b.*\b(job|kaam|kam|placement|paune)\b|\bjob\s+paune\s+pakka\b/i.test(value)) {
    return { type: "job_guarantee", preserveFlow: true };
  }

  if (/\b(data|personal detail|profile)\b.*\b(safe|privacy|secure|surakshit)\b|\bmero\s+data\s+safe\b/i.test(value)) {
    return { type: "data_privacy", preserveFlow: true };
  }

  if (/\b(number|phone|mobile)\b.*\b(dinu|share|pathaune|dincha|dinuhuncha)\b|\bemployer\b.*\bmero\s+(number|phone|mobile)\b/i.test(value)) {
    return { type: "contact_privacy", preserveFlow: true };
  }

  if (/\bcv\b.*\b(sabai|company|pathaune|share|pathaideu)\b|\b(sabai|company)\b.*\bcv\b/i.test(value)) {
    return { type: "document_privacy", preserveFlow: true };
  }

  if (/\b(citizenship|nagarikta|personal document|document)\b.*\b(employer|company)\b.*\b(pathaune|pathauna|share|dinu|dincha|dinuhuncha|dinuhunxa)\b|\b(employer|company)\b.*\b(citizenship|nagarikta|personal document|document)\b.*\b(pathaune|pathauna|share|dinu|dincha|dinuhuncha|dinuhunxa)\b/i.test(value)) {
    return { type: "document_privacy", preserveFlow: true };
  }

  if (/\bcv\b.*\b(dar|darr|safe|privacy|pathauna|leak)\b|\b(dar|darr|safe|privacy|leak)\b.*\bcv\b/i.test(value)) {
    return { type: "document_privacy", preserveFlow: Boolean(activeFlow) };
  }

  if (/\b(tapai haru|jobmate)\b.*\b(kata|location|company)\b|\bkata ko company\b/i.test(value)) {
    return { type: "company_location", preserveFlow: false };
  }

  if (/\b(lumbini)\b.*\b(bahira|outside)\b|\bbahira\b.*\bjob\b/i.test(value)) {
    return { type: "outside_lumbini", preserveFlow: false };
  }

  if (/\bpokhara\b.*\b(kaam|job|cha|chha|xa)\b/i.test(value)) {
    return { type: "pokhara_location", preserveFlow: false };
  }

  if (/\bkathmandu\b.*\b(kaam|job|driver|waiter|helper|cleaner|cook|cha|chha|xa)\b/i.test(value)) {
    return { type: "outside_service_area", city: "Kathmandu", preserveFlow: false };
  }

  if (
    (activeFlow === "sahakari" || /\brevenue\b/i.test(value)) &&
    /\b(revenue|share|fee)\b.*\b(kasari|share|huncha|hunchha)\b/i.test(value)
  ) {
    return { type: "sahakari_revenue", preserveFlow: true };
  }

  if (
    (activeFlow === "sahakari" || /\bfirst month|pahilo month|1 month\b/i.test(value)) &&
    /\b(first month|pahilo month|1 month)\b.*\b(result|aayena|ayena)\b|\bresult\b.*\b(aayena|ayena)\b/i.test(value)
  ) {
    return { type: "sahakari_no_result", preserveFlow: true };
  }

  if (activeFlow === "worker" && /\bsalary\b.*\b(kati|hunxa|huncha|hunchha)|\b(kati|kun)\b.*\bsalary\b/i.test(value)) {
    return { type: "worker_salary", preserveFlow: true };
  }

  if (activeFlow === "worker" && /\b(document|documents|cv|license|citizenship)\b.*\b(dar|safe|privacy|pathauna|leak)|\b(dar|safe|privacy|leak)\b.*\b(document|documents|cv|license|citizenship)\b/i.test(value)) {
    return { type: "document_privacy", preserveFlow: true };
  }

  if (/\b(staff|worker|candidate|profile)\b.*\b(ready|available|cha|chha|xa)\b/i.test(value)) {
    return { type: "staff_ready", preserveFlow: true };
  }

  if (activeFlow === "employer" && /\b(worker|staff|candidate)\b.*\b(ramro bhayena|nar-amro|nar-amro|replace|replacement|chhodyo|chodcha|problem)\b|\b(ramro bhayena|replace|replacement)\b.*\b(worker|staff|candidate)\b/i.test(value)) {
    return { type: "employer_replacement", preserveFlow: true };
  }

  if (activeFlow === "sahakari" && /\bfranchise\b.*\b(lina|linu|parcha|pardaina|chaincha|compulsory|jaruri|required)|\b(lina|linu|parcha|pardaina|chaincha|compulsory|jaruri|required)\b.*\bfranchise\b/i.test(value)) {
    return { type: "sahakari_franchise", preserveFlow: true };
  }

  if (
    activeFlow === "sahakari" &&
    /\b(paisa|fee|payment|investment|lagcha|lagchha|tirnu|upfront)\b/i.test(value)
  ) {
    return { type: "sahakari_upfront", preserveFlow: true };
  }

  if (/\b(payment|settlement|commission|advance|deal|salary)\b.*\b(final|fix|confirm|settle|tirne|linu|dinu)\b/i.test(value)) {
    return { type: "payment_settlement", preserveFlow: true };
  }

  if (
    activeFlow === "employer" &&
    /\b(fee|payment|paisa)\b.*\b(worker\s+)?join\s+(bhayepachi|pachi)|\b(worker\s+)?join\s+(bhayepachi|pachi)\b.*\b(fee|payment|paisa)\b/i.test(value)
  ) {
    return { type: "employer_pricing", preserveFlow: true };
  }

  if (
    /\b(paisa|fee|charge|cost|free|lagcha|lagchha|tirnu|payment)\b/i.test(value) &&
    isPricingQuestion(value)
  ) {
    return {
      type: activeFlow === "employer" ? "employer_pricing" : "worker_free",
      preserveFlow: true,
    };
  }

  return null;
}

function detectHardSafetyRefusal(value = "") {
  const text = String(value || "").toLowerCase();

  if (
    /manxe\s+bech|manche\s+bech|human\s+traffick|trafficking|manxe\s+pathaideu\s+paisa|manche\s+pathaideu\s+paisa/i.test(text)
  ) {
    return "labor_trafficking_refusal";
  }

  if (
    /worker\s+lai\s+free\s+ma|free\s+ma\s+worker|free\s+ma\s+kaam|free\s+ma.*(manche|manxe|helper|staff|worker)|salary\s+nadine|salary\s+nadi|unpaid\s+trial|bina\s+salary|paisa\s+nadi.*worker|paisa\s+nadi.*helper/i.test(text)
  ) {
    return "free_labor_refusal";
  }

  if (
    /\bage\s*(15|16)\b|\b(15|16)\s*(barsa|barsha|year|yrs?)\b|child\s+(worker|helper|labor|labour)|underage|minor\s+worker/i.test(text)
  ) {
    return "child_labor_refusal";
  }

  if (
    /passport\s+rakhera|passport\s+hold|document\s+hold|nagarikta\s+rakhera|citizenship\s+rakhera|ghar\s+bata\s+bahira\s+jana\s+nadine|bahira\s+jana\s+nadine|worker\s+lai\s+lock|advance\s+diyera\s+worker\s+lai\s+lock/i.test(text)
  ) {
    return "unsafe_control_refusal";
  }

  if (
    /(nagarikta|citizenship|passport|document|cv|resume).*(photo|copy|share|pathaideu|pathau\b|dinu|dinuhunxa|dincha)|aru\s+ko\s+document|personal\s+document|cv\s+sab(ai)?\s+employer|candidate\s+ko\s+cv\s+sab(ai)?/i.test(text)
  ) {
    return "document_privacy_refusal";
  }

  if (
    /cheap\s+female|female\s+worker\s+cheap|sasto\s+female|kt\s+cheap|keti\s+cheap|ramri\s+female|female\s+pathaideu/i.test(text)
  ) {
    return "discriminatory_request_refusal";
  }

  return null;
}

function isPricingQuestion(value = "") {
  const text = String(value || "").toLowerCase();

  return (
    text.includes("?") ||
    /\b(kati|lagcha|lagchha|tirnu|tirne|free|charge|cost|price|pricing)\b/i.test(text) ||
    text.length <= 40
  );
}

export function buildSafetyReply({ safety, activeFlow = null, resumePrompt = "" } = {}) {
  if (!safety?.type) return null;

  const base = safetyReplyByType(safety.type, activeFlow, safety);
  const reply = resumePrompt ? `${base}\n\n${resumePrompt}` : base;

  return formatReply(reply);
}

function safetyReplyByType(type, activeFlow, safety = {}) {
  switch (type) {
    case "labor_trafficking_refusal":
      return "Yo request support garna mildaina. JobMate le fair labor, legal age, safe work, consent, ra privacy follow garcha. Employer requirement verify garera only suitable verified profiles human approval pachi share garna sakincha.";

    case "free_labor_refusal":
      return "Unpaid/free labor support garna mildaina; salary, timing, role fair hunuparcha. JobMate le fair labor ra safe work follow garcha.";

    case "child_labor_refusal":
      return "Underage/child worker ko request support garna mildaina. JobMate le legal age, safe work, consent, ra fair labor follow garcha.";

    case "document_privacy_refusal":
      return "Worker documents consent bina share garna mildaina. Employer requirement verify garera only suitable verified profiles human approval pachi share garna sakincha.";

    case "unsafe_control_refusal":
      return "Passport/document hold garne, movement control garne, ya advance diyera worker lock garne request support garna mildaina. JobMate le safe work, consent, ra fair labor follow garcha.";

    case "discriminatory_request_refusal":
      return "Exploitative ya discriminatory worker request support garna mildaina. Role, salary, timing, safety, ra fair requirement clear bhaye human approval pachi suitable verified profiles share garna sakincha.";

    case "identity":
      return "Ma Aarati, JobMate team ko digital sahayogi ho. Ma job khojne worker, staff chahine employer, ra sahakari pilot inquiry ma help garchu.";

    case "company_owner":
      return "JobMate Nepal Bipin Devkota ko team le operate gariraheko local hiring support service ho. Ma Aarati, JobMate team ko digital sahayogi ho.";

    case "out_of_scope":
      return "Ma JobMate ko hiring support ko lagi ho. Website/love letter ma help garna mildaina. Job, staff, ya sahakari pilot sambandhi kura bhaye help garchu.";

    case "confusion":
      return "Maaf garnus, ma clear bujhna khojdai chu. Tapai job khojdai hunuhuncha, staff chahiyeko ho, ki sahakari pilot barema kura garna chahanu huncha?";

    case "help_menu":
      return "Tapai lai kun help chahiyo?\n1. Job khojna\n2. Staff khojna\n3. Sahakari pilot\nDaya garera 1, 2, ya 3 type garnus.";

    case "worker_free":
      return "Worker registration ra job search JobMate ma free ho. Tapai bata registration fee linna.";

    case "employer_pricing":
      return "Employer fee/payment worker join bhayepachi wa requirement confirmation pachi human team le clear garcha. Yo assistant le payment final gardaina.";

    case "job_guarantee":
      return "Job guarantee hudaina. Final hiring employer ko decision, requirement match, interview, ra availability ma depend garcha. JobMate le suitable opportunity aayo bhane follow-up/matching support garcha.";

    case "worker_salary":
      return "Salary employer, role, experience, location anusar farak huncha. JobMate guarantee gardaina, tara tapai ko expected salary note garna milcha.";

    case "document_privacy":
      return "CV/document initially optional ho. Document sharing initially optional ho. JobMate le data job matching/verification ko lagi matra use garcha. Citizenship/personal document consent bina employer lai share garna mildaina. Consent bina mass share hudaina; human team verify garera matra limited profile/document process agadi badhcha.";

    case "data_privacy":
      return "Tapai ko data job matching/verification ko lagi matra use huncha. Consent/human approval bina personal document share hudaina. Suitable employer/verified process pachi matra limited sharing huncha.";

    case "contact_privacy":
      return "Tapai ko number job matching/verification ko lagi matra use huncha. Consent/human approval bina mass share hudaina. Suitable employer/verified process pachi matra limited sharing garna sakincha.";

    case "company_location":
    case "outside_lumbini":
      return "JobMate Nepal Lumbini-focused local hiring support service ho. First pilot Bardaghat/Jimirbar/Nawalparasi West/Butwal/Parasi area focus ma cha. Bahira ko interest note garna sakincha, tara false promise gardainau.";

    case "pokhara_location":
      return "Ahile JobMate ko first pilot Lumbini/Bardaghat/Butwal/Parasi area focus ma cha. Pokhara ko lagi false promise gardina. Tapai Lumbini area ma kaam garna interested hunuhuncha bhane details note garna milcha.";

    case "outside_service_area":
      return `Ahile JobMate ko first pilot Lumbini/Bardaghat/Butwal/Parasi area focus ma cha. ${safety.city || "Yo area"} ko lagi false promise gardina. Tapai Lumbini area ma kaam garna interested hunuhuncha bhane details note garna milcha.`;

    case "staff_ready":
      return "Staff ready cha bhanera aile confirm gardina. Pahila business requirement confirm hunuparcha; tespachi human team le verified profiles matra share garcha.";

    case "employer_replacement":
      return "JobMate le short replacement/support window rakna sakcha, tara exact condition role/joining confirmation pachi human team le clear garcha. Unlimited replacement guarantee hudaina.";

    case "sahakari_franchise":
      return "Franchise compulsory hoina. Paila 30-day zero-investment employment support pilot garne; result aayepachi matra partnership/micro-franchise discuss garna sakincha.";

    case "sahakari_upfront":
      return "Pilot stage ma sahakari lai upfront investment chahindaina. 30-day zero-investment pilot garna sakincha. Placement successful bhayo bhane pilot phase ma 50/50 revenue share garna sakincha.";

    case "sahakari_revenue":
      return "Pilot phase ma placement successful bhaye employer bata collect bhayeko service fee transparent sheet/receipt ma record garincha. Pilot ma 50/50 share garna sakincha. Final settlement human team/manager approval pachi matra confirm huncha.";

    case "sahakari_no_result":
      return "Pilot ko purpose proof build garne ho. Result aayena bhane data review garera process improve garna, pilot extend garna, ya stop garna sakincha. Sahakari lai upfront loss hune model hoina.";

    case "payment_settlement":
      return "Payment, salary, commission, ya settlement yo assistant le final gardaina. Human team confirmation pachi matra kunai term agadi badhcha.";

    default:
      return activeFlow
        ? "Yo kura human team le review garcha."
        : "JobMate team le yo kura review garcha.";
  }
}
