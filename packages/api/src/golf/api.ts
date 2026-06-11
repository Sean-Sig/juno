import { apiFetch, buildQuery, type PageParams } from "../client";
import type { GolfPlayer, GolfTournament, GolfScheduleEntry, PlayerSeasonRank, GolfPlayerScore } from "./types";

export const golf = {
  getPlayers(params?: { sort?: string } & PageParams) {
    return apiFetch<{ data: GolfPlayer[] }>(`/api/v4/golf/players${buildQuery(params)}`);
  },

  getPlayer(id: string) {
    return apiFetch<{ data: GolfPlayer }>(`/api/v4/golf/players/${id}`);
  },

  getPlayerScores(id: string) {
    return apiFetch<{ data: GolfPlayerScore[] }>(`/api/v4/golf/players/${id}/scores`);
  },

  getPlayerSeasonRanks(id: string, params?: PageParams) {
    return apiFetch<{ data: PlayerSeasonRank[] }>(
      `/api/v4/golf/players/${id}/season_ranks/standings${buildQuery(params)}`
    );
  },

  getTournaments(teamId: string, params?: { hide_scores?: boolean } & PageParams) {
    return apiFetch<{ data: GolfTournament[] }>(`/api/v4/golf/tournaments/${teamId}${buildQuery(params)}`);
  },

  getScheduleEntries(params?: PageParams) {
    return apiFetch<{ data: GolfScheduleEntry[] }>(`/api/v4/golf_schedule_entries${buildQuery(params)}`);
  },

  getScheduleEntry(id: string) {
    return apiFetch<{ data: GolfScheduleEntry }>(`/api/v4/golf_schedule_entries/${id}`);
  },

  followPlayer(playerId: string, token: string) {
    return apiFetch("/api/v4/golf/players/follow", {
      method: "POST",
      body: { golfer_id: playerId },
      token,
    });
  },

  unfollowPlayer(playerId: string, token: string) {
    return apiFetch("/api/v4/golf/players/unfollow", {
      method: "POST",
      body: { golfer_id: playerId },
      token,
    });
  },

  getFollowedPlayers(token: string) {
    return apiFetch<{ data: string[] }>("/api/v4/golf/players/followed_players", { token });
  },

  bulkFollowPlayers(playerIds: string[], token: string) {
    return apiFetch("/api/v4/golf/players/bulk_follow_players", {
      method: "POST",
      body: { golfer_ids: playerIds },
      token,
    });
  },
};
