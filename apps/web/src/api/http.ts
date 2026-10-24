import { ApiError } from "./mockDb";

/**
 * Talks to the NestJS API. Used when VITE_API_BASE_URL is set (see
 * `services/index.ts`); without it the app runs on the in-browser demo data.
 */
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? "";
export const USE_API = API_BASE_URL !== "";

/**
 * The sign-in token. It lives in localStorage so a refresh keeps you signed
 * in, and is sent as `Authorization: Bearer …` (not a cookie: Safari blocks
 * cookies between the Vercel and Render domains).
 */
const TOKEN_KEY = "aerosys.token";

export const authToken = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string | null) {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      // Private mode without storage: the session lasts until the tab closes.
    }
  },
};

/** Called when the server says the token is missing, expired or switched off (401). */
let onUnauthorized: () => void = () => {};
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

/** The API answers errors as { message, errors?: [{ field, message }] }. */
async function errorFrom(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as { message?: string | string[]; errors?: Array<{ message: string }> };
    const text = body.errors?.length ? body.errors.map((e) => e.message).join(". ") : Array.isArray(body.message) ? body.message.join(". ") : body.message;
    return new ApiError(text || `Request failed (${res.status})`, res.status);
  } catch {
    return new ApiError(`Request failed (${res.status})`, res.status);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const token = authToken.get();
    if (token) headers.Authorization = `Bearer ${token}`;
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    // The free API host sleeps when idle; the first request can take a minute.
    throw new ApiError("Can't reach the server. Check your connection and try again.", 0);
  }
  // A wrong password on the login form is also a 401, but there is no session to end.
  if (res.status === 401 && path !== "/api/auth/login") onUnauthorized();
  if (!res.ok) throw await errorFrom(res);
  // 204 No Content (deletes) has no body.
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export const http = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body ?? {}),
  put: <T>(path: string, body: unknown) => request<T>("PUT", path, body),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
  delete: (path: string) => request<void>("DELETE", path),
};
