import { generateJSONWithAI } from "../ai/aiProvider.service.js";
import {
  getAaratiRawText,
  normalizeAaratiText,
  isAaratiDirectMenuReply,
  isAaratiEmployerRequestText,
  isAaratiJobSeekerRequestText,
  isAaratiFrustrationText,
  isAaratiUnsafeIllegalText,
  isAaratiPersonalMoneyText,
  isAaratiWeatherText,
  isAaratiMathHomeworkText,
  isAaratiRestartCommandText,
} from "./aaratiTextNormalizer.service.js";

const SAFE_DB_INTENTS = new Set([
  "unknown",
  "worker_registration",
  "job_search",
  "employer_lead",
  "frustrated",
  "restart",
  "human_handoff",
]);

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

const PROVIDER_OR_MODEL_WORDS =
  /gemini|openai|chatgpt|gpt-|gpt |language model|large language model|ai model|provider|system prompt/i;

const FAKE_GUARANTEE_WORDS =
  /100%\s*guarantee|guaranteed job|job guarantee dinch|salary guarantee dinch|sure job|pakka job|pakka milcha/i;

const FAKE_JOB_WORDS =
  /job cha.*salary|vacancy cha.*salary|company le lincha|ma confirm garchu.*job|verified job cha/i;

const HARD_UNSAFE_WORDS =
  /human trafficking|manav taskar|manav taskari|bechna|fake document|fake license|child worker|underage worker|passport hold|passport rakh|salary nadine|forced labor|bonded labor/i;

function isActiveFlow(conversation = {}) {
  const state = String(conversation?.currentState || "");
  const lastAskedField = String(conversation?.metadata?.lastAskedField || "");

  return Boolean(lastAskedField) || ACTIVE_FLOW_STATES.has(state);
}

function normalizeIntent(intent = "unknown") {
  const value = String(intent || "unknown").trim();

  return SAFE_DB_INTENTS.has(value) ? value : "unknown";
}

function cleanReply(reply = "") {
  return String(reply || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function limitReply(reply = "", maxWords = 95) {
  const words = cleanReply(reply).split(/\s+/).filter(Boolean);

  if (words.length <= maxWords) return cleanReply(reply);

  return `${words.slice(0, maxWords).join(" ")}...`;
}

function isSafeReply(reply = "") {
  const text = cleanReply(reply);

  if (!text) return false;
  if (PROVIDER_OR_MODEL_WORDS.test(text)) return false;
  if (FAKE_GUARANTEE_WORDS.test(text)) return false;
  if (FAKE_JOB_WORDS.test(text)) return false;
  if (HARD_UNSAFE_WORDS.test(text)) return false;

  return true;
}

function fallbackReplyForDetectedIntent(detectedIntent = "safe_unknown") {
  if (detectedIntent === "frustration_or_abuse") {
    return `Sorry Mitra ji 🙏

Aghi ko reply ramro bhayena jasto lagyo. Ma JobMate team bata kaam khojna, staff khojna, document/verification, pricing ra support ko kura ma help garna sakchu.

Tapai ko main kura ekchoti short ma pathaunu hola, ma sidha answer dinchhu.`;
  }

  if (detectedIntent === "personal_money_request") {
    return `Bujhe Mitra ji 🙏

JobMate loan/paisa dine service haina. JobMate le kaam khojna, staff khojna, document/verification ra hiring support ma help garcha.

Tapai lai income/kaam chahiyeko ho bhane location ra kasto kaam chahiyo pathaunu hola.`;
  }

  if (detectedIntent === "regulated_or_unrelated_product") {
    return `Mitra ji, yo JobMate le provide garne service haina 🙏

JobMate ko kaam job khojna, staff khojna, document/verification ra hiring support ho.

Kaam khojna ho bhane location ra kaam type pathaunu hola. Staff khojna ho bhane business name ra role pathaunu hola.`;
  }

  if (detectedIntent === "unsafe_illegal_request") {
    return `Yo request JobMate rules anusar mildaina 🙏

JobMate le legal, safe ra voluntary employment/hiring process matra support garcha.

Legal business ko lagi staff chahiyeko ho bhane business name, location, role ra salary detail pathaunu hola.`;
  }

  return `Bujhe Mitra ji 🙏

Yo kura ma ma JobMate ko rule bhitra basera help garna sakchu. JobMate le job khojna, staff khojna, document/verification, pricing ra support ma sahayog garcha.

Tapai kaam khojdai hunuhunchha ki staff khojdai hunuhunchha?`;
}

// ---------------------------------------------------------------------------
// Deterministic fallback — used when ALL AI providers fail/timeout.
// One AI call only: if the call fails, this runs instead of cascading to
// old intent classifier or job_search/worker_registration flows.
// ---------------------------------------------------------------------------

function detectAaratiDeterministicIntent(normalizedText = "") {
  const v = normalizedText;

  if (isAaratiFrustrationText(v)) return "frustration_or_abuse";
  if (isAaratiUnsafeIllegalText(v)) return "unsafe_illegal_request";
  if (isAaratiPersonalMoneyText(v)) return "personal_money_request";
  if (isAaratiWeatherText(v)) return "weather";
  if (isAaratiMathHomeworkText(v)) return "homework_or_math";

  if (/trust|vishwas|believe|genuine|legit|fake|scam|fraud|cheat|bharosa|trust.*garne/i.test(v)) return "trust_question";
  if (/remember.*me|yaad.*tapai|recall|recognize|pehchaan|tapai.*chinnu|remember.*gara/i.test(v)) return "memory_question";
  if (/call.*me|phone.*me|call.*gara|call.*garnu|phone.*number.*de|call.*lagau/i.test(v)) return "call_request";
  if (/salary.*choose|salary.*set|salary.*decide|salary.*fix|salary.*ma.*choice|aafai.*salary|choose.*salary|salary.*आफैँ/i.test(v)) return "salary_choice_question";
  if (/how fast|kati chitto|kati garda|kati din|kati time|kitro din|kitro time|jaldi.*job|chitto.*job|kitna.*time/i.test(v)) return "job_speed_question";
  if (/interview|interview.*kasari|interview.*kaise|interview.*garne|interview.*ko|interview.*ma/i.test(v)) return "interview_question";
  if (/cv.*ban|cv.*bana|cv.*make|cv.*create|cv.*garna|resume.*ban|resume.*bana|cv.*help|cv.*lakh|make.*cv|create.*cv/i.test(v)) return "cv_help_question";
  if (/student|parttime|part.?time|college.*job|job.*student|studying|padhai.*garda.*job|padhai.*sanga.*kaam/i.test(v)) return "parttime_question";
  if (/politics|election|president|prime minister|party|religion|dharm|धर्म|राजनीति|bible|quran/i.test(v)) return "sensitive_unrelated";
  if (/timi ko hau|timi ko ho|tapai ko ho|timro naam|who are you|what are you|aarati.*k.*ho|jobmate.*k.*ho|are you real|bot ho\b|human ho/i.test(v)) return "identity";
  if (/jobmate.*guarantee|job guarantee|salary guarantee|guarantee din|sure job|pakka job|pakka.*milcha/i.test(v)) return "job_guarantee";
  if (/document.*safe|privacy|data.*safe|cv.*safe|license.*safe|citizenship.*safe|leak.*garne/i.test(v)) return "document_privacy_unknown";
  if (/price|pricing|fee|cost|monthly|plan|free.*ho|lagcha.*kati|kati.*lagcha/i.test(v)) return "pricing_unknown";
  if (/support|team.*contact|phone.*help|human.*help/i.test(v)) return "support_unknown";
  if (/khana khanu|k cha|khabar|sanchai|hello|hi\b|namaste|good morning|good evening|how are you|k gardai/i.test(v)) return "small_talk";

  return "safe_unknown_question";
}

function buildDeterministicFallbackReply(intent = "safe_unknown_question") {
  switch (intent) {
    case "frustration_or_abuse":
      return `Sorry Mitra ji 🙏\n\nAghi ko reply ramro bhayena jasto lagyo. Ma JobMate team bata kaam khojna, staff khojna, document/verification, pricing ra support ko kura ma help garna sakchu.\n\nTapai ko main kura ekchoti short ma pathaunu hola, ma sidha answer dinchhu.`;

    case "unsafe_illegal_request":
      return `Yo request JobMate rules anusar mildaina 🙏\n\nJobMate le legal, safe ra voluntary employment/hiring process matra support garcha.\n\nLegal business ko lagi staff chahiyeko ho bhane business name, location, role ra salary detail pathaunu hola.`;

    case "personal_money_request":
      return `Bujhe Mitra ji 🙏\n\nJobMate loan/paisa dine service haina. JobMate le kaam khojna, staff khojna, document/verification ra hiring support ma help garcha.\n\nTapai lai income/kaam chahiyeko ho bhane location ra kasto kaam chahiyo pathaunu hola.`;

    case "weather":
      return `Ma live weather update herna sakdina 🙏\n\nTara JobMate ko kaam ma help garna sakchu — kaam khojna, staff khojna, document verification ya support.\n\nTapai kun location ko job/staff ko lagi sodhdai hunuhunchha?`;

    case "homework_or_math":
      return `Mitra ji, yo kura JobMate ko kaam bhanda bahira parcha 🙏\n\nMa yaha math/homework solve garna bhanda pani job khojna, staff khojna, document/verification ra support ma help garna sakchu.\n\nTapai lai JobMate ma kun kura chahiyeko ho?`;

    case "trust_question":
      return `Bujhe Mitra ji 🙏\n\nJobMate Nepal ma registered ra operated service ho. Tapai ko data safe rakhcha, fake job/employer use gardaina, ra registered employer sanga matra connect garcha.\n\nKaam khojna ho bhane location ra job type pathaunu hola.`;

    case "memory_question":
      return `Mitra ji, ma haru ko purana conversation remember garna sakdina 🙏\n\nTara tapai ko naulo message bata ma pheri help garna tauyyar chu.\n\nTapai kaam khojdai hunuhunchha ki staff khojdai hunuhunchha?`;

    case "call_request":
      return `Mitra ji, ma yahi WhatsApp bata text support dinu ho 🙏\n\nPhone/call support ko lagi JobMate team lai message garnu hola. Complex case bhaye team le contact garcha.\n\nTapai ko problem short ma pathaunu hola, ma try garchu.`;

    case "salary_choice_question":
      return `Mitra ji, salary negotiation tapai ra employer ko beech ma hune kura ho 🙏\n\nJobMate le salary fix gardaina — tara tapai ko expectation employer lai forward garna sakcha.\n\nTapai kasto job ma interested hunuhunchha? Location ra job type pathaunu hola.`;

    case "job_speed_question":
      return `Mitra ji, job milne speed depend garcha — role, location, ra employer ko response ma 🙏\n\nJobMate le job guarantee ya speed guarantee gardaina, tara match bhayema jaldi connect garcha.\n\nTapai ko location ra job type pathaunu hola, ma search garchu.`;

    case "interview_question":
      return `Mitra ji, interview ko process employer le decide garcha 🙏\n\nSamai, format ra kura kunai employer le set garcha. JobMate le match confirmed bhayema detail share garcha.\n\nTapai kasto job ma interested hunuhunchha?`;

    case "cv_help_question":
      return `Mitra ji, ma full CV banaune service haina 🙏\n\nTara tapai ko basic profile save garna, document upload garna, ra employer lai forward garna help garna sakchu.\n\nProfile save garna chahanu huncha bhane location ra job type pathaunu hola.`;

    case "parttime_question":
      return `Hajur Mitra ji 🙏\n\nPart-time kaam JobMate ma pani available huna sakcha. Location ra kasto kaam chahiyo pathaunu hola, ma available options herna sakchu.\n\nStudent hunu bhane flexible timing role pani available huncha kahi.`;

    case "sensitive_unrelated":
      return `Mitra ji, yo topic ma ma answer dina sakdina 🙏\n\nMa JobMate ko rule bhitra basera job, hiring, worker, employer, document/verification, pricing ra support ko kura ma matra help garchu.\n\nTapai kaam khojdai hunuhunchha ki staff khojdai hunuhunchha?`;

    case "identity":
      return `Ma Aarati ho, JobMate team bata 🙏\n\nMa tapai lai kaam khojna, staff khojna, profile save garna, document/verification ra support ma help garna sakchu.\n\nTapai kaam khojdai hunuhunchha ki staff khojdai hunuhunchha?`;

    case "job_guarantee":
      return `Mitra ji, JobMate le job guarantee ya salary guarantee gardaina 🙏\n\nJobMate le jobseeker ra employer lai connect garna, profile/application manage garna ra verification support garna help garcha.\n\nTapai kaam khojdai hunuhunchha bhane location ra kaam type pathaunu hola.`;

    case "document_privacy_unknown":
      return `Mitra ji, document compulsory haina 🙏\n\nDocument verification/hiring process ko lagi matra use huncha. Tapai comfortable hunuhunna bhane document bina pani profile save garna milcha.\n\nDocument bina profile save garna 2 lekhnu hola.`;

    case "pricing_unknown":
      return `Mitra ji, jobseeker ko basic profile/application support generally free ho 🙏\n\nEmployer pricing/service plan chai business need anusar confirm garna parcha.\n\nTapai jobseeker ho bhane kaam type ra location pathaunu hola.`;

    case "support_unknown":
      return `Mitra ji, JobMate support ko lagi ma yahi WhatsApp ma basic help garna sakchu 🙏\n\nComplex kura bhaye team lai forward garna milcha.\n\nTapai ko problem short ma pathaunu hola, ma sidha help garne try garchu.`;

    case "small_talk":
      return `Hajur Mitra ji, thik cha 🙏\n\nMa Aarati, JobMate team bata. Small kura garna milcha, tara mero main kaam tapai lai job/hiring support dinu ho.\n\nKaam khojna ho bhane location ra kaam type pathaunu hola. Staff khojna ho bhane business/role pathaunu hola.`;

    case "safe_unknown_question":
    default:
      return `Bujhe Mitra ji 🙏\n\nYo kura ma ma exact answer confirm garna sakdina, tara JobMate bhitra ma job khojna, staff khojna, document/verification, pricing ra support ko kura ma help garna sakchu.\n\nTapai ko question JobMate/job/hiring sanga related ho bhane ekchoti short ma detail pathaunu hola.`;
  }
}

export function buildAaratiDeterministicFallback(rawText, normalizedText) {
  const detectedIntent = detectAaratiDeterministicIntent(normalizedText || normalizeAaratiText(rawText || ""));
  const reply = buildDeterministicFallbackReply(detectedIntent);

  return {
    route: "answer",
    intent: detectedIntent === "frustration_or_abuse" ? "frustrated" : "unknown",
    detectedIntent,
    allowed: true,
    confidence: 0.6,
    reply,
    nextStep: "",
    handoffNeeded: detectedIntent === "frustration_or_abuse",
    reason: "deterministic_fallback",
    source: "aarati_ai_first_router:deterministic_fallback",
  };
}

// ---------------------------------------------------------------------------

export function shouldUseAaratiAiFirstRouter({ normalized, conversation } = {}) {
  const rawText = getAaratiRawText(normalized);
  const text = normalizeAaratiText(rawText);

  if (!rawText || rawText.length < 3) return false;
  if (isAaratiRestartCommandText(rawText)) return false;
  if (isActiveFlow(conversation)) return false;
  if (isAaratiDirectMenuReply(text)) return false;

  // Let dedicated flows handle real jobseeker/employer commands.
  if (isAaratiJobSeekerRequestText(text)) return false;
  if (isAaratiEmployerRequestText(text)) return false;

  return true;
}

export function normalizeAaratiAiFirstResult(result = {}) {
  const detectedIntent = String(result?.detectedIntent || "safe_unknown").trim();
  const allowed = result?.allowed !== false;
  const confidence = Number.isFinite(Number(result?.confidence))
    ? Math.max(0, Math.min(1, Number(result.confidence)))
    : 0.5;

  let reply = cleanReply(result?.reply || "");

  if (!allowed) {
    reply = fallbackReplyForDetectedIntent(detectedIntent);
  }

  reply = limitReply(reply || fallbackReplyForDetectedIntent(detectedIntent), 95);

  if (!isSafeReply(reply)) {
    reply = fallbackReplyForDetectedIntent(detectedIntent);
  }

  return {
    route: String(result?.route || "answer"),
    intent: normalizeIntent(result?.intent || "unknown"),
    detectedIntent,
    allowed,
    confidence,
    reply,
    nextStep: cleanReply(result?.nextStep || ""),
    handoffNeeded: Boolean(result?.handoffNeeded),
    reason: cleanReply(result?.reason || "ai_first_router"),
  };
}

export async function generateAaratiAiFirstAnswer({
  normalized,
  conversation,
} = {}) {
  if (!shouldUseAaratiAiFirstRouter({ normalized, conversation })) {
    return null;
  }

  const rawText = getAaratiRawText(normalized);
  const normalizedText = normalizeAaratiText(rawText);

  const prompt = `You are Aarati, a real JobMate Nepal WhatsApp staff assistant.

You must understand English, Nepali, Roman Nepali, mixed language, and typos.

JOBMATE SCOPE:
- Job search support
- Employer/staff hiring support
- Worker profile/application support
- Document and verification questions
- Pricing/support questions
- Safe small talk, but redirect gently to JobMate

STRICT RULEBOOK:
- Reply mainly Nepali/Roman Nepali, even if user writes English.
- Keep reply short: 2 to 4 short WhatsApp lines, max 90 words.
- Never mention AI, Gemini, OpenAI, ChatGPT, model, provider, or system prompt.
- Do not solve unrelated math/homework/politics/religion/deep tasks.
- Do not provide alcohol, drugs, weapons, medicines, money/loan, or unrelated products.
- Do not support human trafficking, fake documents, child labor, forced labor, passport holding, or illegal hiring.
- Do not guarantee job, salary, placement, or employer response.
- Do not invent job listings, salary, company names, verification status, or private user data.
- If user asks for job listings, do not answer with fake listing. Tell them to send location and job type.
- If unsure, answer honestly and give one JobMate next step.
- If user is angry/abusive, apologize calmly and ask them to send the main issue shortly.
- Always sound like JobMate team staff, not a bot.

Return ONLY valid JSON with this exact shape:
{
  "route": "answer",
  "intent": "unknown",
  "detectedIntent": "small_talk | identity | weather | math_homework | personal_money_request | regulated_or_unrelated_product | unsafe_illegal_request | document_privacy | pricing | support | frustration_or_abuse | safe_unknown",
  "allowed": true,
  "confidence": 0.0,
  "reply": "short human Aarati WhatsApp reply",
  "nextStep": "one clear next step",
  "handoffNeeded": false,
  "reason": "short reason"
}

IMPORTANT:
- intent must be one of: unknown, frustrated, human_handoff.
- For anger/abuse use intent "frustrated".
- For everything else in this router use intent "unknown".
- Do not output markdown.

User message: ${JSON.stringify(rawText)}
Normalized message: ${JSON.stringify(normalizedText)}
Conversation state: ${conversation?.currentState || "idle"}
Last asked field: ${conversation?.metadata?.lastAskedField || ""}
`;

  const aiResult = await generateJSONWithAI({
    prompt,
    taskName: "aarati_ai_first_router",
    timeoutMs: 8000,
  });

  // One AI call only. If all providers fail (timeout/503/quota), use
  // deterministic bounded fallback — never fall through to old classifier.
  if (!aiResult) {
    console.warn("⚠️ [aarati_ai_first_router] All AI providers failed — using deterministic fallback");
    return buildAaratiDeterministicFallback(rawText, normalizedText);
  }

  const safe = normalizeAaratiAiFirstResult(aiResult);

  return {
    ...safe,
    source: "aarati_ai_first_router",
  };
}
