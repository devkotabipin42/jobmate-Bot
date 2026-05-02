export default function MessageBubble({ message }) {
  const isOutbound = message.direction === "outbound";

  return (
    <div className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-3xl px-4 py-3 shadow-sm ${
          isOutbound
            ? "rounded-br-md bg-emerald-600 text-white"
            : "rounded-bl-md border border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
        }`}
      >
        <p className="whitespace-pre-wrap text-sm leading-6">{message.text}</p>

        <div
          className={`mt-2 flex items-center gap-2 text-[11px] ${
            isOutbound ? "text-emerald-50" : "text-slate-400"
          }`}
        >
          <span>{message.direction}</span>
          <span>•</span>
          <span>{message.intent || "unknown"}</span>
        </div>
      </div>
    </div>
  );
}
