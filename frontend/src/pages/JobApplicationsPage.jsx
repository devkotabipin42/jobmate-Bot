import { useEffect, useMemo, useState } from "react";
import {
  Briefcase,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Eye,
  MapPin,
  Phone,
  RefreshCw,
  UserCheck,
  X,
  XCircle,
} from "lucide-react";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import {
  getJobApplicationDetail,
  listJobApplications,
  updateJobApplicationStatus,
} from "../services/jobApplicationsApi";

const STATUS_OPTIONS = [
  "interest_submitted",
  "reviewing",
  "shortlisted",
  "contacted",
  "interview_scheduled",
  "selected",
  "rejected",
];

const STATUS_LABELS = {
  interest_submitted: "Interest Submitted",
  reviewing: "Reviewing",
  shortlisted: "Shortlisted",
  contacted: "Contacted",
  interview_scheduled: "Interview Scheduled",
  selected: "Selected",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

function statusTone(status) {
  if (status === "selected") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300";
  if (status === "rejected") return "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300";
  if (status === "contacted" || status === "shortlisted") return "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300";
  if (status === "interview_scheduled") return "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300";
  return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300";
}

function formatSalary(app) {
  if (app.salaryMin && app.salaryMax && app.salaryMin !== app.salaryMax) {
    return `Rs ${Number(app.salaryMin).toLocaleString("en-IN")} - ${Number(app.salaryMax).toLocaleString("en-IN")}`;
  }

  if (app.salaryMin || app.salaryMax) {
    return `Rs ${Number(app.salaryMin || app.salaryMax).toLocaleString("en-IN")}`;
  }

  return "Salary not mentioned";
}

export default function JobApplicationsPage() {
  const [applications, setApplications] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [error, setError] = useState("");

  async function loadApplications() {
    try {
      setLoading(true);
      setError("");
      const data = await listJobApplications({
        status: statusFilter,
        limit: 100,
      });
      setApplications(data.applications || []);
    } catch (err) {
      setError(err.message || "Failed to load applications");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadApplications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  async function handleStatusChange(application, nextStatus) {
    if (!nextStatus || nextStatus === application.status) return;

    try {
      setUpdatingId(application.id);
      await updateJobApplicationStatus(application.id, {
        status: nextStatus,
        notes: application.notes || "",
      });
      await loadApplications();

      if (selectedDetail?.id === application.id) {
        await openDetail(application.id);
      }
    } catch (err) {
      setError(err.message || "Failed to update status");
    } finally {
      setUpdatingId("");
    }
  }

  async function openDetail(id) {
    try {
      setDetailLoading(true);
      setError("");
      const data = await getJobApplicationDetail(id);
      setSelectedDetail(data.application);
    } catch (err) {
      setError(err.message || "Failed to load application detail");
    } finally {
      setDetailLoading(false);
    }
  }

  const counts = useMemo(() => {
    return applications.reduce(
      (acc, app) => {
        acc.total += 1;
        acc[app.status] = (acc[app.status] || 0) + 1;
        return acc;
      },
      { total: 0 }
    );
  }, [applications]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <section className="grid gap-4 md:grid-cols-3">
          <StatCard title="Total Applications" value={counts.total || 0} icon={Briefcase} tone="emerald" />
          <StatCard title="Need Review" value={(counts.interest_submitted || 0) + (counts.reviewing || 0)} icon={Clock3} tone="amber" />
          <StatCard title="Selected" value={counts.selected || 0} icon={CheckCircle2} tone="blue" />
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-lg font-black text-slate-950 dark:text-white">
                Job Applications / Interested Workers
              </h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Workers who selected a job from WhatsApp Aarati.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="">All statuses</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </option>
                ))}
              </select>

              <button
                onClick={loadApplications}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-bold text-white dark:bg-white dark:text-slate-950"
              >
                <RefreshCw size={16} />
                Refresh
              </button>
            </div>
          </div>

          {error ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
              {error}
            </div>
          ) : null}

          <div className="mt-5">
            {loading ? (
              <StateCard text="Loading job applications..." />
            ) : applications.length === 0 ? (
              <StateCard text="No job applications yet." />
            ) : (
              <div className="grid gap-4">
                {applications.map((application) => (
                  <ApplicationCard
                    key={application.id}
                    application={application}
                    updating={updatingId === application.id}
                    onStatusChange={handleStatusChange}
                    onViewDetail={openDetail}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        <ApplicationDetailModal
          open={Boolean(selectedDetail) || detailLoading}
          loading={detailLoading}
          application={selectedDetail}
          onClose={() => setSelectedDetail(null)}
          onStatusChange={handleStatusChange}
          updating={Boolean(updatingId)}
        />
      </div>
    </DashboardLayout>
  );
}

function ApplicationCard({ application, updating, onStatusChange, onViewDetail }) {
  return (
    <div className="rounded-3xl border border-slate-100 bg-slate-50/70 p-5 transition hover:border-emerald-100 hover:bg-emerald-50/40 dark:border-slate-800 dark:bg-slate-950/50 dark:hover:border-emerald-500/20 dark:hover:bg-emerald-500/5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-black ${statusTone(application.status)}`}>
              {STATUS_LABELS[application.status] || application.status}
            </span>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-500 shadow-sm dark:bg-slate-800 dark:text-slate-300">
              {application.source}
            </span>
          </div>

          <h4 className="mt-3 text-lg font-black text-slate-950 dark:text-white">
            {application.jobTitle || "Untitled Job"}
          </h4>
          <p className="mt-1 text-sm font-semibold text-slate-600 dark:text-slate-300">
            {application.companyName || "Company not mentioned"}
          </p>

          <div className="mt-4 grid gap-2 text-sm text-slate-500 dark:text-slate-400 md:grid-cols-2 xl:grid-cols-4">
            <Info icon={Phone} label="Worker" value={application.workerPhone || "-"} />
            <Info icon={MapPin} label="Location" value={application.location || "-"} />
            <Info icon={CalendarClock} label="Applied" value={application.appliedDateLabel || "-"} />
            <Info icon={Briefcase} label="Salary" value={formatSalary(application)} />
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 lg:w-72">
          <label className="text-xs font-bold uppercase tracking-wide text-slate-400">
            Update status
          </label>
          <select
            value={application.status}
            disabled={updating}
            onChange={(event) => onStatusChange(application, event.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>

          <div className="grid grid-cols-3 gap-2">
            <QuickButton icon={Eye} label="View" disabled={updating} onClick={() => onViewDetail(application.id)} />
            <QuickButton icon={UserCheck} label="Contacted" disabled={updating} onClick={() => onStatusChange(application, "contacted")} />
            <QuickButton icon={XCircle} label="Rejected" disabled={updating} onClick={() => onStatusChange(application, "rejected")} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ApplicationDetailModal({ open, loading, application, onClose, onStatusChange, updating }) {
  if (!open) return null;

  const selectedJob = application?.metadata?.selectedJob || {};
  const aaratiProfile = application?.metadata?.aaratiProfile || {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-center justify-between border-b border-slate-200 p-5 dark:border-slate-800">
          <div>
            <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
              Job Application Detail
            </p>
            <h3 className="text-xl font-black text-slate-950 dark:text-white">
              {loading ? "Loading..." : application?.jobTitle || "Application"}
            </h3>
          </div>

          <button
            onClick={onClose}
            className="rounded-2xl bg-slate-100 p-2 text-slate-600 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-300"
          >
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm font-semibold text-slate-500">
            Loading application detail...
          </div>
        ) : (
          <div className="max-h-[calc(90vh-90px)] overflow-y-auto p-5">
            <div className="grid gap-4 lg:grid-cols-3">
              <DetailSection title="Application">
                <DetailRow label="Status" value={STATUS_LABELS[application?.status] || application?.status} />
                <DetailRow label="Applied" value={application?.appliedDateLabel || "-"} />
                <DetailRow label="Last Update" value={application?.lastStatusLabel || "-"} />
                <DetailRow label="Source" value={application?.source || "-"} />
              </DetailSection>

              <DetailSection title="Worker">
                <DetailRow label="Phone" value={application?.workerPhone || "-"} />
                <DetailRow label="Worker ID" value={String(application?.workerId || "-")} />
                <DetailRow label="Contact ID" value={String(application?.contactId || "-")} />
              </DetailSection>

              <DetailSection title="Job">
                <DetailRow label="Title" value={application?.jobTitle || "-"} />
                <DetailRow label="Company" value={application?.companyName || "-"} />
                <DetailRow label="Location" value={application?.location || "-"} />
                <DetailRow label="Salary" value={formatSalary(application || {})} />
              </DetailSection>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <DetailSection title="Selected Job Snapshot">
                <DetailRow label="Category" value={selectedJob.category || "-"} />
                <DetailRow label="Type" value={selectedJob.type || "-"} />
                <DetailRow label="Experience" value={selectedJob.experience || "-"} />
                <DetailRow label="Deadline" value={selectedJob.deadline ? new Date(selectedJob.deadline).toLocaleDateString() : "-"} />
                <DetailRow label="Verified" value={selectedJob.is_verified ? "Yes" : "No"} />
                <DetailRow label="Active" value={selectedJob.is_active ? "Yes" : "No"} />
              </DetailSection>

              <DetailSection title="Aarati Profile Context">
                <DetailRow label="Preferred Location" value={aaratiProfile.location || "-"} />
                <DetailRow label="District" value={aaratiProfile.district || "-"} />
                <DetailRow label="Job Type" value={aaratiProfile.jobType || "-"} />
                <DetailRow label="Availability" value={aaratiProfile.availability || "-"} />
                <DetailRow label="Documents" value={aaratiProfile.documents || "-"} />
                <DetailRow label="Applying to selected job" value={aaratiProfile.isApplyingToSelectedJob ? "Yes" : "No"} />
              </DetailSection>
            </div>

            <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Update Status
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {STATUS_OPTIONS.map((status) => (
                  <button
                    key={status}
                    disabled={updating || status === application?.status}
                    onClick={() => onStatusChange(application, status)}
                    className={`rounded-2xl px-4 py-2 text-xs font-black transition ${
                      status === application?.status
                        ? "bg-emerald-600 text-white"
                        : "bg-white text-slate-700 hover:bg-emerald-50 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-emerald-500/10"
                    } disabled:opacity-60`}
                  >
                    {STATUS_LABELS[status]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailSection({ title, children }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
      <h4 className="text-sm font-black text-slate-950 dark:text-white">{title}</h4>
      <div className="mt-3 space-y-2">{children}</div>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl bg-white px-3 py-2 dark:bg-slate-950">
      <span className="text-xs font-bold uppercase tracking-wide text-slate-400">
        {label}
      </span>
      <span className="text-right text-sm font-semibold text-slate-700 dark:text-slate-200">
        {value}
      </span>
    </div>
  );
}

function Info({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2 dark:bg-slate-900">
      <Icon size={15} className="shrink-0 text-emerald-500" />
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
          {label}
        </p>
        <p className="truncate font-semibold text-slate-700 dark:text-slate-200">
          {value}
        </p>
      </div>
    </div>
  );
}

function QuickButton({ icon: Icon, label, disabled, onClick }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-emerald-500/10"
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
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
            {title}
          </p>
          <p className="mt-2 text-3xl font-black text-slate-950 dark:text-white">
            {value}
          </p>
        </div>
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${
            tones[tone] || tones.emerald
          } text-white shadow-lg`}
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
