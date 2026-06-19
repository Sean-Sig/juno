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
