import { useEffect, useState } from "react";
import { adminService } from "../services/adminService";

export function useDashboardSummary() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function fetchSummary() {
    try {
      setLoading(true);
      setError("");
      const result = await adminService.getDashboardSummary();
      setData(result);
    } catch (err) {
      setError(err.message || "Failed to load dashboard summary");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSummary();
  }, []);

  return {
    data,
    loading,
    error,
    refetch: fetchSummary,
  };
}
