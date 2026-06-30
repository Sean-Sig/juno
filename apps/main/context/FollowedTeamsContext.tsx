import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { basketball, hockey, football, soccer, useAuth } from "@juno/api";

// ---------------------------------------------------------------------------
// Team sports only — golf/tennis don't have "teams" in this sense
// ---------------------------------------------------------------------------
type TeamSport = "basketball" | "hockey" | "football" | "soccer";

const TEAM_SPORTS: TeamSport[] = ["basketball", "hockey", "football", "soccer"];

function apiForSport(sport: TeamSport) {
  switch (sport) {
    case "basketball": return basketball;
    case "hockey":     return hockey;
    case "football":   return football;
    case "soccer":     return soccer;
  }
}

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------
type FollowedTeamsCtxValue = {
  /** Map of sport → set of followed team IDs */
  followedIds: Record<TeamSport, string[]>;
  isFollowed: (sport: TeamSport, teamId: string) => boolean;
  follow: (sport: TeamSport, teamId: string) => Promise<void>;
  unfollow: (sport: TeamSport, teamId: string) => Promise<void>;
};

const empty: Record<TeamSport, string[]> = {
  basketball: [],
  hockey: [],
  football: [],
  soccer: [],
};

const FollowedTeamsCtx = createContext<FollowedTeamsCtxValue>({
  followedIds: empty,
  isFollowed: () => false,
  follow: async () => {},
  unfollow: async () => {},
});

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export function FollowedTeamsProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [followedIds, setFollowedIds] = useState<Record<TeamSport, string[]>>(empty);

  useEffect(() => {
    if (!session) {
      setFollowedIds(empty);
      return;
    }
    // Fetch followed teams for all team sports in parallel
    Promise.all(
      TEAM_SPORTS.map((sport) =>
        apiForSport(sport)
          .getFollowedTeams(session.token)
          .then(({ data }) => ({ sport, ids: data }))
          .catch(() => ({ sport, ids: [] as string[] }))
      )
    ).then((results) => {
      const next = { ...empty };
      for (const { sport, ids } of results) next[sport] = ids;
      setFollowedIds(next);
    });
  }, [session]);

  const follow = useCallback(
    async (sport: TeamSport, teamId: string) => {
      if (!session) return;
      setFollowedIds((prev) => ({
        ...prev,
        [sport]: prev[sport].includes(teamId) ? prev[sport] : [...prev[sport], teamId],
      }));
      try {
        await apiForSport(sport).followTeam(teamId, session.token);
      } catch {
        setFollowedIds((prev) => ({
          ...prev,
          [sport]: prev[sport].filter((id) => id !== teamId),
        }));
      }
    },
    [session]
  );

  const unfollow = useCallback(
    async (sport: TeamSport, teamId: string) => {
      if (!session) return;
      setFollowedIds((prev) => ({
        ...prev,
        [sport]: prev[sport].filter((id) => id !== teamId),
      }));
      try {
        await apiForSport(sport).unfollowTeam(teamId, session.token);
      } catch {
        setFollowedIds((prev) => ({
          ...prev,
          [sport]: [...prev[sport], teamId],
        }));
      }
    },
    [session]
  );

  return (
    <FollowedTeamsCtx.Provider
      value={{
        followedIds,
        isFollowed: (sport, teamId) => followedIds[sport].includes(teamId),
        follow,
        unfollow,
      }}
    >
      {children}
    </FollowedTeamsCtx.Provider>
  );
}

export function useFollowedTeams() {
  return useContext(FollowedTeamsCtx);
}
