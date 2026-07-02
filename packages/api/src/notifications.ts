import { apiFetch } from "./client";

export async function registerPushToken(
  token: string,
  platform: string | null,
  authToken: string
): Promise<void> {
  await apiFetch<void>("/api/v4/push_tokens", {
    method: "POST",
    body: { token, platform },
    token: authToken,
  });
}
