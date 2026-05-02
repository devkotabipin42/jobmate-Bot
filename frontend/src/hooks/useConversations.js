import { useEffect, useState } from "react";
import { adminService } from "../services/adminService";

export function useConversations(filters = {}) {
  const [data, setData] = useState({
    items: [],
    pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function fetchConversations() {
    try {
      setLoading(true);
      setError("");

      const cleanedFilters = Object.fromEntries(
        Object.entries(filters).filter(([, value]) => value)
      );

      const result = await adminService.getConversations(cleanedFilters);
      setData(result);
    } catch (err) {
      setError(err.message || "Failed to load conversations");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchConversations();
  }, [filters.search, filters.contactType, filters.status]);

  return {
    conversations: data.items || [],
    pagination: data.pagination,
    loading,
    error,
    refetch: fetchConversations,
  };
}
