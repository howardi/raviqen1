const base = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export async function hostingRequest(path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

export function hostingHealth() {
  return hostingRequest("/api/health");
}
