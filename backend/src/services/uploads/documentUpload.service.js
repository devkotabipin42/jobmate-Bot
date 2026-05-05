import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { WorkerProfile } from "../../models/WorkerProfile.model.js";
import {
  downloadWhatsAppMediaBuffer,
  getWhatsAppMediaInfo,
} from "../whatsapp/whatsappClient.service.js";
import {
  isCloudinaryConfigured,
  uploadDocumentBufferToCloudinary,
} from "./cloudinaryStorage.service.js";

const SUPPORTED_MEDIA_TYPES = ["image", "document"];

const LOCAL_DOCUMENT_UPLOAD_DIR = path.join(
  process.cwd(),
  "uploads",
  "jobmate-documents"
);

function extensionFromMimeType(mimeType = "") {
  const value = String(mimeType || "").toLowerCase();

  if (value.includes("jpeg") || value.includes("jpg")) return "jpg";
  if (value.includes("png")) return "png";
  if (value.includes("webp")) return "webp";
  if (value.includes("pdf")) return "pdf";
  if (value.includes("msword")) return "doc";
  if (value.includes("officedocument")) return "docx";

  return "bin";
}

function sanitizeForFilename(value = "") {
  return String(value || "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 80);
}

function safeDownloadError(error) {
  return {
    status: error?.status || error?.safe?.status || null,
    message: error?.safe?.message || error?.message || "Media download failed",
    code: error?.code || error?.safe?.code || null,
    type: error?.type || error?.safe?.type || null,
    fbtrace_id: error?.fbtrace_id || error?.safe?.fbtrace_id || null,
  };
}

async function downloadAndStoreWhatsAppDocumentLocal(document = {}) {
  if (!document.mediaId) {
    return {
      ok: false,
      reason: "MISSING_MEDIA_ID",
    };
  }

  const mediaInfo = await getWhatsAppMediaInfo(document.mediaId);

  if (mediaInfo?.skipped || !mediaInfo?.url) {
    return {
      ok: false,
      reason: mediaInfo?.reason || "MEDIA_URL_NOT_AVAILABLE",
    };
  }

  const downloaded = await downloadWhatsAppMediaBuffer(mediaInfo.url);

  if (downloaded?.skipped || !downloaded?.buffer) {
    return {
      ok: false,
      reason: downloaded?.reason || "MEDIA_DOWNLOAD_SKIPPED",
    };
  }

  await fs.mkdir(LOCAL_DOCUMENT_UPLOAD_DIR, { recursive: true });

  const mimeType = mediaInfo.mimeType || downloaded.contentType || document.mimeType || "";
  const extension = extensionFromMimeType(mimeType);
  const safeMediaId = sanitizeForFilename(document.mediaId);
  const randomSuffix = crypto.randomBytes(6).toString("hex");
  const filename = `${Date.now()}_${safeMediaId}_${randomSuffix}.${extension}`;
  const absolutePath = path.join(LOCAL_DOCUMENT_UPLOAD_DIR, filename);

  await fs.writeFile(absolutePath, downloaded.buffer);

  return {
    ok: true,
    filename,
    localPath: absolutePath,
    storageUrl: `/uploads/jobmate-documents/${filename}`,
    mimeType,
    fileSize: downloaded.buffer.length,
    sha256: mediaInfo.sha256 || document.sha256 || "",
  };
}


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
  if (/\bcv\b|\bcvs\b|resume|bio[-\s]?data/i.test(value)) return "cv";
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


async function downloadAndStoreWhatsAppDocument(document = {}) {
  if (!document.mediaId) {
    return {
      ok: false,
      reason: "MISSING_MEDIA_ID",
    };
  }

  const mediaInfo = await getWhatsAppMediaInfo(document.mediaId);

  if (mediaInfo?.skipped || !mediaInfo?.url) {
    return {
      ok: false,
      reason: mediaInfo?.reason || "MEDIA_URL_NOT_AVAILABLE",
    };
  }

  const downloaded = await downloadWhatsAppMediaBuffer(mediaInfo.url);

  if (downloaded?.skipped || !downloaded?.buffer) {
    return {
      ok: false,
      reason: downloaded?.reason || "MEDIA_DOWNLOAD_SKIPPED",
    };
  }

  const mimeType = mediaInfo.mimeType || downloaded.contentType || document.mimeType || "";
  const extension = extensionFromMimeType(mimeType);

  if (isCloudinaryConfigured()) {
    const uploaded = await uploadDocumentBufferToCloudinary({
      buffer: downloaded.buffer,
      document,
      mimeType,
      extension,
    });

    if (!uploaded?.skipped && uploaded?.storageUrl) {
      return {
        ok: true,
        filename: uploaded.publicId || "",
        localPath: "",
        storageUrl: uploaded.storageUrl,
        mimeType,
        fileSize: uploaded.bytes || downloaded.buffer.length,
        sha256: mediaInfo.sha256 || document.sha256 || "",
        storageMode: "cloudinary",
        provider: uploaded.provider,
        publicId: uploaded.publicId || "",
        resourceType: uploaded.resourceType || "",
      };
    }
  }

  return downloadAndStoreWhatsAppDocumentLocal(document);
}

export async function saveWorkerDocumentMetadata({ contact, normalized } = {}) {
  if (!contact?._id || !contact?.phone || !isSupportedDocumentMedia(normalized)) {
    return null;
  }

  const document = buildDocumentMetadata(normalized);

  try {
    const stored = await downloadAndStoreWhatsAppDocument(document);

    if (stored?.ok) {
      document.status = "downloaded";
      document.storageUrl = stored.storageUrl || "";
      document.filename = stored.filename || document.filename || "";
      document.mimeType = stored.mimeType || document.mimeType || "";
      document.sha256 = stored.sha256 || document.sha256 || "";
      document.metadata = {
        ...(document.metadata || {}),
        localPath: stored.localPath || "",
        fileSize: stored.fileSize || null,
        storageMode: stored.storageMode || "local_dev",
        provider: stored.provider || "local",
        publicId: stored.publicId || "",
        resourceType: stored.resourceType || "",
        note: stored.storageMode === "cloudinary"
          ? "Media uploaded to Cloudinary."
          : "Media downloaded to local dev storage. Cloud storage fallback used.",
      };
    } else {
      document.metadata = {
        ...(document.metadata || {}),
        downloadSkippedReason: stored?.reason || "UNKNOWN",
      };
    }
  } catch (error) {
    const safeError = safeDownloadError(error);

    document.metadata = {
      ...(document.metadata || {}),
      downloadError: safeError,
    };
  }

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
Hamro team le document check/verify garera zaruri pare sampark garchha.

Aru document chha bhane yahi WhatsApp ma photo/file pathauna saknuhunchha.`;
}
