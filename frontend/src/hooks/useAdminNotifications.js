import { useEffect, useState } from "react";
import { adminService } from "../services/adminService";

const DASHBOARD_MODE =
  import.meta.env.VITE_DASHBOARD_MODE || "jobmate_admin";

export function useAdminNotifications() {
  const [count, setCount] = useState(0);
  const [latest, setLatest] = useState([]);
  const [loading, setLoading] = useState(true);

  async function fetchNotifications() {
    try {
      setLoading(true);

      if (DASHBOARD_MODE === "business_receptionist") {
        const summary = await adminService.getDashboardSummary();
        const metrics = summary?.metrics || {};

        setCount(metrics.newBusinessLeads || 0);

        const leads = await adminService.getBusinessLeads({
          status: "new",
          limit: 10,
        });

        setLatest(leads.items || []);
        return;
      }

      const data = await adminService.getHandoffs({
        status: "open",
        priority: "urgent",
        limit: 10,
      });

      setCount(data.pagination?.total || 0);
      setLatest(data.items || []);
    } catch {
      setCount(0);
      setLatest([]);
    } finally {
      setLoading(false);
    }
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
  };
}
