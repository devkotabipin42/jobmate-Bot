import { useMemo, useState } from "react";
import { Bot, RefreshCcw, Search, UserCheck, UserX } from "lucide-react";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import ConversationListItem from "../components/conversations/ConversationListItem";
import MessageBubble from "../components/conversations/MessageBubble";
import ConversationProfile from "../components/conversations/ConversationProfile";
import ReplyBox from "../components/conversations/ReplyBox";
import { useConversations } from "../hooks/useConversations";
import { useConversationMessages } from "../hooks/useConversationMessages";
import { adminService } from "../services/adminService";

export default function ConversationsPage() {
  const [filters, setFilters] = useState({
    search: "",
    contactType: "",
  });

  const { conversations, loading, error, refetch } = useConversations(filters);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [handoffLoading, setHandoffLoading] = useState(false);
  const [handoffError, setHandoffError] = useState("");

  const activeContactId = selectedContactId || conversations[0]?.contactId || "";
  const {
    data: conversationData,
    messages,
    loading: messagesLoading,
    error: messagesError,
    refetch: refetchMessages,
  } = useConversationMessages(activeContactId);

  const selectedConversation = useMemo(
    () => conversations.find((item) => item.contactId === activeContactId),
    [conversations, activeContactId]
  );

  const botMode = conversationData?.contact?.botMode || selectedConversation?.botMode || "bot";
  const isHumanPaused = botMode === "human_paused";

  function updateFilter(key, value) {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function handleTakeover() {
    if (!activeContactId) return;
    try {
      setHandoffLoading(true);
      setHandoffError("");
      await adminService.takeoverConversation(activeContactId);
      await refetchMessages();
      refetch();
    } catch (err) {
      setHandoffError(err.message || "Takeover failed");
    } finally {
      setHandoffLoading(false);
    }
  }

  async function handleRelease() {
    if (!activeContactId) return;
    try {
      setHandoffLoading(true);
      setHandoffError("");
      await adminService.releaseConversation(activeContactId);
      await refetchMessages();
      refetch();
    } catch (err) {
      setHandoffError(err.message || "Release failed");
    } finally {
      setHandoffLoading(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="grid gap-5 xl:grid-cols-[360px_1fr_320px]">
        <section className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-black text-slate-950 dark:text-white">
                  Inbox
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {conversations.length} conversations
                </p>
              </div>
              <button
                onClick={refetch}
                className="rounded-2xl border border-slate-200 bg-white p-2.5 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
              >
                <RefreshCcw size={16} />
              </button>
            </div>

            <div className="mt-4 flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
              <Search size={18} className="text-slate-400" />
              <input
                value={filters.search}
                onChange={(e) => updateFilter("search", e.target.value)}
                placeholder="Search phone/name..."
                className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-white"
              />
            </div>

            <select
              value={filters.contactType}
              onChange={(e) => updateFilter("contactType", e.target.value)}
              className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
            >
              <option value="">All contacts</option>
              <option value="employer">Employers</option>
              <option value="worker">Workers</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>

          <div className="max-h-[calc(100vh-260px)] space-y-3 overflow-y-auto pr-1">
            {loading ? (
              <StateCard text="Loading conversations..." />
            ) : error ? (
              <StateCard text={error} danger />
            ) : conversations.length === 0 ? (
              <StateCard text="No conversations found." />
            ) : (
              conversations.map((item) => (
                <ConversationListItem
                  key={item.contactId}
                  item={item}
                  active={item.contactId === activeContactId}
                  onClick={() => setSelectedContactId(item.contactId)}
                />
              ))
            )}
          </div>
        </section>

        <section className="min-h-[620px] rounded-3xl border border-slate-200 bg-slate-100/70 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/60">
          <div className="mb-4 rounded-3xl bg-white p-4 shadow-sm dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-black text-slate-950 dark:text-white">
                  {selectedConversation?.displayName || "Select conversation"}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {selectedConversation?.phone || "-"} •{" "}
                  {selectedConversation?.contactType || "-"}
                </p>
              </div>

              {activeContactId && (
                <div className="flex shrink-0 items-center gap-2">
                  {isHumanPaused ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700 ring-1 ring-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20">
                      <UserCheck size={12} />
                      Bot Paused
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20">
                      <Bot size={12} />
                      Bot Active
                    </span>
                  )}

                  {isHumanPaused ? (
                    <button
                      onClick={handleRelease}
                      disabled={handoffLoading}
                      className="inline-flex items-center gap-1.5 rounded-2xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <Bot size={13} />
                      Release
                    </button>
                  ) : (
                    <button
                      onClick={handleTakeover}
                      disabled={handoffLoading}
                      className="inline-flex items-center gap-1.5 rounded-2xl bg-amber-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-600 disabled:opacity-50"
                    >
                      <UserX size={13} />
                      Takeover
                    </button>
                  )}
                </div>
              )}
            </div>

            {handoffError && (
              <p className="mt-2 text-xs font-semibold text-red-500">{handoffError}</p>
            )}
          </div>

          <div className="max-h-[calc(100vh-420px)] space-y-3 overflow-y-auto px-1">
            {messagesLoading ? (
              <StateCard text="Loading messages..." />
            ) : messagesError ? (
              <StateCard text={messagesError} danger />
            ) : messages.length === 0 ? (
              <StateCard text="No messages found." />
            ) : (
              messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))
            )}
          </div>

          <ReplyBox
            contactId={activeContactId}
            onSend={refetchMessages}
          />
        </section>

        <div className="hidden xl:block">
          <ConversationProfile data={conversationData} />
        </div>
      </div>
    </DashboardLayout>
  );
}

function StateCard({ text, danger = false }) {
  return (
    <div
      className={`rounded-3xl border border-dashed p-6 text-center text-sm font-semibold ${
        danger
          ? "border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"
          : "border-slate-200 bg-white text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
      }`}
    >
      {text}
    </div>
  );
}
