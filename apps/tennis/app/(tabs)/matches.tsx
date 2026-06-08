import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View, Text, FlatList,
  ActivityIndicator, RefreshControl, StyleSheet, TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { tennis, TennisMatch, TennisPlayer } from "@juno/api";
import { LiveBadge, useTheme, spacing, typography, radius, type Palette } from "@juno/ui";

const TEAM_ID = process.env.EXPO_PUBLIC_TENNIS_TEAM_ID ?? "00000000-0000-0000-0000-000000000002";

function playerName(player: TennisPlayer | undefined): string {
  if (!player) return "TBD";
  const first = player.display_first_name ?? player.first_name;
  const last = player.display_last_name ?? player.last_name;
  return `${first} ${last}`;
}

export default function MatchesScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [matches, setMatches] = useState<TennisMatch[]>([]);
  const [playerMap, setPlayerMap] = useState<Map<string, TennisPlayer>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const load = useCallback(() => {
    return Promise.all([
      tennis.getTournamentMatches(TEAM_ID),
      tennis.getTournamentPlayers(TEAM_ID),
    ]).then(([{ data: matchData }, { data: playerData }]) => {
      setMatches(matchData);
      const map = new Map<string, TennisPlayer>();
      for (const p of playerData) map.set(p.id, p);
      setPlayerMap(map);
    }).catch(() => {});
  }, []);

  function onRefresh() {
    setRefreshing(true);
    load().finally(() => setRefreshing(false));
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={matches}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        renderItem={({ item }) => (
          <MatchRow
            match={item}
            playerMap={playerMap}
            onPress={() => {
              const p1 = item.player1_id ? playerMap.get(item.player1_id) : undefined;
              const p2 = item.player2_id ? playerMap.get(item.player2_id) : undefined;
              router.push({
                pathname: `/match/${item.id}`,
                params: {
                  p1Name: playerName(p1),
                  p2Name: playerName(p2),
                },
              });
            }}
          />
        )}
      />
    </SafeAreaView>
  );
}

function MatchRow({
  match,
  playerMap,
  onPress,
}: {
  match: TennisMatch;
  playerMap: Map<string, TennisPlayer>;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isLive = ["on_court", "warmup", "playing"].includes(match.status);
  const isFinished = match.status.startsWith("finished");
  const p1 = match.player1_id ? playerMap.get(match.player1_id) : undefined;
  const p2 = match.player2_id ? playerMap.get(match.player2_id) : undefined;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardHeader}>
        <Text style={styles.round}>{match.round} · {match.type}</Text>
        {isLive && <LiveBadge />}
        {isFinished && <Text style={styles.finishedBadge}>Final</Text>}
        {match.court && <Text style={styles.court}>{match.court}</Text>}
      </View>

      <View style={styles.scoreRow}>
        <View style={styles.playerCol}>
          <Text style={[styles.playerName, match.winner === 1 && styles.winner]}>
            {playerName(p1)} {match.winner === 1 ? "✓" : ""}
          </Text>
          <Text style={[styles.playerName, match.winner === 2 && styles.winner]}>
            {playerName(p2)} {match.winner === 2 ? "✓" : ""}
          </Text>
        </View>
        <View style={styles.setsCol}>
          {(match.sets ?? []).map((set, i) => (
            <View key={i} style={styles.setCol}>
              <Text style={styles.setScore}>{set["1"].games}</Text>
              <Text style={styles.setScore}>{set["2"].games}</Text>
            </View>
          ))}
          {isLive && match.live && (
            <View style={styles.setCol}>
              <Text style={[styles.setScore, styles.liveScore]}>{match.live.game_score_1}</Text>
              <Text style={[styles.setScore, styles.liveScore]}>{match.live.game_score_2}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

function createStyles(colors: Palette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
    list: { padding: spacing.md },
    card: {
      backgroundColor: colors.card,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.sm,
      shadowColor: "#000",
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    cardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: spacing.sm },
    round: { ...typography.caption, color: colors.textSecondary, flex: 1 },
    court: { ...typography.caption, color: colors.textSecondary },
    finishedBadge: { ...typography.caption, color: colors.textSecondary, fontWeight: "600" },
    scoreRow: { flexDirection: "row", alignItems: "center" },
    playerCol: { flex: 1 },
    playerName: { ...typography.body, color: colors.text, marginBottom: 4 },
    winner: { fontWeight: "700", color: colors.text },
    setsCol: { flexDirection: "row", gap: 8 },
    setCol: { alignItems: "center" },
    setScore: { ...typography.body, color: colors.text, width: 20, textAlign: "center", marginBottom: 4 },
    liveScore: { color: colors.live, fontWeight: "700" },
  });
}
