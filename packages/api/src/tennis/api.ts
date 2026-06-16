import { apiFetch, buildQuery, type PageParams } from "../client";
import type {
  TennisPlayer,
  TennisMatch,
  TennisTournament,
  TennisScheduleEntry,
  MatchComment,
} from "./types";

export const tennis = {
  // V4 — global player list (sort: "singles_rank" | "doubles_rank", gender: "male" | "female", paginated)
  getPlayers(params?: { sort?: string; gender?: "male" | "female" } & PageParams) {
    return apiFetch<{ data: TennisPlayer[] }>(`/api/v4/tennis/players${buildQuery(params)}`);
  },

  // V3
  getPlayer(id: string) {
    return apiFetch<{ data: TennisPlayer }>(`/api/v3/tennis/players/${id}`);
  },

  getMatch(id: string) {
    return apiFetch<{ data: TennisMatch }>(`/api/v3/tennis/matches/${id}`);
  },

  getTournaments(teamId: string, params?: PageParams) {
    return apiFetch<{ data: TennisTournament[] }>(`/api/v3/tennis/tournaments/${teamId}${buildQuery(params)}`);
  },

  getTournamentMatches(teamId: string, params?: PageParams) {
    return apiFetch<{ data: TennisMatch[] }>(
      `/api/v3/tennis/tournaments/${teamId}/matches${buildQuery(params)}`
    );
  },

  getTournamentPlayers(teamId: string, params?: PageParams) {
    return apiFetch<{ data: TennisPlayer[] }>(
      `/api/v3/tennis/tournaments/${teamId}/players${buildQuery(params)}`
    );
  },

  getScheduleEntries(params?: PageParams) {
    return apiFetch<{ data: TennisScheduleEntry[] }>(`/api/v3/tennis/tennis_schedule_entries${buildQuery(params)}`);
  },

  getScheduleEntry(id: string) {
    return apiFetch<{ data: TennisScheduleEntry }>(`/api/v3/tennis/tennis_schedule_entries/${id}`);
  },

  // V4
  searchPlayers(query: string) {
    return apiFetch<{ data: TennisPlayer[] }>(`/api/v4/tennis/players/search?q=${encodeURIComponent(query)}`);
  },

  getPlayerFull(id: string) {
    return apiFetch<{ data: TennisPlayer }>(`/api/v4/tennis/players/${id}`);
  },

  getPlayerFaceoffs(playerId: string, opponentId: string) {
    return apiFetch<{ data: unknown }>(`/api/v4/tennis/players/${playerId}/faceoffs?opponent_id=${opponentId}`);
  },

  getRecentMatch(playerId: string) {
    return apiFetch<{ data: TennisMatch | null }>(`/api/v4/tennis/players/recent_match?player_id=${playerId}`);
  },

  getPlayerMatches(playerId: string, tournamentId: string) {
    return apiFetch<{ data: TennisMatch[] }>(
      `/api/v4/tennis/players/${playerId}/matches?tournament_id=${tournamentId}`
    );
  },

  getCountries() {
    return apiFetch<{ data: string[] }>("/api/v4/tennis/countries");
  },

  getTicker(params?: PageParams) {
    return apiFetch<{ data: TennisMatch[] }>(`/api/v4/tennis/ticker${buildQuery(params)}`);
  },

  getMostFollowed(teamId: string) {
    return apiFetch<{ data: TennisPlayer[] }>(
      `/api/v4/tennis/tournaments/${teamId}/players/most_followed`
    );
  },

  getMatchComments(matchId: string, locale = "en", params?: PageParams) {
    return apiFetch<{ data: MatchComment[] }>(
      `/api/v4/tennis/match_comments${buildQuery({ match_id: matchId, locale, ...params })}`
    );
  },

  followPlayer(playerId: string, token: string) {
    return apiFetch("/api/v3/tennis/players/follow", {
      method: "POST",
      body: { player_id: playerId },
      token,
    });
  },

  unfollowPlayer(playerId: string, token: string) {
    return apiFetch("/api/v3/tennis/players/unfollow", {
      method: "POST",
      body: { player_id: playerId },
      token,
    });
  },

  getFollowedPlayers(token: string) {
    return apiFetch<{ data: string[] }>("/api/v3/tennis/players/followed_players", { token });
  },

  bulkFollowPlayers(playerIds: string[], token: string) {
    return apiFetch("/api/v3/tennis/players/bulk_follow_players", {
      method: "POST",
      body: { player_ids: playerIds },
      token,
    });
  },
};
