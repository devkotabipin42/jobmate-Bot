import { useEffect, useMemo, useState } from "react";
import {
  BellRing,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Phone,
  RefreshCw,
  Send,
  Trash2,
  XCircle,
} from "lucide-react";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import { adminService } from "../services/adminService";

const STATUS_OPTIONS = ["pending", "sent", "failed", "cancelled"];

function statusTone(status) {
  if (status === "sent") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300";
  if (status === "failed") return "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300";
  if (status === "cancelled") return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
  return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300";
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

function formatLabel(value = "") {
  return String(value || "-").replace(/_/g, " ");
}

export default function FollowupsPage() {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [cancellingId, setCancellingId] = useState("");
  const [processResult, setProcessResult] = useState(null);
  const [error, setError] = useState("");

  async function loadFollowups() {
    try {
      setLoading(true);
      setError("");

      const data = await adminService.getFollowups({
        status,
        limit: 100,
      });

      setItems(data.followups || data.items || []);
    } catch (err) {
      setError(err.message || "Failed to load follow-ups");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFollowups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function handleProcessDue() {
    try {
      setProcessing(true);
      setError("");
      setProcessResult(null);

      const data = await adminService.processFollowups({
        limit: 25,
        dryRun: false,
      });

      setProcessResult(data.result || data);
      await loadFollowups();
    } catch (err) {
      setError(err.message || "Failed to process follow-ups");
    } finally {
      setProcessing(false);
    }
  }

  async function handleCancelFollowup(item) {
    const id = item?._id || item?.id;
    if (!id || item?.status !== "pending") return;

    try {
      setCancellingId(id);
      setError("");

      await adminService.cancelFollowup(id, {
        reason: "Cancelled from follow-ups dashboard",
      });

      await loadFollowups();
    } catch (err) {
      setError(err.message || "Failed to cancel follow-up");
    } finally {
      setCancellingId("");
    }
  }

  const counts = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        acc.total += 1;
        acc[item.status] = (acc[item.status] || 0) + 1;
        return acc;
      },
      { total: 0 }
    );
  }, [items]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <section className="grid gap-4 md:grid-cols-3">
          <StatCard title="Visible Follow-ups" value={counts.total || 0} icon={BellRing} tone="emerald" />
          <StatCard title="Pending" value={counts.pending || 0} icon={Clock3} tone="amber" />
          <StatCard title="Sent" value={counts.sent || 0} icon={CheckCircle2} tone="blue" />
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-xl font-black text-slate-950 dark:text-white">
                Aarati Follow-ups
              </h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Review pending, sent and failed follow-ups before enabling automatic cron processing.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                {STATUS_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {formatLabel(item)}
                  </option>
                ))}
              </select>

              <button
                onClick={loadFollowups}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-bold text-white dark:bg-white dark:text-slate-950"
              >
                <RefreshCw size={16} />
                Refresh
              </button>

              <button
                onClick={handleProcessDue}
                disabled={processing}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-black text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Send size={16} className={processing ? "animate-pulse" : ""} />
                {processing ? "Processing..." : "Process Due"}
              </button>
            </div>
          </div>

          {processResult ? (
            <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
              Scanned {processResult.scanned || 0}, sent {processResult.sent || 0}, failed {processResult.failed || 0}.
            </div>
          ) : null}

          {error ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
              {error}
            </div>
          ) : null}

          <div className="mt-5 grid gap-4">
            {loading ? (
              <StateCard text="Loading follow-ups..." />
            ) : items.length === 0 ? (
              <StateCard text="No follow-ups found for this status." />
            ) : (
              items.map((item) => (
                <FollowupCard
                  key={item._id || item.id}
                  item={item}
                  cancelling={cancellingId === (item._id || item.id)}
                  onCancel={handleCancelFollowup}
                />
              ))
            )}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}

function FollowupCard({ item, cancelling, onCancel }) {
  return (
    <div className="rounded-3xl border border-slate-100 bg-slate-50/70 p-5 transition hover:border-emerald-100 hover:bg-emerald-50/40 dark:border-slate-800 dark:bg-slate-950/50 dark:hover:border-emerald-500/20 dark:hover:bg-emerald-500/5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-black capitalize ${statusTone(item.status)}`}>
              {formatLabel(item.status)}
            </span>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600 shadow-sm dark:bg-slate-800 dark:text-slate-300">
              {formatLabel(item.triggerType)}
            </span>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600 shadow-sm dark:bg-slate-800 dark:text-slate-300">
              attempts {item.attempts || 0}
            </span>
          </div>

          <h4 className="mt-3 text-lg font-black text-slate-950 dark:text-white">
            {formatLabel(item.templateName)}
          </h4>

          <p className="mt-1 text-sm font-semibold text-slate-600 dark:text-slate-300">
            {item.targetType || "Target"} • {item.phone || "-"}
          </p>

          <div className="mt-4 grid gap-2 text-sm text-slate-500 dark:text-slate-400 md:grid-cols-2 xl:grid-cols-4">
            <Info icon={Phone} label="Phone" value={item.phone || "-"} />
            <Info icon={CalendarClock} label="Scheduled" value={formatDate(item.scheduledAt)} />
            <Info icon={CheckCircle2} label="Sent" value={formatDate(item.sentAt)} />
            <Info icon={XCircle} label="Last Error" value={item.lastError || "-"} />
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:w-80">
          {item.status === "pending" ? (
            <button
              onClick={() => onCancel?.(item)}
              disabled={cancelling}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-white px-4 py-2 text-sm font-black text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-500/20 dark:bg-slate-900 dark:text-red-300 dark:hover:bg-red-500/10"
            >
              <Trash2 size={16} />
              {cancelling ? "Cancelling..." : "Cancel Follow-up"}
            </button>
          ) : null}

          <div className="rounded-2xl bg-white p-4 text-sm text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
            Template data
          </p>
          <pre className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap break-words text-xs">
            {JSON.stringify(item.templateData || {}, null, 2)}
          </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, tone = "emerald" }) {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
    blue: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300",
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${tones[tone] || tones.emerald}`}>
        <Icon size={21} />
      </div>
      <p className="mt-4 text-sm font-bold text-slate-500 dark:text-slate-400">{title}</p>
      <p className="mt-1 text-3xl font-black text-slate-950 dark:text-white">{value}</p>
    </div>
  );
}

function Info({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl bg-white p-3 shadow-sm dark:bg-slate-900">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400">
        <Icon size={14} />
        {label}
      </div>
      <p className="mt-1 font-bold text-slate-700 dark:text-slate-200">{value}</p>
    </div>
  );
}

function StateCard({ text }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
      {text}
    </div>
  );
}
