const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000";

function getAdminToken() {
  return localStorage.getItem("jobmate-admin-token") || "";
}

async function request(path, options = {}) {
  const token = getAdminToken();

  if (!token) {
    throw new Error("Admin token missing. Please login again.");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.success === false) {
    throw new Error(data.message || `Request failed with status ${response.status}`);
  }

  return data;
}

export async function listPendingKnowledge({ type = "", status = "pending", limit = 50 } = {}) {
  const params = new URLSearchParams();

  if (type) params.set("type", type);
  if (status) params.set("status", status);
  if (limit) params.set("limit", String(limit));

  return request(`/api/admin/pending-knowledge?${params.toString()}`);
}

export async function approvePendingKnowledge(id, body = {}) {
  return request(`/api/admin/pending-knowledge/${id}/approve`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function rejectPendingKnowledge(id, body = {}) {
  return request(`/api/admin/pending-knowledge/${id}/reject`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function applyPendingKnowledge(id, body = {}) {
  return request(`/api/admin/pending-knowledge/${id}/apply`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
