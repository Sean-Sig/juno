import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { fan } from "../fan/api";

export type Sport = "golf" | "tennis";

export const ALL_SPORTS: Sport[] = ["golf", "tennis"];

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
  /** Pull latest prefs from the backend and merge with local state */
  syncFromBackend: (token: string) => Promise<void>;
};

const SportContext = createContext<SportContextValue | null>(null);

export function SportProvider({ children }: { children: React.ReactNode }) {
  const [followedSports, setFollowedSports] = useState<Sport[]>([]);
  const [defaultSport, setDefaultSport] = useState<Sport>("golf");
  const [activeSport, setActiveSportState] = useState<Sport>("golf");
  const [isLoading, setIsLoading] = useState(true);
  const initialized = useRef(false);

  // Load persisted prefs from SecureStore on mount
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
      .finally(() => {
        setIsLoading(false);
        initialized.current = true;
      });
  }, []);

  const persistPrefs = useCallback(async (prefs: StoredPrefs) => {
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(prefs));
  }, []);

  const setActiveSport = useCallback((sport: Sport) => {
    setActiveSportState(sport);
  }, []);

  const finishOnboarding = useCallback(
    async (followed: Sport[], newDefault: Sport, token: string) => {
      setFollowedSports(followed);
      setDefaultSport(newDefault);
      setActiveSportState(newDefault);
      const prefs: StoredPrefs = { followedSports: followed, defaultSport: newDefault };
      await persistPrefs(prefs);
      // Sync to backend (non-blocking after local state is set)
      fan
        .updateSports(token, { followed_sports: followed, default_sport: newDefault })
        .catch(() => {}); // best-effort
    },
    [persistPrefs]
  );

  const syncFromBackend = useCallback(async (token: string) => {
    try {
      const { data } = await fan.getMe(token);
      const followed = (data.followed_sports ?? []) as Sport[];
      const def = (data.default_sport ?? "golf") as Sport;
      if (followed.length > 0) {
        setFollowedSports(followed);
        setDefaultSport(def);
        // Don't override activeSport if the user has already switched manually
        if (!initialized.current) {
          setActiveSportState(def);
        }
        await persistPrefs({ followedSports: followed, defaultSport: def });
      }
    } catch {
      // Silently fail — local state is the source of truth for the session
    }
  }, [persistPrefs]);

  const value: SportContextValue = {
    activeSport,
    followedSports,
    defaultSport,
    isLoading,
    isOnboarded: followedSports.length > 0,
    setActiveSport,
    finishOnboarding,
    syncFromBackend,
  };

  return <SportContext.Provider value={value}>{children}</SportContext.Provider>;
}

export function useSport(): SportContextValue {
  const ctx = useContext(SportContext);
  if (!ctx) throw new Error("useSport must be used within SportProvider");
  return ctx;
}
