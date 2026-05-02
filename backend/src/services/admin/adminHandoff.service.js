import { HandoffRequest } from "../../models/HandoffRequest.model.js";
import { Contact } from "../../models/Contact.model.js";
import { EmployerLead } from "../../models/EmployerLead.model.js";
import { WorkerProfile } from "../../models/WorkerProfile.model.js";

export async function getHandoffs({
  status,
  priority,
  reason,
  callStatus,
  search,
  page = 1,
  limit = 20,
}) {
  const query = {};

  if (status) query.status = status;
  if (priority) query.priority = priority;
  if (reason) query.reason = reason;
  if (callStatus) query.callStatus = callStatus;

  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const skip = (safePage - 1) * safeLimit;

  let contactIds = [];

  if (search) {
    const contacts = await Contact.find({
      $or: [
        { phone: { $regex: search, $options: "i" } },
        { displayName: { $regex: search, $options: "i" } },
      ],
    })
      .select("_id")
      .lean();

    contactIds = contacts.map((c) => c._id);

    query.$or = [
      { reason: { $regex: search, $options: "i" } },
      { lastUserMessage: { $regex: search, $options: "i" } },
      { contactId: { $in: contactIds } },
    ];
  }

  const [items, total] = await Promise.all([
    HandoffRequest.find(query)
      .sort({ priority: 1, createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean(),

    HandoffRequest.countDocuments(query),
  ]);

  const enriched = await enrichHandoffs(items);

  return {
    items: enriched,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit),
    },
  };
}

export async function getHandoffById(id) {
  const handoff = await HandoffRequest.findById(id).lean();
  if (!handoff) return null;

  const [enriched] = await enrichHandoffs([handoff]);
  return enriched;
}

export async function updateHandoffStatus(id, status) {
  const allowedStatuses = [
    "open",
    "assigned",
    "in_progress",
    "resolved",
    "closed",
    "cancelled",
  ];

  if (!allowedStatuses.includes(status)) {
    const error = new Error("Invalid handoff status");
    error.statusCode = 400;
    throw error;
  }

  const handoff = await HandoffRequest.findByIdAndUpdate(
    id,
    {
      $set: {
        status,
        resolvedAt: ["resolved", "closed", "cancelled"].includes(status)
          ? new Date()
          : null,
      },
    },
    { returnDocument: "after" }
  ).lean();

  if (!handoff) return null;

  const [enriched] = await enrichHandoffs([handoff]);
  return enriched;
}

export async function assignHandoff(id, assignedTo) {
  if (!assignedTo) {
    const error = new Error("assignedTo is required");
    error.statusCode = 400;
    throw error;
  }

  const handoff = await HandoffRequest.findByIdAndUpdate(
    id,
    {
      $set: {
        assignedTo,
        status: "assigned",
        assignedAt: new Date(),
      },
    },
    { returnDocument: "after" }
  ).lean();

  if (!handoff) return null;

  const [enriched] = await enrichHandoffs([handoff]);
  return enriched;
}

export async function updateHandoffCallStatus(id, callStatus, note = "") {
  const allowedCallStatuses = [
    "not_required",
    "pending",
    "called",
    "missed",
    "callback_needed",
    "completed",
  ];

  if (!allowedCallStatuses.includes(callStatus)) {
    const error = new Error("Invalid call status");
    error.statusCode = 400;
    throw error;
  }

  const update = {
    $set: {
      callStatus,
      lastCallAt: ["called", "completed", "missed"].includes(callStatus)
        ? new Date()
        : undefined,
    },
  };

  if (note) {
    update.$push = {
      notes: {
        text: note,
        createdAt: new Date(),
      },
    };
  }

  const handoff = await HandoffRequest.findByIdAndUpdate(id, update, {
    returnDocument: "after",
  }).lean();

  if (!handoff) return null;

  const [enriched] = await enrichHandoffs([handoff]);
  return enriched;
}

async function enrichHandoffs(handoffs = []) {
  const contactIds = handoffs.map((h) => h.contactId).filter(Boolean);

  const [contacts, employerLeads, workers] = await Promise.all([
    Contact.find({ _id: { $in: contactIds } }).lean(),
    EmployerLead.find({ contactId: { $in: contactIds } }).lean(),
    WorkerProfile.find({ contactId: { $in: contactIds } }).lean(),
  ]);

  const contactMap = new Map(contacts.map((c) => [String(c._id), c]));
  const employerMap = new Map(
    employerLeads.map((l) => [String(l.contactId), l])
  );
  const workerMap = new Map(workers.map((w) => [String(w.contactId), w]));

  return handoffs.map((handoff) => {
    const key = String(handoff.contactId);
    const contact = contactMap.get(key);
    const employerLead = employerMap.get(key);
    const worker = workerMap.get(key);

    return {
      id: handoff._id,
      contactId: handoff.contactId,

      reason: handoff.reason || "unknown",
      status: handoff.status || "open",
      priority: handoff.priority || "medium",

      callRequired: handoff.callRequired || false,
      callStatus: handoff.callStatus || "not_required",
      assignedTo: handoff.assignedTo || null,

      lastUserMessage: handoff.lastUserMessage || "",
      metadata: handoff.metadata || {},

      contact: contact
        ? {
            id: contact._id,
            displayName: contact.displayName || "Mitra",
            phone: contact.phone || "-",
            contactType: contact.contactType || "unknown",
            botMode: contact.botMode || "bot",
            status: contact.status || "active",
          }
        : null,

      employerLead: employerLead
        ? {
            id: employerLead._id,
            businessName: employerLead.businessName || "-",
            contactPerson: employerLead.contactPerson || "-",
            phone: employerLead.phone || "-",
            location: employerLead.location || {},
            hiringNeeds: employerLead.hiringNeeds || [],
            leadStatus: employerLead.leadStatus || "new",
            urgencyLevel: employerLead.urgencyLevel || "unknown",
            score: employerLead.score || 0,
          }
        : null,

      worker: worker
        ? {
            id: worker._id,
            fullName: worker.fullName || "-",
            phone: worker.phone || "-",
            jobPreferences: worker.jobPreferences || [],
            location: worker.location || {},
            availability: worker.availability || "unknown",
            documentStatus: worker.documentStatus || "unknown",
            profileStatus: worker.profileStatus || "new",
            score: worker.score || 0,
          }
        : null,

      notes: handoff.notes || [],
      assignedAt: handoff.assignedAt || null,
      resolvedAt: handoff.resolvedAt || null,
      createdAt: handoff.createdAt,
      updatedAt: handoff.updatedAt,
    };
  });
}
