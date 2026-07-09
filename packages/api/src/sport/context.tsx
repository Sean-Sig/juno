import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { fan } from "../fan/api";
import { useAuth } from "../auth/context";

export type Sport = "golf" | "tennis" | "basketball" | "hockey" | "football" | "soccer";

// All six sports have a full tab experience now.
const ENABLED_SPORTS: Sport[] = ["tennis", "golf", "basketball", "hockey", "football", "soccer"];

// Followable in onboarding/sport-settings (shown with a "Coming Soon" badge)
// so Home can surface player/team suggestions for it, but it can't become
// activeSport/defaultSport — see isSportEnabled. Move a sport here instead of
// ENABLED_SPORTS if its tab experience isn't ready yet.
const COMING_SOON_SPORTS: Sport[] = [];

export const ALL_SPORTS: Sport[] = [...ENABLED_SPORTS, ...COMING_SOON_SPORTS];

export function isSportComingSoon(sport: Sport): boolean {
  return COMING_SOON_SPORTS.includes(sport);
}

// True if the sport has a full in-app experience — safe to become
// activeSport/defaultSport or appear in the sport switcher. A "coming soon"
// sport can be followed (for Home's player suggestions) without this being
// true, since following it shouldn't unlock its dedicated tab yet.
export function isSportEnabled(sport: Sport): boolean {
  return ENABLED_SPORTS.includes(sport);
}

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
  /**
   * Clears persisted sport prefs (SecureStore + in-memory state). Call this
   * on account deletion so a freshly-created account doesn't inherit the
   * previous account's followed sports from the on-device cache.
   */
  resetPrefs: () => Promise<void>;
};

const SportContext = createContext<SportContextValue | null>(null);

export function SportProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [followedSports, setFollowedSports] = useState<Sport[]>([]);
  const [defaultSport, setDefaultSport] = useState<Sport>("tennis");
  const [activeSport, setActiveSportState] = useState<Sport>("tennis");
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
          setDefaultSport(prefs.defaultSport ?? "tennis");
          setActiveSportState(prefs.defaultSport ?? "tennis");
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

  const resetPrefs = useCallback(async () => {
    seededFromSession.current = false;
    setFollowedSports([]);
    setDefaultSport("tennis");
    setActiveSportState("tennis");
    await SecureStore.deleteItemAsync(STORAGE_KEY).catch(() => {});
  }, []);

  // followedSports may include "coming soon" sports (golf) — those drive
  // Home's per-sport player suggestions, so they're kept, just filtered down
  // to sports that are followable at all (drops any stale basketball/hockey/
  // football/soccer data from before that list was restricted).
  // activeSport/defaultSport control which sport's dedicated tab experience
  // is entered, so those stay restricted to ENABLED_SPORTS regardless of
  // what's stored — a followed "coming soon" sport should never open its tab.
  const followableFollowedSports = followedSports.filter((sport) => ALL_SPORTS.includes(sport));
  const enabledDefaultSport = ENABLED_SPORTS.includes(defaultSport) ? defaultSport : ENABLED_SPORTS[0];
  const enabledActiveSport = ENABLED_SPORTS.includes(activeSport) ? activeSport : ENABLED_SPORTS[0];

  const value: SportContextValue = {
    activeSport: enabledActiveSport,
    followedSports: followableFollowedSports,
    defaultSport: enabledDefaultSport,
    isLoading,
    isOnboarded: followableFollowedSports.length > 0,
    setActiveSport,
    finishOnboarding,
    resetPrefs,
  };

  return <SportContext.Provider value={value}>{children}</SportContext.Provider>;
}

export function useSport(): SportContextValue {
  const ctx = useContext(SportContext);
  if (!ctx) throw new Error("useSport must be used within SportProvider");
  return ctx;
}
