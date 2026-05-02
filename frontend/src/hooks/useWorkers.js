import { useEffect, useState } from "react";
import { adminService } from "../services/adminService";

export function useWorkers(filters = {}) {
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

  async function fetchWorkers() {
    try {
      setLoading(true);
      setError("");

      const cleanedFilters = Object.fromEntries(
        Object.entries(filters).filter(([, value]) => value)
      );

      const result = await adminService.getWorkers(cleanedFilters);
      setData(result);
    } catch (err) {
      setError(err.message || "Failed to load workers");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchWorkers();
  }, [filters.search, filters.status, filters.availability, filters.district]);

  return {
    workers: data.items || [],
    pagination: data.pagination,
    loading,
    error,
    refetch: fetchWorkers,
  };
}
