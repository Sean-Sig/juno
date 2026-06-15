import React, { useEffect, useMemo, useState } from "react";
import {
  View, Text, FlatList,
  ActivityIndicator, StyleSheet, TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { tennis, TennisMatch, TennisPlayer, MatchComment, joinTennisMatchChannel } from "@juno/api";
import { LiveBadge, useTheme, spacing, typography, radius, type Palette } from "@juno/ui";
import { Channel } from "phoenix";

function playerName(player: TennisPlayer | null, fallback?: string): string {
  if (player) {
    const first = player.display_first_name ?? player.first_name;
    const last = player.display_last_name ?? player.last_name;
    return `${first} ${last}`;
  }
  return fallback ?? "TBD";
}

export default function MatchScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { id, p1Name, p2Name, tournamentName } = useLocalSearchParams<{
    id: string;
    p1Name?: string;
    p2Name?: string;
    tournamentName?: string;
  }>();
  const [match, setMatch] = useState<TennisMatch | null>(null);
  const [player1, setPlayer1] = useState<TennisPlayer | null>(null);
  const [player2, setPlayer2] = useState<TennisPlayer | null>(null);
  const [comments, setComments] = useState<MatchComment[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const navigation = useNavigation();

  // Set system header title + back button
  useEffect(() => {
    const title = tournamentName ?? (p1Name && p2Name ? `${p1Name} vs ${p2Name}` : "Match");
    navigation.setOptions({
      title,
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => router.navigate("/(app)/matches")}
          style={{ paddingRight: spacing.sm }}
        >
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
      ),
      headerRight: () => null,
    });
  }, [tournamentName, p1Name, p2Name, colors.text]);

  useEffect(() => {
    if (!id) return;

    tennis.getMatch(id).then(({ data }) => {
      setMatch(data);
      setLoading(false);

      const fetches: Promise<void>[] = [];
      if (data.player1_id) {
        fetches.push(
          tennis.getPlayerFull(data.player1_id).then(({ data: p }) => setPlayer1(p))
        );
      }
      if (data.player2_id) {
        fetches.push(
          tennis.getPlayerFull(data.player2_id).then(({ data: p }) => setPlayer2(p))
        );
      }
      Promise.all(fetches).catch((err) => {
        if (__DEV__) console.warn("Player fetch failed:", err);
      });
    });

    tennis.getMatchComments(id).then(({ data }) => setComments(data));

    const channel: Channel = joinTennisMatchChannel(id, {
      onState: (m) => setMatch(m),
      onDelta: (diff) => setMatch((prev) => prev ? { ...prev, ...diff } : prev),
      onComment: (c) => setComments((prev) => [c, ...prev]),
    });

    return () => { channel.leave(); };
  }, [id]);

  if (loading || !match) {
    return (
      <SafeAreaView style={styles.center} edges={["bottom"]}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  const isLive = ["on_court", "warmup", "playing"].includes(match.status);

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      {/* Scoreboard */}
      <View style={styles.scoreboard}>
        {isLive && (
          <View style={styles.liveRow}>
            <LiveBadge />
          </View>
        )}
        <View style={styles.scoreRow}>
          <Text style={[styles.playerLabel, match.winner === 1 && styles.winner]}>
            {playerName(player1, p1Name)}
          </Text>
          <View style={styles.sets}>
            {(match.sets ?? []).map((s, i) => (
              <Text key={i} style={styles.setNum}>{s["1"].games}</Text>
            ))}
            {isLive && <Text style={styles.liveGame}>{match.live?.game_score_1}</Text>}
          </View>
        </View>
        <View style={styles.scoreRow}>
          <Text style={[styles.playerLabel, match.winner === 2 && styles.winner]}>
            {playerName(player2, p2Name)}
          </Text>
          <View style={styles.sets}>
            {(match.sets ?? []).map((s, i) => (
              <Text key={i} style={styles.setNum}>{s["2"].games}</Text>
            ))}
            {isLive && <Text style={styles.liveGame}>{match.live?.game_score_2}</Text>}
          </View>
        </View>
      </View>

      {/* Commentary */}
      {comments.length > 0 && (
        <View style={styles.commentsSection}>
          <Text style={styles.sectionTitle}>Commentary</Text>
          <FlatList
            data={comments}
            keyExtractor={(c) => c.id}
            renderItem={({ item }) => (
              <View style={styles.comment}>
                <Text style={styles.commentBody}>{item.body}</Text>
              </View>
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

function createStyles(colors: Palette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
    liveRow: { marginBottom: spacing.sm },
    scoreboard: {
      backgroundColor: colors.card, padding: spacing.md,
      margin: spacing.md, borderRadius: radius.md,
      shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
    },
    scoreRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.sm },
    playerLabel: { flex: 1, ...typography.body, color: colors.text },
    winner: { fontWeight: "700" },
    sets: { flexDirection: "row", gap: spacing.sm },
    setNum: { ...typography.h3, color: colors.text, width: 24, textAlign: "center" },
    liveGame: { ...typography.h3, color: colors.live, fontWeight: "700", width: 32, textAlign: "center" },
    commentsSection: { flex: 1, margin: spacing.md },
    sectionTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
    comment: { paddingVertical: spacing.sm },
    commentBody: { ...typography.body, color: colors.text },
    separator: { height: 1, backgroundColor: colors.border },
  });
}
