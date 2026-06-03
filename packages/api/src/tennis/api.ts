import { apiFetch } from "../client";
import type {
  TennisPlayer,
  TennisMatch,
  TennisTournament,
  TennisScheduleEntry,
  MatchComment,
} from "./types";

export const tennis = {
  // V3
  getPlayer(id: string) {
    return apiFetch<{ data: TennisPlayer }>(`/api/v3/tennis/players/${id}`);
  },

  getMatch(id: string) {
    return apiFetch<{ data: TennisMatch }>(`/api/v3/tennis/matches/${id}`);
  },

  getTournaments(teamId: string) {
    return apiFetch<{ data: TennisTournament[] }>(`/api/v3/tennis/tournaments/${teamId}`);
  },

  getTournamentMatches(teamId: string) {
    return apiFetch<{ data: TennisMatch[] }>(`/api/v3/tennis/tournaments/${teamId}/matches`);
  },

  getTournamentPlayers(teamId: string) {
    return apiFetch<{ data: TennisPlayer[] }>(`/api/v3/tennis/tournaments/${teamId}/players`);
  },

  getScheduleEntries() {
    return apiFetch<{ data: TennisScheduleEntry[] }>("/api/v3/tennis/tennis_schedule_entries");
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

  getCountries() {
    return apiFetch<{ data: string[] }>("/api/v4/tennis/countries");
  },

  getTicker() {
    return apiFetch<{ data: TennisMatch[] }>("/api/v4/tennis/ticker");
  },

  getMostFollowed(teamId: string) {
    return apiFetch<{ data: TennisPlayer[] }>(
      `/api/v4/tennis/tournaments/${teamId}/players/most_followed`
    );
  },

  getMatchComments(matchId: string, locale = "en") {
    return apiFetch<{ data: MatchComment[] }>(
      `/api/v4/tennis/match_comments?match_id=${matchId}&locale=${locale}`
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
};
