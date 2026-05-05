import { generateJSONWithAI } from "../ai/aiProvider.service.js";
import {
  getAaratiRawText,
  normalizeAaratiText,
  isAaratiDirectMenuReply,
  isAaratiEmployerRequestText,
  isAaratiJobSeekerRequestText,
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

export function shouldUseAaratiAiFirstRouter({ normalized, conversation } = {}) {
  const rawText = getAaratiRawText(normalized);
  const text = normalizeAaratiText(rawText);

  if (!rawText || rawText.length < 3) return false;
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

  if (!aiResult) return null;

  const safe = normalizeAaratiAiFirstResult(aiResult);

  return {
    ...safe,
    source: "aarati_ai_first_router",
  };
}
