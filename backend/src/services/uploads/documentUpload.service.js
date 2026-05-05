import { WorkerProfile } from "../../models/WorkerProfile.model.js";

const SUPPORTED_MEDIA_TYPES = ["image", "document"];

export function isSupportedDocumentMedia(normalized = {}) {
  return (
    SUPPORTED_MEDIA_TYPES.includes(normalized?.message?.type) &&
    Boolean(normalized?.message?.mediaId)
  );
}

export function inferDocumentType({
  caption = "",
  filename = "",
  mimeType = "",
} = {}) {
  const value = `${caption} ${filename} ${mimeType}`.toLowerCase();

  if (/license|licence|driving|driver|लाइसेन्स/i.test(value)) return "license";
  if (/citizen|citizenship|nagarikta|नागरिकता/i.test(value)) return "citizenship";
  if (/\bcv\b|resume|bio[-\s]?data/i.test(value)) return "cv";
  if (/certificate|training|अनुभव|experience/i.test(value)) return "certificate";
  if (/image|photo|jpeg|jpg|png/i.test(value)) return "photo";

  return "other";
}

export function buildDocumentMetadata(normalized = {}) {
  const message = normalized.message || {};

  const caption = message.mediaCaption || message.text || "";
  const filename = message.mediaFilename || "";

  return {
    type: inferDocumentType({
      caption,
      filename,
      mimeType: message.mediaMimeType,
    }),
    mediaId: message.mediaId || "",
    mimeType: message.mediaMimeType || "",
    sha256: message.mediaSha256 || "",
    caption,
    filename,
    source: "whatsapp",
    status: "received",
    verified: false,
    uploadedAt: new Date(),
    metadata: {
      providerMessageId: message.providerMessageId || "",
      whatsappMessageType: message.type || "",
      note: "Metadata captured only. File download/storage not enabled yet.",
    },
  };
}

export async function saveWorkerDocumentMetadata({ contact, normalized } = {}) {
  if (!contact?._id || !contact?.phone || !isSupportedDocumentMedia(normalized)) {
    return null;
  }

  const document = buildDocumentMetadata(normalized);

  const worker = await WorkerProfile.findOneAndUpdate(
    { contactId: contact._id },
    {
      $setOnInsert: {
        contactId: contact._id,
        source: "whatsapp",
      },
      $set: {
        phone: contact.phone,
        fullName: contact.displayName || "",
        documentStatus: "ready",
        "metadata.lastDocumentReceivedAt": new Date(),
      },
      $push: {
        documents: document,
      },
      $inc: {
        score: 5,
      },
    },
    {
      upsert: true,
      returnDocument: "after",
      setDefaultsOnInsert: true,
      runValidators: false,
    }
  );

  return {
    worker,
    document,
  };
}

export function buildDocumentReceivedReply(document = {}) {
  const labels = {
    license: "license",
    citizenship: "citizenship/nagarikta",
    cv: "CV",
    certificate: "certificate",
    photo: "photo",
    other: "document/photo",
  };

  const label = labels[document.type] || "document/photo";

  return `Photo/document receive bhayo 🙏

Maile tapai ko ${label} JobMate profile ma note gareko chhu.
Hamro team le suitable kaam ko process ma yo herna sakchha.

Aru document chha bhane pathauna saknuhunchha.`;
}
