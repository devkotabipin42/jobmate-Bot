import { useEffect, useMemo, useState } from "react";
import {
  Brain,
  CheckCircle2,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import {
  listPendingKnowledge,
  approvePendingKnowledge,
  rejectPendingKnowledge,
  applyPendingKnowledge,
} from "../services/pendingKnowledgeApi";

const TYPES = ["role", "location", "faq", "salary", "company"];
const STATUSES = ["pending", "approved", "rejected"];

function typeTone(type) {
  if (type === "role") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300";
  if (type === "location") return "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300";
  if (type === "faq") return "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300";
  return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
}

export default function PendingKnowledgePage() {
  const [items, setItems] = useState([]);
  const [type, setType] = useState("");
  const [status, setStatus] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");

  async function loadItems() {
    try {
      setLoading(true);
      setError("");
      const data = await listPendingKnowledge({
        type,
        status,
        limit: 100,
      });
      setItems(data.items || []);
    } catch (err) {
      setError(err.message || "Failed to load pending knowledge");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, status]);

  const counts = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        acc.total += 1;
        acc[item.type] = (acc[item.type] || 0) + 1;
        return acc;
      },
      { total: 0 }
    );
  }, [items]);

  async function runAction(item, action) {
    try {
      setActionLoading(`${action}:${item._id}`);
      setError("");

      const body = {
        reviewedBy: "Bipin",
        reviewNote:
          action === "apply"
            ? "Applied to RAG from dashboard"
            : action === "approve"
              ? "Approved from dashboard"
              : "Rejected from dashboard",
      };

      if (action === "approve") {
        await approvePendingKnowledge(item._id, body);
      } else if (action === "reject") {
        await rejectPendingKnowledge(item._id, body);
      } else if (action === "apply") {
        await applyPendingKnowledge(item._id, body);
      }

      await loadItems();
    } catch (err) {
      setError(err.message || "Action failed");
    } finally {
      setActionLoading("");
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <section className="grid gap-4 md:grid-cols-3">
          <StatCard title="Suggestions" value={counts.total || 0} icon={Brain} />
          <StatCard title="Roles" value={counts.role || 0} icon={Sparkles} />
          <StatCard title="Locations" value={counts.location || 0} icon={ShieldCheck} />
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-xl font-black text-slate-950 dark:text-white">
                Pending Knowledge
              </h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Review AI-discovered roles, locations, and FAQs before adding them to RAG.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <select
                value={type}
                onChange={(event) => setType(event.target.value)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="">All types</option>
                {TYPES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>

              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                {STATUSES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>

              <button
                onClick={loadItems}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-bold text-white dark:bg-white dark:text-slate-950"
              >
                <RefreshCcw size={16} />
                Refresh
              </button>
            </div>
          </div>

          {error ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
              {error}
            </div>
          ) : null}

          <div className="mt-5 grid gap-4">
            {loading ? (
              <StateCard text="Loading pending knowledge..." />
            ) : items.length === 0 ? (
              <StateCard text="No knowledge suggestions found." />
            ) : (
              items.map((item) => (
                <KnowledgeCard
                  key={item._id}
                  item={item}
                  actionLoading={actionLoading}
                  onAction={runAction}
                />
              ))
            )}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}

function KnowledgeCard({ item, actionLoading, onAction }) {
  const latestExample = item.examples?.[item.examples.length - 1]?.text || item.rawText;

  return (
    <div className="rounded-3xl border border-slate-100 bg-slate-50/70 p-5 dark:border-slate-800 dark:bg-slate-950/50">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-black ${typeTone(item.type)}`}>
              {item.type}
            </span>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600 shadow-sm dark:bg-slate-800 dark:text-slate-300">
              {item.status}
            </span>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600 shadow-sm dark:bg-slate-800 dark:text-slate-300">
              seen {item.count}x
            </span>
          </div>

          <h4 className="mt-3 text-lg font-black text-slate-950 dark:text-white">
            {item.suggestedLabel || item.suggestedKey || item.rawText}
          </h4>
          <p className="mt-1 text-sm font-semibold text-slate-600 dark:text-slate-300">
            Key: {item.suggestedKey || item.normalizedKey}
          </p>

          <div className="mt-4 rounded-2xl bg-white p-4 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Latest example
            </p>
            <p className="mt-1 font-semibold">{latestExample}</p>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3 xl:w-[420px]">
          <ActionButton
            label="Approve"
            icon={CheckCircle2}
            disabled={Boolean(actionLoading)}
            loading={actionLoading === `approve:${item._id}`}
            onClick={() => onAction(item, "approve")}
          />
          <ActionButton
            label="Apply to RAG"
            icon={ShieldCheck}
            disabled={Boolean(actionLoading)}
            loading={actionLoading === `apply:${item._id}`}
            onClick={() => onAction(item, "apply")}
          />
          <ActionButton
            label="Reject"
            icon={XCircle}
            danger
            disabled={Boolean(actionLoading)}
            loading={actionLoading === `reject:${item._id}`}
            onClick={() => onAction(item, "reject")}
          />
        </div>
      </div>
    </div>
  );
}

function ActionButton({ label, icon: Icon, onClick, disabled, loading, danger }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl px-3 py-2 text-xs font-black transition disabled:opacity-60 ${
        danger
          ? "border border-red-200 bg-white text-red-700 hover:bg-red-50 dark:border-red-500/20 dark:bg-slate-900 dark:text-red-300"
          : "border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500/20 dark:bg-slate-900 dark:text-emerald-300"
      }`}
    >
      <Icon size={14} />
      {loading ? "Working..." : label}
    </button>
  );
}

function StatCard({ title, value, icon: Icon }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400">{title}</p>
          <p className="mt-2 text-3xl font-black text-slate-950 dark:text-white">{value}</p>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-green-500 text-white">
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
