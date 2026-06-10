import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Image,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { golf, GolfScheduleEntry, GolfTournament } from "@juno/api";
import { useTheme, spacing, typography, radius, type Palette } from "@juno/ui";

export default function GolfTournamentScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const [entry, setEntry] = useState<GolfScheduleEntry | null>(null);
  const [tournament, setTournament] = useState<GolfTournament | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!id) return;
    golf.getScheduleEntry(id).then(({ data }) => {
      setEntry(data);
      return golf.getTournaments(data.team_id);
    }).then(({ data: tournaments }) => {
      const match = tournaments.find((t) => t.id === id) ?? tournaments[0] ?? null;
      setTournament(match);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!entry) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.empty}>Tournament not found</Text>
      </SafeAreaView>
    );
  }

  const scores = tournament?.events?.[0]?.scores ?? [];
  const eventName = tournament?.events?.[0]?.name;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
      </View>
      <ScrollView>
        {entry.image_url && (
          <Image source={{ uri: entry.image_url }} style={styles.image} />
        )}
        <View style={styles.info}>
          <Text style={styles.name}>{entry.name}</Text>
          <Text style={styles.dates}>
            {entry.start_date?.slice(0, 10)} – {entry.end_date?.slice(0, 10)}
          </Text>
          <Text style={styles.level}>{entry.partnership_level.toUpperCase()}</Text>

          {entry.winners_name && (
            <View style={styles.winnerRow}>
              <Text style={styles.winnerLabel}>Winner</Text>
              <Text style={styles.winnerName}>{entry.winners_name}</Text>
              {entry.winners_score && (
                <Text style={styles.winnerScore}>{entry.winners_score}</Text>
              )}
            </View>
          )}
        </View>

        {scores.length > 0 && (
          <View style={styles.leaderboard}>
            <Text style={styles.sectionTitle}>
              {eventName ?? "Leaderboard"}
            </Text>
            {scores.map((score) => (
              <View key={score.id} style={styles.scoreRow}>
                <Text style={styles.place}>{score.display_place ?? "—"}</Text>
                <View style={styles.playerInfo}>
                  <Text style={styles.playerName}>
                    {score.player?.display_first_name ?? score.player?.first_name}{" "}
                    {score.player?.display_last_name ?? score.player?.last_name}
                  </Text>
                  {score.player?.country && (
                    <Text style={styles.country}>{score.player.country}</Text>
                  )}
                </View>
                <Text style={[styles.par, score.par < 0 && styles.under]}>
                  {score.par === 0 ? "E" : score.par > 0 ? `+${score.par}` : score.par}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: Palette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      padding: spacing.md,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    back: { marginRight: spacing.sm },
    backText: { ...typography.body, color: colors.primary },
    image: { width: "100%", height: 200 },
    info: { padding: spacing.md, backgroundColor: colors.card },
    name: { ...typography.h2, color: colors.text },
    dates: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
    level: { ...typography.caption, color: colors.primary, marginTop: spacing.xs, fontWeight: "600" },
    winnerRow: {
      marginTop: spacing.md,
      padding: spacing.md,
      backgroundColor: colors.background,
      borderRadius: radius.md,
    },
    winnerLabel: { ...typography.caption, color: colors.textSecondary },
    winnerName: { ...typography.h3, color: colors.text, marginTop: spacing.xs },
    winnerScore: { ...typography.body, color: colors.primary, marginTop: spacing.xs },
    leaderboard: { margin: spacing.md },
    sectionTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
    scoreRow: {
      flexDirection: "row",
      alignItems: "center",
      padding: spacing.md,
      backgroundColor: colors.card,
      borderRadius: radius.sm,
      marginBottom: 1,
    },
    place: { width: 36, ...typography.label, color: colors.textSecondary },
    playerInfo: { flex: 1 },
    playerName: { ...typography.body, color: colors.text, fontWeight: "600" },
    country: { ...typography.caption, color: colors.textSecondary },
    par: { ...typography.h3, color: colors.text },
    under: { color: colors.live },
    empty: { ...typography.body, color: colors.textSecondary },
  });
}
