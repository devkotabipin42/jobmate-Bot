import { useEffect, useState } from "react";
import { adminService } from "../services/adminService";

export function useAdminNotifications() {
  const [count, setCount] = useState(0);
  const [latest, setLatest] = useState([]);
  const [loading, setLoading] = useState(true);

  async function fetchNotifications() {
    try {
      setLoading(true);

      const data = await adminService.getNotifications({
        status: "unread",
        limit: 10,
      });

      setCount(data.unreadCount || 0);
      setLatest(data.items || []);
    } catch {
      setCount(0);
      setLatest([]);
    } finally {
      setLoading(false);
    }
  }

  async function markAllRead() {
    await adminService.markAllNotificationsRead();
    await fetchNotifications();
  }

  async function markRead(id) {
    if (!id) return;
    await adminService.markNotificationRead(id);
    await fetchNotifications();
  }

  useEffect(() => {
    fetchNotifications();

    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  return {
    count,
    latest,
    loading,
    refetch: fetchNotifications,
    markRead,
    markAllRead,
  };
}
