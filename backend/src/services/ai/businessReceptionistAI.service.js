import axios from "axios";
import { env } from "../../config/env.js";
import {
  buildBusinessReceptionistPrompt,
  getDefaultBusinessProfileForAI,
} from "./businessPromptBuilder.service.js";

const FALLBACK_REPLY =
  "Yo kura hamro team le confirm garera tapai lai chhittai reply garnuhuncha.";

export async function generateBusinessReceptionistReply(userText) {
  const cleanText = String(userText || "").trim();

  if (!cleanText) {
    return makeResult({
      intent: "greeting",
      reply: "Namaste 🙏 Tapai lai kasari help garna sakchu?",
      source: "empty_fallback",
    });
  }

  const businessProfile = await getDefaultBusinessProfileForAI();

  if (!businessProfile) {
    return makeResult({
      ok: false,
      intent: "unknown",
      reply: FALLBACK_REPLY,
      needsHuman: true,
      priority: "medium",
      reason: "Business profile not configured",
      source: "no_business_profile",
    });
  }

  const ruleReply = buildFastRuleReply({
    text: cleanText,
    businessProfile,
  });

  if (ruleReply) {
    return ruleReply;
  }

  if (!env.GEMINI_API_KEY) {
    return makeResult({
      ok: false,
      intent: "unknown",
      reply: FALLBACK_REPLY,
      needsHuman: true,
      priority: "medium",
      reason: "Gemini API key missing",
      source: "no_gemini_key",
    });
  }

  try {
    const prompt = buildBusinessReceptionistPrompt({
      businessProfile,
      userText: cleanText,
    });

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
          temperature: 0.25,
          topP: 0.8,
          maxOutputTokens: 350,
          responseMimeType: "application/json",
        },
      },
      {
        timeout: 20000,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const raw =
      response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    const parsed = safeParseJSON(raw);
    const normalized = normalizeBusinessAIResult(parsed);

    if (!normalized.reply || normalized.reply === FALLBACK_REPLY) {
      return makeResult({
        intent: "unknown",
        reply: FALLBACK_REPLY,
        needsHuman: true,
        priority: "medium",
        reason: "AI returned weak/empty reply",
        source: "weak_ai_fallback",
      });
    }

    return normalized;
  } catch (error) {
    console.error("❌ Business receptionist AI failed:", {
      status: error?.response?.status,
      message: error?.message,
      data: error?.response?.data,
    });

    return makeResult({
      ok: false,
      intent: "unknown",
      reply: FALLBACK_REPLY,
      needsHuman: true,
      priority: "medium",
      reason: "AI failed, fallback used",
      source: "ai_error_fallback",
    });
  }
}

function buildFastRuleReply({ text, businessProfile }) {
  const lower = normalize(text);
  const businessName = businessProfile.businessName || "hamro business";

  if (
    includesAny(lower, [
      "start",
      "restart",
      "menu",
      "suru",
      "सुरु",
      "sanchai",
      "sanchai hunuhunxa",
      "sancho",
      "hello",
      "hi",
      "namaste",
      "namaskar",
    ])
  ) {
    return makeResult({
      intent: "greeting",
      confidence: 0.95,
      reply: `Namaste 🙏\n${businessName} ma swagat cha.\n\nTapai lai kun kura ma help garna sakchu?\n1. Services / price\n2. Booking\n3. Location`,
      source: "rule_greeting",
    });
  }

  if (
    includesAny(lower, [
      "khana khanu",
      "khana khayau",
      "khana khanu bhayo",
      "khana khayo",
    ])
  ) {
    return makeResult({
      intent: "greeting",
      confidence: 0.95,
      reply: `Khayen, dhanyabaad 🙏\nTapai le khana khanus bhayo?\n\nTapai lai ${businessName} ko kun kura ma help garna sakchu?`,
      source: "rule_casual_greeting",
    });
  }

  if (
    includesAny(lower, [
      "discount",
      "chut",
      "छुट",
      "kam hunxa",
      "sasto",
      "milxa discount",
    ])
  ) {
    return makeResult({
      intent: "discount_request",
      confidence: 0.98,
      reply:
        "Discount ko barema owner/team le confirm garnuhuncha.\n\nTapai kun service ko lagi discount bujhna chahanu bhayeko ho? Ma tapai ko request note garera team lai forward gardinchhu.",
      needsHuman: true,
      priority: "medium",
      reason: "User asked discount/negotiation",
      source: "rule_discount",
    });
  }

  if (
    includesAny(lower, [
      "location",
      "kata",
      "kaha",
      "address",
      "map",
      "ठेगाना",
      "लोकेसन",
    ])
  ) {
    const area = businessProfile.location?.area || "";
    const district = businessProfile.location?.district || "";
    const province = businessProfile.location?.province || "";
    const mapLink = businessProfile.location?.mapLink || "";

    const locationText = [area, district, province].filter(Boolean).join(", ");

    const reply = locationText
      ? `Hamro location ${locationText} ma ho.${
          mapLink ? `\nMap: ${mapLink}` : ""
        }`
      : "Location ko detail hamro team le confirm garera pathaunuhuncha 🙏";

    return makeResult({
      intent: "location_inquiry",
      confidence: 0.9,
      reply,
      needsHuman: !locationText,
      priority: locationText ? "low" : "medium",
      source: "rule_location",
    });
  }

  if (
    includesAny(lower, [
      "time",
      "khulcha",
      "open",
      "opening",
      "bandha",
      "kati baje",
      "samaya",
    ])
  ) {
    const hours = businessProfile.openingHours || "";

    return makeResult({
      intent: "opening_hours",
      confidence: 0.9,
      reply: hours
        ? `Hamro opening time ${hours} ho 🙏`
        : "Opening hour ko detail hamro team le confirm garera pathaunuhuncha 🙏",
      needsHuman: !hours,
      priority: hours ? "low" : "medium",
      source: "rule_opening_hours",
    });
  }

  if (
    includesAny(lower, [
      "booking",
      "book",
      "appointment",
      "date",
      "time milcha",
      "reserve",
    ])
  ) {
    return makeResult({
      intent: "booking_request",
      confidence: 0.9,
      reply:
        "Booking garna milcha 🙏\n\nKripaya kun service ko lagi booking garna khojnu bhayeko ho? Ani preferred date/time pani pathaunuhola.",
      source: "rule_booking",
    });
  }

  const serviceReply = findServiceReply({ lower, businessProfile });

  if (serviceReply) {
    return serviceReply;
  }

  return null;
}

function findServiceReply({ lower, businessProfile }) {
  const services = (businessProfile.services || []).filter(
    (service) => service.isActive !== false
  );

  for (const service of services) {
    const serviceName = normalize(service.name || "");
    const words = serviceName
      .split(/\s+/)
      .filter(Boolean)
      .filter((word) => !["hair", "kapal", "service"].includes(word));

    const synonymMatched =
      (serviceName.includes("cut") &&
        includesAny(lower, ["kapal kateko", "kapal katne", "kapal katako", "hair cut", "cutting", "kateko", "katne"])) ||
      (serviceName.includes("color") &&
        includesAny(lower, ["hair color", "kapal color", "color gareko", "color garne", "color"]));

    const matched =
      lower.includes(serviceName) ||
      synonymMatched ||
      words.some((word) => word.length >= 3 && lower.includes(word));

    if (!matched) continue;

    const price = formatServicePrice(service);
    const description = service.description || "";

    let reply = `${service.name}`;

    if (price) {
      reply += ` ${price} bata available cha.`;
    } else {
      reply += ` ko price hamro team le confirm garera pathaunuhuncha.`;
    }

    if (description) {
      reply += `\n${description}`;
    }

    reply +=
      "\n\nTapai yo service ko lagi booking/detail bujhna chahanu huncha?";

    return makeResult({
      intent: "price_inquiry",
      confidence: 0.95,
      reply,
      lead: {
        service: service.name,
        interest: service.name,
      },
      needsHuman: !price,
      priority: "low",
      reason: `Matched service: ${service.name}`,
      source: "rule_service_price",
    });
  }

  if (
    includesAny(lower, [
      "price",
      "kati",
      "rate",
      "fee",
      "charge",
      "cost",
      "paisa",
      "kati ho",
    ])
  ) {
    const serviceList = services
      .slice(0, 5)
      .map((service, index) => {
        const price = formatServicePrice(service);
        return `${index + 1}. ${service.name}${price ? ` — ${price}` : ""}`;
      })
      .join("\n");

    return makeResult({
      intent: "price_inquiry",
      confidence: 0.85,
      reply: serviceList
        ? `Kun service ko price bujhna chahanu bhayeko ho?\n\n${serviceList}`
        : "Kun service ko price bujhna chahanu bhayeko ho? Hamro team le detail confirm garera pathaunuhuncha.",
      needsHuman: services.length === 0,
      priority: services.length === 0 ? "medium" : "low",
      source: "rule_general_price",
    });
  }

  return null;
}

function makeResult({
  ok = true,
  intent = "unknown",
  confidence = 0.8,
  reply = FALLBACK_REPLY,
  lead = {},
  needsHuman = false,
  priority = "low",
  reason = "",
  source = "rule",
}) {
  return {
    ok,
    intent,
    confidence,
    reply,
    lead: {
      name: lead.name || "",
      phone: lead.phone || "",
      interest: lead.interest || "",
      service: lead.service || "",
      preferredDate: lead.preferredDate || "",
      preferredTime: lead.preferredTime || "",
      location: lead.location || "",
      urgency: lead.urgency || "",
    },
    needsHuman,
    priority,
    reason,
    source,
  };
}

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[।,?!.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesAny(text, words = []) {
  return words.some((word) => text.includes(String(word).toLowerCase()));
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

function normalizeBusinessAIResult(data = {}) {
  const reply = String(data.reply || "").trim();

  return {
    ok: Boolean(data.ok ?? true),
    intent: String(data.intent || "unknown"),
    confidence: Number(data.confidence || 0),
    reply: reply || FALLBACK_REPLY,
    lead: {
      name: data.lead?.name || "",
      phone: data.lead?.phone || "",
      interest: data.lead?.interest || "",
      service: data.lead?.service || "",
      preferredDate: data.lead?.preferredDate || "",
      preferredTime: data.lead?.preferredTime || "",
      location: data.lead?.location || "",
      urgency: data.lead?.urgency || "",
    },
    needsHuman: Boolean(data.needsHuman),
    priority: data.priority || "low",
    reason: data.reason || "",
    source: "business_ai",
  };
}

function formatServicePrice(service = {}) {
  const currency = service.currency || "NPR";
  const from = service.priceFrom;
  const to = service.priceTo;

  if (from && to) {
    return `${currency} ${Number(from).toLocaleString()}-${Number(
      to
    ).toLocaleString()}`;
  }

  if (from) {
    return `${currency} ${Number(from).toLocaleString()}+`;
  }

  return "";
}
