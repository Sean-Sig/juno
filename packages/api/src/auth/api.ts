import type { AuthSession } from "./types";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";

async function authPost(path: string, body: unknown): Promise<AuthSession> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw json;
  return json as AuthSession;
}

export const auth = {
  register(email: string, password: string, accountId: string): Promise<AuthSession> {
    return authPost("/api/v4/auth/register", { email, password, account_id: accountId });
  },

  login(email: string, password: string, accountId: string): Promise<AuthSession> {
    return authPost("/api/v4/auth/login", { email, password, account_id: accountId });
  },

  async me(token: string): Promise<{ fan_id: string; account_id: string }> {
    const res = await fetch(`${API_URL}/api/v4/auth/me`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) throw await res.json();
    return res.json();
  },
};
