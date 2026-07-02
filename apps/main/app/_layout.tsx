import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator, Platform } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import React, { useEffect, useRef } from "react";
import { AuthProvider, useAuth, SportProvider, useSport, registerPushToken } from "@juno/api";
import { ThemeProvider, useTheme, typography } from "@juno/ui";
import { FollowedPlayersProvider, FollowedPlayersAllProvider } from "../context/FollowedPlayersContext";
import { FollowedTeamsProvider } from "../context/FollowedTeamsContext";

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
  const didLandOnHome = useRef(false);

  useEffect(() => {
    if (authLoading || sportLoading) return;

    SplashScreen.hideAsync();

    const inAuth = segments[0] === "(auth)";
    const inOnboarding = segments[0] === "onboarding";
    const inDetailScreen = ["tournament", "match", "scorecard"].includes(segments[0] as string);

    if (!session) {
      didLandOnHome.current = false;
      if (!inAuth) router.replace("/(auth)/login");
      return;
    }

    if (!isOnboarded) {
      didLandOnHome.current = false;
      if (!inOnboarding) router.replace("/onboarding");
      return;
    }

    // On the very first render after auth resolves (including app refresh),
    // always land on home — Expo Router restores the last active tab otherwise.
    if (!didLandOnHome.current && !inDetailScreen) {
      didLandOnHome.current = true;
      router.replace("/(app)/home");
    }
  }, [authLoading, sportLoading, session, isOnboarded, segments]);

  // Register Expo push token once per session. Silently skips in Expo Go
  // (no projectId) and when permission is denied — never blocks the app.
  useEffect(() => {
    if (!session) return;

    (async () => {
      try {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== "granted") return;

        const tokenData = await Notifications.getExpoPushTokenAsync();
        const platform = Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : null;
        await registerPushToken(tokenData.data, platform, session.token);
      } catch {
        // non-fatal: Expo Go (no projectId), permission denied, or network error
      }
    })();
  }, [session?.token]);

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
      <FollowedPlayersProvider>
      <FollowedPlayersAllProvider>
      <FollowedTeamsProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="tournament/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="match/[id]" options={{ ...detailHeader, title: "Match" }} />
          <Stack.Screen name="scorecard" options={{ ...detailHeader, title: "Scorecard" }} />
        </Stack>
      </FollowedTeamsProvider>
      </FollowedPlayersAllProvider>
      </FollowedPlayersProvider>
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
