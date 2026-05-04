import {
  listDueFollowups,
  listScheduledFollowups,
} from "../services/followups/followupScheduler.service.js";
import { processDueFollowups } from "../services/followups/followupProcessor.service.js";

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


export async function processFollowups(req, res) {
  try {
    const { limit = 25, dryRun = false } = req.body || {};

    const result = await processDueFollowups({
      limit,
      dryRun: dryRun === true || dryRun === "true",
    });

    return res.json({
      success: true,
      result,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to process followups",
      error: error.message,
    });
  }
}
