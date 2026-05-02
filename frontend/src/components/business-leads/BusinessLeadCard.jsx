import {
  CalendarDays,
  CheckCircle2,
  Clock,
  MessageCircle,
  Phone,
  ExternalLink,
  UserRound,
} from "lucide-react";

const statusStyles = {
  new: "bg-blue-50 text-blue-700 ring-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/20",
  contacted:
    "bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20",
  booked:
    "bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20",
  closed:
    "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
  spam: "bg-red-50 text-red-700 ring-red-100 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/20",
};

export default function BusinessLeadCard({ lead, onStatusChange, saving }) {
  const name = lead.customerName || lead.displayName || "Unknown customer";
  const phone = String(lead.phone || "").replace(/[^0-9]/g, "");
  const whatsappUrl = phone ? `https://wa.me/${phone}` : "";
  const callUrl = phone ? `tel:+${phone}` : "";

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 text-xs font-black capitalize ring-1 ${
                statusStyles[lead.status] || statusStyles.new
              }`}
            >
              {lead.status}
            </span>

            {lead.needsHuman ? (
              <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-700 ring-1 ring-red-100 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/20">
                Human needed
              </span>
            ) : null}

            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {lead.intent || "unknown"}
            </span>
          </div>

          <h3 className="mt-3 text-xl font-black text-slate-950 dark:text-white">
            {name}
          </h3>

          <div className="mt-2 flex flex-wrap gap-3 text-sm font-semibold text-slate-500 dark:text-slate-400">
            {callUrl ? (
              <a
                href={callUrl}
                className="inline-flex items-center gap-1.5 hover:text-emerald-600"
              >
                <Phone size={15} />
                {lead.phone}
              </a>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <Phone size={15} />
                {lead.phone}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <UserRound size={15} />
              {lead.service || "No service"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {callUrl ? (
            <LinkButton href={callUrl}>
              <Phone size={14} />
              Call
            </LinkButton>
          ) : null}

          {whatsappUrl ? (
            <LinkButton href={whatsappUrl}>
              <ExternalLink size={14} />
              WhatsApp
            </LinkButton>
          ) : null}

          <ActionButton
            disabled={saving}
            onClick={() => onStatusChange(lead.id, "contacted")}
          >
            Contacted
          </ActionButton>
          <ActionButton
            disabled={saving}
            onClick={() => onStatusChange(lead.id, "booked")}
          >
            Booked
          </ActionButton>
          <ActionButton
            disabled={saving}
            onClick={() => onStatusChange(lead.id, "closed")}
          >
            Closed
          </ActionButton>
          <ActionButton
            danger
            disabled={saving}
            onClick={() => onStatusChange(lead.id, "spam")}
          >
            Spam
          </ActionButton>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <InfoBox
          icon={CalendarDays}
          label="Preferred date"
          value={lead.preferredDate || "-"}
        />
        <InfoBox
          icon={Clock}
          label="Preferred time"
          value={lead.preferredTime || "-"}
        />
        <InfoBox
          icon={CheckCircle2}
          label="Priority"
          value={lead.priority || "low"}
        />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <MessageBox title="First inquiry" value={lead.firstMessage || "-"} />
        <MessageBox title="Booking request" value={lead.bookingMessage || "-"} />
        <MessageBox title="Last message" value={lead.lastMessage || "-"} />
      </div>
    </article>
  );
}

function MessageBox({ title, value }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950/60">
      <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-400">
        <MessageCircle size={14} />
        {title}
      </div>
      <p className="text-sm leading-6 text-slate-700 dark:text-slate-300">
        {value}
      </p>
    </div>
  );
}

function InfoBox({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950/60">
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-400">
        <Icon size={14} />
        {label}
      </div>
      <p className="mt-1 font-black capitalize text-slate-900 dark:text-white">
        {value}
      </p>
    </div>
  );
}

function LinkButton({ children, href }) {
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel={href.startsWith("http") ? "noreferrer" : undefined}
      className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-emerald-50 px-4 py-2 text-xs font-black text-emerald-700 transition hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300"
    >
      {children}
    </a>
  );
}

function ActionButton({ children, onClick, disabled, danger = false }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`rounded-2xl px-4 py-2 text-xs font-black transition disabled:opacity-50 ${
        danger
          ? "bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-500/10 dark:text-red-300"
          : "bg-slate-100 text-slate-700 hover:bg-emerald-100 hover:text-emerald-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-300"
      }`}
    >
      {children}
    </button>
  );
}
