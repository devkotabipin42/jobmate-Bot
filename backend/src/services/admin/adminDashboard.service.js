import { Contact } from "../../models/Contact.model.js";
import { EmployerLead } from "../../models/EmployerLead.model.js";
import { WorkerProfile } from "../../models/WorkerProfile.model.js";
import { HandoffRequest } from "../../models/HandoffRequest.model.js";
import { Message } from "../../models/Message.model.js";

export async function getDashboardSummary() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [
    totalContacts,
    totalEmployerLeads,
    hotEmployerLeads,
    totalWorkers,
    qualifiedWorkers,
    openHandoffs,
    urgentHandoffs,
    todayMessages,
    latestEmployerLeads,
    latestWorkers,
    latestHandoffs,
  ] = await Promise.all([
    Contact.countDocuments({}),
    EmployerLead.countDocuments({}),
    EmployerLead.countDocuments({
      $or: [{ leadStatus: "hot" }, { urgencyLevel: "urgent" }],
    }),
    WorkerProfile.countDocuments({}),
    WorkerProfile.countDocuments({
      profileStatus: { $in: ["complete", "qualified"] },
    }),
    HandoffRequest.countDocuments({ status: "open" }),
    HandoffRequest.countDocuments({
      status: "open",
      priority: { $in: ["urgent", "high"] },
    }),
    Message.countDocuments({
      createdAt: { $gte: startOfToday },
    }),

    EmployerLead.find({})
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),

    WorkerProfile.find({})
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),

    HandoffRequest.find({})
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
  ]);

  return {
    metrics: {
      totalContacts,
      totalEmployerLeads,
      hotEmployerLeads,
      totalWorkers,
      qualifiedWorkers,
      openHandoffs,
      urgentHandoffs,
      todayMessages,
    },
    latest: {
      employerLeads: latestEmployerLeads.map(formatEmployerLead),
      workers: latestWorkers.map(formatWorker),
      handoffs: latestHandoffs.map(formatHandoff),
    },
  };
}

function formatEmployerLead(lead) {
  return {
    id: lead._id,
    businessName: lead.businessName || "-",
    contactPerson: lead.contactPerson || "-",
    phone: lead.phone || "-",
    location: lead.location || {},
    hiringNeeds: lead.hiringNeeds || [],
    leadStatus: lead.leadStatus || "new",
    urgencyLevel: lead.urgencyLevel || "unknown",
    score: lead.score || 0,
    createdAt: lead.createdAt,
  };
}

function formatWorker(worker) {
  return {
    id: worker._id,
    fullName: worker.fullName || "-",
    phone: worker.phone || "-",
    jobPreferences: worker.jobPreferences || [],
    location: worker.location || {},
    availability: worker.availability || "unknown",
    documentStatus: worker.documentStatus || "unknown",
    profileStatus: worker.profileStatus || "new",
    score: worker.score || 0,
    createdAt: worker.createdAt,
  };
}

function formatHandoff(handoff) {
  return {
    id: handoff._id,
    reason: handoff.reason || "unknown",
    status: handoff.status || "open",
    priority: handoff.priority || "medium",
    callRequired: handoff.callRequired || false,
    callStatus: handoff.callStatus || "not_required",
    assignedTo: handoff.assignedTo || null,
    createdAt: handoff.createdAt,
  };
}
