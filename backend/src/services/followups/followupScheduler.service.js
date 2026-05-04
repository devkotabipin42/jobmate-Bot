import { ScheduledFollowup } from "../../models/ScheduledFollowup.model.js";

function addDays(days = 1) {
  const date = new Date();
  date.setDate(date.getDate() + Number(days || 1));
  return date;
}

export async function scheduleFollowup({
  targetType,
  targetId,
  phone,
  triggerType,
  templateName,
  templateData = {},
  scheduledAt,
} = {}) {
  if (!targetType || !targetId || !phone || !triggerType || !templateName) {
    return null;
  }

  return ScheduledFollowup.findOneAndUpdate(
    {
      targetType,
      targetId,
      triggerType,
      templateName,
    },
    {
      $setOnInsert: {
        targetType,
        targetId,
        triggerType,
        templateName,
        scheduledAt: scheduledAt || addDays(2),
        status: "pending",
      },
      $set: {
        phone,
        templateData,
      },
    },
    {
      upsert: true,
      returnDocument: "after",
      setDefaultsOnInsert: true,
      runValidators: false,
    }
  );
}

export async function listDueFollowups({ limit = 50 } = {}) {
  return ScheduledFollowup.find({
    status: "pending",
    scheduledAt: { $lte: new Date() },
  })
    .sort({ scheduledAt: 1 })
    .limit(Number(limit || 50))
    .lean();
}

export async function listScheduledFollowups({
  status = "pending",
  limit = 50,
} = {}) {
  const query = {};

  if (status) query.status = status;

  return ScheduledFollowup.find(query)
    .sort({ scheduledAt: 1 })
    .limit(Number(limit || 50))
    .lean();
}

export async function markFollowupSent(id) {
  return ScheduledFollowup.findByIdAndUpdate(
    id,
    {
      $set: {
        status: "sent",
        sentAt: new Date(),
      },
      $inc: {
        attempts: 1,
      },
    },
    {
      returnDocument: "after",
      runValidators: false,
    }
  );
}

export async function markFollowupFailed(id, errorMessage = "") {
  return ScheduledFollowup.findByIdAndUpdate(
    id,
    {
      $set: {
        status: "failed",
        lastError: String(errorMessage || ""),
      },
      $inc: {
        attempts: 1,
      },
    },
    {
      returnDocument: "after",
      runValidators: false,
    }
  );
}
