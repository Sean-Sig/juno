import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import * as SecureStore from "expo-secure-store";
import {
  golfPalettes,
  tennisPalettes,
  spacing,
  radius,
  typography,
  type Palette,
  type ThemeMode,
} from "./theme";

export type Sport = "golf" | "tennis";
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
};

function storageKey(sport: Sport): string {
  return `juno_${sport}_theme_preference`;
}

export function ThemeProvider({ sport, children }: { sport: Sport; children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>("system");

  useEffect(() => {
    SecureStore.getItemAsync(storageKey(sport)).then((saved) => {
      if (saved === "light" || saved === "dark" || saved === "system") {
        setPreferenceState(saved);
      }
    });
  }, [sport]);

  function setPreference(next: ThemePreference) {
    setPreferenceState(next);
    if (next === "system") {
      SecureStore.deleteItemAsync(storageKey(sport)).catch(() => {});
    } else {
      SecureStore.setItemAsync(storageKey(sport), next).catch(() => {});
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
