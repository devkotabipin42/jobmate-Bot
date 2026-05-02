import {
  Building2,
  CheckCircle2,
  Clock,
  MessageCircle,
  PhoneCall,
  User,
  Users,
} from "lucide-react";
import HandoffBadge from "./HandoffBadge";

export default function HandoffCard({
  handoff,
  onCallStatusUpdate,
  onResolve,
  actionLoading,
}) {
  const isEmployer = Boolean(handoff.employerLead);
  const title = isEmployer
    ? handoff.employerLead?.businessName || "Employer lead"
    : handoff.worker?.fullName || handoff.contact?.displayName || "Contact";

  const subtitle = isEmployer
    ? formatEmployerNeed(handoff.employerLead)
    : formatWorkerNeed(handoff.worker);

  const isBusy = actionLoading === handoff.id;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-amber-200 hover:shadow-xl hover:shadow-slate-200/70 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-amber-500/30 dark:hover:shadow-amber-950/20">
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-3">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
              isEmployer
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                : "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"
            }`}
          >
            {isEmployer ? <Building2 size={22} /> : <User size={22} />}
          </div>

          <div>
            <h3 className="font-black text-slate-950 dark:text-white">
              {title}
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {handoff.contact?.phone || "-"} • {handoff.reason}
            </p>
          </div>
        </div>

        <HandoffBadge priority={handoff.priority} />
      </div>

      <div className="mt-5 rounded-2xl bg-slate-50 p-4 dark:bg-slate-950/60">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          {subtitle}
        </p>

        {handoff.lastUserMessage ? (
          <p className="mt-2 flex items-start gap-2 text-sm text-slate-500 dark:text-slate-400">
            <MessageCircle size={15} className="mt-0.5 shrink-0" />
            “{handoff.lastUserMessage}”
          </p>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <Info icon={Clock} label="Status" value={handoff.status || "open"} />
        <Info icon={PhoneCall} label="Call" value={handoff.callStatus || "not_required"} />
        <Info icon={Users} label="Assigned" value={handoff.assignedTo || "Unassigned"} />
      </div>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <button
          onClick={() => onCallStatusUpdate?.(handoff)}
          disabled={isBusy}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-950 dark:hover:bg-amber-300"
        >
          <PhoneCall size={16} />
          {isBusy ? "Updating..." : "Mark Called"}
        </button>

        <button
          onClick={() => onResolve?.(handoff)}
          disabled={isBusy}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <CheckCircle2 size={16} />
          {isBusy ? "Updating..." : "Mark Resolved"}
        </button>
      </div>
    </div>
  );
}

function Info({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400">
        <Icon size={14} />
        {label}
      </div>
      <p className="mt-1 font-semibold text-slate-800 dark:text-slate-100">
        {value}
      </p>
    </div>
  );
}

function formatEmployerNeed(lead) {
  const need = lead?.hiringNeeds?.[0];

  if (!need) return "Employer follow-up required";

  return `${need.quantity || 1} ${need.role || "staff"} needed • ${
    lead.location?.area || "-"
  } • ${lead.urgencyLevel || "unknown"}`;
}

function formatWorkerNeed(worker) {
  if (!worker) return "Worker follow-up required";

  const pref = worker.jobPreferences?.length
    ? worker.jobPreferences.join(", ")
    : "job preference not selected";

  return `${pref} • ${worker.location?.district || "-"} • ${
    worker.availability || "unknown"
  }`;
}
