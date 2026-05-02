import { useEffect, useState } from "react";
import { adminService } from "../services/adminService";

export function useHandoffs(filters = {}) {
  const [data, setData] = useState({
    items: [],
    pagination: {
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    },
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function fetchHandoffs() {
    try {
      setLoading(true);
      setError("");

      const cleanedFilters = Object.fromEntries(
        Object.entries(filters).filter(([, value]) => value)
      );

      const result = await adminService.getHandoffs(cleanedFilters);
      setData(result);
    } catch (err) {
      setError(err.message || "Failed to load handoffs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchHandoffs();
  }, [filters.search, filters.status, filters.priority, filters.callStatus]);

  return {
    handoffs: data.items || [],
    pagination: data.pagination,
    loading,
    error,
    refetch: fetchHandoffs,
  };
}
