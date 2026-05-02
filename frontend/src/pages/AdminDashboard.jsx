import {
  Building2,
  Users,
  PhoneCall,
  MessageCircle,
  ArrowUpRight,
} from "lucide-react";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import MetricCard from "../components/dashboard/MetricCard";
import { useDashboardSummary } from "../hooks/useDashboardSummary";

const DASHBOARD_MODE =
  import.meta.env.VITE_DASHBOARD_MODE || "jobmate_admin";

export default function AdminDashboard() {
  const { data, loading, error, refetch } = useDashboardSummary();

  const metrics = data?.metrics || {};
  const latest = data?.latest || {};

  return (
    <DashboardLayout>
      {loading ? (
        <StateCard title="Loading dashboard..." />
      ) : error ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-red-700">
          <p className="font-bold">Dashboard load failed</p>
          <p className="mt-1 text-sm">{error}</p>
          <button
            onClick={refetch}
            className="mt-4 rounded-2xl bg-red-600 px-4 py-2 text-sm font-bold text-white"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="space-y-7">
          {DASHBOARD_MODE === "business_receptionist" ? (
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                title="Business Leads"
                value={metrics.totalBusinessLeads || 0}
                subtitle={`${metrics.newBusinessLeads || 0} new leads`}
                icon={MessageCircle}
                tone="emerald"
              />
              <MetricCard
                title="Need Follow-up"
                value={metrics.humanNeededBusinessLeads || 0}
                subtitle={`${metrics.contactedBusinessLeads || 0} contacted`}
                icon={PhoneCall}
                tone="amber"
              />
              <MetricCard
                title="Booked"
                value={metrics.bookedBusinessLeads || 0}
                subtitle="confirmed bookings"
                icon={Building2}
                tone="blue"
              />
              <MetricCard
                title="Messages Today"
                value={metrics.todayMessages}
                subtitle={`${metrics.totalContacts || 0} contacts`}
                icon={MessageCircle}
                tone="rose"
              />
            </section>
          ) : (
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
              <MetricCard
                title="Employer Leads"
                value={metrics.totalEmployerLeads}
                subtitle={`${metrics.hotEmployerLeads || 0} hot leads`}
                icon={Building2}
                tone="emerald"
              />
              <MetricCard
                title="Workers"
                value={metrics.totalWorkers}
                subtitle={`${metrics.qualifiedWorkers || 0} qualified`}
                icon={Users}
                tone="blue"
              />
              <MetricCard
                title="Open Handoffs"
                value={metrics.openHandoffs}
                subtitle={`${metrics.urgentHandoffs || 0} urgent`}
                icon={PhoneCall}
                tone="amber"
              />
              <MetricCard
                title="Messages Today"
                value={metrics.todayMessages}
                subtitle={`${metrics.totalContacts || 0} contacts`}
                icon={MessageCircle}
                tone="rose"
              />
              <MetricCard
                title="Business Leads"
                value={metrics.totalBusinessLeads || 0}
                subtitle={`${metrics.newBusinessLeads || 0} new leads`}
                icon={MessageCircle}
                tone="emerald"
              />
              <MetricCard
                title="Need Follow-up"
                value={metrics.humanNeededBusinessLeads || 0}
                subtitle={`${metrics.contactedBusinessLeads || 0} contacted`}
                icon={PhoneCall}
                tone="amber"
              />
            </section>
          )}

          {DASHBOARD_MODE === "business_receptionist" ? (
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h3 className="text-lg font-black text-slate-950 dark:text-white">
                WhatsApp AI Receptionist Overview
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                Customer inquiries, bookings, follow-ups and WhatsApp conversations are captured here.
                Open Business Leads to contact customers, mark bookings, or close completed inquiries.
              </p>
            </section>
          ) : (
            <section className="grid gap-6 xl:grid-cols-3">
              <LatestPanel
                title="Hot Employer Leads"
                description="Latest businesses from WhatsApp"
                items={(latest.employerLeads || []).map((lead) => ({
                  title: lead.businessName,
                  subtitle: `${lead.location?.area || "-"} • ${lead.urgencyLevel}`,
                  badge: lead.leadStatus,
                  score: lead.score,
                }))}
              />

              <LatestPanel
                title="Worker Profiles"
                description="Recently registered candidates"
                items={(latest.workers || []).map((worker) => ({
                  title: worker.fullName,
                  subtitle: `${worker.location?.district || "-"} • ${worker.availability}`,
                  badge: worker.profileStatus,
                  score: worker.score,
                }))}
              />

              <LatestPanel
                title="Call Queue"
                description="Handoffs that need human action"
                items={(latest.handoffs || []).map((handoff) => ({
                  title: handoff.reason,
                  subtitle: `${handoff.callStatus} • ${
                    handoff.callRequired ? "Call required" : "No call"
                  }`,
                  badge: handoff.priority,
                }))}
              />
            </section>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}

function LatestPanel({ title, description, items = [] }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-black text-slate-950 dark:text-white">{title}</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
        </div>
        <button className="rounded-2xl bg-slate-100 p-2 text-slate-600 dark:text-slate-300 hover:bg-emerald-50 hover:text-emerald-700">
          <ArrowUpRight size={17} />
        </button>
      </div>

      <div className="mt-5 space-y-3">
        {items.length === 0 ? (
          <StateCard title="No data yet." compact />
        ) : (
          items.map((item, index) => (
            <div
              key={`${item.title}-${index}`}
              className="rounded-2xl border border-slate-100 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-950/50 p-4 transition hover:border-emerald-100 hover:bg-emerald-50/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-slate-900 dark:text-slate-100">{item.title}</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{item.subtitle}</p>
                </div>
                <span className="rounded-full bg-white px-3 dark:bg-slate-800 py-1 text-xs font-bold text-slate-600 dark:text-slate-300 shadow-sm">
                  {item.badge}
                </span>
              </div>

              {typeof item.score === "number" ? (
                <div className="mt-3 h-2 rounded-full bg-slate-200 dark:bg-slate-800">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-emerald-500 to-green-500"
                    style={{ width: `${Math.min(item.score, 100)}%` }}
                  />
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function StateCard({ title, compact = false }) {
  return (
    <div
      className={`rounded-3xl border border-dashed border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 text-slate-500 dark:text-slate-400 ${
        compact ? "p-4 text-sm" : "p-8"
      }`}
    >
      {title}
    </div>
  );
}
