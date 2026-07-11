/**
 * AC-104: Self-hosted Express API client with token refresh.
 *
 * A fetch wrapper that automatically calls POST /auth/refresh when it gets a
 * 401 from the API and retries the original request with the new access token.
 *
 * This is used when the app is deployed against the self-hosted Express+
 * Postgres backend (docker compose). The Supabase Cloud path uses supabase.auth
 * session refresh instead and is untouched.
 *
 * Usage:
 *   import { apiFetch, setTokens } from "@/lib/self-hosted-client";
 *   const res = await apiFetch("/products");
 *   const json = await res.json();
 */

const ACCESS_KEY = "cortaqc.access_token";
const REFRESH_KEY = "cortaqc.refresh_token";

export function getApiBase(): string {
  const env = (import.meta as any).env ?? {};
  return env.VITE_API_BASE_URL ?? "/api";
}

export function getAccessToken(): string | null {
  try { return localStorage.getItem(ACCESS_KEY); } catch { return null; }
}
export function getRefreshToken(): string | null {
  try { return localStorage.getItem(REFRESH_KEY); } catch { return null; }
}
export function setTokens(access: string | null, refresh?: string | null) {
  try {
    if (access) localStorage.setItem(ACCESS_KEY, access); else localStorage.removeItem(ACCESS_KEY);
    if (refresh !== undefined) {
      if (refresh) localStorage.setItem(REFRESH_KEY, refresh); else localStorage.removeItem(REFRESH_KEY);
    }
  } catch { /* ignore */ }
}
export function clearTokens() { setTokens(null, null); }

let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  const refresh = getRefreshToken();
  if (!refresh) return null;
  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${getApiBase()}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refresh }),
      });
      if (!res.ok) { clearTokens(); return null; }
      const body = await res.json().catch(() => ({}));
      const access = body?.data?.access_token ?? body?.access_token ?? null;
      const newRefresh = body?.data?.refresh_token ?? body?.refresh_token ?? refresh;
      if (access) { setTokens(access, newRefresh); return access; }
      clearTokens(); return null;
    } catch {
      return null;
    } finally {
      // release after microtask so parallel callers all see the same result
      setTimeout(() => { refreshInFlight = null; }, 0);
    }
  })();
  return refreshInFlight;
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const url = path.startsWith("http") ? path : `${getApiBase()}${path.startsWith("/") ? path : `/${path}`}`;

  const doRequest = (token: string | null): Promise<Response> => {
    const headers = new Headers(init.headers ?? {});
    if (!headers.has("Content-Type") && init.body && typeof init.body === "string") {
      headers.set("Content-Type", "application/json");
    }
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(url, { ...init, headers });
  };

  let res = await doRequest(getAccessToken());
  if (res.status !== 401) return res;

  // Try one refresh + retry cycle
  const newToken = await refreshAccessToken();
  if (!newToken) return res;
  res = await doRequest(newToken);
  return res;
}

/** POST /roles/:id/permissions is exposed as PATCH per AC-91. */
export function updateRolePermissions(roleId: string, permission_ids: string[]) {
  return apiFetch(`/roles/${roleId}/permissions`, {
    method: "PATCH",
    body: JSON.stringify({ permission_ids }),
  });
}
