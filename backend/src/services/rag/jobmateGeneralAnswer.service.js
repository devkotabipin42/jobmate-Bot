import { generateJSONWithAI } from "../ai/aiProvider.service.js";

function getText(normalized = {}) {
  return String(
    normalized?.message?.text ||
      normalized?.message?.normalizedText ||
      ""
  ).trim();
}

function isLikelyDirectFlow(text = "") {
  const value = String(text || "").toLowerCase();

  return (
    /kaam chahiyo|kam chahiyo|job chahiyo|staff chahiyo|worker chahiyo|apply|register|driver|hotel|security|sales|helper|it|computer|butwal|bardaghat|bhairahawa|parasi|nawalparasi|rupandehi/i.test(value) ||
    /^[1-7]$/.test(value)
  );
}

function isQuestionLike(text = "") {
  const value = String(text || "").toLowerCase();

  return (
    /\?|ke ho|k ho|kina|kasari|kati|kaha|kahile|who|what|why|how|can you|do you|garxa|garcha|huncha|safe|trust|guarantee|responsible/i.test(value)
  );
}

function isAllowedActiveState(conversation = {}) {
  const state = String(conversation?.currentState || "");
  const lastAsked = String(conversation?.metadata?.lastAskedField || "");

  // In these active states, let repair/safety handle special questions.
  // Otherwise keep the normal form flow.
  if (["ask_documents", "ask_availability", "ask_jobType", "ask_job_type", "ask_district"].includes(state)) {
    return false;
  }

  if (lastAsked) return false;

  return true;
}

export function shouldTryGeneralAIAnswer({ conversation, normalized } = {}) {
  const text = getText(normalized);

  if (!text || text.length < 4) return false;
  if (isLikelyDirectFlow(text)) return false;
  if (!isQuestionLike(text)) return false;
  if (!isAllowedActiveState(conversation)) return false;

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
- Speak naturally in Nepali/Roman Nepali unless user clearly writes English.
- Keep WhatsApp reply short: maximum 3 short paragraphs.
- You are JobMate team ko digital sahayogi. Never mention Gemini, OpenAI, model, AI provider.
- Do not guarantee jobs. Say JobMate helps connect verified jobseekers and employers.
- Do not invent jobs, salaries, company verification, or payment status.
- If you do not know specific factual info, say you are not fully sure and can connect JobMate team.
- For document privacy: document is optional, used only for verification/hiring process, user can save profile without document.
- For illegal/unsafe hiring, trafficking, forced labor, scams: refuse.
- If off-topic harmless question, answer lightly in one line, then redirect to JobMate.
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
