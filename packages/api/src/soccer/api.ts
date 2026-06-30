import { apiFetch, buildQuery, type PageParams } from "../client";
import type { SoccerGame, SoccerTeam, SoccerPlayer } from "./types";

export const soccer = {
  /** GET /api/v4/soccer/games — filterable by date/league/status */
  getGames(params?: { date?: string; league?: string; status?: string; team_id?: string } & PageParams) {
    return apiFetch<{ data: SoccerGame[] }>(`/api/v4/soccer/games${buildQuery(params)}`);
  },

  getGame(id: string) {
    return apiFetch<{ data: SoccerGame }>(`/api/v4/soccer/games/${id}`);
  },

  /** GET /api/v4/soccer/teams — standings, filterable by league/conference */
  getTeams(params?: { league?: string; conference?: string } & PageParams) {
    return apiFetch<{ data: SoccerTeam[] }>(`/api/v4/soccer/teams${buildQuery(params)}`);
  },

  getTeam(id: string) {
    return apiFetch<{ data: SoccerTeam }>(`/api/v4/soccer/teams/${id}`);
  },

  getPlayers(params?: { league?: string; team_id?: string; q?: string } & PageParams) {
    return apiFetch<{ data: SoccerPlayer[] }>(`/api/v4/soccer/players${buildQuery(params)}`);
  },

  getPlayer(id: string) {
    return apiFetch<{ data: SoccerPlayer }>(`/api/v4/soccer/players/${id}`);
  },

  getFollowedPlayers(token: string) {
    return apiFetch<{ data: string[] }>("/api/v4/soccer/players/followed_players", { token });
  },

  followPlayer(playerId: string, token: string) {
    return apiFetch("/api/v4/soccer/players/follow", {
      method: "POST",
      body: { player_id: playerId },
      token,
    });
  },

  unfollowPlayer(playerId: string, token: string) {
    return apiFetch("/api/v4/soccer/players/unfollow", {
      method: "POST",
      body: { player_id: playerId },
      token,
    });
  },

  getFollowedTeams(token: string) {
    return apiFetch<{ data: string[] }>("/api/v4/soccer/teams/followed_teams", { token });
  },

  followTeam(teamId: string, token: string) {
    return apiFetch("/api/v4/soccer/teams/follow", {
      method: "POST",
      body: { team_id: teamId },
      token,
    });
  },

  unfollowTeam(teamId: string, token: string) {
    return apiFetch("/api/v4/soccer/teams/unfollow", {
      method: "POST",
      body: { team_id: teamId },
      token,
    });
  },
};
