const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";

export const TERMS_URL = process.env.EXPO_PUBLIC_TERMS_URL ?? `${API_URL}/legal/terms`;
export const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL ?? `${API_URL}/legal/privacy`;

// Placeholder until there's a business email — swap via EXPO_PUBLIC_SUPPORT_EMAIL.
export const SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? "ssiggard07@gmail.com";
