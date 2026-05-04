import { JobApplication } from "../models/JobApplication.model.js";

function formatDateLabel(date) {
  if (!date) return "";

  const d = new Date(date);

  if (Number.isNaN(d.getTime())) return "";

  return d.toLocaleString("en-GB", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toJobApplicationCard(application = {}) {
  return {
    id: application._id,
    workerId: application.workerId || null,
    contactId: application.contactId || null,
    workerPhone: application.phone || "",
    jobId: application.jobId || "",
    jobTitle: application.jobTitle || "",
    companyName: application.companyName || "",
    location: application.location || "",
    salaryMin: application.salaryMin ?? null,
    salaryMax: application.salaryMax ?? null,
    jobType: application.jobType || "",
    status: application.status || "interest_submitted",
    source: application.source || "whatsapp_aarati",
    notes: application.notes || "",
    appliedAt: application.appliedAt || application.createdAt || null,
    appliedDateLabel: formatDateLabel(application.appliedAt || application.createdAt),
    lastStatusAt: application.lastStatusAt || application.updatedAt || null,
    lastStatusLabel: formatDateLabel(application.lastStatusAt || application.updatedAt),
    createdAt: application.createdAt || null,
    updatedAt: application.updatedAt || null,
    // Keep list response compact. Use detail endpoint for full metadata.
  };
}

export async function listJobApplications(req, res) {
  try {
    const {
      status,
      jobId,
      phone,
      limit = 50,
    } = req.query || {};

    const query = {};

    if (status) query.status = status;
    if (jobId) query.jobId = String(jobId);
    if (phone) query.phone = String(phone);

    const applications = await JobApplication.find(query)
      .sort({ updatedAt: -1 })
      .limit(Math.min(Number(limit || 50), 200))
      .lean();

    return res.json({
      success: true,
      count: applications.length,
      applications: applications.map(toJobApplicationCard),
    });
  } catch (error) {
    console.error("List job applications failed:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to list job applications",
      error: error.message,
    });
  }
}

export async function updateJobApplicationStatus(req, res) {
  try {
    const { id } = req.params;
    const {
      status,
      notes = "",
    } = req.body || {};

    const allowedStatuses = [
      "interest_submitted",
      "reviewing",
      "shortlisted",
      "contacted",
      "interview_scheduled",
      "selected",
      "rejected",
      "withdrawn",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid job application status",
      });
    }

    const application = await JobApplication.findByIdAndUpdate(
      id,
      {
        $set: {
          status,
          lastStatusAt: new Date(),
          ...(typeof notes === "string" ? { notes } : {}),
        },
      },
      {
        returnDocument: "after",
        runValidators: false,
      }
    ).lean();

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Job application not found",
      });
    }

    return res.json({
      success: true,
      application: toJobApplicationCard(application),
    });
  } catch (error) {
    console.error("Update job application failed:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update job application",
      error: error.message,
    });
  }
}


export async function getJobApplicationDetail(req, res) {
  try {
    const { id } = req.params;

    const application = await JobApplication.findById(id).lean();

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Job application not found",
      });
    }

    return res.json({
      success: true,
      application: {
        ...toJobApplicationCard(application),
        metadata: application.metadata || {},
      },
    });
  } catch (error) {
    console.error("Get job application detail failed:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get job application detail",
      error: error.message,
    });
  }
}
