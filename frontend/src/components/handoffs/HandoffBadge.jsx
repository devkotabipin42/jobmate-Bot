const priorityStyles = {
  urgent:
    "bg-red-50 text-red-700 ring-red-100 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/20",
  high:
    "bg-orange-50 text-orange-700 ring-orange-100 dark:bg-orange-500/10 dark:text-orange-300 dark:ring-orange-500/20",
  medium:
    "bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20",
  low:
    "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
};

export default function HandoffBadge({ priority = "medium" }) {
  const className = priorityStyles[priority] || priorityStyles.medium;

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ring-1 ${className}`}>
      {priority}
    </span>
  );
}
