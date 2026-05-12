import axios from "axios";
import {
  findReplyPolicyIssues,
  sanitizeReply,
} from "./replyFormatter.service.js";

const ALLOWED_INTENTS = new Set([
  "worker_lead",
  "worker_registration",
  "employer_lead",
  "sahakari_partnership",
]);

export function shouldUseGeminiAssist({
  message = "",
  intentDecision = {},
  activeFlow = null,
} = {}) {
  const value = normalize(message);
  if (!value || isNoGeminiSafetyOrPolicyMessage(value)) return false;

  const intent = intentDecision?.intent || "unknown";
  if (["reset", "greeting", "knowledge_question"].includes(intent)) return false;

  if (intent === "unknown") {
    return /\b(job|kaam|kam|staff|worker|manxe|manche|sahakari|restaurant|hotel|helper|driver|kitchen)\b/i.test(value);
  }

  if (activeFlow && isMessy(value)) return true;

  return isMessy(value) && ["worker_start", "employer_start", "sahakari_start"].includes(intent);
}

export async function assistWithMessyMessage({
  message = "",
  activeFlow = null,
  collectedData = {},
} = {}) {
  if (!getGeminiApiKey()) return null;

  const result = await callGeminiJsonSafely({
    systemInstruction: buildSystemInstruction(),
    userText: JSON.stringify({
      message,
      activeFlow,
      collectedData,
    }),
  });

  if (!result?.ok || !result.data) return null;

  return normalizeAssistPayload(result.data);
}

export function buildGeminiAssistedText({ message = "", assist = {} } = {}) {
  const fields = assist?.fieldsSuggestion || {};
  const parts = [String(message || "").trim()];

  const role = cleanText(fields.roleInterest || fields.role || fields.roleNeeded || fields.jobType);
  const location = cleanText(fields.currentLocation || fields.location || fields.preferredArea);
  const name = cleanText(fields.fullName || fields.workerName || fields.businessName || fields.sahakariName);
  const phone = cleanText(fields.phone || fields.providedPhone);
  const count = cleanText(fields.numberNeeded || fields.quantity);
  const salary = cleanText(fields.salaryRange || fields.expectedSalary);
  const timing = cleanText(fields.timing);
  const contact = cleanText(fields.contactPerson || fields.managerName);
  const meeting = cleanText(fields.preferredMeetingTime || fields.meeting);
  const memberCount = cleanText(fields.memberCountApprox || fields.memberCount);

  if (name) parts.push(`naam ${name}`);
  if (phone) parts.push(`phone ${phone}`);
  if (location) parts.push(`${location} area`);
  if (role && assist.intentSuggestion?.includes("worker")) parts.push(`${role} job`);
  if (role && assist.intentSuggestion === "employer_lead") {
    parts.push(`${count || 1} ${role} chahiyo`);
  }
  if (count && assist.intentSuggestion === "employer_lead") parts.push(`${count} jana`);
  if (salary) parts.push(`salary ${salary}`);
  if (timing) parts.push(`timing ${timing}`);
  if (contact) parts.push(`contact ${contact}`);
  if (meeting) parts.push(`${meeting} meeting garna milcha`);
  if (memberCount) parts.push(`member ${memberCount} jati chan`);
  if (fields.hasLicense || /available|partial/i.test(String(fields.documentsStatus || ""))) {
    parts.push("license cha documents cha");
  }
  if (fields.businessSector) parts.push(cleanText(fields.businessSector));
  if (fields.urgency) parts.push(cleanText(fields.urgency));
  if (fields.experienceNeeded || fields.experienceRequired) {
    parts.push(`experience ${cleanText(fields.experienceNeeded || fields.experienceRequired)}`);
  }
  if (fields.genderPreference) parts.push(`gender ${cleanText(fields.genderPreference)}`);
  if (fields.feeUnderstanding) parts.push("fee worker join bhayepachi");
  if (fields.businessOwnerMembers === true) parts.push("business owner members pani chan");

  return parts.filter(Boolean).join(". ");
}

async function callGeminiJsonSafely({ systemInstruction = "", userText = "" } = {}) {
  try {
    const mockJson = process.env.JOBMATE_LEAD_AGENT_GEMINI_MOCK_JSON;
    if (mockJson) {
      return {
        ok: true,
        data: JSON.parse(mockJson),
      };
    }

    const apiKey = getGeminiApiKey();
    if (!apiKey) return { ok: false, data: null };

    const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
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
      { timeout: Number(process.env.AI_TIMEOUT_MS || 2500) }
    );

    const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    return {
      ok: true,
      data: JSON.parse(text),
    };
  } catch {
    return {
      ok: false,
      data: null,
    };
  }
}

function getGeminiApiKey() {
  return String(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "").trim();
}

function buildSystemInstruction() {
  return [
    "You help parse messy Roman Nepali WhatsApp messages for JobMate lead intake.",
    "You are only a parser and reply-polish helper. Do not approve leads, payments, jobs, or profile sharing.",
    "Return JSON with: intentSuggestion, fieldsSuggestion, replySuggestion, confidence.",
    "Allowed intentSuggestion values: worker_lead, worker_registration, employer_lead, sahakari_partnership, unknown.",
    "Use concise Roman Nepali for replySuggestion.",
    "Do not mention any implementation, tool, model, provider, or automation.",
    "Do not promise jobs, staff availability, payment finalization, document sharing, free/unpaid labor, child labor, or unsafe labor.",
    "For employer payment, only say human team confirms after requirement/worker joining.",
    "For sahakari, prefer 30-day zero-investment employment support pilot first.",
  ].join("\n");
}

function normalizeAssistPayload(data = {}) {
  const confidence = Number(data.confidence || 0);
  const intentSuggestion = String(data.intentSuggestion || "unknown").trim();

  if (confidence < 0.68 || !ALLOWED_INTENTS.has(intentSuggestion)) {
    return null;
  }

  const fieldsSuggestion = isPlainObject(data.fieldsSuggestion)
    ? sanitizeFields(data.fieldsSuggestion)
    : {};

  const replySuggestion = sanitizeAssistReply(data.replySuggestion);

  return {
    intentSuggestion,
    fieldsSuggestion,
    replySuggestion,
    confidence,
  };
}

function sanitizeFields(fields = {}) {
  return Object.fromEntries(
    Object.entries(fields)
      .filter(([, value]) => value !== null && value !== undefined && value !== "")
      .map(([key, value]) => [key, sanitizeFieldValue(value)])
  );
}

function sanitizeFieldValue(value) {
  if (typeof value === "boolean" || typeof value === "number") return value;
  if (Array.isArray(value)) return value.map(sanitizeFieldValue).filter(Boolean);
  if (isPlainObject(value)) return sanitizeFields(value);
  return cleanText(value);
}

function sanitizeAssistReply(reply = "") {
  const sanitized = sanitizeReply(reply);
  if (!sanitized || findReplyPolicyIssues(sanitized).length) return "";
  if (/\b(job|staff)\b.*\bguarantee|pakka\s+job|staff\s+ready\b/i.test(sanitized)) return "";
  if (/\b(payment|settlement|fee)\b.*\bfinal|free\s+labor|unpaid|child\s+worker/i.test(sanitized)) return "";
  return sanitized;
}

function isMessy(value = "") {
  return /\b(kei|ki|painxa|paincha|pauxa|pauna|side tira|tira|ni cha|jodna|manche chainxa|manxe chainxa|kitchen tira|ko lagi)\b/i.test(value);
}

function isNoGeminiSafetyOrPolicyMessage(value = "") {
  return /\b(job|kaam|kam|placement)\b.*\b(guarantee|pakka)\b|\bpakka\b.*\b(job|kaam|kam|placement|paune)\b/i.test(value) ||
    /\b(paisa|fee|charge|cost|free|lagcha|lagchha|tirnu|payment)\b/i.test(value) ||
    /\b(staff|worker|candidate|profile)\b.*\b(ready|available|cha|chha|xa)\b/i.test(value) ||
    /\b(timi\s+ai\s+ho|ai\s+ho|timi ko ho|who are you)\b/i.test(value) ||
    /\b(document|documents|cv|license|citizenship|nagarikta|passport)\b.*\b(photo|copy|share|pathaideu|pathau|dinu|dinuhunxa|dar|safe|privacy|leak|rakhera|hold)\b/i.test(value) ||
    /\b(manxe\s+bech|manche\s+bech|traffick|free\s+ma\s+worker|free\s+ma\s+kaam|salary\s+nadine|unpaid|age\s*(15|16)|child\s+helper|passport\s+rakhera|cheap\s+female)\b/i.test(value);
}

function cleanText(value = "") {
  return String(value || "")
    .replace(/[^\p{L}\p{N}\s./:-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalize(value = "") {
  return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
