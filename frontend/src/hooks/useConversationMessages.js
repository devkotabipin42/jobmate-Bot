import { useEffect, useState } from "react";
import { adminService } from "../services/adminService";

export function useConversationMessages(contactId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(contactId));
  const [error, setError] = useState("");

  async function fetchMessages() {
    if (!contactId) return;

    try {
      setLoading(true);
      setError("");

      const result = await adminService.getConversationMessages(contactId, {
        limit: 50,
      });

      setData(result);
    } catch (err) {
      setError(err.message || "Failed to load messages");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchMessages();
  }, [contactId]);

  return {
    data,
    messages: data?.messages || [],
    loading,
    error,
    refetch: fetchMessages,
  };
}
