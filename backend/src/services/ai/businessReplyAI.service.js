import axios from "axios";
import { env } from "../../config/env.js";

export async function generateNaturalBusinessReply({
  businessName = "hamro business",
  businessType = "local_business",
  selectedService = "",
  userMessage = "",
  replyGoal = "booking_followup",
}) {
  if (!env.GEMINI_API_KEY) return null;

  const prompt = `
You write short, warm, human-like WhatsApp replies for a Nepali local business.

Business name: ${businessName}
Business type: ${businessType}
Selected service: ${selectedService}
User message: ${userMessage}
Reply goal: ${replyGoal}

Style:
- Roman Nepali / Nepali-English, matching user style.
- Natural human receptionist tone.
- Short and useful.
- Do not over-explain.
- Do not say you are AI/Gemini/ChatGPT.
- Do not promise final availability, discount, or fixed booking unless owner/team confirms.
- If user asks availability/date/time, say team/owner will confirm.
- Ask for one useful next detail only, usually name.

Examples:
User: "boli deuso tira khali xa?"
Service: hair color
Reply: "Hajur, hair color ko lagi bholi diuso ko availability check garera confirm gardinchhau 🙏\\n\\nKripaya tapai ko naam pathaunuhola, booking note garna sajilo huncha."

User: "bholi 2 baje aauna milcha?"
Service: hair cut
Reply: "Hajur, hair cut ko lagi bholi 2 baje ko request note gareko chu.\\n\\nTime confirm garera hamro team le tapai lai reply garnuhuncha. Tapai ko naam pathaunuhola?"

Return ONLY JSON:
{
  "reply": ""
}
`.trim();

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`;

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
          temperature: 0.45,
          topP: 0.85,
          maxOutputTokens: 220,
          responseMimeType: "application/json",
        },
      },
      {
        timeout: 5000,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const raw =
      response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    const parsed = safeParseJSON(raw);
    const reply = String(parsed.reply || "").trim();

    return reply || null;
  } catch (error) {
    console.error("❌ Natural business reply AI failed:", {
      status: error?.response?.status,
      message: error?.message,
    });
    return null;
  }
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
