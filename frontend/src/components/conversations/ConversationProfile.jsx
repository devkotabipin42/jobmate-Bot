import { Building2, Briefcase, MapPin, Phone, User } from "lucide-react";

export default function ConversationProfile({ data }) {
  const contact = data?.contact;
  const employerLead = data?.employerLead;
  const worker = data?.worker;

  if (!contact) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        Select a conversation.
      </div>
    );
  }

  return (
    <aside className="space-y-4">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
            <User size={22} />
          </div>
          <div>
            <h3 className="font-black text-slate-950 dark:text-white">
              {contact.displayName}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {contact.contactType}
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          <Info icon={Phone} label="Phone" value={contact.phone} />
          <Info icon={Briefcase} label="Bot Mode" value={contact.botMode} />
        </div>
      </div>

      {employerLead ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h4 className="flex items-center gap-2 font-black text-slate-950 dark:text-white">
            <Building2 size={18} />
            Employer Lead
          </h4>
          <div className="mt-4 space-y-3">
            <Info label="Business" value={employerLead.businessName} />
            <Info label="Status" value={employerLead.leadStatus} />
            <Info label="Urgency" value={employerLead.urgencyLevel} />
            <Info label="Score" value={employerLead.score} />
          </div>
        </div>
      ) : null}

      {worker ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h4 className="flex items-center gap-2 font-black text-slate-950 dark:text-white">
            <MapPin size={18} />
            Worker Profile
          </h4>
          <div className="mt-4 space-y-3">
            <Info label="Name" value={worker.fullName} />
            <Info label="Status" value={worker.profileStatus} />
            <Info label="Availability" value={worker.availability} />
            <Info label="Score" value={worker.score} />
          </div>
        </div>
      ) : null}
    </aside>
  );
}

function Info({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950/60">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400">
        {Icon ? <Icon size={14} /> : null}
        {label}
      </div>
      <p className="mt-1 font-semibold text-slate-800 dark:text-slate-100">
        {value ?? "-"}
      </p>
    </div>
  );
}
