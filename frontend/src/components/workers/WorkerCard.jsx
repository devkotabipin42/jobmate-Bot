import {
  BadgeCheck,
  Briefcase,
  CalendarClock,
  FileCheck2,
  MapPin,
  Phone,
  User,
  UserCheck,
} from "lucide-react";
import WorkerStatusBadge from "./WorkerStatusBadge";

const nextStatuses = [
  { label: "Qualified", value: "qualified" },
  { label: "Verified", value: "verified" },
  { label: "Matched", value: "matched" },
  { label: "Placed", value: "placed" },
  { label: "Inactive", value: "inactive" },
];

export default function WorkerCard({
  worker,
  onStatusChange,
  actionLoading,
}) {
  const isBusy = actionLoading === worker.id;

  const preferences =
    worker.jobPreferences?.length > 0
      ? worker.jobPreferences.join(", ")
      : "Not selected";

  return (
    <div className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl hover:shadow-slate-200/70 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-500/30 dark:hover:shadow-blue-950/20">
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
            <User size={22} />
          </div>

          <div>
            <h3 className="font-black text-slate-950 dark:text-white">
              {worker.fullName}
            </h3>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
              <Phone size={14} />
              {worker.phone}
            </p>
          </div>
        </div>

        <WorkerStatusBadge status={worker.profileStatus} />
      </div>

      <div className="mt-5 grid gap-3 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-2">
        <Info icon={Briefcase} label="Job Preference" value={preferences} />
        <Info
          icon={MapPin}
          label="Location"
          value={`${worker.location?.district || "-"}, ${
            worker.location?.province || "-"
          }`}
        />
        <Info
          icon={CalendarClock}
          label="Availability"
          value={worker.availability || "unknown"}
        />
        <Info
          icon={FileCheck2}
          label="Documents"
          value={worker.documentStatus || "unknown"}
        />
      </div>

      <div className="mt-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Worker Score
          </p>
          <div className="mt-2 h-2 w-40 rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500"
              style={{ width: `${Math.min(worker.score || 0, 100)}%` }}
            />
          </div>
        </div>

        <button
          onClick={() => onStatusChange?.(worker, "verified")}
          disabled={isBusy}
          className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-950 dark:hover:bg-blue-300"
        >
          <UserCheck size={16} />
          {isBusy ? "Updating..." : "Verify"}
        </button>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-5">
        {nextStatuses.map((item) => (
          <button
            key={item.value}
            onClick={() => onStatusChange?.(worker, item.value)}
            disabled={isBusy}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {item.value === "placed" ? <BadgeCheck size={14} /> : null}
            {item.label}
          </button>
        ))}
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
