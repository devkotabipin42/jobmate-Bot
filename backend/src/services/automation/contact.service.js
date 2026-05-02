import {
  upsertContactFromWhatsApp,
  updateContactType,
  pauseContactForHuman as pauseContactForHumanRepo,
  markContactOptedOut,
} from "../../repositories/contact.repository.js";

export async function createOrUpdateContactFromNormalizedMessage(normalized) {
  if (!normalized?.ok) {
    throw new Error("Cannot create contact from invalid normalized payload");
  }

  const contact = await upsertContactFromWhatsApp({
    phone: normalized.contact.phone,
    waId: normalized.contact.waId,
    displayName: normalized.contact.displayName || "Mitra",
    metadata: {
      provider: normalized.provider,
      phoneNumberId: normalized.phoneNumberId,
      businessDisplayPhoneNumber: normalized.businessDisplayPhoneNumber,
    },
  });

  return contact;
}

export async function applyContactIntentState(contact, intentResult) {
  if (!contact) return null;

  if (intentResult.intent === "worker_registration") {
    return updateContactType(contact._id, "worker");
  }

  if (intentResult.intent === "employer_lead") {
    return updateContactType(contact._id, "employer");
  }

  if (
    intentResult.intent === "human_handoff" ||
    intentResult.intent === "frustrated" ||
    intentResult.intent === "unsupported"
  ) {
    return pauseContactForHuman(contact._id);
  }

  if (intentResult.intent === "opt_out") {
    return markContactOptedOut(contact._id);
  }

  return contact;
}

export async function pauseContactForHuman(contactId) {
  return pauseContactForHumanRepo(contactId);
}
