import * as SecureStore from "expo-secure-store";
import type { AuthSession } from "./types";

export async function saveSession(session: AuthSession, key: string): Promise<void> {
  await SecureStore.setItemAsync(key, JSON.stringify(session));
}

export async function loadSession(key: string): Promise<AuthSession | null> {
  const raw = await SecureStore.getItemAsync(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export async function clearSession(key: string): Promise<void> {
  await SecureStore.deleteItemAsync(key);
}
