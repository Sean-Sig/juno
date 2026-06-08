const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";

/** Common offset-pagination params accepted by list endpoints (default per_page is 50 server-side). */
export type PageParams = {
  page?: number;
  per_page?: number;
};

/** Builds a `?a=1&b=2` query string from a params object, skipping undefined values. */
export function buildQuery(params?: Record<string, string | number | boolean | undefined>): string {
  if (!params) return "";

  const entries = Object.entries(params).filter(([, v]) => v !== undefined) as [string, string | number | boolean][];
  if (entries.length === 0) return "";

  return `?${new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString()}`;
}

let _onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(fn: () => void): void {
  _onUnauthorized = fn;
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  token?: string;
};

export async function apiFetch<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = "GET", body, token } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    _onUnauthorized?.();
    throw new Error("UNAUTHORIZED");
  }

  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${path}`);
  }

  return res.json() as Promise<T>;
}
