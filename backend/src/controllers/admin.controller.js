import { BusinessLead } from "../models/BusinessLead.model.js";
import { getDashboardSummary } from "../services/admin/adminDashboard.service.js";

import {
  getEmployerLeads,
  getEmployerLeadById,
  updateEmployerLeadStatus,
} from "../services/admin/adminEmployerLead.service.js";

import {
  getWorkers,
  getWorkerById,
  updateWorkerStatus,
  verifyWorkerDocument,
} from "../services/admin/adminWorker.service.js";

import {
  getHandoffs,
  getHandoffById,
  updateHandoffStatus,
  assignHandoff,
  updateHandoffCallStatus,
} from "../services/admin/adminHandoff.service.js";

import {
  getConversations,
  getConversationMessages,
} from "../services/admin/adminConversation.service.js";

export async function getAdminDashboardSummary(req, res) {
  try {
    const data = await getDashboardSummary();
    const businessLeadCounts = {
      total: await BusinessLead.countDocuments({}),
      new: await BusinessLead.countDocuments({ status: "new" }),
      contacted: await BusinessLead.countDocuments({ status: "contacted" }),
      booked: await BusinessLead.countDocuments({ status: "booked" }),
      humanNeeded: await BusinessLead.countDocuments({
        needsHuman: true,
        status: { $in: ["new", "contacted"] },
      }),
    };

    return res.status(200).json({
      success: true,
      data: {
        ...data,
        metrics: {
          ...(data.metrics || {}),
          totalBusinessLeads: businessLeadCounts.total,
          newBusinessLeads: businessLeadCounts.new,
          contactedBusinessLeads: businessLeadCounts.contacted,
          bookedBusinessLeads: businessLeadCounts.booked,
          humanNeededBusinessLeads: businessLeadCounts.humanNeeded,
        },
      },
    });
  } catch (error) {
    console.error("❌ Admin dashboard summary failed:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard summary",
      error: error.message,
    });
  }
}

export async function listAdminEmployerLeads(req, res) {
  try {
    const data = await getEmployerLeads({
      status: req.query.status,
      urgency: req.query.urgency,
      search: req.query.search,
      page: req.query.page || 1,
      limit: req.query.limit || 20,
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("❌ Admin employer leads list failed:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch employer leads",
      error: error.message,
    });
  }
}

export async function getAdminEmployerLeadDetail(req, res) {
  try {
    const lead = await getEmployerLeadById(req.params.id);

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Employer lead not found",
      });
    }

    return res.status(200).json({ success: true, data: lead });
  } catch (error) {
    console.error("❌ Admin employer lead detail failed:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch employer lead",
      error: error.message,
    });
  }
}

export async function patchAdminEmployerLeadStatus(req, res) {
  try {
    const lead = await updateEmployerLeadStatus(req.params.id, req.body.status);

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Employer lead not found",
      });
    }

    return res.status(200).json({ success: true, data: lead });
  } catch (error) {
    console.error("❌ Admin employer lead status update failed:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to update employer lead status",
    });
  }
}

export async function listAdminWorkers(req, res) {
  try {
    const data = await getWorkers({
      status: req.query.status,
      availability: req.query.availability,
      district: req.query.district,
      search: req.query.search,
      page: req.query.page || 1,
      limit: req.query.limit || 20,
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("❌ Admin workers list failed:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch workers",
      error: error.message,
    });
  }
}

export async function getAdminWorkerDetail(req, res) {
  try {
    const worker = await getWorkerById(req.params.id);

    if (!worker) {
      return res.status(404).json({
        success: false,
        message: "Worker not found",
      });
    }

    return res.status(200).json({ success: true, data: worker });
  } catch (error) {
    console.error("❌ Admin worker detail failed:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch worker",
      error: error.message,
    });
  }
}

export async function patchAdminWorkerStatus(req, res) {
  try {
    const worker = await updateWorkerStatus(req.params.id, req.body.status);

    if (!worker) {
      return res.status(404).json({
        success: false,
        message: "Worker not found",
      });
    }

    return res.status(200).json({ success: true, data: worker });
  } catch (error) {
    console.error("❌ Admin worker status update failed:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to update worker status",
    });
  }
}

export async function patchAdminWorkerDocumentVerify(req, res) {
  try {
    const worker = await verifyWorkerDocument(
      req.params.id,
      req.params.documentId
    );

    if (!worker) {
      return res.status(404).json({
        success: false,
        message: "Worker document not found",
      });
    }

    return res.status(200).json({ success: true, data: worker });
  } catch (error) {
    console.error("❌ Admin worker document verify failed:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to verify worker document",
    });
  }
}

export async function listAdminHandoffs(req, res) {
  try {
    const data = await getHandoffs({
      status: req.query.status,
      priority: req.query.priority,
      reason: req.query.reason,
      callStatus: req.query.callStatus,
      search: req.query.search,
      page: req.query.page || 1,
      limit: req.query.limit || 20,
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("❌ Admin handoffs list failed:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch handoffs",
      error: error.message,
    });
  }
}

export async function getAdminHandoffDetail(req, res) {
  try {
    const handoff = await getHandoffById(req.params.id);

    if (!handoff) {
      return res.status(404).json({
        success: false,
        message: "Handoff not found",
      });
    }

    return res.status(200).json({ success: true, data: handoff });
  } catch (error) {
    console.error("❌ Admin handoff detail failed:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch handoff",
      error: error.message,
    });
  }
}

export async function patchAdminHandoffStatus(req, res) {
  try {
    const handoff = await updateHandoffStatus(req.params.id, req.body.status);

    if (!handoff) {
      return res.status(404).json({
        success: false,
        message: "Handoff not found",
      });
    }

    return res.status(200).json({ success: true, data: handoff });
  } catch (error) {
    console.error("❌ Admin handoff status update failed:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to update handoff status",
    });
  }
}

export async function patchAdminHandoffAssign(req, res) {
  try {
    const handoff = await assignHandoff(req.params.id, req.body.assignedTo);

    if (!handoff) {
      return res.status(404).json({
        success: false,
        message: "Handoff not found",
      });
    }

    return res.status(200).json({ success: true, data: handoff });
  } catch (error) {
    console.error("❌ Admin handoff assign failed:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to assign handoff",
    });
  }
}

export async function patchAdminHandoffCall(req, res) {
  try {
    const handoff = await updateHandoffCallStatus(
      req.params.id,
      req.body.callStatus,
      req.body.note || ""
    );

    if (!handoff) {
      return res.status(404).json({
        success: false,
        message: "Handoff not found",
      });
    }

    return res.status(200).json({ success: true, data: handoff });
  } catch (error) {
    console.error("❌ Admin handoff call update failed:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to update call status",
    });
  }
}


export async function listAdminConversations(req, res) {
  try {
    const data = await getConversations({
      search: req.query.search,
      contactType: req.query.contactType,
      status: req.query.status,
      page: req.query.page || 1,
      limit: req.query.limit || 20,
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("❌ Admin conversations list failed:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch conversations",
      error: error.message,
    });
  }
}

export async function getAdminConversationMessages(req, res) {
  try {
    const data = await getConversationMessages({
      contactId: req.params.contactId,
      page: req.query.page || 1,
      limit: req.query.limit || 50,
    });

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Conversation contact not found",
      });
    }

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("❌ Admin conversation messages failed:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch conversation messages",
      error: error.message,
    });
  }
}
