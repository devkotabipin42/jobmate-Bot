// Employer lead repository.
// DB-only layer: no WhatsApp messages, no AI logic, no state-machine decisions.

import { EmployerLead } from "../../../models/EmployerLead.model.js";

export async function findActiveEmployerLead({ contactId } = {}) {
  if (!contactId) return null;

  return EmployerLead.findOne({
    contactId,
    leadStatus: { $nin: ["paid", "closed", "invalid"] },
  }).lean();
}

export async function addHiringNeedIfNotDuplicate({ contactId, vacancy } = {}) {
  if (!contactId || !vacancy) {
    return { shouldPush: false };
  }

  const existingLead = await findActiveEmployerLead({ contactId });

  const alreadyExists = existingLead?.hiringNeeds?.some((need) => {
    return (
      String(need.role || "") === String(vacancy.role || "") &&
      Number(need.quantity || 1) === Number(vacancy.quantity || 1) &&
      Number(need.salaryMin || 0) === Number(vacancy.salaryMin || 0) &&
      Number(need.salaryMax || 0) === Number(vacancy.salaryMax || 0)
    );
  });

  return {
    shouldPush: !alreadyExists,
  };
}

export async function upsertEmployerLead({ contact, leadUpdate } = {}) {
  if (!contact?._id) {
    throw new Error("Missing contact id for employer lead upsert");
  }

  const baseSet = {
    contactId: contact._id,
    phone: contact.phone,
    whatsapp: contact.phone,
    source: "whatsapp",
  };

  const update = {
    $setOnInsert: baseSet,
    ...(leadUpdate || {}),
  };

  return EmployerLead.findOneAndUpdate(
    {
      contactId: contact._id,
      leadStatus: { $nin: ["paid", "closed", "invalid"] },
    },
    update,
    {
      returnDocument: "after",
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );
}
