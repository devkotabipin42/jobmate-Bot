import { generateJSONWithAI } from "../ai/aiProvider.service.js";

export function isDocumentPrivacyConcern({ conversation, normalized } = {}) {
  const text = String(
    normalized?.message?.text ||
      normalized?.message?.normalizedText ||
      ""
  ).toLowerCase();

  const isDocumentState =
    conversation?.currentState === "ask_documents" ||
    conversation?.metadata?.lastAskedField === "documents";

  if (!isDocumentState || !text) return false;

  return (
    /trust|leak|leaked|responsible|responsibility|privacy|safe|secure|security|misuse|ignore|dekhidaina|document.*leak|who will be responsible/i.test(text) ||
    /विश्वास|गोपनीय|सुरक्षित|चुहावट|दुरुपयोग|जिम्मेवारी|डर/i.test(text)
  );
}

export function buildDocumentPrivacyConcernReply() {
  return `Tapai ko chinta thik ho 🙏

Document pathaunu compulsory haina.

JobMate team le document sirf verification/hiring process ko lagi herchha. Tapai comfortable hunuhunna bhane document bina pani profile save garna milchha.

Document bina profile save garna 2 lekhnu hola.
Pachhi trust bhaye yahi WhatsApp ma license/CV/citizenship photo pathauna saknuhunchha.`;
}

export function isUnsafeHiringRequest(text = "") {
  const value = String(text || "").toLowerCase();

  return (
    /human\s*traffick|trafficker|trafficking|slave|forced\s*labor|forced\s*labour|kidnap|illegal\s*worker|sell\s*people|people\s*smuggling/i.test(value) ||
    /fasauna|fasaauna|fasayera|fasna|fasaune|jabarjasti|jabardasti|passport\s*rakh|passport\s*rakhera|manche\s*bech|manxe\s*bech|bidesh\s*pathauna.*passport|illegal\s*kaam/i.test(value) ||
    /मानव\s*तस्कर|मानव\s*तस्करी|बेचबिखन|जबरजस्ती\s*काम|अपहरण|फसाउन|पासपोर्ट\s*राख/i.test(value)
  );
}

export function buildUnsafeHiringReply() {
  return `Ma yasto request ma sahayog garna sakdina.

JobMate le sirf legal, safe ra voluntary employment/hiring process ma matra sahayog garchha.

Yedi tapai lai legal business ko lagi staff chahiyeko ho bhane business naam, location, role, salary ra work type clear pathaunu hola.`;
}

function shouldRunAISafetyClassifier({ conversation, normalized } = {}) {
  const text = String(
    normalized?.message?.text ||
      normalized?.message?.normalizedText ||
      ""
  ).toLowerCase();

  if (!text || text.length < 8) return false;

  const state = String(conversation?.currentState || "").toLowerCase();
  const isHiringContext =
    state.includes("employer") ||
    state.includes("business") ||
    state.includes("vacancy") ||
    state.includes("staff") ||
    /staff|worker|manxe|manche|hire|hiring|kaam garne|काम गर्ने/i.test(text);

  const isDocumentContext =
    state === "ask_documents" ||
    conversation?.metadata?.lastAskedField === "documents" ||
    /document|license|citizenship|cv|privacy|leak|responsible|trust|safe|secure/i.test(text);

  const hasRiskSignal =
    /fasa|fasau|jabar|jabardasti|illegal|passport|bech|smuggl|traffic|force|slave|kidnap|leak|privacy|responsible|misuse|trust/i.test(text) ||
    /फसा|जबर|गैरकानुनी|पासपोर्ट|बेच|तस्क|चुहावट|गोपनीय|जिम्मेवारी/i.test(text);

  return Boolean((isHiringContext || isDocumentContext) && hasRiskSignal);
}

async function classifySafetyWithAI({ conversation, normalized } = {}) {
  if (!shouldRunAISafetyClassifier({ conversation, normalized })) {
    return null;
  }

  const text =
    normalized?.message?.text ||
    normalized?.message?.normalizedText ||
    "";

  const prompt = `You are a safety classifier for JobMate, a WhatsApp hiring platform in Nepal.

Classify the user's message.

Return ONLY JSON:
{
  "safe": true|false,
  "category": "safe"|"document_privacy"|"unsafe_hiring"|"scam"|"abuse"|"unknown",
  "confidence": 0.0-1.0,
  "action": "allow"|"answer_privacy"|"refuse"|"human_review",
  "reason": "short reason"
}

Definitions:
- document_privacy: user asks about document leak, misuse, trust, responsibility, privacy, security, or whether document upload is safe.
- unsafe_hiring: human trafficking, forced labor, trapping/deceiving people, slavery, illegal worker request, kidnapping, passport confiscation, selling/smuggling people, exploitation.
- scam: asking for deposits, fees, fake jobs, suspicious money request.
- abuse: harassment, threats, hateful or violent request.
- safe: normal legal job search, legal hiring, salary question, location question, registration.

Current conversation state: ${conversation?.currentState || ""}
Last asked field: ${conversation?.metadata?.lastAskedField || ""}
User message: ${JSON.stringify(text)}
`;

  const result = await generateJSONWithAI({
    prompt,
    taskName: "jobmate_safety_classifier",
    timeoutMs: 2500,
  });

  if (!result || typeof result !== "object") return null;

  const confidence = Number(result.confidence || 0);
  const category = String(result.category || "unknown");
  const action = String(result.action || "allow");

  if (confidence < 0.75) return null;

  if (category === "unsafe_hiring" || action === "refuse") {
    return {
      type: "unsafe_hiring",
      intent: "frustrated",
      priority: "urgent",
      reply: buildUnsafeHiringReply(),
      updateConversation: null,
      source: "ai_safety_classifier",
      confidence,
      reason: result.reason || "",
    };
  }

  if (category === "document_privacy" || action === "answer_privacy") {
    return {
      type: "document_privacy_concern",
      intent: "worker_registration",
      priority: "medium",
      reply: buildDocumentPrivacyConcernReply(),
      updateConversation: {
        currentState: "ask_documents",
        lastAskedField: "documents",
        pendingDocumentPrivacyConcern: true,
      },
      source: "ai_safety_classifier",
      confidence,
      reason: result.reason || "",
    };
  }

  return null;
}

export async function detectJobMateSafetyEvent({ conversation, normalized } = {}) {
  const text =
    normalized?.message?.text ||
    normalized?.message?.normalizedText ||
    "";

  if (isUnsafeHiringRequest(text)) {
    return {
      type: "unsafe_hiring",
      intent: "frustrated",
      priority: "urgent",
      reply: buildUnsafeHiringReply(),
      updateConversation: null,
      source: "rule_guard",
      confidence: 1,
    };
  }

  if (isDocumentPrivacyConcern({ conversation, normalized })) {
    return {
      type: "document_privacy_concern",
      intent: "worker_registration",
      priority: "medium",
      reply: buildDocumentPrivacyConcernReply(),
      updateConversation: {
        currentState: "ask_documents",
        lastAskedField: "documents",
        pendingDocumentPrivacyConcern: true,
      },
      source: "rule_guard",
      confidence: 1,
    };
  }

  return classifySafetyWithAI({ conversation, normalized });
}
