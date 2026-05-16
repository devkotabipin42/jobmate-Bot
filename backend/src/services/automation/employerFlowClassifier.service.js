import { generateJSONWithAI } from "../ai/aiProvider.service.js";

const VALID_TYPES = new Set([
  "FLOW_ANSWER",
  "SIDE_QUESTION",
  "FILLER",
  "WORKER_INTENT",
  "OFF_TOPIC",
]);

// ── Local rule-based classifier (no API needed) ───────────────────────────────
const RE_QUESTION_WORD     = /^(what|where|who|how|why|ke|k|kaha|kasari|kina|kun|kasto|kahile|kata)\b/i;
const RE_HUMAN_HANDOFF     = /staff\s*(?:sanga|singa|saga)|team\s*(?:sanga|singa|saga)|manager\s*(?:sanga|singa|saga)|manche\s*(?:sanga|singa|saga)|human\s*(?:sanga|singa|saga)|kura\s*garna?\s*[xc]ha|human\s*support/i;
const RE_WORKER_JOB_SIGNAL = /kaam\s*chahiyo|job\s*chahiyo|kaam\s*chayako|kam\s*chayako|malai\s*kaam|malai\s*job|mero\s*lagi\s*(?:kaam|job)|i\s*need\s*(?:a\s*)?job|job\s*khojna|sorry.*kaam|galti.*bhayo.*kaam/i;
const RE_SINGLE_DIGIT      = /^\d$/;
const RE_FILLER            = /^(ok|okay|thik|thik\s*cha|huncha|hunchha|next|continue|proceed|haha|lol)$/i;
const RE_KNOWN_ROLE        = /^(driver|waiter|cook|helper|cleaner|security|guard|teacher|accountant|cashier|electrician|plumber|nurse|sweeper|barista|chef|tailor|receptionist|supervisor|marketing|sales|manager)$/i;
const RE_KNOWN_DISTRICT    = /^(nawalparasi|bardaghat|butwal|bhairahawa|palpa|dang|banke|bardiya|kapilvastu|rupandehi|parasi|lumbini|pokhara|kathmandu|lalitpur|chitwan|butaha|sunwal|rampur)$/i;

function localClassifyEmployer(text) {
  const lower = String(text || "").trim().toLowerCase();
  if (!lower) return null;

  if (RE_QUESTION_WORD.test(lower))     return { type: "SIDE_QUESTION", reason: "local: question word" };
  if (RE_HUMAN_HANDOFF.test(lower))     return { type: "SIDE_QUESTION", reason: "local: human handoff" };
  if (RE_WORKER_JOB_SIGNAL.test(lower)) return { type: "WORKER_INTENT", reason: "local: worker job-seeking signal" };
  if (RE_SINGLE_DIGIT.test(lower))      return { type: "FLOW_ANSWER",   reason: "local: single digit" };
  if (RE_FILLER.test(lower))            return { type: "FILLER",        reason: "local: filler word" };
  if (RE_KNOWN_ROLE.test(lower))        return { type: "FLOW_ANSWER",   reason: "local: known role" };
  if (RE_KNOWN_DISTRICT.test(lower))    return { type: "FLOW_ANSWER",   reason: "local: known district" };

  return null;
}

// ── Main classifier ───────────────────────────────────────────────────────────

/**
 * Classify an incoming employer-flow message.
 * 1. Local rules (instant, no API) for obvious cases.
 * 2. Gemini AI for ambiguous input (timeout 4000ms, 503 auto-retried once).
 * 3. On Gemini failure → SIDE_QUESTION (safer than FLOW_ANSWER for unknowns).
 */
export async function classifyEmployerMessage({ text = "", currentState = "" } = {}) {
  const message = String(text || "").trim();
  if (!message) return null;

  const local = localClassifyEmployer(message);
  if (local) {
    console.log("🏠 [EMPLOYER CLASSIFIER LOCAL]", local);
    return local;
  }

  const prompt = buildPrompt(message, currentState);
  let result = null;
  try {
    result = await generateJSONWithAI({
      prompt,
      taskName: "employer_flow_classifier",
      timeoutMs: 4000,
    });
  } catch {
    return null;
  }

  if (!result) return null;

  const type = String(result?.type || "").toUpperCase().trim();
  if (!VALID_TYPES.has(type)) return null;

  return {
    type,
    reason: String(result?.reason || "").slice(0, 120),
  };
}

export function buildEmployerFillerNudge(currentState = "", lastQuestion = "") {
  if (lastQuestion) return lastQuestion;

  const nudges = {
    ask_business_name:
      "Business ya company ko naam pathaunus hola (e.g., 'Hotel Annapurna', 'ABC Traders').",
    ask_business_name_after_ai:
      "Business ya company ko naam pathaunus hola.",
    ask_vacancy:
      "Kati jana staff chahiyo ra kun role ho bataunu hola (e.g., '2 jana waiter', '1 driver').",
    ask_vacancy_role:
      "Kun role ko staff chahinchha? (e.g., driver, waiter, helper, security guard)",
    ask_location:
      "Business kaha cha? Area ra district bataunu hola (e.g., 'Bardaghat, Nawalparasi').",
    ask_urgency:
      "Kahile dekhi staff chahiyo?\n1. Yo hapta (urgent)\n2. 1-2 hapta\n3. 1 mahina bhitra\n4. Planning phase",
    ask_salary_range:
      "Expected salary range ke ho? (e.g., '15000-18000', 'negotiable')",
    ask_work_type:
      "Full-time ho ki part-time? Work schedule bataunu hola.",
  };

  return nudges[currentState] || "Kripaya details pathaunus ta 🙏";
}

function buildPrompt(text, currentState) {
  return `You are a WhatsApp bot classifier for JobMate Nepal.
Current flow: employer staff hiring
Current step: ${currentState}
User message: ${text}

Classify this message as ONE of:
- FLOW_ANSWER: direct answer to the current hiring question (business name, staff count, role, location, urgency, salary, work type, etc.)
- SIDE_QUESTION: question about JobMate, Aarati, office, pricing, identity, hours, "about you", kaha cha, etc.
- FILLER: meaningless filler ("ok", "continue", "next", "haha", "thik cha", "huncha") with no real registerable hiring content
- WORKER_INTENT: user is looking for a job for themselves, not hiring (e.g., "malai kaam chahiyo", "i need a job", "job khojna ho")
- OFF_TOPIC: completely unrelated to hiring/recruitment (weather, politics, homework, personal chat)

Rules:
- Single digits (1-9) are almost always FLOW_ANSWER (menu selections or staff counts).
- Business/company names are FLOW_ANSWER at the business name step.
- Staff counts with or without roles (e.g., "2 jana", "3 driver") are FLOW_ANSWER.
- Role names alone (driver, waiter, cook, security, helper, etc.) are FLOW_ANSWER at vacancy step.
- Location names alone (Bardaghat, Butwal, Parasi, etc.) are FLOW_ANSWER at location step.
- Urgency selections ("urgent", "this week", "1 mahina") are FLOW_ANSWER at urgency step.
- Salary numbers or ranges are FLOW_ANSWER at salary step.
- "full time", "part time", "shift based" are FLOW_ANSWER at work type step.
- "ok", "thik", "huncha", "hunchha" alone are FILLER, not a useful hiring answer.
- Questions containing "kaha", "ke ho", "about", "office", "price", "hours", "time", "baje" are SIDE_QUESTION.
- WORKER_INTENT (highest priority): if user says they personally need/want a job ("malai kaam chahiyo", "job khojna cha", "i need a job", "mero lagi job") — classify as WORKER_INTENT even if the message also contains a role name.
- The key distinction: employer says "I need a driver" → FLOW_ANSWER; job seeker says "I need a driver job" or "malai kaam chahiyo" → WORKER_INTENT.

Return ONLY valid JSON: { "type": "FLOW_ANSWER", "reason": "short reason" }`;
}
