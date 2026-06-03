import { apiFetch } from "../client";
import type { GolfPlayer, GolfTournament, GolfScheduleEntry } from "./types";

export const golf = {
  getPlayers(params?: { sort?: string; page?: number }) {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return apiFetch<{ data: GolfPlayer[] }>(`/api/v4/golf/players${qs ? `?${qs}` : ""}`);
  },

  getPlayer(id: string) {
    return apiFetch<{ data: GolfPlayer }>(`/api/v4/golf/players/${id}`);
  },

  getPlayerScores(id: string) {
    return apiFetch<{ data: unknown[] }>(`/api/v4/golf/players/${id}/scores`);
  },

  getTournaments(teamId: string, params?: { hide_scores?: boolean }) {
    const qs = params?.hide_scores ? "?hide_scores=true" : "";
    return apiFetch<{ data: GolfTournament[] }>(`/api/v4/golf/tournaments/${teamId}${qs}`);
  },

  getScheduleEntries() {
    return apiFetch<{ data: GolfScheduleEntry[] }>("/api/v4/golf_schedule_entries");
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
};
