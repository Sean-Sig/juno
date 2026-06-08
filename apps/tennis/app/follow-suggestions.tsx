import React, { useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, ActivityIndicator, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { tennis, TennisPlayer, useAuth } from "@juno/api";
import { PlayerCard, useTheme, spacing, typography, radius, type Palette } from "@juno/ui";

const TEAM_ID = process.env.EXPO_PUBLIC_TENNIS_TEAM_ID ?? "00000000-0000-0000-0000-000000000002";

export default function FollowSuggestionsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { session } = useAuth();
  const router = useRouter();
  const [players, setPlayers] = useState<TennisPlayer[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    tennis.getMostFollowed(TEAM_ID).then(({ data }) => {
      setPlayers(data.slice(0, 20));
      setLoading(false);
    }).catch(() => {
      tennis.getTournamentPlayers(TEAM_ID).then(({ data }) => {
        setPlayers(data.slice(0, 20));
        setLoading(false);
      }).catch(() => setLoading(false));
    });
  }, []);

  function toggle(id: string) {
    setSelected((ids) => (ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]));
  }

  async function finish() {
    if (session && selected.length > 0) {
      setSubmitting(true);
      try {
        await tennis.bulkFollowPlayers(selected, session.token);
      } catch {
        // non-fatal — continue to the app either way
      } finally {
        setSubmitting(false);
      }
    }
    router.replace("/(tabs)/");
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right", "bottom"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Follow your favorite players</Text>
        <Text style={styles.subtitle}>
          Pick a few players to follow. We'll keep you updated on their matches and rankings.
          You can change this anytime from your profile.
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loadingIndicator} />
      ) : (
        <FlatList
          data={players}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <PlayerCard
              firstName={item.display_first_name ?? item.first_name}
              lastName={item.display_last_name ?? item.last_name}
              country={item.country}
              photo={item.photo}
              rank={item.singles_rank}
              rankLabel="ATP/WTA"
              following={selected.includes(item.id)}
              onToggleFollow={() => toggle(item.id)}
              onPress={() => toggle(item.id)}
            />
          )}
        />
      )}

      <View style={styles.footer}>
        <Text style={styles.selectedCount}>
          {selected.length} selected
        </Text>
        <TouchableOpacity style={[styles.button, submitting && styles.buttonDisabled]} onPress={finish} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator color={colors.textOnPrimary} />
          ) : (
            <Text style={styles.buttonText}>{selected.length > 0 ? "Follow & Continue" : "Skip for now"}</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function createStyles(colors: Palette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { padding: spacing.lg, paddingBottom: spacing.md },
    title: { ...typography.h1, color: colors.text, marginBottom: spacing.sm },
    subtitle: { ...typography.body, color: colors.textSecondary },
    loadingIndicator: { marginTop: spacing.xl },
    list: { paddingHorizontal: spacing.md },
    footer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
      backgroundColor: colors.surface,
    },
    selectedCount: { ...typography.label, color: colors.textSecondary },
    button: {
      backgroundColor: colors.primary,
      borderRadius: radius.full,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      minWidth: 160,
      alignItems: "center",
    },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { ...typography.label, color: colors.textOnPrimary, fontWeight: "700" },
  });
}
