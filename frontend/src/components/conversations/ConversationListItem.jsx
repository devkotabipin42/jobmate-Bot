import { Building2, User, MessageCircle } from "lucide-react";

export default function ConversationListItem({ item, active, onClick }) {
  const isEmployer = item.contactType === "employer";
  const latestText = item.latestMessage?.text || "No messages yet";

  return (
    <button
      onClick={onClick}
      className={`w-full rounded-3xl border p-4 text-left transition ${
        active
          ? "border-emerald-200 bg-emerald-50 shadow-sm dark:border-emerald-500/30 dark:bg-emerald-500/10"
          : "border-slate-200 bg-white hover:border-emerald-100 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-500/20 dark:hover:bg-slate-800"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
            isEmployer
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
              : "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"
          }`}
        >
          {isEmployer ? <Building2 size={20} /> : <User size={20} />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate font-black text-slate-950 dark:text-white">
              {item.displayName}
            </p>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
              {item.messageCount || 0}
            </span>
          </div>

          <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
            {item.phone} • {item.contactType}
          </p>

          <p className="mt-2 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">
            <MessageCircle className="mr-1 inline" size={13} />
            {latestText}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {item.currentIntent}
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {item.botMode}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}
