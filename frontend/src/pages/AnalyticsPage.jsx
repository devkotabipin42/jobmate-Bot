import {
  BarChart,
  Bar,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import { RefreshCcw, TrendingUp } from "lucide-react";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import { useAnalytics } from "../hooks/useAnalytics";

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6"];

export default function AnalyticsPage() {
  const { summary, employerLeads, workers, handoffs, loading, error, refetch } =
    useAnalytics();

  const metrics = summary?.metrics || {};

  const overviewData = [
    { name: "Employers", value: metrics.totalEmployerLeads || 0 },
    { name: "Workers", value: metrics.totalWorkers || 0 },
    { name: "Handoffs", value: metrics.openHandoffs || 0 },
    { name: "Messages", value: metrics.todayMessages || 0 },
  ];

  const leadStatusData = groupByField(employerLeads, "leadStatus");
  const workerStatusData = groupByField(workers, "profileStatus");
  const handoffPriorityData = groupByField(handoffs, "priority");

  const conversionData = [
    {
      name: "Contacts",
      value: metrics.totalContacts || 0,
    },
    {
      name: "Employer Leads",
      value: metrics.totalEmployerLeads || 0,
    },
    {
      name: "Hot Leads",
      value: metrics.hotEmployerLeads || 0,
    },
    {
      name: "Urgent Handoffs",
      value: metrics.urgentHandoffs || 0,
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="flex items-center gap-2 text-xl font-black text-slate-950 dark:text-white">
                <TrendingUp size={22} />
                Analytics Overview
              </h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Lead quality, worker status, handoff priority and WhatsApp activity.
              </p>
            </div>

            <button
              onClick={refetch}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <RefreshCcw size={16} />
              Refresh
            </button>
          </div>
        </section>

        {loading ? (
          <StateCard text="Loading analytics..." />
        ) : error ? (
          <StateCard text={error} danger />
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MiniMetric
                label="Total Contacts"
                value={metrics.totalContacts}
                sub="WhatsApp users"
              />
              <MiniMetric
                label="Hot Leads"
                value={metrics.hotEmployerLeads}
                sub="Employer priority"
              />
              <MiniMetric
                label="Qualified Workers"
                value={metrics.qualifiedWorkers}
                sub="Ready candidates"
              />
              <MiniMetric
                label="Urgent Handoffs"
                value={metrics.urgentHandoffs}
                sub="Need follow-up"
              />
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
              <ChartCard title="Operations Overview">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={overviewData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="name" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[12, 12, 0, 0]} fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Conversion Funnel">
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={conversionData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="name" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#10b981"
                      strokeWidth={4}
                      dot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Employer Lead Status">
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={leadStatusData}
                      dataKey="value"
                      nameKey="name"
                      outerRadius={95}
                      label
                    >
                      {leadStatusData.map((_, index) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Worker Profile Status">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={workerStatusData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="name" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[12, 12, 0, 0]} fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Handoff Priority">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={handoffPriorityData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="name" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[12, 12, 0, 0]} fill="#f59e0b" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </section>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function MiniMetric({ label, value, sub }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="mt-3 text-4xl font-black text-slate-950 dark:text-white">
        {value ?? 0}
      </p>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{sub}</p>
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h3 className="mb-5 font-black text-slate-950 dark:text-white">
        {title}
      </h3>
      {children}
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

function groupByField(items = [], field) {
  const map = new Map();

  for (const item of items) {
    const key = item[field] || "unknown";
    map.set(key, (map.get(key) || 0) + 1);
  }

  const data = Array.from(map.entries()).map(([name, value]) => ({
    name,
    value,
  }));

  return data.length ? data : [{ name: "No data", value: 1 }];
}
