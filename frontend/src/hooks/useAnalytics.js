import { useEffect, useState } from "react";
import { adminService } from "../services/adminService";

export function useAnalytics() {
  const [summary, setSummary] = useState(null);
  const [employerLeads, setEmployerLeads] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [handoffs, setHandoffs] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function fetchAnalytics() {
    try {
      setLoading(true);
      setError("");

      const [summaryData, employerData, workerData, handoffData] =
        await Promise.all([
          adminService.getDashboardSummary(),
          adminService.getEmployerLeads({ limit: 100 }),
          adminService.getWorkers({ limit: 100 }),
          adminService.getHandoffs({ limit: 100 }),
        ]);

      setSummary(summaryData);
      setEmployerLeads(employerData.items || []);
      setWorkers(workerData.items || []);
      setHandoffs(handoffData.items || []);
    } catch (err) {
      setError(err.message || "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAnalytics();
  }, []);

  return {
    summary,
    employerLeads,
    workers,
    handoffs,
    loading,
    error,
    refetch: fetchAnalytics,
  };
}
