import {
  createJobMatch,
  listJobMatches,
  updateJobMatchStatus,
} from "../services/matching/jobMatch.service.js";

export async function createMatch(req, res) {
  try {
    const result = await createJobMatch(req.body || {});

    if (!result.ok) {
      return res.status(result.statusCode || 400).json({
        success: false,
        message: result.message || "Failed to create match",
      });
    }

    return res.json({
      success: true,
      match: result.match,
    });
  } catch (error) {
    console.error("Create match failed:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create match",
      error: error.message,
    });
  }
}

export async function getMatches(req, res) {
  try {
    const matches = await listJobMatches(req.query || {});

    return res.json({
      success: true,
      count: matches.length,
      matches,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to list matches",
      error: error.message,
    });
  }
}

export async function patchMatchStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, notes = "" } = req.body || {};

    const match = await updateJobMatchStatus({
      id,
      status,
      notes,
    });

    if (!match) {
      return res.status(404).json({
        success: false,
        message: "Match not found",
      });
    }

    return res.json({
      success: true,
      match,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update match",
      error: error.message,
    });
  }
}
