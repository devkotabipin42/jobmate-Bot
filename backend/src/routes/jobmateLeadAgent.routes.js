import express from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import {
  handleJobMateLeadAgentMessage,
} from "../services/jobmateLeadAgent/jobmateLeadAgent.service.js";

const router = express.Router();
const localSessions = new Map();

router.post(
  "/message",
  asyncHandler(async (req, res) => {
    const text = String(req.body?.text || req.body?.message || "").trim();
    const phone = String(req.body?.phone || "local-test").trim();
    const displayName = String(req.body?.displayName || "Mitra").trim();

    const conversation =
      req.body?.conversation ||
      localSessions.get(phone) ||
      makeLocalConversation();

    const result = await handleJobMateLeadAgentMessage({
      contact: {
        _id: req.body?.contactId || null,
        phone,
        displayName,
      },
      conversation,
      normalizedMessage: {
        message: {
          text,
          normalizedText: text.toLowerCase(),
          type: "text",
        },
      },
    });

    const nextConversation = result.handled
      ? applyLocalResult(conversation, result)
      : conversation;

    localSessions.set(phone, nextConversation);

    return res.json({
      success: true,
      handled: result.handled,
      reply: result.reply || null,
      intent: result.intent || null,
      reason: result.reason || "",
      usedGemini: Boolean(result.usedGemini),
      leadDraft: result.leadDraft || null,
      taskDraft: result.taskDraft || null,
      state: nextConversation.metadata.jobmateLeadAgent,
    });
  })
);

export default router;

function makeLocalConversation() {
  return {
    currentIntent: "unknown",
    currentState: "idle",
    metadata: {},
  };
}

function applyLocalResult(conversation, result) {
  return {
    ...conversation,
    currentIntent: result.conversationIntent || "unknown",
    currentState: result.currentState || "idle",
    metadata: {
      ...(conversation.metadata || {}),
      jobmateLeadAgent: result.state,
      lastQuestion: result.reply,
      lastAskedField: null,
    },
  };
}
