import { apiFetch } from "../client";
import type { ScoutResult } from "./types";

export const scout = {
  getCredits(token: string): Promise<{ data: { credits: number } }> {
    return apiFetch("/api/v4/scout/credits", { token });
  },

  analyze(token: string, sport: string, playerIds: string[]): Promise<{ data: ScoutResult }> {
    return apiFetch("/api/v4/scout/analyze", {
      method: "POST",
      token,
      body: { sport, player_ids: playerIds },
    });
  },
};
