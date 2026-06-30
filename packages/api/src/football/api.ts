import { apiFetch, buildQuery, type PageParams } from "../client";
import type { FootballGame, FootballTeam, FootballPlayer } from "./types";

export const football = {
  /** GET /api/v4/football/games — filterable by date/league/status */
  getGames(params?: { date?: string; league?: string; status?: string; team_id?: string } & PageParams) {
    return apiFetch<{ data: FootballGame[] }>(`/api/v4/football/games${buildQuery(params)}`);
  },

  getGame(id: string) {
    return apiFetch<{ data: FootballGame }>(`/api/v4/football/games/${id}`);
  },

  /** GET /api/v4/football/teams — standings, filterable by league/conference/division */
  getTeams(params?: { league?: string; conference?: string; division?: string } & PageParams) {
    return apiFetch<{ data: FootballTeam[] }>(`/api/v4/football/teams${buildQuery(params)}`);
  },

  getTeam(id: string) {
    return apiFetch<{ data: FootballTeam }>(`/api/v4/football/teams/${id}`);
  },

  getPlayers(params?: { league?: string; team_id?: string; q?: string; position?: string } & PageParams) {
    return apiFetch<{ data: FootballPlayer[] }>(`/api/v4/football/players${buildQuery(params)}`);
  },

  getPlayer(id: string) {
    return apiFetch<{ data: FootballPlayer }>(`/api/v4/football/players/${id}`);
  },

  getFollowedPlayers(token: string) {
    return apiFetch<{ data: string[] }>("/api/v4/football/players/followed_players", { token });
  },

  followPlayer(playerId: string, token: string) {
    return apiFetch("/api/v4/football/players/follow", {
      method: "POST",
      body: { player_id: playerId },
      token,
    });
  },

  unfollowPlayer(playerId: string, token: string) {
    return apiFetch("/api/v4/football/players/unfollow", {
      method: "POST",
      body: { player_id: playerId },
      token,
    });
  },

  getFollowedTeams(token: string) {
    return apiFetch<{ data: string[] }>("/api/v4/football/teams/followed_teams", { token });
  },

  followTeam(teamId: string, token: string) {
    return apiFetch("/api/v4/football/teams/follow", {
      method: "POST",
      body: { team_id: teamId },
      token,
    });
  },

  unfollowTeam(teamId: string, token: string) {
    return apiFetch("/api/v4/football/teams/unfollow", {
      method: "POST",
      body: { team_id: teamId },
      token,
    });
  },
};
