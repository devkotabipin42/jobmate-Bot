import { useState } from "react";
import { Search, SlidersHorizontal, RefreshCcw } from "lucide-react";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import EmployerLeadCard from "../components/employers/EmployerLeadCard";
import { useEmployerLeads } from "../hooks/useEmployerLeads";
import { adminService } from "../services/adminService";

export default function EmployerLeadsPage() {
  const [filters, setFilters] = useState({
    search: "",
    urgency: "",
    status: "",
  });

  const [actionLoading, setActionLoading] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  const { leads, pagination, loading, error, refetch } =
    useEmployerLeads(filters);

  function updateFilter(key, value) {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function handleStatusChange(lead, status) {
    try {
      setActionLoading(lead.id);
      setActionMessage("");

      await adminService.updateEmployerLeadStatus(lead.id, { status });

      setActionMessage(`Lead status updated to ${status}.`);
      await refetch();
    } catch (err) {
      setActionMessage(err.message || "Failed to update lead status.");
    } finally {
      setActionLoading("");
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h3 className="text-xl font-black text-slate-950 dark:text-white">
                Employer Leads Pipeline
              </h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                WhatsApp बाट आएको hiring requests, urgency, salary and call
                priority.
              </p>
            </div>

            <button
              onClick={refetch}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <RefreshCcw size={16} />
              Refresh
            </button>
          </div>

          {actionMessage ? (
            <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
              {actionMessage}
            </div>
          ) : null}

          <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_180px_180px]">
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
              <Search size={18} className="text-slate-400" />
              <input
                value={filters.search}
                onChange={(e) => updateFilter("search", e.target.value)}
                placeholder="Search business, phone, location..."
                className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-white"
              />
            </div>

            <select
              value={filters.urgency}
              onChange={(e) => updateFilter("urgency", e.target.value)}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
            >
              <option value="">All urgency</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
              <option value="unknown">Unknown</option>
            </select>

            <select
              value={filters.status}
              onChange={(e) => updateFilter("status", e.target.value)}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
            >
              <option value="">All status</option>
              <option value="new">New</option>
              <option value="qualifying">Qualifying</option>
              <option value="hot">Hot</option>
              <option value="interested">Interested</option>
              <option value="called">Called</option>
              <option value="follow_up">Follow up</option>
              <option value="converted">Converted</option>
              <option value="closed">Closed</option>
              <option value="invalid">Invalid</option>
            </select>
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-slate-300">
              <SlidersHorizontal size={16} />
              {pagination?.total || 0} leads found
            </div>
          </div>

          {loading ? (
            <StateCard text="Loading employer leads..." />
          ) : error ? (
            <StateCard text={error} danger />
          ) : leads.length === 0 ? (
            <StateCard text="No employer leads found." />
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {leads.map((lead) => (
                <EmployerLeadCard
                  key={lead.id}
                  lead={lead}
                  onStatusChange={handleStatusChange}
                  actionLoading={actionLoading}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}

function StateCard({ text, danger = false }) {
  return (
    <div
      className={`rounded-3xl border border-dashed p-8 text-center text-sm font-semibold ${
        danger
          ? "border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"
          : "border-slate-200 bg-white text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
      }`}
    >
      {text}
    </div>
  );
}
