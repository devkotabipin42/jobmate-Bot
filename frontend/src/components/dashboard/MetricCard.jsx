import { motion } from "framer-motion";

const toneMap = {
  emerald: {
    card: "from-emerald-500 to-green-600",
    bg: "bg-emerald-50 dark:bg-emerald-500/10",
    text: "text-emerald-700 dark:text-emerald-300",
  },
  blue: {
    card: "from-blue-500 to-indigo-600",
    bg: "bg-blue-50 dark:bg-blue-500/10",
    text: "text-blue-700 dark:text-blue-300",
  },
  amber: {
    card: "from-amber-500 to-orange-600",
    bg: "bg-amber-50 dark:bg-amber-500/10",
    text: "text-amber-700 dark:text-amber-300",
  },
  rose: {
    card: "from-rose-500 to-red-600",
    bg: "bg-rose-50 dark:bg-rose-500/10",
    text: "text-rose-700 dark:text-rose-300",
  },
};

export default function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  tone = "emerald",
}) {
  const styles = toneMap[tone] || toneMap.emerald;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="group overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-200/70 dark:border-slate-800 dark:bg-slate-900 dark:hover:shadow-emerald-950/20"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            {title}
          </p>
          <p className="mt-3 text-4xl font-black tracking-tight text-slate-950 dark:text-white">
            {value ?? 0}
          </p>
        </div>

        {Icon ? (
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${styles.card} text-white shadow-lg`}
          >
            <Icon size={22} />
          </div>
        ) : null}
      </div>

      {subtitle ? (
        <div
          className={`mt-5 inline-flex rounded-full ${styles.bg} px-3 py-1 text-xs font-bold ${styles.text}`}
        >
          {subtitle}
        </div>
      ) : null}
    </motion.div>
  );
}
