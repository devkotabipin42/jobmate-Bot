import { v2 as cloudinary } from "cloudinary";
import { env } from "../../config/env.js";

let configured = false;

export function isCloudinaryConfigured() {
  return Boolean(
    env.DOCUMENT_STORAGE_PROVIDER === "cloudinary" &&
      env.CLOUDINARY_CLOUD_NAME &&
      env.CLOUDINARY_API_KEY &&
      env.CLOUDINARY_API_SECRET
  );
}

function configureCloudinary() {
  if (configured) return;

  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });

  configured = true;
}

function buildPublicId({ document = {}, extension = "" } = {}) {
  const mediaId = String(document.mediaId || "media")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 80);

  const type = String(document.type || "document")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 40);

  const suffix = Date.now();

  return `jobmate/documents/${type}_${mediaId}_${suffix}${extension ? `.${extension}` : ""}`;
}

function resourceTypeFromMimeType(mimeType = "") {
  const value = String(mimeType || "").toLowerCase();

  if (value.startsWith("image/")) return "image";
  if (value.startsWith("video/")) return "video";

  return "raw";
}

export async function uploadDocumentBufferToCloudinary({
  buffer,
  document = {},
  mimeType = "",
  extension = "",
} = {}) {
  if (!buffer) {
    throw new Error("Document buffer is required");
  }

  if (!isCloudinaryConfigured()) {
    return {
      skipped: true,
      reason: "CLOUDINARY_NOT_CONFIGURED",
    };
  }

  configureCloudinary();

  const publicId = buildPublicId({ document, extension });
  const resourceType = resourceTypeFromMimeType(mimeType || document.mimeType);

  const uploadResult = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        resource_type: resourceType,
        overwrite: false,
        folder: undefined,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    stream.end(buffer);
  });

  return {
    skipped: false,
    provider: "cloudinary",
    storageUrl: uploadResult.secure_url || uploadResult.url || "",
    publicId: uploadResult.public_id || "",
    resourceType: uploadResult.resource_type || resourceType,
    bytes: uploadResult.bytes || buffer.length,
    format: uploadResult.format || "",
    raw: {
      assetId: uploadResult.asset_id || "",
      version: uploadResult.version || null,
    },
  };
}
