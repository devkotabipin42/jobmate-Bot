import { useEffect, useState } from "react";
import { adminService } from "../services/adminService";

export function useBusinessLeads(initialFilters = {}) {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [filters, setFilters] = useState({
    status: "",
    needsHuman: "",
    search: "",
    ...initialFilters,
  });
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");

  async function fetchLeads(nextFilters = filters) {
    try {
      setLoading(true);
      setError("");

      const params = {
        page: nextFilters.page || 1,
        limit: nextFilters.limit || 20,
      };

      if (nextFilters.status) params.status = nextFilters.status;
      if (nextFilters.needsHuman) params.needsHuman = nextFilters.needsHuman;
      if (nextFilters.search) params.service = nextFilters.search;

      const data = await adminService.getBusinessLeads(params);

      setItems(data.items || []);
      setPagination(data.pagination || {});
    } catch (err) {
      setError(err.message || "Failed to load business leads");
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id, payload) {
    try {
      setSavingId(id);
      setError("");

      await adminService.updateBusinessLeadStatus(id, payload);
      await fetchLeads();
    } catch (err) {
      setError(err.message || "Failed to update lead");
    } finally {
      setSavingId("");
    }
  }

  function updateFilters(next) {
    const merged = {
      ...filters,
      ...next,
      page: 1,
    };

    setFilters(merged);
    fetchLeads(merged);
  }

  useEffect(() => {
    fetchLeads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    items,
    pagination,
    filters,
    loading,
    savingId,
    error,
    refetch: fetchLeads,
    updateFilters,
    updateStatus,
  };
}
