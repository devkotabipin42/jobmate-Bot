const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const DEFAULT_TIMEOUT = 15000;

function getAdminToken() {
  return localStorage.getItem("jobmate-admin-token") || "";
}

async function request(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...(getAdminToken() ? { Authorization: `Bearer ${getAdminToken()}` } : {}),
        ...(options.headers || {}),
      },
      signal: controller.signal,
      ...options,
    });

    let data = null;

    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      throw new Error(
        data?.message ||
          data?.error?.message ||
          `Request failed with status ${response.status}`
      );
    }

    if (data?.success === false) {
      throw new Error(
        data?.message || data?.error?.message || "API request failed"
      );
    }

    return data?.data ?? data;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Server response timeout. Please try again.");
    }

    if (!navigator.onLine) {
      throw new Error("Internet connection छैन। Please reconnect and retry.");
    }

    throw new Error(error.message || "Network request failed");
  } finally {
    clearTimeout(timeout);
  }
}

export const adminService = {
  login(password) {
    return request("/api/admin/auth/login", {
      method: "POST",
      body: JSON.stringify({ password }),
    });
  },
  getDashboardSummary() {
    return request("/api/admin/dashboard/summary");
  },


  getBusinessProfile() {
    return request("/api/admin/business-profile");
  },


  getBusinessLeads(params = {}) {
    const query = new URLSearchParams(params).toString();
    return request(`/api/admin/business-leads${query ? `?${query}` : ""}`);
  },

  updateBusinessLeadStatus(id, payload) {
    return request(`/api/admin/business-leads/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },


  updateBusinessProfile(payload) {
    return request("/api/admin/business-profile", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  addBusinessService(payload) {
    return request("/api/admin/business-profile/services", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  deleteBusinessService(serviceId) {
    return request(`/api/admin/business-profile/services/${serviceId}`, {
      method: "DELETE",
    });
  },

  addBusinessFAQ(payload) {
    return request("/api/admin/business-profile/faqs", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  deleteBusinessFAQ(faqId) {
    return request(`/api/admin/business-profile/faqs/${faqId}`, {
      method: "DELETE",
    });
  },


  getEmployerLeads(params = {}) {
    const query = new URLSearchParams(params).toString();
    return request(`/api/admin/employer-leads${query ? `?${query}` : ""}`);
  },

  updateEmployerLeadStatus(id, payload) {
    return request(`/api/admin/employer-leads/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  updateEmployerLeadVerification(id, payload) {
    return request(`/api/admin/employer-leads/${id}/verification`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  getEmployerLeadMatches(id, params = {}) {
    const query = new URLSearchParams(params).toString();
    return request(`/api/admin/employer-leads/${id}/matches${query ? `?${query}` : ""}`);
  },

  createJobMatch(payload) {
    return request("/api/admin/matches", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  updateJobMatchStatus(id, payload) {
    return request(`/api/admin/matches/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  getWorkers(params = {}) {
    const query = new URLSearchParams(params).toString();
    return request(`/api/admin/workers${query ? `?${query}` : ""}`);
  },

  updateWorkerStatus(id, payload) {
    return request(`/api/admin/workers/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },


  verifyWorkerDocument(workerId, documentId, payload = {}) {
    return request(`/api/admin/workers/${workerId}/documents/${documentId}/verify`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  getHandoffs(params = {}) {
    const query = new URLSearchParams(params).toString();
    return request(`/api/admin/handoffs${query ? `?${query}` : ""}`);
  },

  updateHandoffCallStatus(id, payload) {
    return request(`/api/admin/handoffs/${id}/call`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  updateHandoffStatus(id, payload) {
    return request(`/api/admin/handoffs/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  getJobMatches(params = {}) {
    const query = new URLSearchParams(params).toString();
    return request(`/api/admin/matches${query ? `?${query}` : ""}`);
  },

  createJobMatch(payload) {
    return request("/api/admin/matches", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  updateJobMatchStatus(id, payload) {
    return request(`/api/admin/matches/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  getNotifications(params = {}) {
    const query = new URLSearchParams(params).toString();
    return request(`/api/admin/notifications${query ? `?${query}` : ""}`);
  },

  markNotificationRead(id) {
    return request(`/api/admin/notifications/${id}/read`, {
      method: "PATCH",
    });
  },

  markAllNotificationsRead() {
    return request("/api/admin/notifications/read-all", {
      method: "PATCH",
    });
  },

  getFollowups(params = {}) {
    const query = new URLSearchParams(params).toString();
    return request(`/api/admin/followups${query ? `?${query}` : ""}`);
  },

  processFollowups(payload = {}) {
    return request("/api/admin/followups/process", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },


  cancelFollowup(id, payload = {}) {
    return request(`/api/admin/followups/${id}/cancel`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },


  getConversations(params = {}) {
    const query = new URLSearchParams(params).toString();
    return request(`/api/admin/conversations${query ? `?${query}` : ""}`);
  },

  getConversationMessages(contactId, params = {}) {
    if (!contactId) {
      throw new Error("Contact ID is required");
    }

    const query = new URLSearchParams(params).toString();
    return request(
      `/api/admin/conversations/${contactId}/messages${
        query ? `?${query}` : ""
      }`
    );
  },

  sendMessage(contactId, message) {
    return request(`/api/admin/conversations/${contactId}/send`, {
      method: "POST",
      body: JSON.stringify({ message }),
    });
  },

  takeoverConversation(contactId, { sendNotification = true } = {}) {
    return request(`/api/admin/conversations/${contactId}/takeover`, {
      method: "POST",
      body: JSON.stringify({ sendNotification }),
    });
  },

  releaseConversation(contactId) {
    return request(`/api/admin/conversations/${contactId}/release`, {
      method: "POST",
    });
  },
};
