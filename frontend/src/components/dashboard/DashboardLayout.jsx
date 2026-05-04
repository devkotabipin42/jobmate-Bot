import {
  LayoutDashboard,
  Building2,
  ClipboardList,
  Users,
  PhoneCall,
  MessageCircle,
  BarChart3,
  Settings,
  Bot,
  Search,
  Bell,
  FileCheck2,
  Brain,
  Moon,
  Sun,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useTheme } from "../../hooks/useTheme";
import { useAdminNotifications } from "../../hooks/useAdminNotifications";

const DASHBOARD_MODE =
  import.meta.env.VITE_DASHBOARD_MODE || "jobmate_admin";

const jobMateNavItems = [
  { label: "Overview", icon: LayoutDashboard, to: "/admin" },
  { label: "Leads", fullLabel: "Employer Leads", icon: Building2, to: "/admin/employer-leads" },
  { label: "Business", fullLabel: "Business Leads", icon: ClipboardList, to: "/admin/business-leads" },
  { label: "Workers", icon: Users, to: "/admin/workers" },
  { label: "Applications", fullLabel: "Job Applications", icon: FileCheck2, to: "/admin/job-applications" },
  { label: "Knowledge", fullLabel: "Pending Knowledge", icon: Brain, to: "/admin/pending-knowledge" },
  { label: "Calls", fullLabel: "Handoffs", icon: PhoneCall, to: "/admin/handoffs" },
  { label: "Chats", fullLabel: "Conversations", icon: MessageCircle, to: "/admin/conversations" },
  { label: "Analytics", icon: BarChart3, to: "/admin/analytics" },
  { label: "Settings", icon: Settings, to: "/admin/settings" },
];

const businessReceptionistNavItems = [
  { label: "Overview", icon: LayoutDashboard, to: "/admin" },
  { label: "Business Leads", icon: ClipboardList, to: "/admin/business-leads" },
  { label: "Chats", fullLabel: "Conversations", icon: MessageCircle, to: "/admin/conversations" },
  { label: "Settings", icon: Settings, to: "/admin/settings" },
];

const navItems =
  DASHBOARD_MODE === "business_receptionist"
    ? businessReceptionistNavItems
    : jobMateNavItems;

const mobileNavItems = navItems.slice(0, 5);

const pageTitles = {
  "/admin": {
    label: "Operations Dashboard",
    title:
      DASHBOARD_MODE === "business_receptionist"
        ? "WhatsApp AI Receptionist"
        : "JobMate AI Hiring Command Center",
    description:
      DASHBOARD_MODE === "business_receptionist"
        ? "Customer inquiries, bookings, and follow-ups captured from WhatsApp."
        : "Monitor WhatsApp leads, workers, calls and AI conversations.",
  },
  "/admin/employer-leads": {
    label: "Employer CRM",
    title: "Employer Leads",
    description: "Manage hiring requests collected from WhatsApp.",
  },
  "/admin/business-leads": {
    eyebrow: "Business Receptionist",
    title: "Business Leads",
    description: "Customer inquiries, bookings, and follow-ups captured by the WhatsApp AI Receptionist.",
  },

  "/admin/workers": {
    label: "Worker CRM",
    title: "Worker Profiles",
    description: "Track job seekers, availability and verification status.",
  },
  "/admin/handoffs": {
    label: "Call Operations",
    title: "Handoff Queue",
    description: "Follow up urgent employer and worker requests.",
  },
  "/admin/conversations": {
    label: "Inbox",
    title: "WhatsApp Conversations",
    description: "View user messages, bot replies and conversation context.",
  },
  "/admin/analytics": {
    label: "Insights",
    title: "Analytics",
    description: "Understand conversion, lead quality and bot performance.",
  },
  "/admin/settings": {
    label: "System",
    title: "Settings",
    description:
      DASHBOARD_MODE === "business_receptionist"
        ? "Manage your WhatsApp assistant, business info and customer replies."
        : "Manage WhatsApp, AI, team and system preferences.",
  },
};

export default function DashboardLayout({ children }) {
  const { isDark, toggleTheme } = useTheme();
  const notifications = useAdminNotifications();

  function handleLogout() {
    localStorage.removeItem("jobmate-admin-token");
    localStorage.removeItem("jobmate-admin-user");
    window.location.href = "/admin/login";
  }
  const location = useLocation();
  const current = pageTitles[location.pathname] || pageTitles["/admin"];

  return (
    <div className="min-h-screen bg-[#F7FAF8] text-slate-950 dark:bg-slate-950 dark:text-slate-100">
      <aside className="fixed left-0 top-0 hidden h-screen w-72 border-r border-slate-200/80 bg-white/95 p-5 shadow-sm backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/95 lg:block">
        <BrandBlock />

        <nav className="mt-6 space-y-1.5">
          {navItems.map((item) => (
            <SidebarLink key={item.to} item={item} />
          ))}
        </nav>

        <div className="absolute bottom-5 left-5 right-5 rounded-3xl border border-emerald-100 bg-emerald-50 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/10">
          <p className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
            WhatsApp Live
          </p>
          <p className="mt-1 text-xs leading-5 text-emerald-700 dark:text-emerald-300">
            {DASHBOARD_MODE === "business_receptionist"
                ? "AI bot, customer leads, bookings and conversations connected."
                : "AI bot, employer leads, workers, calls and conversations connected."}
          </p>
          <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            System online
          </div>
        </div>
      </aside>

      <main className="pb-24 lg:pb-0 lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/90 sm:px-5 sm:py-4">
          <div className="flex items-center justify-between gap-3 lg:hidden">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-green-500 text-white shadow-lg shadow-emerald-500/20">
                <Bot size={21} />
              </div>
              <div>
                <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    {DASHBOARD_MODE === "business_receptionist" ? "AI" : "JobMate"}
                </p>
                <h1 className="text-sm font-black text-slate-950 dark:text-white">
                    {DASHBOARD_MODE === "business_receptionist" ? "Receptionist OS" : "AI Hiring OS"}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <ThemeButton isDark={isDark} toggleTheme={toggleTheme} />
              <NotificationButton count={notifications.count} />
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-4 lg:mt-0 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 sm:text-sm">
                {current.label}
              </p>
              <h2 className="text-xl font-black tracking-tight text-slate-950 dark:text-white sm:text-2xl">
                {current.title}
              </h2>
              <p className="mt-1 hidden text-sm text-slate-500 dark:text-slate-400 sm:block">
                {current.description}
              </p>
            </div>

            <div className="hidden items-center gap-3 lg:flex">
              <div className="items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900 lg:flex">
                <Search size={17} className="text-slate-400" />
                <span className="text-sm text-slate-400">
                    {DASHBOARD_MODE === "business_receptionist"
                      ? "Search customers, leads..."
                      : "Search leads, workers..."}
                </span>
              </div>

              <ThemeButton isDark={isDark} toggleTheme={toggleTheme} />
              <NotificationButton count={notifications.count} />

              <button
                onClick={handleLogout}
                className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white dark:bg-white dark:text-slate-950"
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        <div className="p-4 sm:p-5 lg:p-7">{children}</div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/95 px-2 py-2 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/95 lg:hidden">
        <div className="grid grid-cols-5 gap-1">
          {mobileNavItems.map((item) => (
            <MobileNavLink key={item.to} item={item} />
          ))}
        </div>
      </nav>
    </div>
  );
}

function BrandBlock() {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-br from-emerald-600 to-green-500 p-4 text-white shadow-lg shadow-emerald-500/20">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20">
        <Bot size={24} />
      </div>
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-50">
            {DASHBOARD_MODE === "business_receptionist" ? "AI" : "JobMate"}
        </p>
          <h1 className="text-lg font-bold leading-tight">
            {DASHBOARD_MODE === "business_receptionist"
              ? "Receptionist OS"
              : "AI Hiring OS"}
          </h1>
      </div>
    </div>
  );
}

function SidebarLink({ item }) {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.to}
      end={item.to === "/admin"}
      className={({ isActive }) =>
        `flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${
          isActive
            ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20"
            : "text-slate-600 hover:bg-slate-50 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white"
        }`
      }
    >
      <Icon size={18} />
      {item.fullLabel || item.label}
    </NavLink>
  );
}

function MobileNavLink({ item }) {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.to}
      end={item.to === "/admin"}
      className={({ isActive }) =>
        `flex flex-col items-center justify-center rounded-2xl px-2 py-2 text-[11px] font-bold transition ${
          isActive
            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
            : "text-slate-500 dark:text-slate-400"
        }`
      }
    >
      <Icon size={18} />
      <span className="mt-1">{item.label}</span>
    </NavLink>
  );
}

function ThemeButton({ isDark, toggleTheme }) {
  return (
    <button
      onClick={toggleTheme}
      className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-600 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
      title="Toggle theme"
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}

function NotificationButton({ count = 0 }) {
  return (
    <a
      href="/admin/handoffs"
      className="relative rounded-2xl border border-slate-200 bg-white p-3 text-slate-600 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
      title="Urgent handoffs"
    >
      <Bell size={18} />

      {count > 0 ? (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-black text-white ring-2 ring-white dark:ring-slate-900">
          {count > 99 ? "99+" : count}
        </span>
      ) : (
        <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
      )}
    </a>
  );
}
