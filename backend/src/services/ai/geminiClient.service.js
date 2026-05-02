import axios from "axios";
import { env } from "../../config/env.js";

export async function callGeminiJson({ systemInstruction, userText }) {
  if (!env.GEMINI_API_KEY) {
    return {
      ok: false,
      reason: "GEMINI_API_KEY_NOT_CONFIGURED",
      data: null,
    };
  }

  try {
    const model = env.GEMINI_MODEL || "gemini-3-flash-preview";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;

    const prompt = `${systemInstruction}

Return ONLY valid JSON. No markdown. No explanation.

User message:
${userText}`;

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
          responseMimeType: "application/json",
        },
      },
      { timeout: 12000 }
    );

    const text =
      response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    try {
      return {
        ok: true,
        data: JSON.parse(text),
      };
    } catch {
      return {
        ok: false,
        reason: "GEMINI_JSON_PARSE_FAILED",
        raw: text,
        data: null,
      };
    }
  } catch (error) {
    return {
      ok: false,
      reason: "GEMINI_API_ERROR",
      status: error.response?.status || null,
      message:
        error.response?.data?.error?.message ||
        error.message ||
        "Gemini request failed",
      data: null,
    };
  }
}
