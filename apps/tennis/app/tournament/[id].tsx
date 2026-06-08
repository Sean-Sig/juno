import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Image,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { tennis, TennisMatch, TennisPlayer, TennisScheduleEntry, TennisTournament } from "@juno/api";
import { LiveBadge, useTheme, spacing, typography, radius, type Palette } from "@juno/ui";

const TEAM_ID = process.env.EXPO_PUBLIC_TENNIS_TEAM_ID ?? "00000000-0000-0000-0000-000000000002";

function playerName(player: TennisPlayer | undefined): string {
  if (!player) return "TBD";
  const first = player.display_first_name ?? player.first_name;
  const last = player.display_last_name ?? player.last_name;
  return `${first} ${last}`;
}

export default function TennisTournamentScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const [entry, setEntry] = useState<TennisScheduleEntry | null>(null);
  const [tournament, setTournament] = useState<TennisTournament | null>(null);
  const [matches, setMatches] = useState<TennisMatch[]>([]);
  const [playerMap, setPlayerMap] = useState<Map<string, TennisPlayer>>(new Map());
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!id) return;
    Promise.all([
      tennis.getScheduleEntry(id),
      tennis.getTournaments(TEAM_ID),
      tennis.getTournamentMatches(TEAM_ID),
      tennis.getTournamentPlayers(TEAM_ID),
    ]).then(([{ data: entryData }, { data: tournaments }, { data: matchData }, { data: playerData }]) => {
      setEntry(entryData);
      const match = tournaments.find((t) => t.id === id) ?? tournaments[0] ?? null;
      setTournament(match);
      setMatches(match ? matchData.filter((m) => m.tournament_id === match.id) : matchData);
      const map = new Map<string, TennisPlayer>();
      for (const p of playerData) map.set(p.id, p);
      setPlayerMap(map);
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
          {tournament?.surface && <Text style={styles.surface}>Surface: {tournament.surface}</Text>}
        </View>

        {matches.length > 0 && (
          <View style={styles.matchesSection}>
            <Text style={styles.sectionTitle}>Matches</Text>
            {matches.map((match) => {
              const isLive = ["on_court", "warmup", "playing"].includes(match.status);
              const isFinished = match.status.startsWith("finished");
              const p1 = match.player1_id ? playerMap.get(match.player1_id) : undefined;
              const p2 = match.player2_id ? playerMap.get(match.player2_id) : undefined;
              return (
                <TouchableOpacity
                  key={match.id}
                  style={styles.matchRow}
                  onPress={() =>
                    router.push({
                      pathname: `/match/${match.id}`,
                      params: { p1Name: playerName(p1), p2Name: playerName(p2) },
                    })
                  }
                  activeOpacity={0.7}
                >
                  <View style={styles.matchRowHeader}>
                    <Text style={styles.round}>{match.round} · {match.type}</Text>
                    {isLive && <LiveBadge />}
                    {isFinished && <Text style={styles.finishedBadge}>Final</Text>}
                  </View>
                  <Text style={[styles.playerName, match.winner === 1 && styles.winner]}>
                    {playerName(p1)} {match.winner === 1 ? "✓" : ""}
                  </Text>
                  <Text style={[styles.playerName, match.winner === 2 && styles.winner]}>
                    {playerName(p2)} {match.winner === 2 ? "✓" : ""}
                  </Text>
                </TouchableOpacity>
              );
            })}
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
    surface: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
    matchesSection: { margin: spacing.md },
    sectionTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
    matchRow: {
      backgroundColor: colors.card,
      borderRadius: radius.sm,
      padding: spacing.md,
      marginBottom: spacing.xs,
    },
    matchRowHeader: { flexDirection: "row", alignItems: "center", marginBottom: spacing.xs, gap: spacing.sm },
    round: { ...typography.caption, color: colors.textSecondary },
    finishedBadge: { ...typography.caption, color: colors.textSecondary, fontWeight: "600" },
    playerName: { ...typography.body, color: colors.text },
    winner: { fontWeight: "700", color: colors.primary },
    empty: { ...typography.body, color: colors.textSecondary },
  });
}
