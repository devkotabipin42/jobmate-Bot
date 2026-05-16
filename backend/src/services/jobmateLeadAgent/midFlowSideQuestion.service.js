import axios from "axios";
import { JOBMATE_KNOWLEDGE_TOPICS } from "../../data/knowledge/jobmateKnowledgePack.js";
import { sanitizeReply } from "./replyFormatter.service.js";

export async function handleMidFlowSideQuestion({
  text = "",
  activeFlow = null,
  state = {},
} = {}) {
  if (!activeFlow) return { handled: false };
  if (!isSideQuestion(text)) return { handled: false };

  const ragAnswer = findRagAnswer(text);

  if (ragAnswer) {
    const nudge = buildNaturalNudge(activeFlow, state);
    const reply = nudge ? `${ragAnswer}\n\n${nudge}` : ragAnswer;
    return { handled: true, reply };
  }

  const staticReply = buildStaticFallback(text, activeFlow, state);
  if (staticReply) return { handled: true, reply: staticReply };

  const aiReply = await generateAiAnswer({ text, activeFlow, state });
  if (!aiReply) return { handled: false };

  return { handled: true, reply: aiReply };
}

// Liberal: if it is NOT a clear flow answer, treat it as a potential side question.
function isSideQuestion(text = "") {
  const value = String(text || "").trim().toLowerCase();

  if (!value || value.length < 4) return false;

  // Single digit — menu selection, availability choice, confirmation
  if (/^[1-9]$/.test(value)) return false;

  // Bare phone number
  if (/^9[78]\d{8}$/.test(value.replace(/[\s-]/g, ""))) return false;

  // Bare numeric or salary range (e.g. 24, 18000, 18000-22000)
  if (/^\d{1,6}(-\d{1,6})?$/.test(value)) return false;

  // Simple yes/no/ok/availability confirmations
  if (
    /^(ho|haina|cha|chha|xa|xaina|ok|okay|yes|no|thik cha|theek cha|huncha|hunxa|pardaina|hajur|nai|hoo|sahi|full.?time|part.?time|immediate|available|unavailable)$/.test(
      value
    )
  )
    return false;

  // Single well-known role name
  if (
    /^(waiter|driver|cook|helper|cleaner|security|guard|sales|receptionist|teacher|accountant|cashier|kitchen|electrician|plumber|mason|carpenter|nurse|sweeper|peon|watchman|marketing|manager|supervisor|housekeeper|barista|delivery|operator|technician|engineer|painter|tailor|chef|steward|admin|coordinator|farmer|labour|labor)$/.test(
      value
    )
  )
    return false;

  // Single well-known location name
  if (
    /^(butwal|bardaghat|parasi|bhairahawa|jimirbar|sunwal|nawalpur|palpa|rupandehi|lumbini|pokhara|kathmandu|chitwan|lalitpur|butaha|tansen|byas|gaidakot|waling|damauli|nawalparasi|hetauda|birgunj|biratnagar|dharan|itahari)$/.test(
      value
    )
  )
    return false;

  // Multi-part data entry — ≥ 2 commas means structured field answer, not a question
  if ((value.match(/,/g) || []).length >= 2) return false;

  // Long message with an embedded Nepal phone number = data entry
  if (value.length > 60 && /9[78]\d{8}/.test(value.replace(/\s/g, ""))) return false;

  // ---- Positive signals: anything below this line is treated as a side question ----

  // Explicit question mark
  if (value.includes("?")) return true;

  // Knowledge-seeking words (Nepali + English)
  if (
    /\b(ke ho|k ho|kasari|kina|kaha|kata|kun|barema|about|what|where|who|why|bujhna|explain)\b/.test(
      value
    )
  )
    return true;

  // Mentions of JobMate/Aarati by name
  if (/\b(jobmate|job\s*mate|aarati)\b/.test(value)) return true;

  // English conversational phrases — clearly not flow data
  if (
    /\b(you|funny|haha|lol|nice|cool|awesome|thanks|thank|bye|sorry|wow|great|bravo|interesting|really)\b/i.test(
      value
    )
  )
    return true;

  // Feature/topic keywords
  if (
    /\b(verified\s*badge|field\s*agent|pricing|document\s*safe|privacy|support\s*email)\b/.test(
      value
    )
  )
    return true;

  return false;
}

function findRagAnswer(text = "") {
  const value = String(text || "").toLowerCase();
  for (const topic of JOBMATE_KNOWLEDGE_TOPICS) {
    if (topic.patterns.some((p) => p.test(value))) {
      return topic.answer;
    }
  }
  return null;
}

async function generateAiAnswer({ text = "", activeFlow = null, state = {} } = {}) {
  const apiKey = String(
    process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || ""
  ).trim();
  if (!apiKey) return null;

  // Mock support for test environments
  const mockEnv = process.env.JOBMATE_LEAD_AGENT_GEMINI_MOCK_JSON;
  if (mockEnv) {
    try {
      const parsed = JSON.parse(mockEnv);
      const answer = sanitizeReply(
        String(parsed?.reply || parsed?.knowledgeAnswer || "").trim()
      );
      return answer || null;
    } catch {
      return null;
    }
  }

  const flowCtx = buildFlowContext(activeFlow, state);
  const prompt = buildAaratiPrompt(text, flowCtx);

  try {
    const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const response = await axios.post(
      url,
      {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 256,
          responseMimeType: "application/json",
        },
      },
      { timeout: Number(process.env.AI_TIMEOUT_MS || 2500) }
    );

    const raw =
      response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const parsed = JSON.parse(raw);
    const reply = sanitizeReply(String(parsed?.reply || "").trim());
    return reply || null;
  } catch {
    return null;
  }
}

function buildAaratiPrompt(text, flowCtx) {
  return [
    "Timi Aarati ho — JobMate Nepal ki WhatsApp assistant. Warm, friendly, helpful friend jasto kura garchau.",
    "",
    "Rules:",
    "- Hamesha Roman Nepali ma reply garnu. English aayo bhane bujhnu tara Roman Nepali ma reply garnu.",
    "- Hindi words kabhi naprayu: aap, hum, kijiye, nahi, kya, hai, accha, theek.",
    "- AI, Gemini, Google, robot, language model — yo sab naprayu. Timi Aarati ho, JobMate team ki member.",
    "- Max 2-3 short lines — WhatsApp jasto compact.",
    "- Job guarantee, payment final, staff ready pakka cha — yo sab naprayu.",
    "",
    "Special scenarios:",
    '- "whats about you" / "k ho tapai" / "timi ko ho" → warmly introduce: "Ma Aarati — JobMate Nepal ki WhatsApp assistant. Job khojna ya staff khojna help garchu!"',
    '- "where are you" / "kaha cha" → "JobMate WhatsApp bata kaam garcha — Bardaghat, Nawalparasi, Lumbini area ko local base cha."',
    "- Funny/random/casual message → light humor sanga reply, tarpachi gently guide back.",
    "- General question about JobMate → short, helpful, conversational answer.",
    "",
    `Context: User ${flowCtx.description}.`,
    `Reply ko last line ma yo warm nudge raknu: "${flowCtx.nudge}"`,
    "",
    'Return ONLY valid JSON: { "reply": "<Roman Nepali reply, max 3 lines, friendly tone>" }',
    "",
    `User message: "${text}"`,
  ].join("\n");
}

function buildFlowContext(activeFlow, state) {
  const step = state?.step || "";

  if (activeFlow === "worker") {
    const nudges = {
      jobType: "Haina ta, kaam ko kura garau — kasto job khojna cha tapai lai? 😊",
      district: "Kun district ma kaam khojna cha bataunu hola.",
      location: "Kun area tira job khojna cha tapai?",
      availability: "Full-time garnu cha ki part-time?",
      documents: "License ya kochi document cha tapai sanga?",
      fullName: "Tapai ko naam k ho ni?",
      providedPhone: "Aba phone number pathaunus ta.",
      age: "Tapai ko umar kati ho?",
      experience: "Kati barsa experience cha tapai sanga?",
      expectedSalary: "Kati salary expect garnu bhayo?",
      confirmation: "Yo details thik lagcha? Confirm garnu hola.",
    };
    return {
      description: "job khojna bhani worker registration ma cha",
      nudge:
        nudges[step] ||
        "Haina ta, registration continue garau — details pathaunus hola. 😊",
    };
  }

  if (activeFlow === "employer") {
    return {
      description: "staff khojna bhani employer requirement flow ma cha",
      nudge: "Aba staff requirement ko kura garau — details pathaunus hola. 😊",
    };
  }

  if (activeFlow === "sahakari") {
    return {
      description: "sahakari partnership flow ma cha",
      nudge: "Haina ta, sahakari ko details pathaunus hola. 😊",
    };
  }

  return {
    description: "kura garirako cha",
    nudge: "Job ya staff ko kura garau — help garchu. 😊",
  };
}

function buildStaticFallback(text = "", activeFlow = null, state = {}) {
  const value = String(text || "").trim().toLowerCase();
  const nudge = buildNaturalNudge(activeFlow, state);

  // Who is Aarati / about you
  if (
    (value.includes("about") && value.includes("you")) ||
    /\b(timi\s*ko\s*ho|k\s*ho\s*tapai|tapai\s*k\s*ho|aarati\s*ko\s*ho|who\s*are\s*you)\b/.test(value)
  ) {
    const reply =
      "Ma Aarati — JobMate Nepal ki WhatsApp assistant hun! Job khojna ya staff khojna — dui jana lai help garchu. 😊";
    return nudge ? `${reply}\n\n${nudge}` : reply;
  }

  // Where is office / location query
  if (
    /\b(office|branch|center|sewa|service)\b/.test(value) &&
    /\b(kaha|kata|where|cha|xa|kun)\b/.test(value)
  ) {
    const reply =
      "JobMate ko main base Bardaghat, Nawalparasi — Lumbini zone ma cha. WhatsApp bata nai sewa dincha, physically aaunaparne hudaina. 📍";
    return nudge ? `${reply}\n\n${nudge}` : reply;
  }

  // Where are you from / location of Aarati
  if (
    /\b(where|kaha|kata)\b/.test(value) &&
    /\b(you|aarati|tapai|timi|from|bata|hun)\b/.test(value)
  ) {
    const reply =
      "JobMate WhatsApp bata kaam garcha — Bardaghat, Nawalparasi, Lumbini area ko local base cha. 📍";
    return nudge ? `${reply}\n\n${nudge}` : reply;
  }

  // Casual / funny
  if (
    /\b(funny|haha|lol|wow|cool|nice|great|awesome|interesting|bravo)\b/i.test(value)
  ) {
    const reply = "Haha, ramro cha! 😄 JobMate sanga kura garda ni mazza aaucha ni!";
    return nudge ? `${reply}\n\n${nudge}` : reply;
  }

  return null;
}

function buildNaturalNudge(flow, state) {
  return buildFlowContext(flow, state).nudge;
}
