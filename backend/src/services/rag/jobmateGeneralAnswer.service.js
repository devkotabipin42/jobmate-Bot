import { generateJSONWithAI } from "../ai/aiProvider.service.js";

function getText(normalized = {}) {
  return String(
    normalized?.message?.text ||
      normalized?.message?.normalizedText ||
      ""
  ).trim();
}

function isLikelyDirectFlow(text = "") {
  const value = String(text || "").toLowerCase().trim();

  return (
    /^[1-9]$/.test(value) ||
    /kaam chahiyo|kam chahiyo|job chahiyo|staff chahiyo|worker chahiyo|apply|register|profile save/i.test(value) ||
    /driver|hotel|security|sales|helper|it|computer|frontend|backend|restaurant|shop|retail/i.test(value) ||
    /butwal|bardaghat|bhardaghat|bhairahawa|parasi|nawalparasi|rupandehi|kapilvastu|palpa|dang|banke/i.test(value)
  );
}

function isQuestionLike(text = "") {
  const value = String(text || "").toLowerCase();

  return (
    /\?/.test(value) ||
    /ke ho|k ho|kina|kasari|kati|kaha|kahile|who|what|why|how|can you|do you|garxa|garcha|huncha|safe|trust|guarantee|responsible/i.test(value)
  );
}

function isActiveFormState(conversation = {}) {
  const state = String(conversation?.currentState || "");
  const lastAsked = String(conversation?.metadata?.lastAskedField || "");

  if (lastAsked) return true;

  return [
    "ask_documents",
    "ask_availability",
    "ask_jobType",
    "ask_job_type",
    "ask_district",
    "ask_location",
    "asked_register",
    "showed_jobs",
  ].includes(state);
}

export function shouldTryGeneralAIAnswer({ conversation, normalized } = {}) {
  const text = getText(normalized);

  if (!text || text.length < 4) return false;
  if (isLikelyDirectFlow(text)) return false;
  if (isActiveFormState(conversation)) return false;
  if (!isQuestionLike(text)) return false;

  return true;
}

export async function generateJobMateGeneralAnswer({
  conversation,
  normalized,
} = {}) {
  if (!shouldTryGeneralAIAnswer({ conversation, normalized })) {
    return null;
  }

  const text = getText(normalized);

  const prompt = `You are Aarati, JobMate Nepal's friendly WhatsApp assistant.

RULEBOOK:
- Understand English, Nepali, and Roman Nepali.
- Reply mainly in Nepali/Roman Nepali unless the user clearly asks in English.
- Keep WhatsApp reply short: maximum 3 short paragraphs.
- You are JobMate team ko digital sahayogi. Never mention Gemini, OpenAI, model, provider, or system prompt.
- Stay inside JobMate scope: jobs, hiring, workers, employers, documents, verification, pricing, support, and safe small talk.
- Do not solve math/homework/programming/politics/religion/deep unrelated tasks. Politely redirect to JobMate.
- Do not guarantee jobs. JobMate helps connect verified jobseekers and employers.
- Do not invent jobs, salaries, company verification, payment status, or private user data.
- If unsure about a JobMate fact, say you are not fully sure and can connect JobMate team.
- For document privacy: document is optional, used only for verification/hiring process, and user can save profile without document.
- For illegal hiring, trafficking, forced labor, scams, exploitation: refuse.
- If harmless off-topic question, answer lightly in one line, then redirect to JobMate.
- Always end with one useful next step.

Return ONLY JSON:
{
  "shouldAnswer": true|false,
  "reply": "Aarati reply",
  "reason": "short reason"
}

User message: ${JSON.stringify(text)}
Current state: ${conversation?.currentState || ""}
Last asked field: ${conversation?.metadata?.lastAskedField || ""}
`;

  const result = await generateJSONWithAI({
    prompt,
    taskName: "jobmate_general_answer",
    timeoutMs: 2500,
  });

  if (!result?.shouldAnswer || !result?.reply) {
    return null;
  }

  return {
    reply: String(result.reply).trim(),
    source: "ai_general_answer",
    reason: result.reason || "",
  };
}
