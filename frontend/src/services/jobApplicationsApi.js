const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000";

function getAdminToken() {
  return localStorage.getItem("jobmate-admin-token") || "";
}

async function request(path, options = {}) {
  const token = getAdminToken();

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
    throw new Error(data.message || "Request failed");
  }

  return data;
}

export async function listJobApplications({ status = "", limit = 50 } = {}) {
  const params = new URLSearchParams();

  if (status) params.set("status", status);
  if (limit) params.set("limit", String(limit));

  return request(`/api/admin/job-applications?${params.toString()}`);
}

export async function getJobApplicationDetail(id) {
  return request(`/api/admin/job-applications/${id}`);
}

export async function updateJobApplicationStatus(id, { status, notes = "" }) {
  return request(`/api/admin/job-applications/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status, notes }),
  });
}
