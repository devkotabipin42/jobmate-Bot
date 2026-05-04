import { Notification } from "../../models/Notification.model.js";

export async function createNotification({
  type,
  title,
  message = "",
  priority = "medium",
  entityType = "System",
  entityId = "",
  phone = "",
  metadata = {},
} = {}) {
  if (!type || !title) {
    return null;
  }

  return Notification.create({
    type,
    title,
    message,
    priority,
    entityType,
    entityId: String(entityId || ""),
    phone: String(phone || ""),
    metadata,
  });
}

export async function listNotifications({
  status = "unread",
  limit = 30,
} = {}) {
  const query = {};

  if (status) query.status = status;

  return Notification.find(query)
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(limit || 30), 100))
    .lean();
}

export async function getUnreadNotificationCount() {
  return Notification.countDocuments({
    status: "unread",
  });
}

export async function markNotificationRead(id) {
  return Notification.findByIdAndUpdate(
    id,
    {
      $set: {
        status: "read",
        readAt: new Date(),
      },
    },
    {
      returnDocument: "after",
      runValidators: false,
    }
  ).lean();
}

export async function markAllNotificationsRead() {
  return Notification.updateMany(
    { status: "unread" },
    {
      $set: {
        status: "read",
        readAt: new Date(),
      },
    },
    { runValidators: false }
  );
}
