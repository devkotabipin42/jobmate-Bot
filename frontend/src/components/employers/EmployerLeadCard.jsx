import {
  Building2,
  CheckCircle2,
  MapPin,
  Phone,
  RefreshCcw,
  Search,
  ShieldCheck,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";
import LeadStatusBadge from "./LeadStatusBadge";

const nextStatuses = [
  { label: "Called", value: "called" },
  { label: "Follow-up", value: "follow_up" },
  { label: "Converted", value: "converted" },
  { label: "Closed", value: "closed" },
];

const verificationStatuses = {
  unverified: "Unverified",
  needs_call: "Needs Call",
  called: "Called",
  verified: "Verified",
  rejected: "Rejected",
};

function formatRole(role = "") {
  const labels = {
    marketing_staff: "Marketing Staff",
    kitchen_staff: "Kitchen Staff",
    driver: "Driver",
    shopkeeper: "Shopkeeper",
    waiter: "Waiter",
    security_guard: "Security Guard",
    frontend_developer: "Frontend Developer",
    helper_staff: "Helper",
  };

  return labels[role] || String(role || "staff").replace(/_/g, " ");
}

function formatNeeds(lead) {
  const needs = Array.isArray(lead.hiringNeeds) ? lead.hiringNeeds : [];

  if (needs.length > 1) {
    return needs
      .map((need) => `${need.quantity || 1} ${formatRole(need.role)}`)
      .join(", ");
  }

  const need = lead.primaryNeed || needs[0] || {};
  return `${need.quantity || 1} ${formatRole(need.role || "staff")}`;
}

export default function EmployerLeadCard({
  lead,
  onStatusChange,
  onVerificationChange,
  onFindWorkers,
  actionLoading,
}) {
  const need = lead.primaryNeed || lead.hiringNeeds?.[0] || {};
  const isBusy = actionLoading === lead.id;

  const salary =
    need.salaryMin && need.salaryMax
      ? `NPR ${Number(need.salaryMin).toLocaleString()}–${Number(
          need.salaryMax
        ).toLocaleString()}`
      : "Salary not mentioned";

  const verificationStatus = lead.verificationStatus || "needs_call";
  const needsCall = lead.needsCall !== false;

  function markVerified() {
    onVerificationChange?.(lead, {
      verificationStatus: "verified",
      salaryVerified: true,
      phoneVerified: true,
      needsCall: false,
      hrNotes: "Verified from dashboard.",
    });
  }

  function markCalled() {
    onVerificationChange?.(lead, {
      verificationStatus: "called",
      needsCall: false,
      hrNotes: "Called from dashboard.",
    });
  }

  function markNeedsCall() {
    onVerificationChange?.(lead, {
      verificationStatus: "needs_call",
      needsCall: true,
      hrNotes: "Needs HR follow-up call.",
    });
  }

  return (
    <div className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-emerald-200 hover:shadow-xl hover:shadow-slate-200/70 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-500/30 dark:hover:shadow-emerald-950/20">
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
            <Building2 size={22} />
          </div>

          <div>
            <h3 className="font-black text-slate-950 dark:text-white">
              {lead.businessName}
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {lead.contactPerson} • {lead.phone}
            </p>

            <div className="mt-2 flex flex-wrap gap-2">
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                {verificationStatuses[verificationStatus] || verificationStatus}
              </span>
              {needsCall ? (
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                  Needs Call
                </span>
              ) : null}
              {lead.salaryVerified ? (
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                  Salary Verified
                </span>
              ) : null}
              {lead.phoneVerified ? (
                <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-black text-purple-700 dark:bg-purple-500/10 dark:text-purple-300">
                  Phone Verified
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <LeadStatusBadge status={lead.leadStatus} />
      </div>

      <div className="mt-5 grid gap-3 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-2">
        <Info icon={Users} label="Need" value={formatNeeds(lead)} />
        <Info
          icon={MapPin}
          label="Location"
          value={`${lead.location?.area || "-"}, ${lead.location?.district || "-"}`}
        />
        <Info icon={Wallet} label="Salary" value={salary} />
        <Info icon={Phone} label="Urgency" value={lead.urgencyLevel || "unknown"} />
      </div>

      {lead.hrNotes ? (
        <div className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-600 dark:bg-slate-950/60 dark:text-slate-300">
          HR note: {lead.hrNotes}
        </div>
      ) : null}

      <div className="mt-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Lead Score
          </p>
          <div className="mt-2 h-2 w-40 rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-emerald-500 to-green-500"
              style={{ width: `${Math.min(lead.score || 0, 100)}%` }}
            />
          </div>
        </div>

        <button
          onClick={() => onStatusChange?.(lead, "hot")}
          disabled={isBusy}
          className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-950 dark:hover:bg-emerald-300"
        >
          {isBusy ? "Updating..." : "Mark Hot"}
        </button>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-4">
        {nextStatuses.map((item) => (
          <button
            key={item.value}
            onClick={() => onStatusChange?.(lead, item.value)}
            disabled={isBusy}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {item.value === "converted" ? <CheckCircle2 size={14} /> : null}
            {item.value === "follow_up" ? <RefreshCcw size={14} /> : null}
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <button
          onClick={markCalled}
          disabled={isBusy}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-blue-700 transition hover:bg-blue-50 disabled:opacity-60 dark:border-blue-500/20 dark:bg-slate-950 dark:text-blue-300"
        >
          <Phone size={14} />
          Mark Called
        </button>
        <button
          onClick={markVerified}
          disabled={isBusy}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-white px-3 py-2 text-xs font-bold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-60 dark:border-emerald-500/20 dark:bg-slate-950 dark:text-emerald-300"
        >
          <ShieldCheck size={14} />
          Mark Verified
        </button>
        <button
          onClick={markNeedsCall}
          disabled={isBusy}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-white px-3 py-2 text-xs font-bold text-amber-700 transition hover:bg-amber-50 disabled:opacity-60 dark:border-amber-500/20 dark:bg-slate-950 dark:text-amber-300"
        >
          <UserCheck size={14} />
          Needs Call
        </button>
        <button
          onClick={() => onFindWorkers?.(lead)}
          disabled={isBusy}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300"
        >
          <Search size={14} />
          Find Workers
        </button>
      </div>
    </div>
  );
}

function Info({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950/60">
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
