import axios from "axios";
import { env } from "../../config/env.js";

const cooldowns = {
  gemini: 0,
  openai: 0,
};

export async function generateJSONWithAI({
  prompt,
  taskName = "ai_task",
  primaryProvider = env.AI_PRIMARY_PROVIDER || "gemini",
  fallbackProvider = env.AI_FALLBACK_PROVIDER || "",
  timeoutMs = Number(env.AI_TIMEOUT_MS || 2500),
} = {}) {
  const providers = [primaryProvider, fallbackProvider]
    .filter(Boolean)
    .filter((provider) => !["none", "false", "off", "disabled"].includes(String(provider).toLowerCase()))
    .filter(Boolean)
    .filter((provider, index, arr) => arr.indexOf(provider) === index);

  for (const provider of providers) {
    const result = await callProviderSafely({
      provider,
      prompt,
      taskName,
      timeoutMs,
    });

    if (result) return result;
  }

  return null;
}

async function callProviderSafely({ provider, prompt, taskName, timeoutMs }) {
  if (Date.now() < (cooldowns[provider] || 0)) {
    console.log(`⏳ ${provider} cooldown active for ${taskName}`);
    return null;
  }

  try {
    if (provider === "gemini") {
      return await callGeminiJSON({ prompt, timeoutMs });
    }

    if (provider === "openai") {
      return await callOpenAIJSON({ prompt, timeoutMs });
    }

    console.warn(`⚠️ Unknown AI provider: ${provider}`);
    return null;
  } catch (error) {
    handleAIError({ provider, taskName, error });
    return null;
  }
}

async function callGeminiJSON({ prompt, timeoutMs }) {
  if (!env.GEMINI_API_KEY) return null;

  const model = env.GEMINI_MODEL || "gemini-1.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;

  const response = await axios.post(
    url,
    {
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        topP: 0.8,
        maxOutputTokens: 350,
        responseMimeType: "application/json",
      },
    },
    {
      timeout: timeoutMs,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  const raw = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  return safeParseJSON(raw);
}

async function callOpenAIJSON({ prompt, timeoutMs }) {
  if (!env.OPENAI_API_KEY) return null;

  const model = env.OPENAI_MODEL || "gpt-4o-mini";

  const response = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.1,
      response_format: {
        type: "json_object",
      },
    },
    {
      timeout: timeoutMs,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
    }
  );

  const raw = response.data?.choices?.[0]?.message?.content || "{}";
  return safeParseJSON(raw);
}

function handleAIError({ provider, taskName, error }) {
  const status = error?.response?.status;
  const cooldownMs = Number(env.AI_COOLDOWN_ON_429_MS || 120000);

  if (status === 429) {
    cooldowns[provider] = Date.now() + cooldownMs;
    console.error(`🚦 ${provider} rate limited for ${taskName}. Cooling down.`);
    return;
  }

  console.error(`❌ ${provider} failed for ${taskName}:`, {
    status,
    message: error?.message,
  });
}

function safeParseJSON(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = String(text || "").match(/\{[\s\S]*\}/);
    if (!match) return {};
    try {
      return JSON.parse(match[0]);
    } catch {
      return {};
    }
  }
}
