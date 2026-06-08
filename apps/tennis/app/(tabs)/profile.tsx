import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { tennis, TennisPlayer, useAuth } from "@juno/api";
import { PlayerCard, TopAppBar, useTheme, spacing, typography, radius, type Palette, type ThemePreference } from "@juno/ui";

const TEAM_ID = process.env.EXPO_PUBLIC_TENNIS_TEAM_ID ?? "00000000-0000-0000-0000-000000000002";

export default function ProfileScreen() {
  const { colors, preference, setPreference } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { session, logout } = useAuth();
  const router = useRouter();
  const [followedPlayers, setFollowedPlayers] = useState<TennisPlayer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) {
      setLoading(false);
      return;
    }
    tennis.getFollowedPlayers(session.token).then(({ data: ids }) => {
      return tennis.getTournamentPlayers(TEAM_ID).then(({ data: players }) => {
        setFollowedPlayers(players.filter((p) => ids.includes(p.id)));
      });
    }).finally(() => setLoading(false));
  }, [session]);

  function cycleAppearance() {
    const order: ThemePreference[] = ["system", "light", "dark"];
    const next = order[(order.indexOf(preference) + 1) % order.length];
    setPreference(next);
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <TopAppBar
        title="Profile"
        avatarUri={null}
        avatarInitials={session?.fan_id?.[0]?.toUpperCase() ?? "?"}
      />

      {!session ? (
        <View style={styles.center}>
          <Text style={styles.empty}>Sign in to manage your account and followed players.</Text>
          <TouchableOpacity style={styles.signInButton} onPress={() => router.push("/(auth)/login")}>
            <Text style={styles.signInButtonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={followedPlayers}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View>
              <View style={styles.account}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarInitials}>{session.fan_id[0]?.toUpperCase()}</Text>
                </View>
                <Text style={styles.accountId}>Fan #{session.fan_id.slice(0, 8)}</Text>
              </View>

              <View style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={styles.rowLabel}>Appearance</Text>
                  <Text style={styles.rowValue}>
                    {preference === "system" ? "Match system" : preference === "dark" ? "Dark" : "Light"}
                  </Text>
                </View>
                <Switch
                  value={preference === "dark" || (preference === "system" && colors.background === "#121212")}
                  onValueChange={cycleAppearance}
                  trackColor={{ true: colors.primary, false: colors.border }}
                />
              </View>
              <TouchableOpacity onPress={cycleAppearance}>
                <Text style={styles.link}>Tap to cycle: System → Light → Dark</Text>
              </TouchableOpacity>

              <Text style={styles.sectionTitle}>Followed Players</Text>
              {loading && <ActivityIndicator color={colors.primary} style={styles.loadingIndicator} />}
              {!loading && followedPlayers.length === 0 && (
                <Text style={styles.empty}>You're not following anyone yet.</Text>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <PlayerCard
              firstName={item.display_first_name ?? item.first_name}
              lastName={item.display_last_name ?? item.last_name}
              country={item.country}
              photo={item.photo}
              rank={item.singles_rank}
              rankLabel="ATP/WTA"
              onPress={() => router.push(`/player/${item.id}`)}
            />
          )}
          ListFooterComponent={
            <TouchableOpacity style={styles.logoutButton} onPress={logout}>
              <Text style={styles.logoutText}>Log Out</Text>
            </TouchableOpacity>
          }
        />
      )}
    </SafeAreaView>
  );
}

function createStyles(colors: Palette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg, gap: spacing.md },
    list: { padding: spacing.md },
    account: { alignItems: "center", marginBottom: spacing.lg },
    avatar: {
      width: 72,
      height: 72,
      borderRadius: radius.full,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.sm,
    },
    avatarInitials: { ...typography.h2, color: colors.textOnPrimary, fontWeight: "700" },
    accountId: { ...typography.body, color: colors.textSecondary },
    row: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.xs,
    },
    rowText: { flex: 1 },
    rowLabel: { ...typography.body, color: colors.text, fontWeight: "600" },
    rowValue: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
    link: { ...typography.caption, color: colors.primary, marginBottom: spacing.lg },
    sectionTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
    loadingIndicator: { marginVertical: spacing.md },
    empty: { ...typography.body, color: colors.textSecondary, textAlign: "center" },
    signInButton: {
      backgroundColor: colors.primary,
      borderRadius: radius.full,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
    },
    signInButtonText: { ...typography.label, color: colors.textOnPrimary, fontWeight: "700" },
    logoutButton: {
      marginTop: spacing.lg,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.error,
      paddingVertical: spacing.sm,
      alignItems: "center",
    },
    logoutText: { ...typography.label, color: colors.error, fontWeight: "700" },
  });
}
