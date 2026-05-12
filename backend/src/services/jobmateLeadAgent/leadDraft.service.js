let leadDraftSequence = 0;

export function createLeadDraft({
  type,
  contact = {},
  data = {},
  source = "whatsapp",
  notes = [],
} = {}) {
  leadDraftSequence += 1;

  return {
    id: `jobmate_${type || "lead"}_lead_draft_${Date.now()}_${leadDraftSequence}`,
    type,
    source,
    status: "pending_human_approval",
    draftStatus: "draft",
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
    contact: {
      contactId: contact?._id || null,
      phone: contact?.phone || "",
      displayName: contact?.displayName || "",
    },
    data,
    notes: [
      "Human approval required before matching, calling, sharing profiles, or confirming terms.",
      ...notes,
    ],
    createdAt: new Date().toISOString(),
  };
}

export function leadDraftRequiresHumanApproval(leadDraft = {}) {
  return Boolean(
    leadDraft.requiresHumanApproval &&
      leadDraft.humanApprovalRequired &&
      leadDraft.approvalStatus === "pending_human_approval" &&
      leadDraft.botFinalized === false
  );
}
