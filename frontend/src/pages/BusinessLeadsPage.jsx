import { RefreshCcw, Search, SlidersHorizontal } from "lucide-react";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import BusinessLeadCard from "../components/business-leads/BusinessLeadCard";
import { useBusinessLeads } from "../hooks/useBusinessLeads";

export default function BusinessLeadsPage() {
  const {
    items,
    pagination,
    filters,
    loading,
    savingId,
    error,
    refetch,
    updateFilters,
    updateStatus,
  } = useBusinessLeads();

  async function handleStatusChange(id, status) {
    await updateStatus(id, {
      status,
      note: `Marked as ${status} from dashboard.`,
    });
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h3 className="text-xl font-black text-slate-950 dark:text-white">
                Business Leads
              </h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                WhatsApp AI Receptionist बाट आएका booking, price inquiry र human-support leads.
              </p>
            </div>

            <button
              onClick={() => refetch()}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white hover:bg-emerald-600 dark:bg-white dark:text-slate-950"
            >
              <RefreshCcw size={16} />
              Refresh
            </button>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_180px_180px]">
            <label className="relative">
              <Search
                size={17}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={filters.search}
                onChange={(e) => updateFilters({ search: e.target.value })}
                placeholder="Search by service..."
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-semibold outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:focus:ring-emerald-500/10"
              />
            </label>

            <select
              value={filters.status}
              onChange={(e) => updateFilters({ status: e.target.value })}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            >
              <option value="">All status</option>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="booked">Booked</option>
              <option value="closed">Closed</option>
              <option value="spam">Spam</option>
            </select>

            <select
              value={filters.needsHuman}
              onChange={(e) => updateFilters({ needsHuman: e.target.value })}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            >
              <option value="">All leads</option>
              <option value="true">Human needed</option>
              <option value="false">No human needed</option>
            </select>
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </div>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MiniStat title="Total" value={pagination.total || 0} />
          <MiniStat
            title="Showing"
            value={items.length}
            icon={<SlidersHorizontal size={16} />}
          />
          <MiniStat
            title="Human needed"
            value={items.filter((item) => item.needsHuman).length}
          />
          <MiniStat
            title="New"
            value={items.filter((item) => item.status === "new").length}
          />
        </section>

        {loading ? (
          <StateCard text="Loading business leads..." />
        ) : items.length === 0 ? (
          <StateCard text="No business leads found." />
        ) : (
          <section className="space-y-4">
            {items.map((lead) => (
              <BusinessLeadCard
                key={lead.id}
                lead={lead}
                saving={savingId === lead.id}
                onStatusChange={handleStatusChange}
              />
            ))}
          </section>
        )}
      </div>
    </DashboardLayout>
  );
}

function MiniStat({ title, value, icon }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
          {title}
        </p>
        <span className="text-slate-400">{icon}</span>
      </div>
      <p className="mt-2 text-3xl font-black text-slate-950 dark:text-white">
        {value}
      </p>
    </div>
  );
}

function StateCard({ text }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
      {text}
    </div>
  );
}
