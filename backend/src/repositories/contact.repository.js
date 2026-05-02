import { Contact } from "../models/Contact.model.js";
import { normalizePhone } from "../utils/normalizePhone.js";

export async function findContactByPhone(phone) {
  const normalizedPhone = normalizePhone(phone);

  if (!normalizedPhone) return null;

  return Contact.findOne({ phone: normalizedPhone });
}

export async function upsertContactFromWhatsApp({
  phone,
  waId,
  displayName,
  contactType = "unknown",
  metadata = {},
}) {
  const normalizedPhone = normalizePhone(phone);
  const normalizedWaId = normalizePhone(waId || phone);

  if (!normalizedPhone) {
    throw new Error("Cannot upsert contact without phone");
  }

  const update = {
    $set: {
      waId: normalizedWaId || normalizedPhone,
      displayName: displayName || "Mitra",
      source: "whatsapp",
      lastMessageAt: new Date(),
      metadata,
    },
    $setOnInsert: {
      phone: normalizedPhone,
      contactType,
      language: "nepali_english",
      status: "active",
      botMode: "bot",
    },
  };

  return Contact.findOneAndUpdate({ phone: normalizedPhone }, update, {
    new: true,
    upsert: true,
    setDefaultsOnInsert: true,
  });
}

export async function updateContactType(contactId, contactType) {
  return Contact.findByIdAndUpdate(
    contactId,
    { $set: { contactType } },
    { new: true }
  );
}

export async function pauseContactForHuman(contactId) {
  return Contact.findByIdAndUpdate(
    contactId,
    { $set: { botMode: "human_paused" } },
    { new: true }
  );
}

export async function markContactOptedOut(contactId) {
  return Contact.findByIdAndUpdate(
    contactId,
    {
      $set: {
        status: "opted_out",
        botMode: "human_paused",
      },
    },
    { new: true }
  );
}
