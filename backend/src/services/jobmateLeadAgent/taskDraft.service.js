let taskDraftSequence = 0;

export function createTaskDraft({
  type,
  leadDraft = null,
  contact = {},
  title = "",
  data = {},
  priority = "medium",
} = {}) {
  taskDraftSequence += 1;

  return {
    id: `jobmate_${type || "review"}_task_draft_${Date.now()}_${taskDraftSequence}`,
    type,
    title,
    priority,
    status: "pending_human_approval",
    approvalStatus: "pending_human_approval",
    requiresHumanApproval: true,
    humanApprovalRequired: true,
    botFinalized: false,
    canBeExecutedByBot: false,
    paymentSettlement: {
      status: "not_finalized",
      finalizedByBot: false,
      requiresHumanReview: true,
    },
    leadDraftId: leadDraft?.id || null,
    contact: {
      contactId: contact?._id || null,
      phone: contact?.phone || "",
      displayName: contact?.displayName || "",
    },
    data,
    createdAt: new Date().toISOString(),
  };
}
