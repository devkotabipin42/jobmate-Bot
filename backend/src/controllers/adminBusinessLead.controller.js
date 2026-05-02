import {
  listBusinessLeads,
  updateBusinessLeadStatus,
} from "../services/admin/adminBusinessLead.service.js";

export async function getAdminBusinessLeads(req, res) {
  try {
    const data = await listBusinessLeads(req.query);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("❌ Get business leads failed:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to fetch business leads",
    });
  }
}

export async function patchAdminBusinessLeadStatus(req, res) {
  try {
    const data = await updateBusinessLeadStatus({
      leadId: req.params.leadId,
      status: req.body?.status,
      note: req.body?.note,
    });

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("❌ Update business lead failed:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to update business lead",
    });
  }
}
