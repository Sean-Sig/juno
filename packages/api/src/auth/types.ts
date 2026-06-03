export type AuthSession = {
  token: string;
  fan_id: string;
  account_id: string;
};

export type AuthResponse = AuthSession;

export type AuthFieldErrors = { errors: Record<string, string[]> };
export type AuthError = { error: string } | AuthFieldErrors;
