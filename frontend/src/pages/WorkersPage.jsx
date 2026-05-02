import { useState } from "react";
import { RefreshCcw, Search, SlidersHorizontal } from "lucide-react";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import WorkerCard from "../components/workers/WorkerCard";
import { useWorkers } from "../hooks/useWorkers";
import { adminService } from "../services/adminService";

export default function WorkersPage() {
  const [filters, setFilters] = useState({
    search: "",
    status: "",
    availability: "",
    district: "",
  });

  const [actionLoading, setActionLoading] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  const { workers, pagination, loading, error, refetch } = useWorkers(filters);

  function updateFilter(key, value) {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function handleStatusChange(worker, status) {
    try {
      setActionLoading(worker.id);
      setActionMessage("");

      await adminService.updateWorkerStatus(worker.id, { status });

      setActionMessage(`Worker status updated to ${status}.`);
      await refetch();
    } catch (err) {
      setActionMessage(err.message || "Failed to update worker status.");
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
                Worker Profiles
              </h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                WhatsApp bata register bhayeko job seekers, availability and
                document status.
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
            <div className="mt-4 rounded-2xl bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
              {actionMessage}
            </div>
          ) : null}

          <div className="mt-5 grid gap-3 xl:grid-cols-[1fr_170px_190px_170px]">
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
              <Search size={18} className="text-slate-400" />
              <input
                value={filters.search}
                onChange={(e) => updateFilter("search", e.target.value)}
                placeholder="Search name, phone, job preference..."
                className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-white"
              />
            </div>

            <select
              value={filters.status}
              onChange={(e) => updateFilter("status", e.target.value)}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
            >
              <option value="">All status</option>
              <option value="new">New</option>
              <option value="incomplete">Incomplete</option>
              <option value="complete">Complete</option>
              <option value="qualified">Qualified</option>
              <option value="verified">Verified</option>
              <option value="matched">Matched</option>
              <option value="placed">Placed</option>
              <option value="inactive">Inactive</option>
            </select>

            <select
              value={filters.availability}
              onChange={(e) => updateFilter("availability", e.target.value)}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
            >
              <option value="">All availability</option>
              <option value="immediate">Immediate</option>
              <option value="within_1_week">Within 1 week</option>
              <option value="within_1_month">Within 1 month</option>
              <option value="available_later">Available later</option>
              <option value="unknown">Unknown</option>
            </select>

            <select
              value={filters.district}
              onChange={(e) => updateFilter("district", e.target.value)}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
            >
              <option value="">All districts</option>
              <option value="Nawalparasi">Nawalparasi</option>
              <option value="Rupandehi">Rupandehi</option>
              <option value="Kapilvastu">Kapilvastu</option>
              <option value="Butwal">Butwal</option>
            </select>
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-slate-300">
              <SlidersHorizontal size={16} />
              {pagination?.total || 0} workers found
            </div>
          </div>

          {loading ? (
            <StateCard text="Loading workers..." />
          ) : error ? (
            <StateCard text={error} danger />
          ) : workers.length === 0 ? (
            <StateCard text="No workers found." />
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {workers.map((worker) => (
                <WorkerCard
                  key={worker.id}
                  worker={worker}
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
