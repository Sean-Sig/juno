import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { AuthProvider, useAuth, SportProvider, useSport } from "@juno/api";
import { ThemeProvider, useTheme, typography } from "@juno/ui";

SplashScreen.preventAutoHideAsync();

/**
 * Inner navigator — runs INSIDE AuthProvider + SportProvider.
 * Handles three redirect cases:
 *  1. Not logged in → /(auth)/login
 *  2. Logged in but no sports picked → /onboarding
 *  3. Ready → /(app)/ (the tab layout)
 */
function RootNavigator() {
  const { session, isLoading: authLoading } = useAuth();
  const { isOnboarded, isLoading: sportLoading } = useSport();
  const { colors, mode } = useTheme();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (authLoading || sportLoading) return;

    SplashScreen.hideAsync();

    const inAuth = segments[0] === "(auth)";
    const inOnboarding = segments[0] === "onboarding";
    const inApp = segments[0] === "(app)";
    // Root-level detail screens pushed over the tab layout — don't redirect these
    const inDetailScreen = ["tournament", "player", "game", "match"].includes(segments[0] as string);

    if (!session) {
      if (!inAuth) router.replace("/(auth)/login");
      return;
    }

    if (!isOnboarded) {
      if (!inOnboarding) router.replace("/onboarding");
      return;
    }

    if (!inApp && !inDetailScreen) {
      router.replace("/(app)/");
    }
  }, [authLoading, sportLoading, session, isOnboarded, segments]);

  if (authLoading || sportLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const detailHeader = {
    headerShown: true,
    headerStyle: { backgroundColor: colors.surface },
    headerTintColor: colors.text,
    headerTitleStyle: { ...(typography.h3 as object) },
    headerBackTitle: "",
  } as const;

  return (
    <>
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="player/[id]" options={{ ...detailHeader, title: "Player" }} />
        <Stack.Screen name="game/[id]" options={{ ...detailHeader, title: "Game" }} />
        <Stack.Screen name="tournament/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="match/[id]" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

/**
 * Reads active sport from SportContext and feeds it to ThemeProvider
 * so colors swap when the sport switches.
 */
function SportAwareTheme({ children }: { children: React.ReactNode }) {
  const { activeSport } = useSport();
  return <ThemeProvider sport={activeSport}>{children}</ThemeProvider>;
}

export default function RootLayout() {
  return (
    <AuthProvider sessionKey="juno_session">
      <SportProvider>
        <SportAwareTheme>
          <RootNavigator />
        </SportAwareTheme>
      </SportProvider>
    </AuthProvider>
  );
}
