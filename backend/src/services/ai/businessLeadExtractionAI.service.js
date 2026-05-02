import axios from "axios";
import { env } from "../../config/env.js";

let aiCooldownUntil = 0;

export async function extractBusinessLeadWithAI({
  messageText,
  selectedService = "",
  businessType = "",
}) {
  const text = String(messageText || "").trim();

  if (!text || !env.GEMINI_API_KEY) {
    return null;
  }

  if (Date.now() < aiCooldownUntil) {
    console.log("⏳ Business lead AI cooldown active, using fallback extraction");
    return null;
  }

  const prompt = `
You extract booking/lead details from Nepali, Roman Nepali, Nepali-English WhatsApp messages.

Business type: ${businessType || "local business"}
Selected service context: ${selectedService || "unknown"}

User message:
${text}

Understand flexible spellings:
- bholi, boli, voli = tomorrow
- aaja = today
- parsi = day_after_tomorrow
- dui baje = 2:00
- tin baje = 3:00
- belka = evening
- bihana = morning
- दिउँसो / diuso = afternoon

Return ONLY valid JSON.

JSON format:
{
  "ok": true,
  "intent": "booking_request | price_inquiry | service_inquiry | location_inquiry | discount_request | human_request | unknown",
  "service": "",
  "preferredDate": "",
  "preferredTime": "",
  "urgency": "",
  "customerName": "",
  "location": "",
  "needsHuman": false,
  "confidence": 0.0,
  "reason": ""
}

Rules:
- Use selected service if user message implies booking/detail for that service.
- preferredDate should be normalized: today, tomorrow, day_after_tomorrow, or raw date if specific.
- preferredTime should be normalized as human readable like "2:00 PM" when possible.
- Do not invent customer name or phone.
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
          temperature: 0.1,
          topP: 0.8,
          maxOutputTokens: 300,
          responseMimeType: "application/json",
        },
      },
      {
        timeout: 4000,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const raw =
      response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    const parsed = safeParseJSON(raw);

    return {
      ok: Boolean(parsed.ok ?? true),
      intent: parsed.intent || "unknown",
      service: parsed.service || "",
      preferredDate: parsed.preferredDate || "",
      preferredTime: parsed.preferredTime || "",
      urgency: parsed.urgency || "",
      customerName: parsed.customerName || "",
      location: parsed.location || "",
      needsHuman: Boolean(parsed.needsHuman),
      confidence: Number(parsed.confidence || 0),
      reason: parsed.reason || "",
      source: "business_lead_ai",
    };
  } catch (error) {
    const status = error?.response?.status;

    if (status === 429) {
      aiCooldownUntil = Date.now() + 2 * 60 * 1000;
      console.error("🚦 Business lead AI rate limited. Cooling down for 2 minutes.");
    } else {
      console.error("❌ Business lead extraction AI failed:", {
        status,
        message: error?.message,
      });
    }

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
