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
    /मानव\s*तस्कर|मानव\s*तस्करी|बेचबिखन|जबरजस्ती\s*काम|अपहरण/i.test(value)
  );
}

export function buildUnsafeHiringReply() {
  return `Ma yasto request ma sahayog garna sakdina.

JobMate le sirf legal, safe ra voluntary employment/hiring process ma matra sahayog garchha.

Yedi tapai lai legal business ko lagi staff chahiyeko ho bhane business naam, location, role, salary ra work type clear pathaunu hola.`;
}

export function detectJobMateSafetyEvent({ conversation, normalized } = {}) {
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
    };
  }

  return null;
}
