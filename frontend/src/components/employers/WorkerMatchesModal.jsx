import { X, Phone, MapPin, Briefcase, BadgeCheck, Link2 } from "lucide-react";

function reasonLabel(reason = "") {
  const labels = {
    same_area: "Same area",
    same_district: "Same district",
    role_match: "Role match",
    immediate_available: "Immediate",
    available_soon: "Available soon",
    available_within_2_weeks: "Within 2 weeks",
    documents_ready: "Documents ready",
    verified_profile: "Verified",
    complete_profile: "Complete profile",
  };

  return labels[reason] || reason.replace(/_/g, " ");
}

function roleLabel(role = "") {
  const labels = {
    driver_transport: "Driver / Transport",
    security_guard: "Security Guard",
    hotel_restaurant: "Hotel / Restaurant",
    construction_labor: "Construction / Labor",
    farm_agriculture: "Farm / Agriculture",
    shop_retail: "Shop / Retail",
    it_web: "IT / Web",
    other: "Other",
  };

  return labels[role] || String(role || "-").replace(/_/g, " ");
}

export default function WorkerMatchesModal({
  open,
  loading,
  lead,
  matches = [],
  error,
  creatingKey = "",
  onCreateMatch,
  onClose,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-center justify-between border-b border-slate-200 p-5 dark:border-slate-800">
          <div>
            <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
              Worker Matching
            </p>
            <h3 className="text-xl font-black text-slate-950 dark:text-white">
              {lead?.businessName || "Employer Lead"}
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {lead?.location?.area || "-"}, {lead?.location?.district || "-"}
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-2xl bg-slate-100 p-2 text-slate-600 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-300"
          >
            <X size={20} />
          </button>
        </div>

        <div className="max-h-[calc(90vh-90px)] overflow-y-auto p-5">
          {loading ? (
            <StateCard text="Finding matching workers..." />
          ) : error ? (
            <StateCard text={error} danger />
          ) : matches.length === 0 ? (
            <StateCard text="No matching workers found yet." />
          ) : (
            <div className="grid gap-4">
              {matches.map((match) => (
                <div
                  key={`${match.workerId}-${match.matchedNeed?.role}`}
                  className="rounded-3xl border border-slate-100 bg-slate-50/70 p-5 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                          Match {match.matchScore}
                        </span>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {match.profileStatus}
                        </span>
                      </div>

                      <h4 className="mt-3 text-lg font-black text-slate-950 dark:text-white">
                        {match.workerName || "Worker"}
                      </h4>

                      <div className="mt-4 grid gap-2 text-sm md:grid-cols-2 xl:grid-cols-4">
                        <Info icon={Phone} label="Phone" value={match.phone || "-"} />
                        <Info
                          icon={MapPin}
                          label="Location"
                          value={`${match.location?.area || "-"}, ${match.location?.district || "-"}`}
                        />
                        <Info
                          icon={Briefcase}
                          label="Matched Need"
                          value={`${match.matchedNeed?.quantity || 1} ${match.matchedNeed?.role || "-"}`}
                        />
                        <Info
                          icon={BadgeCheck}
                          label="Preference"
                          value={(match.jobPreferences || []).map(roleLabel).join(", ") || "-"}
                        />
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {(match.matchReasons || []).map((reason) => (
                          <span
                            key={reason}
                            className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                          >
                            {reasonLabel(reason)}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        disabled={creatingKey === `${match.workerId}-${match.matchedNeed?.role || "role"}`}
                        onClick={() => onCreateMatch?.(match)}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                      >
                        <Link2 size={16} />
                        {creatingKey === `${match.workerId}-${match.matchedNeed?.role || "role"}`
                          ? "Creating..."
                          : "Create Match"}
                      </button>

                      <a
                        href={`tel:${match.phone}`}
                        className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-2 text-sm font-bold text-white dark:bg-white dark:text-slate-950"
                      >
                        Call Worker
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Info({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl bg-white p-3 dark:bg-slate-950">
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
