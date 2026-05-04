import { JobApplication } from "../models/JobApplication.model.js";

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
      applications,
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
      application,
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
