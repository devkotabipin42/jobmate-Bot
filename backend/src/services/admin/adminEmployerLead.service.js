import { EmployerLead } from "../../models/EmployerLead.model.js";

export async function getEmployerLeads({
  status,
  urgency,
  search,
  page = 1,
  limit = 20,
}) {
  const query = {};

  if (status) {
    query.leadStatus = status;
  }

  if (urgency) {
    query.urgencyLevel = urgency;
  }

  if (search) {
    query.$or = [
      { businessName: { $regex: search, $options: "i" } },
      { contactPerson: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
      { "location.area": { $regex: search, $options: "i" } },
      { "location.district": { $regex: search, $options: "i" } },
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [items, total] = await Promise.all([
    EmployerLead.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),

    EmployerLead.countDocuments(query),
  ]);

  return {
    items: items.map(formatEmployerLead),
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)),
    },
  };
}

export async function getEmployerLeadById(id) {
  const lead = await EmployerLead.findById(id).lean();

  if (!lead) return null;

  return formatEmployerLead(lead);
}

export async function updateEmployerLeadStatus(id, status) {
  const allowedStatuses = [
    "new",
    "qualifying",
    "hot",
    "interested",
    "called",
    "follow_up",
    "converted",
    "closed",
    "invalid",
    "paid",
  ];

  if (!allowedStatuses.includes(status)) {
    const error = new Error("Invalid employer lead status");
    error.statusCode = 400;
    throw error;
  }

  const lead = await EmployerLead.findByIdAndUpdate(
    id,
    {
      $set: {
        leadStatus: status,
        updatedAt: new Date(),
      },
    },
    { returnDocument: "after" }
  ).lean();

  if (!lead) return null;

  return formatEmployerLead(lead);
}

function formatEmployerLead(lead) {
  const primaryNeed = lead.hiringNeeds?.[0] || null;

  return {
    id: lead._id,
    businessName: lead.businessName || "-",
    contactPerson: lead.contactPerson || "-",
    phone: lead.phone || "-",
    whatsapp: lead.whatsapp || lead.phone || "-",
    source: lead.source || "whatsapp",

    location: {
      area: lead.location?.area || "-",
      district: lead.location?.district || "-",
      province: lead.location?.province || "-",
      country: lead.location?.country || "Nepal",
    },

    hiringNeeds: lead.hiringNeeds || [],
    primaryNeed,

    leadStatus: lead.leadStatus || "new",
    urgencyLevel: lead.urgencyLevel || "unknown",
    score: lead.score || 0,

    lastQualifiedAt: lead.lastQualifiedAt || null,
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
  };
}
