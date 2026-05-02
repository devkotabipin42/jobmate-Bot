import { BusinessLead } from "../../models/BusinessLead.model.js";

export async function listBusinessLeads({
  status,
  service,
  needsHuman,
  page = 1,
  limit = 20,
} = {}) {
  const query = {};

  if (status) query.status = status;
  if (service) query.service = new RegExp(service, "i");

  if (needsHuman === "true") query.needsHuman = true;
  if (needsHuman === "false") query.needsHuman = false;

  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const skip = (safePage - 1) * safeLimit;

  const [items, total] = await Promise.all([
    BusinessLead.find(query)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean(),
    BusinessLead.countDocuments(query),
  ]);

  return {
    items: items.map(formatBusinessLead),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit),
    },
  };
}

export async function updateBusinessLeadStatus({ leadId, status, note }) {
  const allowed = ["new", "contacted", "booked", "closed", "spam"];

  if (!allowed.includes(status)) {
    const error = new Error("Invalid lead status");
    error.statusCode = 400;
    throw error;
  }

  const update = {
    status,
  };

  if (note) {
    update.$push = {
      notes: {
        text: note,
        createdAt: new Date(),
      },
    };
  }

  const lead = await BusinessLead.findByIdAndUpdate(
    leadId,
    note
      ? {
          $set: { status },
          $push: update.$push,
        }
      : {
          $set: { status },
        },
    { returnDocument: "after" }
  ).lean();

  if (!lead) {
    const error = new Error("Business lead not found");
    error.statusCode = 404;
    throw error;
  }

  return formatBusinessLead(lead);
}

function formatBusinessLead(lead) {
  return {
    id: lead._id,
    contactId: lead.contactId,
    conversationId: lead.conversationId,
    phone: lead.phone,
    displayName: lead.displayName,
    customerName: lead.customerName || "",
    intent: lead.intent,
    service: lead.service,
    interest: lead.interest,
    preferredDate: lead.preferredDate,
    preferredTime: lead.preferredTime,
    location: lead.location,
    firstMessage: lead.firstMessage || "",
    bookingMessage: lead.bookingMessage || "",
    lastMessage: lead.lastMessage,
    status: lead.status,
    priority: lead.priority,
    needsHuman: lead.needsHuman,
    notes: lead.notes || [],
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
  };
}
