import { generateJSONWithAI } from "../ai/aiProvider.service.js";

const VALID_TYPES = new Set([
  "FLOW_ANSWER",
  "SIDE_QUESTION",
  "FILLER",
  "EMPLOYER_INTENT",
  "OFF_TOPIC",
]);

// ── Local rule-based classifier (no API needed) ───────────────────────────────
const RE_QUESTION_WORD        = /^(what|where|who|how|why|ke|k|kaha|kasari|kina|kun|kasto|kahile|kata)\b/i;
const RE_HUMAN_HANDOFF        = /staff\s*(?:sanga|singa|saga)|team\s*(?:sanga|singa|saga)|manager\s*(?:sanga|singa|saga)|manche\s*(?:sanga|singa|saga)|human\s*(?:sanga|singa|saga)|kura\s*garna?\s*[xc]ha|human\s*support/i;
const RE_EMPLOYER_SIGNAL      = /staff\s*chahiyo|worker\s*chahiyo|hire\s*garna|vacancy\s*cha|malai\s*staff|(?:need|chahiyo)\s+(?:staff|driver|worker|hr|manager)|recruit\s*garna/i;
const RE_JOB_SEEKER_AFFIRM    = /malai\s*(kaam|job)\s*chaiyo|i\s*need\s+a?\s*job\b|job\s*chahiyo|kaam\s*chahiyo|mero\s*lagi\s*(kaam|job)/i;
const RE_SINGLE_DIGIT         = /^\d$/;
const RE_FILLER               = /^(ok|okay|thik|thik\s*cha|huncha|hunchha|next|continue|proceed|haha|lol)$/i;
const RE_KNOWN_ROLE           = /^(driver|waiter|cook|helper|cleaner|security|guard|teacher|accountant|cashier|electrician|plumber|nurse|sweeper|barista|chef|tailor|receptionist|supervisor|marketing|sales|manager)$/i;
const RE_KNOWN_DISTRICT       = /^(nawalparasi|bardaghat|butwal|bhairahawa|palpa|dang|banke|bardiya|kapilvastu|rupandehi|parasi|lumbini|pokhara|kathmandu|lalitpur|chitwan|butaha|sunwal|rampur)$/i;

function localClassifyWorker(text) {
  const lower = String(text || "").trim().toLowerCase();
  if (!lower) return null;

  if (RE_QUESTION_WORD.test(lower))     return { type: "SIDE_QUESTION",   reason: "local: question word" };
  if (RE_HUMAN_HANDOFF.test(lower))     return { type: "SIDE_QUESTION",   reason: "local: human handoff" };
  // Job-seeker affirmation must be checked BEFORE employer signal to avoid EMPLOYER_INTENT mismatch
  if (RE_JOB_SEEKER_AFFIRM.test(lower)) return { type: "FILLER",          reason: "local: job seeker in worker flow" };
  if (RE_EMPLOYER_SIGNAL.test(lower))   return { type: "EMPLOYER_INTENT", reason: "local: employer signal" };
  if (RE_SINGLE_DIGIT.test(lower))      return { type: "FLOW_ANSWER",     reason: "local: single digit" };
  if (RE_FILLER.test(lower))            return { type: "FILLER",          reason: "local: filler word" };
  if (RE_KNOWN_ROLE.test(lower))        return { type: "FLOW_ANSWER",     reason: "local: known role" };
  if (RE_KNOWN_DISTRICT.test(lower))    return { type: "FLOW_ANSWER",     reason: "local: known district" };

  return null;
}

// ── Main classifier ───────────────────────────────────────────────────────────

/**
 * Classify an incoming worker-flow message.
 * 1. Local rules (instant, no API) for obvious cases.
 * 2. Gemini AI for ambiguous input (timeout 4000ms, 503 auto-retried once).
 * 3. On Gemini failure → SIDE_QUESTION (safer than FLOW_ANSWER for unknowns).
 */
export async function classifyWorkerMessage({ text = "", currentState = "" } = {}) {
  const message = String(text || "").trim();
  if (!message) return null;

  const local = localClassifyWorker(message);
  if (local) {
    console.log("🏠 [WORKER CLASSIFIER LOCAL]", local);
    return local;
  }

  const prompt = buildPrompt(message, currentState);
  let result = null;
  try {
    result = await generateJSONWithAI({
      prompt,
      taskName: "worker_flow_classifier",
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

export function buildFillerNudge(currentState = "", lastQuestion = "") {
  if (lastQuestion) return lastQuestion;

  const nudges = {
    ask_job_type:
      "Tapai kun kaam khojdai hunuhunchha? Euta number pathaunus hola.",
    ask_jobType:
      "Tapai kun kaam khojdai hunuhunchha? Euta number pathaunus hola.",
    ask_district:
      "Tapai kun district ma kaam garna milcha bataunu hola.",
    ask_availability:
      "Tapai kahile dekhi kaam start garna ready hunuhuncha?\n1. Immediate\n2. 1-2 hapta\n3. 1 mahina\n4. Not decided",
    ask_document_status:
      "Tapai sanga document (license, nagarikta, CV) chha?\n1. Chha\n2. Chhaina\n3. Kehi chha, kehi chhaina",
    ask_documents:
      "Document photo ya file pathaunu hola, ya status bataunu hola.",
    ask_fullName: "Tapai ko full naam ke ho?",
    ask_providedPhone: "Tapai ko phone number ke ho?",
    ask_age: "Tapai ko umar kati ho?",
    ask_experience: "Tapai sanga kati barsa ko experience chha?",
    ask_expectedSalary: "Tapai ko expected salary kati ho?",
    ask_confirmation:
      "Details thik chha bhane 'ho' ya 'yes' pathaunus, natrabhane change garna bataunu hola.",
  };

  return nudges[currentState] || "Kripaya jaankari pathaunus ta 🙏";
}

function buildPrompt(text, currentState) {
  return `You are a WhatsApp bot classifier for JobMate Nepal.
Current flow: worker registration
Current step: ${currentState}
User message: ${text}

Classify this message as ONE of:
- FLOW_ANSWER: direct answer to the current question (job type, district, availability, name, phone, etc.)
- SIDE_QUESTION: question about JobMate, Aarati, office, pricing, identity, hours, "about you", kaha cha, etc.
- FILLER: meaningless filler ("continue", "ok", "next", "haha", "lol", "thik") with no real registerable content
- EMPLOYER_INTENT: user wants to hire or recruit staff — they are an employer, not a job seeker
- OFF_TOPIC: completely unrelated to job search (weather, politics, homework, personal chat)

Rules:
- Single digits (1-9) are almost always FLOW_ANSWER (menu selections).
- Job type names alone (driver, waiter, cook, security, etc.) are FLOW_ANSWER.
- District/location names as a standalone reply are FLOW_ANSWER.
- "ok", "thik", "huncha" right after a question are FILLER (not confirmation yet).
- Questions containing "kaha", "ke ho", "about you", "office", "price", "hours", "time", "baje" are SIDE_QUESTION.
- EMPLOYER_INTENT rule (highest priority): if the user says they NEED or WANT a person to work FOR them — phrases like "need hr manager", "need staff", "need driver", "hire garna", "staff chahiyo", "vacancy cha", "recruit garna", "looking for [role]", "i need [role]", "[role] chahiyo mero business ko lagi" — classify as EMPLOYER_INTENT even if it contains a role name.
- The key distinction: job seeker says "I want a job as driver" → FLOW_ANSWER; employer says "I need a driver" → EMPLOYER_INTENT.

Return ONLY valid JSON: { "type": "FLOW_ANSWER", "reason": "short reason" }`;
}
