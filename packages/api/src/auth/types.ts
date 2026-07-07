export type AuthSession = {
  token: string;
  fan_id: string;
  account_id: string;
  /** Readable display name, randomly generated at registration; editable in Profile */
  display_name?: string | null;
  /** Sports the fan has chosen to follow — included in login/register/me responses */
  followed_sports?: string[];
  /** The fan's default sport */
  default_sport?: string | null;
};

export type AuthResponse = AuthSession;

export type AuthFieldErrors = { errors: Record<string, string[]> };
export type AuthError = { error: string } | AuthFieldErrors;
