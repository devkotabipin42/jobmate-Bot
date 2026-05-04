import { applyPendingKnowledgeToRAG } from "../services/rag/applyPendingKnowledge.service.js";
import { PendingKnowledge } from "../models/PendingKnowledge.model.js";

export async function listPendingKnowledge(req, res) {
  try {
    const {
      type,
      status = "pending",
      limit = 50,
    } = req.query || {};

    const query = {};

    if (type) query.type = type;
    if (status) query.status = status;

    const items = await PendingKnowledge.find(query)
      .sort({ count: -1, lastSeenAt: -1 })
      .limit(Math.min(Number(limit || 50), 200))
      .lean();

    return res.json({
      success: true,
      count: items.length,
      items,
    });
  } catch (error) {
    console.error("List pending knowledge failed:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to list pending knowledge",
      error: error.message,
    });
  }
}

export async function approvePendingKnowledge(req, res) {
  try {
    const { id } = req.params;
    const { reviewedBy = "admin", reviewNote = "" } = req.body || {};

    const item = await PendingKnowledge.findByIdAndUpdate(
      id,
      {
        $set: {
          status: "approved",
          reviewedAt: new Date(),
          reviewedBy,
          reviewNote,
        },
      },
      {
        returnDocument: "after",
        runValidators: false,
      }
    ).lean();

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Pending knowledge item not found",
      });
    }

    return res.json({
      success: true,
      item,
    });
  } catch (error) {
    console.error("Approve pending knowledge failed:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to approve pending knowledge",
      error: error.message,
    });
  }
}

export async function rejectPendingKnowledge(req, res) {
  try {
    const { id } = req.params;
    const { reviewedBy = "admin", reviewNote = "" } = req.body || {};

    const item = await PendingKnowledge.findByIdAndUpdate(
      id,
      {
        $set: {
          status: "rejected",
          reviewedAt: new Date(),
          reviewedBy,
          reviewNote,
        },
      },
      {
        returnDocument: "after",
        runValidators: false,
      }
    ).lean();

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Pending knowledge item not found",
      });
    }

    return res.json({
      success: true,
      item,
    });
  } catch (error) {
    console.error("Reject pending knowledge failed:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to reject pending knowledge",
      error: error.message,
    });
  }
}


export async function applyPendingKnowledge(req, res) {
  try {
    const { id } = req.params;
    const { reviewedBy = "admin", reviewNote = "Applied to RAG" } = req.body || {};

    const result = await applyPendingKnowledgeToRAG({
      id,
      reviewedBy,
      reviewNote,
    });

    if (!result.ok) {
      return res.status(result.statusCode || 400).json({
        success: false,
        message: result.message || "Failed to apply pending knowledge",
      });
    }

    return res.json({
      success: true,
      applied: result.applied,
      item: result.item,
    });
  } catch (error) {
    console.error("Apply pending knowledge failed:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to apply pending knowledge",
      error: error.message,
    });
  }
}
