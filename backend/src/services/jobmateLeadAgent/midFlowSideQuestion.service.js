import axios from "axios";
import { JOBMATE_KNOWLEDGE_TOPICS } from "../../data/knowledge/jobmateKnowledgePack.js";
import { sanitizeReply } from "./replyFormatter.service.js";
import { buildWorkerResumePrompt } from "./workerLeadFlow.service.js";
import { buildEmployerResumePrompt } from "./employerLeadFlow.service.js";
import { buildSahakariResumePrompt } from "./sahakariLeadFlow.service.js";

export async function handleMidFlowSideQuestion({
  text = "",
  activeFlow = null,
  state = {},
} = {}) {
  if (!activeFlow) return { handled: false };
  if (!isSideQuestion(text)) return { handled: false };

  const ragAnswer = findRagAnswer(text);
  const baseReply = ragAnswer || (await generateAiAnswer(text));

  if (!baseReply) return { handled: false };

  const resumePrompt = buildFlowResumePrompt({ flow: activeFlow, state });
  const reply = resumePrompt ? `${baseReply}\n\n${resumePrompt}` : baseReply;

  return { handled: true, reply };
}

function isSideQuestion(text = "") {
  const value = String(text || "").trim().toLowerCase();

  if (!value || value.length < 5) return false;

  // Single digit — numeric flow answer (menu selection, availability choice, etc.)
  if (/^[1-9]$/.test(value)) return false;

  // Bare phone number
  if (/^9[78]\d{8}$/.test(value.replace(/[\s-]/g, ""))) return false;

  // Bare numeric — salary, age, count
  if (/^\d{1,6}$/.test(value)) return false;

  // Simple yes/no/ok confirmations
  if (/^(ho|haina|cha|chha|xa|xaina|ok|okay|yes|no|thik cha|theek cha|huncha|hunxa|pardaina|hajur|nai|hoo|sahi)$/.test(value)) return false;

  // Single well-known role name
  if (/^(waiter|driver|cook|helper|cleaner|security|guard|sales|receptionist|teacher|accountant|cashier|kitchen|electrician|plumber|mason|carpenter|nurse|sweeper|peon|watchman)$/.test(value)) return false;

  // Single well-known location name
  if (/^(butwal|bardaghat|parasi|bhairahawa|jimirbar|sunwal|nawalpur|palpa|rupandehi|lumbini|pokhara|kathmandu|chitwan|lalitpur|butaha|tansen|byas|gaidakot|waling|damauli)$/.test(value)) return false;

  // Multi-part data entry (≥ 2 commas = structured flow data, not a question)
  const commaCount = (value.match(/,/g) || []).length;
  if (commaCount >= 2) return false;

  // Long message with an embedded phone number = flow data entry
  if (value.length > 60 && /9[78]\d{8}/.test(value.replace(/\s/g, ""))) return false;

  // Must have an explicit question mark or a clear knowledge-seeking phrase
  return (
    value.includes("?") ||
    /\b(ke ho|k ho|kasari|kina|barema|about|what|how|bujhna|explain)\b/.test(value) ||
    /\b(jobmate|job\s*mate)\b/.test(value) ||
    /\b(verified\s*badge|field\s*agent|pricing plan|plan k|plan ke)\b/.test(value)
  );
}

function findRagAnswer(text = "") {
  const value = String(text || "").toLowerCase();

  for (const topic of JOBMATE_KNOWLEDGE_TOPICS) {
    if (topic.patterns.some((pattern) => pattern.test(value))) {
      return topic.answer;
    }
  }

  return null;
}

async function generateAiAnswer(text = "") {
  const apiKey = String(
    process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || ""
  ).trim();
  if (!apiKey) return null;

  try {
    const mockEnv = process.env.JOBMATE_LEAD_AGENT_GEMINI_MOCK_JSON;
    if (mockEnv) {
      const parsed = JSON.parse(mockEnv);
      const answer = String(parsed?.knowledgeAnswer || "").trim();
      return answer || null;
    }

    const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const prompt = [
      "Timi JobMate Nepal ko helpful assistant ho.",
      "User le JobMate barema question gareko cha. Tyo question ko Roman Nepali ma short, clear, helpful answer deu.",
      "Hindi words (nahi, kya, hai, aap, chahiye, kaise, accha) naprayu.",
      "AI, Gemini, model, provider, ya kuno tech word naprayu.",
      "Job guarantee, payment final, staff ready bhanera naprayu.",
      "2-3 sentence ma answer deu. Natural Roman Nepali tone.",
      'Return ONLY valid JSON: { "knowledgeAnswer": "<reply>" }',
      "",
      `User question: ${text}`,
    ].join("\n");

    const response = await axios.post(
      url,
      {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
      },
      { timeout: Number(process.env.AI_TIMEOUT_MS || 2500) }
    );

    const raw =
      response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const parsed = JSON.parse(raw);
    const answer = sanitizeReply(String(parsed?.knowledgeAnswer || "").trim());

    return answer || null;
  } catch {
    return null;
  }
}

function buildFlowResumePrompt({ flow = null, state = {} } = {}) {
  if (flow === "worker") return buildWorkerResumePrompt({ state });
  if (flow === "employer") return buildEmployerResumePrompt({ state });
  if (flow === "sahakari") return buildSahakariResumePrompt({ state });
  return "";
}
