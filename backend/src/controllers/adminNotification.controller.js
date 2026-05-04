import {
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../services/notifications/notification.service.js";

export async function getNotifications(req, res) {
  try {
    const { status = "unread", limit = 30 } = req.query || {};

    const [items, unreadCount] = await Promise.all([
      listNotifications({ status, limit }),
      getUnreadNotificationCount(),
    ]);

    return res.json({
      success: true,
      unreadCount,
      count: items.length,
      items,
    });
  } catch (error) {
    console.error("Get notifications failed:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get notifications",
      error: error.message,
    });
  }
}

export async function readNotification(req, res) {
  try {
    const item = await markNotificationRead(req.params.id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    return res.json({
      success: true,
      item,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to mark notification read",
      error: error.message,
    });
  }
}

export async function readAllNotifications(req, res) {
  try {
    const result = await markAllNotificationsRead();

    return res.json({
      success: true,
      modifiedCount: result.modifiedCount || 0,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to mark all notifications read",
      error: error.message,
    });
  }
}
