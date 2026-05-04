import { useEffect, useMemo, useState } from "react";
import {
  Briefcase,
  CalendarClock,
  CheckCircle2,
  MapPin,
  Phone,
  RefreshCw,
  UserCheck,
  XCircle,
} from "lucide-react";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import { adminService } from "../services/adminService";

const STATUS_OPTIONS = [
  "matched",
  "contacted",
  "interview_scheduled",
  "selected",
  "placed",
  "rejected",
  "withdrawn",
];

const STATUS_LABELS = {
  matched: "Matched",
  contacted: "Contacted",
  interview_scheduled: "Interview Scheduled",
  selected: "Selected",
  placed: "Placed",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

function statusTone(status) {
  if (status === "placed") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300";
  if (status === "selected") return "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300";
  if (status === "rejected" || status === "withdrawn") return "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300";
  if (status === "interview_scheduled") return "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300";
  return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300";
}

function formatRole(role = "") {
  const labels = {
    driver: "Driver",
    driver_transport: "Driver / Transport",
    frontend_developer: "Frontend Developer",
    it_web: "IT / Web",
    marketing_staff: "Marketing Staff",
    kitchen_staff: "Kitchen Staff",
    shopkeeper: "Shopkeeper",
    security_guard: "Security Guard",
    waiter: "Waiter",
    helper_staff: "Helper",
  };

  return labels[role] || String(role || "Staff").replace(/_/g, " ");
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function JobMatchesPage() {
  const [matches, setMatches] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadMatches() {
    try {
      setLoading(true);
      setError("");

      const data = await adminService.getJobMatches({
        status: statusFilter,
        limit: 100,
      });

      setMatches(data.matches || []);
    } catch (err) {
      setError(err.message || "Failed to load matches");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  async function handleStatusChange(match, status) {
    if (!status || status === match.status) return;

    try {
      setActionLoading(match._id || match.id);
      setMessage("");
      setError("");

      await adminService.updateJobMatchStatus(match._id || match.id, {
        status,
        notes: match.notes || "",
      });

      setMessage(`Match status updated to ${status}.`);
      await loadMatches();
    } catch (err) {
      setError(err.message || "Failed to update match status.");
    } finally {
      setActionLoading("");
    }
  }

  const counts = useMemo(() => {
    return matches.reduce(
      (acc, item) => {
        acc.total += 1;
        acc[item.status] = (acc[item.status] || 0) + 1;
        return acc;
      },
      { total: 0 }
    );
  }, [matches]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <section className="grid gap-4 md:grid-cols-3">
          <StatCard title="Total Matches" value={counts.total || 0} icon={Briefcase} tone="emerald" />
          <StatCard title="Contacted" value={counts.contacted || 0} icon={Phone} tone="amber" />
          <StatCard title="Placed" value={counts.placed || 0} icon={CheckCircle2} tone="blue" />
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-xl font-black text-slate-950 dark:text-white">
                Job Matches / Placement Pipeline
              </h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Track matched workers from employer leads through contacted, selected, and placed.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="">All statuses</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </option>
                ))}
              </select>

              <button
                onClick={loadMatches}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-bold text-white dark:bg-white dark:text-slate-950"
              >
                <RefreshCw size={16} />
                Refresh
              </button>
            </div>
          </div>

          {message ? (
            <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
              {message}
            </div>
          ) : null}

          {error ? (
            <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:bg-red-500/10 dark:text-red-300">
              {error}
            </div>
          ) : null}

          <div className="mt-5">
            {loading ? (
              <StateCard text="Loading matches..." />
            ) : matches.length === 0 ? (
              <StateCard text="No matches found yet." />
            ) : (
              <div className="grid gap-4">
                {matches.map((match) => (
                  <MatchCard
                    key={match._id || match.id}
                    match={match}
                    updating={actionLoading === (match._id || match.id)}
                    onStatusChange={handleStatusChange}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}

function MatchCard({ match, updating, onStatusChange }) {
  return (
    <div className="rounded-3xl border border-slate-100 bg-slate-50/70 p-5 transition hover:border-emerald-100 hover:bg-emerald-50/40 dark:border-slate-800 dark:bg-slate-950/50">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-black ${statusTone(match.status)}`}>
              {STATUS_LABELS[match.status] || match.status}
            </span>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600 shadow-sm dark:bg-slate-800 dark:text-slate-300">
              Score {match.matchScore || 0}
            </span>
          </div>

          <h4 className="mt-3 text-lg font-black text-slate-950 dark:text-white">
            {match.businessName || "Employer"} → {match.workerName || "Worker"}
          </h4>

          <p className="mt-1 text-sm font-semibold text-slate-600 dark:text-slate-300">
            {formatRole(match.role)} • {match.workerPhone || "-"}
          </p>

          <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <Info icon={Phone} label="Worker" value={match.workerPhone || "-"} />
            <Info icon={Phone} label="Employer" value={match.employerPhone || "-"} />
            <Info icon={MapPin} label="Location" value={`${match.location?.area || "-"}, ${match.location?.district || "-"}`} />
            <Info icon={CalendarClock} label="Matched" value={formatDate(match.matchedAt || match.createdAt)} />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {(match.matchReasons || []).map((reason) => (
              <span
                key={reason}
                className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
              >
                {String(reason).replace(/_/g, " ")}
              </span>
            ))}
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 lg:w-72">
          <label className="text-xs font-bold uppercase tracking-wide text-slate-400">
            Update match status
          </label>

          <select
            value={match.status}
            disabled={updating}
            onChange={(event) => onStatusChange(match, event.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-2">
            <QuickButton label="Contacted" icon={Phone} disabled={updating} onClick={() => onStatusChange(match, "contacted")} />
            <QuickButton label="Placed" icon={CheckCircle2} disabled={updating} onClick={() => onStatusChange(match, "placed")} />
            <QuickButton label="Selected" icon={UserCheck} disabled={updating} onClick={() => onStatusChange(match, "selected")} />
            <QuickButton label="Rejected" icon={XCircle} disabled={updating} onClick={() => onStatusChange(match, "rejected")} />
          </div>

          <a
            href={`tel:${match.workerPhone}`}
            className="mt-1 inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-2 text-sm font-bold text-white dark:bg-white dark:text-slate-950"
          >
            Call Worker
          </a>
        </div>
      </div>
    </div>
  );
}

function Info({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl bg-white p-3 dark:bg-slate-900">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400">
        <Icon size={14} />
        {label}
      </div>
      <p className="mt-1 font-semibold text-slate-800 dark:text-slate-100">{value}</p>
    </div>
  );
}

function QuickButton({ icon: Icon, label, onClick, disabled }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
    >
      <Icon size={14} />
      {label}
    </button>
  );
}

function StatCard({ title, value, icon: Icon, tone }) {
  const tones = {
    emerald: "from-emerald-500 to-green-500",
    amber: "from-amber-500 to-orange-500",
    blue: "from-blue-500 to-indigo-500",
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400">{title}</p>
          <p className="mt-2 text-3xl font-black text-slate-950 dark:text-white">{value}</p>
        </div>
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${
            tones[tone] || tones.emerald
          } text-white`}
        >
          <Icon size={22} />
        </div>
      </div>
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
