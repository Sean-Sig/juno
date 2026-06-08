export type ThemeMode = "light" | "dark";

export type Palette = {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  card: string;
  text: string;
  textSecondary: string;
  textOnPrimary: string;
  textOnSecondary: string;
  border: string;
  divider: string;
  live: string;
  liveBackground: string;
  error: string;
};

export type SportPalettes = {
  light: Palette;
  dark: Palette;
};

export const golfPalettes: SportPalettes = {
  light: {
    primary: "#009778",
    secondary: "#FEC101",
    background: "#F9FAFB",
    surface: "#FFFFFF",
    card: "#FFFFFF",
    text: "#111827",
    textSecondary: "#6B7280",
    textOnPrimary: "#FFFFFF",
    textOnSecondary: "#000000",
    border: "#E5E7EB",
    divider: "rgba(17, 24, 39, 0.12)",
    live: "#16A34A",
    liveBackground: "#DCFCE7",
    error: "#DC2626",
  },
  dark: {
    primary: "#009778",
    secondary: "#FEC101",
    background: "#121212",
    surface: "#121212",
    card: "#1E1E1E",
    text: "#FFFFFF",
    textSecondary: "#B3B3B3",
    textOnPrimary: "#FFFFFF",
    textOnSecondary: "#000000",
    border: "rgba(255, 255, 255, 0.12)",
    divider: "rgba(255, 255, 255, 0.5)",
    live: "#4ADE80",
    liveBackground: "rgba(22, 163, 74, 0.2)",
    error: "#F87171",
  },
};

export const tennisPalettes: SportPalettes = {
  light: {
    primary: "#1565C0",
    secondary: "#F59E0B",
    background: "#F9FAFB",
    surface: "#FFFFFF",
    card: "#FFFFFF",
    text: "#111827",
    textSecondary: "#6B7280",
    textOnPrimary: "#FFFFFF",
    textOnSecondary: "#000000",
    border: "#E5E7EB",
    divider: "rgba(17, 24, 39, 0.12)",
    live: "#16A34A",
    liveBackground: "#DCFCE7",
    error: "#DC2626",
  },
  dark: {
    primary: "#3B82F6",
    secondary: "#FFB300",
    background: "#121212",
    surface: "#121212",
    card: "#1E1E1E",
    text: "#FFFFFF",
    textSecondary: "#B3B3B3",
    textOnPrimary: "#FFFFFF",
    textOnSecondary: "#000000",
    border: "rgba(255, 255, 255, 0.12)",
    divider: "rgba(255, 255, 255, 0.5)",
    live: "#4ADE80",
    liveBackground: "rgba(22, 163, 74, 0.2)",
    error: "#F87171",
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 12,
  lg: 16,
  full: 9999,
} as const;

export const typography = {
  h1: { fontSize: 28, fontWeight: "700" as const },
  h2: { fontSize: 22, fontWeight: "700" as const },
  h3: { fontSize: 18, fontWeight: "600" as const },
  body: { fontSize: 15, fontWeight: "400" as const },
  caption: { fontSize: 12, fontWeight: "400" as const },
  label: { fontSize: 13, fontWeight: "500" as const },
} as const;
