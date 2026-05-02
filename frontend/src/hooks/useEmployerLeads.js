import { useEffect, useState } from "react";
import { adminService } from "../services/adminService";

export function useEmployerLeads(filters = {}) {
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

  async function fetchLeads() {
    try {
      setLoading(true);
      setError("");

      const cleanedFilters = Object.fromEntries(
        Object.entries(filters).filter(([, value]) => value)
      );

      const result = await adminService.getEmployerLeads(cleanedFilters);
      setData(result);
    } catch (err) {
      setError(err.message || "Failed to load employer leads");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLeads();
  }, [filters.search, filters.urgency, filters.status]);

  return {
    leads: data.items || [],
    pagination: data.pagination,
    loading,
    error,
    refetch: fetchLeads,
  };
}
