import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import * as SecureStore from "expo-secure-store";
import {
  golfPalettes,
  tennisPalettes,
  basketballPalettes,
  hockeyPalettes,
  footballPalettes,
  soccerPalettes,
  spacing,
  radius,
  typography,
  type Palette,
  type ThemeMode,
} from "./theme";

export type Sport = "golf" | "tennis" | "basketball" | "hockey" | "football" | "soccer";
export type ThemePreference = ThemeMode | "system";

type ThemeContextValue = {
  sport: Sport;
  mode: ThemeMode;
  preference: ThemePreference;
  colors: Palette;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const palettesBySport: Record<Sport, { light: Palette; dark: Palette }> = {
  golf: golfPalettes,
  tennis: tennisPalettes,
  basketball: basketballPalettes,
  hockey: hockeyPalettes,
  football: footballPalettes,
  soccer: soccerPalettes,
};

// Single key — theme preference is global, not per-sport
const THEME_STORAGE_KEY = "juno_theme_preference";

export function ThemeProvider({ sport, children }: { sport: Sport; children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>("system");

  // Load once on mount — sport changes don't affect the stored preference
  useEffect(() => {
    SecureStore.getItemAsync(THEME_STORAGE_KEY).then((saved) => {
      if (saved === "light" || saved === "dark" || saved === "system") {
        setPreferenceState(saved);
      }
    });
  }, []);

  function setPreference(next: ThemePreference) {
    setPreferenceState(next);
    if (next === "system") {
      SecureStore.deleteItemAsync(THEME_STORAGE_KEY).catch(() => {});
    } else {
      SecureStore.setItemAsync(THEME_STORAGE_KEY, next).catch(() => {});
    }
  }

  const mode: ThemeMode = preference === "system" ? (systemScheme === "dark" ? "dark" : "light") : preference;
  const colors = palettesBySport[sport][mode];

  const value = useMemo<ThemeContextValue>(
    () => ({ sport, mode, preference, colors, spacing, radius, typography, setPreference }),
    [sport, mode, preference, colors]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
