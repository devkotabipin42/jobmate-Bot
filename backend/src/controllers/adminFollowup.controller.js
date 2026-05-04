import {
  listDueFollowups,
  listScheduledFollowups,
} from "../services/followups/followupScheduler.service.js";

export async function getFollowups(req, res) {
  try {
    const { status = "pending", limit = 50, due } = req.query || {};

    const items =
      due === "true"
        ? await listDueFollowups({ limit })
        : await listScheduledFollowups({ status, limit });

    return res.json({
      success: true,
      count: items.length,
      items,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to list followups",
      error: error.message,
    });
  }
}
