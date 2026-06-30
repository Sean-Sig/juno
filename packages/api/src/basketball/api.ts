import { apiFetch, buildQuery, type PageParams } from "../client";
import type { BasketballGame, BasketballTeam, BasketballPlayer, BasketballPlayerStats, BasketballScheduleEntry } from "./types";

export type BasketballPlayersSort =
  | "pts_per_g"
  | "ast_per_g"
  | "trb_per_g"
  | "stl_per_g"
  | "blk_per_g"
  | "fg_pct"
  | "fg3_pct"
  | "ft_pct"
  | "mp_per_g"
  | "games";

export const basketball = {
  /** GET /api/v4/basketball/games — filterable by date, date range, league, or status */
  getGames(params?: { date?: string; date_from?: string; date_to?: string; league?: string; status?: string; team_id?: string } & PageParams) {
    return apiFetch<{ data: BasketballGame[] }>(`/api/v4/basketball/games${buildQuery(params)}`);
  },

  getGame(id: string) {
    return apiFetch<{ data: BasketballGame }>(`/api/v4/basketball/games/${id}`);
  },

  /** GET /api/v4/basketball/teams — standings, filterable by league/conference */
  getTeams(params?: { league?: string; conference?: string } & PageParams) {
    return apiFetch<{ data: BasketballTeam[] }>(`/api/v4/basketball/teams${buildQuery(params)}`);
  },

  getTeam(id: string) {
    return apiFetch<{ data: BasketballTeam }>(`/api/v4/basketball/teams/${id}`);
  },

  getPlayers(
    params?: {
      league?: string;
      team_id?: string;
      q?: string;
      position?: string;
      sort?: BasketballPlayersSort;
      order?: "asc" | "desc";
      season?: number;
    } & PageParams,
  ) {
    return apiFetch<{ data: BasketballPlayer[]; meta: { season: number } }>(
      `/api/v4/basketball/players${buildQuery(params)}`,
    );
  },

  getPlayer(id: string) {
    return apiFetch<{ data: BasketballPlayer & { stats_history: BasketballPlayerStats[] } }>(
      `/api/v4/basketball/players/${id}`,
    );
  },

  getFollowedPlayers(token: string) {
    return apiFetch<{ data: string[] }>("/api/v4/basketball/players/followed_players", { token });
  },

  followPlayer(playerId: string, token: string) {
    return apiFetch("/api/v4/basketball/players/follow", {
      method: "POST",
      body: { player_id: playerId },
      token,
    });
  },

  unfollowPlayer(playerId: string, token: string) {
    return apiFetch("/api/v4/basketball/players/unfollow", {
      method: "POST",
      body: { player_id: playerId },
      token,
    });
  },

  getFollowedTeams(token: string) {
    return apiFetch<{ data: string[] }>("/api/v4/basketball/teams/followed_teams", { token });
  },

  followTeam(teamId: string, token: string) {
    return apiFetch("/api/v4/basketball/teams/follow", {
      method: "POST",
      body: { team_id: teamId },
      token,
    });
  },

  unfollowTeam(teamId: string, token: string) {
    return apiFetch("/api/v4/basketball/teams/unfollow", {
      method: "POST",
      body: { team_id: teamId },
      token,
    });
  },

  /** GET /api/v4/basketball/schedule_entries — named seasons/playoffs, filterable by league */
  getScheduleEntries(params?: { league?: string }) {
    return apiFetch<{ data: BasketballScheduleEntry[] }>(`/api/v4/basketball/schedule_entries${buildQuery(params)}`);
  },

  getScheduleEntry(id: string) {
    return apiFetch<{ data: BasketballScheduleEntry }>(`/api/v4/basketball/schedule_entries/${id}`);
  },
};
