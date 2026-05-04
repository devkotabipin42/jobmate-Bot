import { findMatchingWorkersForEmployerLead } from "../services/matching/workerMatching.service.js";

export async function getEmployerLeadWorkerMatches(req, res) {
  try {
    const { id } = req.params;
    const { limit = 20 } = req.query || {};

    const result = await findMatchingWorkersForEmployerLead({
      employerLeadId: id,
      limit,
    });

    if (!result.lead) {
      return res.status(404).json({
        success: false,
        message: "Employer lead not found",
      });
    }

    return res.json({
      success: true,
      lead: result.lead,
      count: result.matches.length,
      matches: result.matches,
    });
  } catch (error) {
    console.error("Worker match failed:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to find matching workers",
      error: error.message,
    });
  }
}
