import { useEffect, useState } from "react";
import {
  Bot,
  Building2,
  CheckCircle2,
  Clock,
  Globe,
  KeyRound,
  Loader2,
  MapPin,
  MessageCircle,
  Plus,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
  Webhook,
} from "lucide-react";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import { useBusinessProfile } from "../hooks/useBusinessProfile";

const emptyService = {
  name: "",
  description: "",
  priceFrom: "",
  priceTo: "",
  currency: "NPR",
};

const emptyFAQ = {
  question: "",
  answer: "",
};

export default function SettingsPage() {
  const {
    profile,
    loading,
    saving,
    error,
    message,
    updateProfile,
    addService,
    deleteService,
    addFAQ,
    deleteFAQ,
  } = useBusinessProfile();

  const [form, setForm] = useState({
    businessName: "",
    businessType: "jobmate",
    description: "",
    openingHours: "",
    languageStyle: "roman_nepali",
    botTone: "polite_friendly",
    contact: {
      phone: "",
      whatsapp: "",
      email: "",
      website: "",
    },
    location: {
      area: "",
      district: "",
      province: "Lumbini",
      country: "Nepal",
      mapLink: "",
    },
    safetyMode: {
      answerOnlyFromBusinessData: true,
      humanHandoffOnDiscount: true,
      humanHandoffOnComplaint: true,
      humanHandoffOnUnknown: true,
    },
  });

  const [serviceForm, setServiceForm] = useState(emptyService);
  const [faqForm, setFaqForm] = useState(emptyFAQ);

  useEffect(() => {
    if (!profile) return;

    setForm({
      businessName: profile.businessName || "",
      businessType: profile.businessType || "jobmate",
      description: profile.description || "",
      openingHours: profile.openingHours || "",
      languageStyle: profile.languageStyle || "roman_nepali",
      botTone: profile.botTone || "polite_friendly",
      contact: {
        phone: profile.contact?.phone || "",
        whatsapp: profile.contact?.whatsapp || "",
        email: profile.contact?.email || "",
        website: profile.contact?.website || "",
      },
      location: {
        area: profile.location?.area || "",
        district: profile.location?.district || "",
        province: profile.location?.province || "Lumbini",
        country: profile.location?.country || "Nepal",
        mapLink: profile.location?.mapLink || "",
      },
      safetyMode: {
        answerOnlyFromBusinessData:
          profile.safetyMode?.answerOnlyFromBusinessData ?? true,
        humanHandoffOnDiscount:
          profile.safetyMode?.humanHandoffOnDiscount ?? true,
        humanHandoffOnComplaint:
          profile.safetyMode?.humanHandoffOnComplaint ?? true,
        humanHandoffOnUnknown:
          profile.safetyMode?.humanHandoffOnUnknown ?? true,
      },
    });
  }, [profile]);

  function updateField(key, value) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function updateNested(section, key, value) {
    setForm((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value,
      },
    }));
  }

  async function handleSaveProfile(e) {
    e.preventDefault();
    await updateProfile(form);
  }

  async function handleAddService(e) {
    e.preventDefault();

    await addService({
      name: serviceForm.name,
      description: serviceForm.description,
      priceFrom: serviceForm.priceFrom === "" ? null : Number(serviceForm.priceFrom),
      priceTo: serviceForm.priceTo === "" ? null : Number(serviceForm.priceTo),
      currency: serviceForm.currency || "NPR",
    });

    setServiceForm(emptyService);
  }

  async function handleAddFAQ(e) {
    e.preventDefault();

    await addFAQ({
      question: faqForm.question,
      answer: faqForm.answer,
    });

    setFaqForm(emptyFAQ);
  }

  if (loading) {
    return (
      <DashboardLayout>
        <StateCard text="Loading business settings..." />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-xl font-black text-slate-950 dark:text-white">
                AI Receptionist Settings
              </h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Set your business profile, services, prices and FAQs so the assistant can answer customers correctly.
              </p>
            </div>

            <div className="inline-flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
              <CheckCircle2 size={16} />
              Protected
            </div>
          </div>

          {error ? (
            <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:bg-red-500/10 dark:text-red-300">
              {error}
            </div>
          ) : null}

          {message ? (
            <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
              {message}
            </div>
          ) : null}
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <StatusCard
            icon={MessageCircle}
            title="WhatsApp Cloud API"
            status="Connected"
            description="Webhook and message sending are active."
            tone="emerald"
          />
          <StatusCard
            icon={Sparkles}
            title="AI Reply Engine"
            status="Enabled"
            description="AI understands customer messages and helps generate smart replies."
            tone="blue"
          />
          <StatusCard
            icon={Webhook}
            title="Business Information"
            status={`${profile?.services?.length || 0} services / ${profile?.faqs?.length || 0} FAQs`}
            description="Assistant uses this information to answer customer questions."
            tone="amber"
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <form
            onSubmit={handleSaveProfile}
            className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <PanelHeader
              icon={Building2}
              title="Business Profile"
              description="Basic information about this business."
            />

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Input
                label="Business Name"
                value={form.businessName}
                onChange={(value) => updateField("businessName", value)}
                placeholder="Sujata Beauty Studio"
              />

              <Select
                label="Business Type"
                value={form.businessType}
                onChange={(value) => updateField("businessType", value)}
                options={[
                  ["jobmate", "JobMate / Hiring"],
                  ["consultancy", "Consultancy"],
                  ["beauty_parlour", "Beauty Parlour"],
                  ["restaurant", "Restaurant"],
                  ["clinic", "Clinic"],
                  ["hotel", "Hotel"],
                  ["repair_service", "Repair Service"],
                  ["shop", "Shop"],
                  ["other", "Other"],
                ]}
              />

              <Input
                label="Opening Hours"
                value={form.openingHours}
                onChange={(value) => updateField("openingHours", value)}
                placeholder="10 AM - 7 PM"
                icon={Clock}
              />

              <Select
                label="Language Style"
                value={form.languageStyle}
                onChange={(value) => updateField("languageStyle", value)}
                options={[
                  ["roman_nepali", "Roman Nepali"],
                  ["nepali", "Nepali"],
                  ["english", "English"],
                  ["mixed", "Nepali + English"],
                ]}
              />

              <Select
                label="Bot Tone"
                value={form.botTone}
                onChange={(value) => updateField("botTone", value)}
                options={[
                  ["polite_friendly", "Polite + Friendly"],
                  ["professional", "Professional"],
                  ["casual", "Casual"],
                  ["sales_focused", "Sales Focused"],
                ]}
              />

              <Input
                label="Phone"
                value={form.contact.phone}
                onChange={(value) => updateNested("contact", "phone", value)}
                placeholder="9800000000"
              />

              <Input
                label="WhatsApp"
                value={form.contact.whatsapp}
                onChange={(value) => updateNested("contact", "whatsapp", value)}
                placeholder="9800000000"
              />

              <Input
                label="Email"
                value={form.contact.email}
                onChange={(value) => updateNested("contact", "email", value)}
                placeholder="business@email.com"
              />

              <Input
                label="Website"
                value={form.contact.website}
                onChange={(value) => updateNested("contact", "website", value)}
                placeholder="https://example.com"
                icon={Globe}
              />

              <Input
                label="Area"
                value={form.location.area}
                onChange={(value) => updateNested("location", "area", value)}
                placeholder="Butwal / Bardaghat"
                icon={MapPin}
              />

              <Input
                label="District"
                value={form.location.district}
                onChange={(value) => updateNested("location", "district", value)}
                placeholder="Rupandehi / Nawalparasi"
              />

              <Input
                label="Province"
                value={form.location.province}
                onChange={(value) => updateNested("location", "province", value)}
                placeholder="Lumbini"
              />

              <Input
                label="Map Link"
                value={form.location.mapLink}
                onChange={(value) => updateNested("location", "mapLink", value)}
                placeholder="Google Maps link"
              />
            </div>

            <div className="mt-4">
              <Textarea
                label="Business Description"
                value={form.description}
                onChange={(value) => updateField("description", value)}
                placeholder="Business ko short description..."
              />
            </div>

            <div className="mt-5 rounded-3xl bg-slate-50 p-4 dark:bg-slate-950/60">
              <PanelHeader
                icon={ShieldCheck}
                title="Bot Safety Rules"
                description="Bot ले के गर्न पाउँछ / के human लाई पठाउने."
                compact
              />

              <div className="mt-4 space-y-3">
                <ToggleRow
                  title="Answer only from business data"
                  description="Bot ले saved services/FAQ/profile बाहिरको कुरा invent गर्दैन."
                  enabled={form.safetyMode.answerOnlyFromBusinessData}
                  onToggle={() =>
                    updateNested(
                      "safetyMode",
                      "answerOnlyFromBusinessData",
                      !form.safetyMode.answerOnlyFromBusinessData
                    )
                  }
                />
                <ToggleRow
                  title="Handoff on discount"
                  description="Discount/negotiation आए human confirm."
                  enabled={form.safetyMode.humanHandoffOnDiscount}
                  onToggle={() =>
                    updateNested(
                      "safetyMode",
                      "humanHandoffOnDiscount",
                      !form.safetyMode.humanHandoffOnDiscount
                    )
                  }
                />
                <ToggleRow
                  title="Handoff on complaint"
                  description="Angry/complaint user आए human follow-up."
                  enabled={form.safetyMode.humanHandoffOnComplaint}
                  onToggle={() =>
                    updateNested(
                      "safetyMode",
                      "humanHandoffOnComplaint",
                      !form.safetyMode.humanHandoffOnComplaint
                    )
                  }
                />
                <ToggleRow
                  title="Handoff if unknown"
                  description="Bot लाई थाहा नभए team confirm भन्छ."
                  enabled={form.safetyMode.humanHandoffOnUnknown}
                  onToggle={() =>
                    updateNested(
                      "safetyMode",
                      "humanHandoffOnUnknown",
                      !form.safetyMode.humanHandoffOnUnknown
                    )
                  }
                />
              </div>
            </div>

            <button
              disabled={saving}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {saving ? <Loader2 className="animate-spin" size={17} /> : <Save size={17} />}
              {saving ? "Saving..." : "Save Business Profile"}
            </button>
          </form>

          <div className="space-y-6">
            <ServicesPanel
              services={profile?.services || []}
              serviceForm={serviceForm}
              setServiceForm={setServiceForm}
              onAdd={handleAddService}
              onDelete={deleteService}
              saving={saving}
            />

            <FAQPanel
              faqs={profile?.faqs || []}
              faqForm={faqForm}
              setFaqForm={setFaqForm}
              onAdd={handleAddFAQ}
              onDelete={deleteFAQ}
              saving={saving}
            />
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <SettingPanel
            icon={Bot}
            title="Automation Rules"
            description="Active WhatsApp assistant flows for this business."
          >
            <div className="space-y-3">
              <RuleItem title="Business Info Replies" value="Ready" />
              <RuleItem title="Service & Price Replies" value="Ready" />
              <RuleItem title="FAQ Auto Answers" value="Ready" />
              <RuleItem title="Team Handoff Rules" value="Active" />
            </div>
          </SettingPanel>

          <SettingPanel
            icon={KeyRound}
            title="Setup Checklist"
            description="Complete these steps to make the assistant ready for real customers."
          >
            <div className="space-y-3">
              <ChecklistItem text="AI reply style setup" />
              <ChecklistItem text="Connect business information to replies" />
              <ChecklistItem text="Connect business WhatsApp number" />
              <ChecklistItem text="Import information from business website" />
            </div>
          </SettingPanel>
        </section>
      </div>
    </DashboardLayout>
  );
}

function ServicesPanel({ services, serviceForm, setServiceForm, onAdd, onDelete, saving }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <PanelHeader
        icon={Sparkles}
        title="Services / Prices"
        description="Assistant uses this data when customers ask about services and prices."
      />

      <form onSubmit={onAdd} className="mt-5 space-y-3">
        <Input
          label="Service Name"
          value={serviceForm.name}
          onChange={(value) => setServiceForm((prev) => ({ ...prev, name: value }))}
          placeholder="Hair Color"
        />
        <Textarea
          label="Description"
          value={serviceForm.description}
          onChange={(value) =>
            setServiceForm((prev) => ({ ...prev, description: value }))
          }
          placeholder="Final price hair length अनुसार फरक हुन सक्छ."
          rows={2}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Price From"
            type="number"
            value={serviceForm.priceFrom}
            onChange={(value) =>
              setServiceForm((prev) => ({ ...prev, priceFrom: value }))
            }
            placeholder="1500"
          />
          <Input
            label="Price To"
            type="number"
            value={serviceForm.priceTo}
            onChange={(value) =>
              setServiceForm((prev) => ({ ...prev, priceTo: value }))
            }
            placeholder="3000"
          />
        </div>

        <button
          disabled={saving || !serviceForm.name}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white hover:bg-emerald-600 disabled:opacity-60 dark:bg-white dark:text-slate-950"
        >
          <Plus size={16} />
          Add Service
        </button>
      </form>

      <div className="mt-5 space-y-3">
        {services.length === 0 ? (
          <EmptyBox text="No services added yet." />
        ) : (
          services.map((service) => (
            <div
              key={service._id}
              className="rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-slate-950 dark:text-white">
                    {service.name}
                  </p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {service.description || "No description"}
                  </p>
                  <p className="mt-2 text-sm font-bold text-emerald-700 dark:text-emerald-300">
                    {formatPrice(service)}
                  </p>
                </div>
                <button
                  onClick={() => onDelete(service._id)}
                  className="rounded-2xl bg-red-50 p-2 text-red-600 hover:bg-red-100 dark:bg-red-500/10 dark:text-red-300"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function FAQPanel({ faqs, faqForm, setFaqForm, onAdd, onDelete, saving }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <PanelHeader
        icon={MessageCircle}
        title="FAQ / Common Questions"
        description="Customer ले सोध्ने common question-answer."
      />

      <form onSubmit={onAdd} className="mt-5 space-y-3">
        <Input
          label="Question"
          value={faqForm.question}
          onChange={(value) =>
            setFaqForm((prev) => ({ ...prev, question: value }))
          }
          placeholder="Location kata ho?"
        />
        <Textarea
          label="Answer"
          value={faqForm.answer}
          onChange={(value) =>
            setFaqForm((prev) => ({ ...prev, answer: value }))
          }
          placeholder="Hamro location Butwal ma ho..."
          rows={3}
        />

        <button
          disabled={saving || !faqForm.question || !faqForm.answer}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white hover:bg-emerald-600 disabled:opacity-60 dark:bg-white dark:text-slate-950"
        >
          <Plus size={16} />
          Add FAQ
        </button>
      </form>

      <div className="mt-5 space-y-3">
        {faqs.length === 0 ? (
          <EmptyBox text="No FAQs added yet." />
        ) : (
          faqs.map((faq) => (
            <div
              key={faq._id}
              className="rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-slate-950 dark:text-white">
                    {faq.question}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                    {faq.answer}
                  </p>
                </div>
                <button
                  onClick={() => onDelete(faq._id)}
                  className="rounded-2xl bg-red-50 p-2 text-red-600 hover:bg-red-100 dark:bg-red-500/10 dark:text-red-300"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function StatusCard({ icon: Icon, title, status, description, tone }) {
  const tones = {
    emerald:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
    blue: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300",
    amber:
      "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
          tones[tone] || tones.emerald
        }`}
      >
        <Icon size={22} />
      </div>
      <h3 className="mt-4 font-black text-slate-950 dark:text-white">
        {title}
      </h3>
      <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20">
        <CheckCircle2 size={13} />
        {status}
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
        {description}
      </p>
    </div>
  );
}

function SettingPanel({ icon: Icon, title, description, children }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <PanelHeader icon={Icon} title={title} description={description} />
      <div className="mt-5">{children}</div>
    </div>
  );
}

function PanelHeader({ icon: Icon, title, description, compact = false }) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={`flex ${compact ? "h-9 w-9" : "h-11 w-11"} items-center justify-center rounded-2xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200`}
      >
        <Icon size={compact ? 17 : 20} />
      </div>
      <div>
        <h3 className="font-black text-slate-950 dark:text-white">{title}</h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {description}
        </p>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, placeholder, type = "text", icon: Icon }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-400">
        {Icon ? <Icon size={14} /> : null}
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:focus:ring-emerald-500/10"
      />
    </label>
  );
}

function Textarea({ label, value, onChange, placeholder, rows = 4 }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-400">
        {label}
      </span>
      <textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:focus:ring-emerald-500/10"
      />
    </label>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-400">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:focus:ring-emerald-500/10"
      >
        {options.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ToggleRow({ title, description, enabled, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between gap-4 rounded-2xl bg-white p-4 text-left dark:bg-slate-900"
    >
      <div>
        <p className="font-bold text-slate-900 dark:text-slate-100">{title}</p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {description}
        </p>
      </div>

      <span
        className={`relative inline-flex h-7 w-12 shrink-0 rounded-full ${
          enabled ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"
        }`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
            enabled ? "left-6" : "left-1"
          }`}
        />
      </span>
    </button>
  );
}

function RuleItem({ title, value }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4 dark:bg-slate-950/60">
      <p className="font-bold text-slate-900 dark:text-slate-100">{title}</p>
      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
        {value}
      </span>
    </div>
  );
}

function ChecklistItem({ text }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4 dark:bg-slate-950/60">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
        •
      </span>
      <p className="font-semibold text-slate-800 dark:text-slate-100">{text}</p>
    </div>
  );
}

function EmptyBox({ text }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
      {text}
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

function formatPrice(service) {
  const currency = service.currency || "NPR";
  const from = service.priceFrom;
  const to = service.priceTo;

  if (from && to) return `${currency} ${Number(from).toLocaleString()}–${Number(to).toLocaleString()}`;
  if (from) return `${currency} ${Number(from).toLocaleString()}+`;
  return "Price not set";
}
