import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { fan } from "../fan/api";
import { useAuth } from "../auth/context";

export type Sport = "golf" | "tennis" | "basketball" | "hockey" | "football" | "soccer";

export const ALL_SPORTS: Sport[] = ["golf", "tennis", "basketball", "hockey", "football", "soccer"];

const STORAGE_KEY = "juno_sport_prefs";

type StoredPrefs = {
  followedSports: Sport[];
  defaultSport: Sport;
};

type SportContextValue = {
  /** Currently visible sport (session-level, resets to defaultSport on next launch) */
  activeSport: Sport;
  /** Sports the user has chosen to follow */
  followedSports: Sport[];
  /** The user's persisted default sport */
  defaultSport: Sport;
  /** True while loading prefs from storage on startup */
  isLoading: boolean;
  /** True once the user has completed onboarding (followedSports.length > 0) */
  isOnboarded: boolean;
  /** Switch active sport in the current session (no backend call) */
  setActiveSport: (sport: Sport) => void;
  /**
   * Called when the user completes onboarding or updates sport settings.
   * Persists to SecureStore and syncs to the backend.
   */
  finishOnboarding: (followed: Sport[], defaultSport: Sport, token: string) => Promise<void>;
};

const SportContext = createContext<SportContextValue | null>(null);

export function SportProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [followedSports, setFollowedSports] = useState<Sport[]>([]);
  const [defaultSport, setDefaultSport] = useState<Sport>("golf");
  const [activeSport, setActiveSportState] = useState<Sport>("golf");
  const [isLoading, setIsLoading] = useState(true);
  // Track whether we've already applied session prefs so we don't override
  // an in-session sport switch when the session object re-renders.
  const seededFromSession = useRef(false);

  // 1. Load from SecureStore immediately on mount (fast, no network)
  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          const prefs: StoredPrefs = JSON.parse(raw);
          setFollowedSports(prefs.followedSports ?? []);
          setDefaultSport(prefs.defaultSport ?? "golf");
          setActiveSportState(prefs.defaultSport ?? "golf");
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  // 2. When auth loads the session it calls auth.me(), which now returns followed_sports
  //    and default_sport. Merge those in — no second network call needed.
  useEffect(() => {
    if (!session || seededFromSession.current) return;
    const followed = (session.followed_sports ?? []) as Sport[];
    const def = (session.default_sport ?? null) as Sport | null;
    if (followed.length > 0 && def) {
      seededFromSession.current = true;
      setFollowedSports(followed);
      setDefaultSport(def);
      setActiveSportState(def);
      // Keep SecureStore in sync
      SecureStore.setItemAsync(
        STORAGE_KEY,
        JSON.stringify({ followedSports: followed, defaultSport: def })
      ).catch(() => {});
    }
  }, [session]);

  const persistPrefs = useCallback(async (prefs: StoredPrefs) => {
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(prefs));
  }, []);

  const setActiveSport = useCallback((sport: Sport) => {
    setActiveSportState(sport);
  }, []);

  const finishOnboarding = useCallback(
    async (followed: Sport[], newDefault: Sport, token: string) => {
      seededFromSession.current = true;
      setFollowedSports(followed);
      setDefaultSport(newDefault);
      setActiveSportState(newDefault);
      const prefs: StoredPrefs = { followedSports: followed, defaultSport: newDefault };
      await persistPrefs(prefs);
      // Sync to backend (non-blocking — local state is already updated)
      fan
        .updateSports(token, { followed_sports: followed, default_sport: newDefault })
        .catch(() => {});
    },
    [persistPrefs]
  );

  const value: SportContextValue = {
    activeSport,
    followedSports,
    defaultSport,
    isLoading,
    isOnboarded: followedSports.length > 0,
    setActiveSport,
    finishOnboarding,
  };

  return <SportContext.Provider value={value}>{children}</SportContext.Provider>;
}

export function useSport(): SportContextValue {
  const ctx = useContext(SportContext);
  if (!ctx) throw new Error("useSport must be used within SportProvider");
  return ctx;
}
