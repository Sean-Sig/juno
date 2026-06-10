import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { AuthProvider, useAuth, SportProvider, useSport } from "@juno/api";
import { ThemeProvider, useTheme } from "@juno/ui";

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
  const { isOnboarded, isLoading: sportLoading, syncFromBackend } = useSport();
  const { colors, mode } = useTheme();
  const segments = useSegments();
  const router = useRouter();

  // After login, pull latest sport prefs from backend in the background
  useEffect(() => {
    if (session?.token) {
      syncFromBackend(session.token);
    }
  }, [session?.token]);

  useEffect(() => {
    if (authLoading || sportLoading) return;

    SplashScreen.hideAsync();

    const inAuth = segments[0] === "(auth)";
    const inOnboarding = segments[0] === "onboarding";
    const inApp = segments[0] === "(app)";

    if (!session) {
      if (!inAuth) router.replace("/(auth)/login");
      return;
    }

    if (!isOnboarded) {
      if (!inOnboarding) router.replace("/onboarding");
      return;
    }

    if (!inApp) {
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

  return (
    <>
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false }} />
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
