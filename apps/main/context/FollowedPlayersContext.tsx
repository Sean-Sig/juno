import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  golf,
  tennis,
  basketball,
  hockey,
  football,
  soccer,
  useAuth,
  useSport,
  type Sport,
} from "@juno/api";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function apiForSport(sport: Sport) {
  switch (sport) {
    case "golf":       return golf;
    case "tennis":     return tennis;
    case "basketball": return basketball;
    case "hockey":     return hockey;
    case "football":   return football;
    case "soccer":     return soccer;
  }
}

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------
type FollowedCtx = {
  followedIds: string[];
  isFollowed: (id: string) => boolean;
  follow: (id: string) => Promise<void>;
  unfollow: (id: string) => Promise<void>;
};

const FollowedPlayersCtx = createContext<FollowedCtx>({
  followedIds: [],
  isFollowed: () => false,
  follow: async () => {},
  unfollow: async () => {},
});

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export function FollowedPlayersProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session } = useAuth();
  const { activeSport } = useSport();
  const [followedIds, setFollowedIds] = useState<string[]>([]);

  // Re-fetch whenever session or active sport changes
  useEffect(() => {
    if (!session) {
      setFollowedIds([]);
      return;
    }
    apiForSport(activeSport)
      .getFollowedPlayers(session.token)
      .then(({ data }) => setFollowedIds(data))
      .catch(() => {});
  }, [session, activeSport]);

  const follow = useCallback(
    async (id: string) => {
      if (!session) return;
      // Optimistic update
      setFollowedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
      try {
        await apiForSport(activeSport).followPlayer(id, session.token);
      } catch {
        // Roll back on error
        setFollowedIds((prev) => prev.filter((x) => x !== id));
      }
    },
    [session, activeSport]
  );

  const unfollow = useCallback(
    async (id: string) => {
      if (!session) return;
      // Optimistic update
      setFollowedIds((prev) => prev.filter((x) => x !== id));
      try {
        await apiForSport(activeSport).unfollowPlayer(id, session.token);
      } catch {
        // Roll back on error
        setFollowedIds((prev) => [...prev, id]);
      }
    },
    [session, activeSport]
  );

  return (
    <FollowedPlayersCtx.Provider
      value={{
        followedIds,
        isFollowed: (id) => followedIds.includes(id),
        follow,
        unfollow,
      }}
    >
      {children}
    </FollowedPlayersCtx.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useFollowedPlayers() {
  return useContext(FollowedPlayersCtx);
}

// ---------------------------------------------------------------------------
// Cross-sport variant — for screens that need followed players from every
// sport at once (currently just the Home feed), unlike useFollowedPlayers()
// above which is intentionally scoped to whichever sport is active.
// ---------------------------------------------------------------------------
type FollowedPlayersAllCtx = {
  /** Map of sport → set of followed player IDs */
  followedIds: Record<Sport, string[]>;
  isFollowed: (sport: Sport, id: string) => boolean;
  follow: (sport: Sport, id: string) => Promise<void>;
  unfollow: (sport: Sport, id: string) => Promise<void>;
};

const emptyAll: Record<Sport, string[]> = {
  golf: [], tennis: [], basketball: [], hockey: [], football: [], soccer: [],
};

const FollowedPlayersAllCtx = createContext<FollowedPlayersAllCtx>({
  followedIds: emptyAll,
  isFollowed: () => false,
  follow: async () => {},
  unfollow: async () => {},
});

const ALL_SPORTS: Sport[] = ["golf", "tennis", "basketball", "hockey", "football", "soccer"];

export function FollowedPlayersAllProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [followedIds, setFollowedIds] = useState<Record<Sport, string[]>>(emptyAll);

  useEffect(() => {
    if (!session) {
      setFollowedIds(emptyAll);
      return;
    }
    Promise.all(
      ALL_SPORTS.map((sport) =>
        apiForSport(sport)
          .getFollowedPlayers(session.token)
          .then(({ data }) => ({ sport, ids: data }))
          .catch(() => ({ sport, ids: [] as string[] }))
      )
    ).then((results) => {
      const next = { ...emptyAll };
      for (const { sport, ids } of results) next[sport] = ids;
      setFollowedIds(next);
    });
  }, [session]);

  const follow = useCallback(
    async (sport: Sport, id: string) => {
      if (!session) return;
      setFollowedIds((prev) => ({
        ...prev,
        [sport]: prev[sport].includes(id) ? prev[sport] : [...prev[sport], id],
      }));
      try {
        await apiForSport(sport).followPlayer(id, session.token);
      } catch {
        setFollowedIds((prev) => ({ ...prev, [sport]: prev[sport].filter((x) => x !== id) }));
      }
    },
    [session]
  );

  const unfollow = useCallback(
    async (sport: Sport, id: string) => {
      if (!session) return;
      setFollowedIds((prev) => ({ ...prev, [sport]: prev[sport].filter((x) => x !== id) }));
      try {
        await apiForSport(sport).unfollowPlayer(id, session.token);
      } catch {
        setFollowedIds((prev) => ({
          ...prev,
          [sport]: prev[sport].includes(id) ? prev[sport] : [...prev[sport], id],
        }));
      }
    },
    [session]
  );

  return (
    <FollowedPlayersAllCtx.Provider
      value={{
        followedIds,
        isFollowed: (sport, id) => followedIds[sport].includes(id),
        follow,
        unfollow,
      }}
    >
      {children}
    </FollowedPlayersAllCtx.Provider>
  );
}

export function useFollowedPlayersAll() {
  return useContext(FollowedPlayersAllCtx);
}
