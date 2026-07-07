import React, { createContext, useContext, useEffect, useState } from "react";
import { auth } from "./api";
import { fan } from "../fan/api";
import { saveSession, loadSession, clearSession } from "./storage";
import { setUnauthorizedHandler } from "../client";
import type { AuthSession } from "./types";

type AuthContextValue = {
  session: AuthSession | null;
  isLoading: boolean;
  login: (email: string, password: string, accountId: string) => Promise<AuthSession>;
  register: (email: string, password: string, accountId: string) => Promise<AuthSession>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  updateDisplayName: (displayName: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  children,
  sessionKey,
}: {
  children: React.ReactNode;
  sessionKey: string;
}) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearSession(sessionKey);
      setSession(null);
    });

    loadSession(sessionKey).then(async (s) => {
      if (!s) {
        setIsLoading(false);
        return;
      }
      try {
        // me() validates the token AND returns latest fan data (including sport prefs);
        // merge into the stored session so SportProvider can read prefs without a second request.
        const fresh = await auth.me(s.token);
        setSession({ ...s, ...fresh });
      } catch {
        await clearSession(sessionKey);
        setSession(null);
      } finally {
        setIsLoading(false);
      }
    });
  }, []);

  async function login(email: string, password: string, accountId: string): Promise<AuthSession> {
    const s = await auth.login(email, password, accountId);
    await saveSession(s, sessionKey);
    setSession(s);
    return s;
  }

  async function register(email: string, password: string, accountId: string): Promise<AuthSession> {
    const s = await auth.register(email, password, accountId);
    await saveSession(s, sessionKey);
    setSession(s);
    return s;
  }

  async function logout(): Promise<void> {
    await clearSession(sessionKey);
    setSession(null);
  }

  async function deleteAccount(): Promise<void> {
    if (session) {
      await fan.deleteAccount(session.token);
    }
    await clearSession(sessionKey);
    setSession(null);
  }

  async function updateDisplayName(displayName: string): Promise<void> {
    if (!session) return;
    const { data } = await fan.updateDisplayName(session.token, displayName);
    const updated = { ...session, display_name: data.display_name };
    await saveSession(updated, sessionKey);
    setSession(updated);
  }

  return (
    <AuthContext.Provider
      value={{ session, isLoading, login, register, logout, deleteAccount, updateDisplayName }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
