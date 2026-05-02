import { generateJSONWithAI } from "./aiProvider.service.js";
import {
  resolveLumbiniLocation,
  getLocationSearchTerms,
} from "../jobmate/lumbiniLocation.service.js";
import { resolveJobMateLocationSmart } from "../location/smartLocationResolver.service.js";

export async function extractJobSearchWithAI({ text = "" } = {}) {
  const message = String(text || "").trim();

  if (!message) return null;

  const ruleFallback = extractJobSearchWithRules(message);

  const prompt = `
You extract job search details from Nepali, Roman Nepali, and Nepali-English WhatsApp messages.

User message:
${message}

Business context:
This is JobMate Nepal, currently focused on Lumbini Province job matching.

Important Lumbini areas include:
Bardaghat, Parasi/Ramgram, Sunwal, Butwal, Bhairahawa/Siddharthanagar, Tilottama, Devdaha, Rupandehi, Nawalparasi West, Kapilvastu, Taulihawa, Banaganga, Chandrauta, Palpa, Tansen, Banke, Nepalgunj, Dang, Ghorahi, Tulsipur.

Allowed categories:
- Hospitality
- Driver/Transport
- Security
- Shop/Retail
- Construction/Labor
- Farm/Agriculture
- IT/Tech
- Education
- Finance/Banking
- Other

Return ONLY valid JSON:
{
  "ok": true,
  "intent": "job_search | worker_registration | salary_question | document_question | human_support | greeting | unknown",
  "locationText": "",
  "category": "",
  "keyword": "",
  "urgency": "",
  "confidence": 0.0,
  "reason": ""
}

Rules:
- If user asks if work/job is available, intent is job_search.
- Extract only the location text the user mentioned. Do not invent location.
- If user says "j sukai kaam", category should be "Other" and keyword "any work".
- If user says hotel/waiter/kitchen/restaurant, category "Hospitality".
- If user says driver/license/gadi, category "Driver/Transport".
- If user says factory/helper/production, category "Construction/Labor" or "Other".
- If location is not mentioned, keep locationText empty.
- Do not invent salary, company, or job availability.
`.trim();

  let parsed = null;

  try {
    parsed = await generateJSONWithAI({
      prompt,
      taskName: "jobmate_job_search_extraction",
    });
  } catch (error) {
    console.warn("⚠️ JobMate extraction AI failed:", error?.message || error);
  }

  const aiResult = parsed
    ? await buildExtractionResult({
        intent: parsed.intent,
        locationText: parsed.locationText || parsed.location || "",
        category: parsed.category,
        keyword: parsed.keyword,
        urgency: parsed.urgency,
        confidence: parsed.confidence,
        reason: parsed.reason,
        source: "jobmate_job_search_ai_provider",
      })
    : null;

  // If AI fails or gives weak/empty location, use rule fallback.
  if (!aiResult) return ruleFallback;

  if (!aiResult.locationText && ruleFallback?.locationText) {
    return {
      ...aiResult,
      locationText: ruleFallback.locationText,
      resolvedLocation: ruleFallback.resolvedLocation,
      locationSearchTerms: ruleFallback.locationSearchTerms,
      shouldSearchJobs: ruleFallback.shouldSearchJobs,
      needsLocationClarification: ruleFallback.needsLocationClarification,
      reason: aiResult.reason || ruleFallback.reason,
    };
  }

  return aiResult;
}

async function buildExtractionResult({
  intent = "unknown",
  locationText = "",
  category = "",
  keyword = "",
  urgency = "",
  confidence = 0,
  reason = "",
  source = "jobmate_extraction",
} = {}) {
  const cleanLocationText = String(locationText || "").trim();

  // Try local JSON map first (instant, no API call)
  const localResolved = cleanLocationText
    ? resolveLumbiniLocation(cleanLocationText)
    : null;

  let resolvedLocation = localResolved;
  let isClearlyOutsideLumbini = false;
  let isPossiblyLocalNepal = false;

  // If local map did not match, try Mapbox for unknown places
  if (cleanLocationText && !localResolved) {
    try {
      const smart = await resolveJobMateLocationSmart(cleanLocationText);
      if (smart) {
        isClearlyOutsideLumbini = Boolean(smart.isClearlyOutsideLumbini);
        isPossiblyLocalNepal = Boolean(smart.isPossiblyLocalNepal);
        if (smart.isInsideLumbini && smart.resolvedLocation) {
          resolvedLocation = smart.resolvedLocation;
        }
      }
    } catch (_) {
      // Mapbox failed — treat as possibly local Nepal, do not block user
      isPossiblyLocalNepal = true;
    }
  }

  const isJobSearch = intent === "job_search";

  // Only block user if Mapbox clearly proved outside Lumbini.
  // Unknown places = treat as local Nepal, go to follow-up flow.
  const needsLocationClarification =
    isJobSearch &&
    (!cleanLocationText || (isClearlyOutsideLumbini && !resolvedLocation));

  return {
    ok: true,
    intent: intent || "unknown",
    locationText: cleanLocationText,
    location: resolvedLocation?.canonical || cleanLocationText || "",
    resolvedLocation,
    locationSearchTerms: resolvedLocation
      ? getLocationSearchTerms(cleanLocationText)
      : [],
    category: normalizeCategory(category || keyword || ""),
    keyword: keyword || "",
    urgency: urgency || "",
    confidence: Number(confidence || 0),
    shouldSearchJobs: isJobSearch && Boolean(resolvedLocation),
    needsLocationClarification,
    isClearlyOutsideLumbini,
    isPossiblyLocalNepal,
    reason:
      reason ||
      (isClearlyOutsideLumbini
        ? "clearly_outside_lumbini"
        : needsLocationClarification
          ? "missing_or_unknown_lumbini_location"
          : ""),
    source,
  };
}

async function extractJobSearchWithRules(message = "") {
  const text = String(message || "").toLowerCase();

  const resolvedLocation = resolveLumbiniLocation(message);
  const guessedLocationText = guessLocationText(message);
  const locationText =
    resolvedLocation?.matchedAlias ||
    resolvedLocation?.canonical ||
    guessedLocationText ||
    "";

  let category = "Other";
  let keyword = "";

  if (/(hotel|restaurant|waiter|kitchen|cook|होटल|वेटर)/i.test(message)) {
    category = "Hospitality";
    keyword = "hotel";
  } else if (/(driver|license|licence|gadi|गाडी|ड्राइभर)/i.test(message)) {
    category = "Driver/Transport";
    keyword = "driver";
  } else if (/(security|guard|गार्ड|सेक्युरिटी)/i.test(message)) {
    category = "Security";
    keyword = "security";
  } else if (/(shop|sales|retail|pasal|पसल|सेल्स)/i.test(message)) {
    category = "Shop/Retail";
    keyword = "shop";
  } else if (/(factory|helper|labour|labor|construction|फ्याक्ट्री|हेल्पर)/i.test(message)) {
    category = "Construction/Labor";
    keyword = "factory/helper";
  } else if (/(j sukai|junsukai|any work|जे सुकै|जुनसुकै)/i.test(message)) {
    category = "Other";
    keyword = "any work";
  }

  const isJobSearch =
    /(kaam|kam|job|work|jagir|काम|जागिर).*(xa|cha|chha|छ|छैन|xaina|chaina)/i.test(text) ||
    /(xa|cha|chha|छ).*(kaam|kam|job|work|jagir|काम|जागिर)/i.test(text) ||
    /(kaam|kam|job|work|jagir|काम|जागिर)/i.test(text);

  return await buildExtractionResult({
    intent: isJobSearch ? "job_search" : "unknown",
    locationText,
    category,
    keyword,
    confidence: resolvedLocation ? 0.75 : 0.45,
    reason: resolvedLocation ? "rule_location_match" : "rule_no_location_match",
    source: "jobmate_job_search_rule_fallback",
  });
}

function guessLocationText(message = "") {
  const raw = String(message || "").trim();

  // Strip leading filler words like "malai", "tapai", "ma" before matching
  const cleaned = raw
    .replace(/^(malai|tapai|hajur|please|pls|ma|मलाई|मा)\s+/gi, "")
    .trim();

  const FILLER_WORDS = new Set([
    "malai", "tapai", "hajur", "ma", "yo", "kei", "kehi",
    "mलाई", "मलाई", "please", "pls",
  ]);

  const patterns = [
    /([A-Za-zऀ-ॿ]+(?:[\s-][A-Za-zऀ-ॿ]+)?)\s+(ma|maa|मा)\s+(kaam|kam|job|work|jagir|काम|जागिर)/i,
    /([A-Za-zऀ-ॿ]+(?:[\s-][A-Za-zऀ-ॿ]+)?)\s+(tira|side|area)/i,
  ];

  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match?.[1]) {
      const candidate = match[1].trim();
      if (FILLER_WORDS.has(candidate.toLowerCase())) continue;
      if (candidate.length < 3) continue;
      return candidate;
    }
  }

  return "";
}

function normalizeCategory(value = "") {
  const text = String(value || "").toLowerCase().trim();

  if (!text) return "Other";

  if (text.includes("hospitality") || text.includes("hotel") || text.includes("restaurant")) {
    return "Hospitality";
  }

  if (text.includes("driver") || text.includes("transport")) return "Driver/Transport";
  if (text.includes("security")) return "Security";
  if (text.includes("shop") || text.includes("retail") || text.includes("sales")) return "Shop/Retail";
  if (text.includes("construction") || text.includes("labor") || text.includes("labour") || text.includes("factory") || text.includes("helper")) {
    return "Construction/Labor";
  }
  if (text.includes("farm") || text.includes("agriculture")) return "Farm/Agriculture";
  if (text.includes("it") || text.includes("tech")) return "IT/Tech";
  if (text.includes("education")) return "Education";
  if (text.includes("finance") || text.includes("bank")) return "Finance/Banking";

  return "Other";
}
