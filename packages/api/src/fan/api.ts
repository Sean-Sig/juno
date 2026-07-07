import { apiFetch } from "../client";

export type FanProfile = {
  id: string;
  email: string;
  account_id: string;
  display_name: string | null;
  followed_sports: string[];
  default_sport: string | null;
};

export type SportPrefs = {
  followed_sports: string[];
  default_sport: string;
};

export const fan = {
  /** GET /api/v4/me — returns full fan profile including sport prefs */
  getMe(token: string): Promise<{ data: FanProfile }> {
    return apiFetch("/api/v4/me", { token });
  },

  /** PUT /api/v4/me/sports — update followed_sports and default_sport */
  updateSports(token: string, prefs: SportPrefs): Promise<{ data: SportPrefs }> {
    return apiFetch("/api/v4/me/sports", {
      method: "PUT",
      token,
      body: prefs,
    });
  },

  /** PUT /api/v4/me/name — update display_name (any non-blank string, up to 40 chars) */
  updateDisplayName(token: string, displayName: string): Promise<{ data: { display_name: string } }> {
    return apiFetch("/api/v4/me/name", {
      method: "PUT",
      token,
      body: { display_name: displayName },
    });
  },

  /** DELETE /api/v4/me — permanently deletes the fan's account and all associated data */
  deleteAccount(token: string): Promise<void> {
    return apiFetch("/api/v4/me", { method: "DELETE", token });
  },
};
