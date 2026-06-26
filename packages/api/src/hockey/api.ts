import { apiFetch, buildQuery, type PageParams } from "../client";
import type { HockeyGame, HockeyTeam, HockeyPlayer } from "./types";

export const hockey = {
  /** GET /api/v4/hockey/games — filterable by date/league/status */
  getGames(params?: { date?: string; league?: string; status?: string } & PageParams) {
    return apiFetch<{ data: HockeyGame[] }>(`/api/v4/hockey/games${buildQuery(params)}`);
  },

  getGame(id: string) {
    return apiFetch<{ data: HockeyGame }>(`/api/v4/hockey/games/${id}`);
  },

  /** GET /api/v4/hockey/teams — standings, filterable by league/conference */
  getTeams(params?: { league?: string; conference?: string } & PageParams) {
    return apiFetch<{ data: HockeyTeam[] }>(`/api/v4/hockey/teams${buildQuery(params)}`);
  },

  getTeam(id: string) {
    return apiFetch<{ data: HockeyTeam }>(`/api/v4/hockey/teams/${id}`);
  },

  getPlayers(params?: { league?: string; team_id?: string; q?: string; position?: string } & PageParams) {
    return apiFetch<{ data: HockeyPlayer[] }>(`/api/v4/hockey/players${buildQuery(params)}`);
  },

  getPlayer(id: string) {
    return apiFetch<{ data: HockeyPlayer }>(`/api/v4/hockey/players/${id}`);
  },

  getFollowedPlayers(token: string) {
    return apiFetch<{ data: string[] }>("/api/v4/hockey/players/followed_players", { token });
  },

  followPlayer(playerId: string, token: string) {
    return apiFetch("/api/v4/hockey/players/follow", {
      method: "POST",
      body: { player_id: playerId },
      token,
    });
  },

  unfollowPlayer(playerId: string, token: string) {
    return apiFetch("/api/v4/hockey/players/unfollow", {
      method: "POST",
      body: { player_id: playerId },
      token,
    });
  },
};
