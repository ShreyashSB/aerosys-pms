/**
 * Placeholder HTTP client for when a real backend is available.
 *
 * Example migration of a service method:
 *
 *   // before (mock)
 *   async list() { await simulateLatency(); return clone(db.read().projects); }
 *   // after (REST)
 *   async list() { return http.get<Project[]>("/api/projects"); }
 *
 * Nothing outside `src/services` needs to change.
 */
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: "include",
  });
  if (!res.ok) throw new Error(`${method} ${path} failed: ${res.status}`);
  return (await res.json()) as T;
}

export const http = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body: unknown) => request<T>("PUT", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
};
