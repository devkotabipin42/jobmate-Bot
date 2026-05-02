import { Lock, SendHorizonal } from "lucide-react";
import { useState } from "react";

export default function ReplyBox() {
  const [message, setMessage] = useState("");

  return (
    <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-black text-slate-950 dark:text-white">
            Admin Reply
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            WhatsApp manual reply will be enabled after safety review.
          </p>
        </div>

        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700 ring-1 ring-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20">
          <Lock size={12} />
          Safe mode
        </span>
      </div>

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
        placeholder="Type a reply or internal follow-up note..."
        className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:focus:border-emerald-500 dark:focus:ring-emerald-500/10"
      />

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Future: send WhatsApp reply, add internal note, or assign agent.
        </p>

        <button
          disabled
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-300 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed dark:bg-slate-700 dark:text-slate-400"
        >
          <SendHorizonal size={16} />
          Send coming soon
        </button>
      </div>
    </div>
  );
}
