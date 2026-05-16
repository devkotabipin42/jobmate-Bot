import { Send } from "lucide-react";
import { useState } from "react";
import { adminService } from "../../services/adminService";

export default function ReplyBox({ contactId, onSend }) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function handleSend() {
    const text = message.trim();
    if (!text || !contactId) return;

    try {
      setSending(true);
      setError("");
      await adminService.sendMessage(contactId, text);
      setMessage("");
      onSend?.();
    } catch (err) {
      setError(err.message || "Failed to send");
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleSend();
    }
  }

  return (
    <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="mb-3 text-sm font-black text-slate-950 dark:text-white">
        Admin Reply
      </p>

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={3}
        placeholder="Type a reply... (Ctrl+Enter to send)"
        className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:focus:border-emerald-500 dark:focus:ring-emerald-500/10"
      />

      {error && (
        <p className="mt-2 text-xs font-semibold text-red-500">{error}</p>
      )}

      <div className="mt-3 flex justify-end">
        <button
          onClick={handleSend}
          disabled={!message.trim() || !contactId || sending}
          className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
        >
          <Send size={15} />
          {sending ? "Sending..." : "Send"}
        </button>
      </div>
    </div>
  );
}
