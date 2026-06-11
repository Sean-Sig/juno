import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  SectionList,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { tennis, TennisMatch, TennisPlayer } from "@juno/api";
import { LiveBadge, useTheme, spacing, typography, radius, type Palette } from "@juno/ui";

const TEAM_ID = process.env.EXPO_PUBLIC_TENNIS_TEAM_ID ?? "00000000-0000-0000-0000-000000000002";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function playerName(player: TennisPlayer | undefined): string {
  if (!player) return "TBD";
  const first = player.display_first_name ?? player.first_name;
  const last = player.display_last_name ?? player.last_name;
  return `${first} ${last}`;
}

const ROUND_ORDER: Record<string, number> = {
  F: 0,
  SF: 1,
  QF: 2,
  R16: 3,
  R32: 4,
  R64: 5,
  R128: 6,
};

const ROUND_LABELS: Record<string, string> = {
  F: "Final",
  SF: "Semi-Final",
  QF: "Quarter-Final",
  R16: "Round of 16",
  R32: "Round of 32",
  R64: "Round of 64",
  R128: "Round of 128",
};

function roundLabel(round: string | null): string {
  if (!round) return "Other";
  return ROUND_LABELS[round] ?? round;
}

function isLive(match: TennisMatch): boolean {
  return ["on_court", "warmup", "playing"].includes(match.status);
}

function isFinished(match: TennisMatch): boolean {
  return match.status.startsWith("finished");
}

type FilterType = "all" | "ms" | "ws" | "doubles";

const FILTERS: { key: FilterType; label: string }[] = [
  { key: "all", label: "All" },
  { key: "ms", label: "MS" },
  { key: "ws", label: "WS" },
  { key: "doubles", label: "Doubles" },
];

function matchPassesFilter(match: TennisMatch, filter: FilterType): boolean {
  if (filter === "all") return true;
  const type = (match.type ?? "").toUpperCase();
  if (filter === "ms") return type === "MS";
  if (filter === "ws") return type === "WS";
  if (filter === "doubles") return ["MD", "WD", "MX"].includes(type);
  return true;
}

type Section = { title: string; data: TennisMatch[] };

function buildSections(matches: TennisMatch[], filter: FilterType): Section[] {
  const filtered = matches.filter((m) => matchPassesFilter(m, filter));

  const live = filtered.filter(isLive);
  const rest = filtered.filter((m) => !isLive(m));

  // Group remaining by round
  const byRound = new Map<string, TennisMatch[]>();
  for (const m of rest) {
    const key = m.round ?? "Other";
    if (!byRound.has(key)) byRound.set(key, []);
    byRound.get(key)!.push(m);
  }

  // Sort rounds: known order first, then alphabetical for unknown
  const sortedRounds = Array.from(byRound.keys()).sort((a, b) => {
    const oa = ROUND_ORDER[a] ?? 99;
    const ob = ROUND_ORDER[b] ?? 99;
    if (oa !== ob) return oa - ob;
    return a.localeCompare(b);
  });

  const sections: Section[] = [];

  if (live.length > 0) {
    sections.push({ title: "🔴 Live", data: live });
  }

  for (const round of sortedRounds) {
    const data = byRound.get(round)!;
    if (data.length > 0) {
      sections.push({ title: roundLabel(round), data });
    }
  }

  return sections;
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function MatchesScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [matches, setMatches] = useState<TennisMatch[]>([]);
  const [playerMap, setPlayerMap] = useState<Map<string, TennisPlayer>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");
  const router = useRouter();

  const load = useCallback(() => {
    return Promise.all([
      tennis.getTournamentMatches(TEAM_ID),
      tennis.getTournamentPlayers(TEAM_ID),
    ])
      .then(([{ data: matchData }, { data: playerData }]) => {
        setMatches(matchData);
        const map = new Map<string, TennisPlayer>();
        for (const p of playerData) map.set(p.id, p);
        setPlayerMap(map);
      })
      .catch(() => {});
  }, []);

  function onRefresh() {
    setRefreshing(true);
    load().finally(() => setRefreshing(false));
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const sections = useMemo(() => buildSections(matches, filter), [matches, filter]);

  if (loading) {
    return (
      <SafeAreaView style={styles.center} edges={["left", "right"]}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      {/* Filter pills */}
      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[styles.pill, filter === f.key && styles.pillActive]}
              onPress={() => setFilter(f.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.pillText, filter === f.key && styles.pillTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {sections.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.empty}>No matches found</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <MatchCard
              match={item}
              playerMap={playerMap}
              teamId={TEAM_ID}
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
              onPlayerPress={(playerId) => {
                router.push({
                  pathname: `/(app)/player/${playerId}`,
                  params: { teamId: TEAM_ID, from: "matches" },
                });
              }}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Match card
// ---------------------------------------------------------------------------

function MatchCard({
  match,
  playerMap,
  teamId: _teamId,
  onPress,
  onPlayerPress,
}: {
  match: TennisMatch;
  playerMap: Map<string, TennisPlayer>;
  teamId: string;
  onPress: () => void;
  onPlayerPress: (playerId: string) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const live = isLive(match);
  const finished = isFinished(match);
  const scheduled = !live && !finished;

  const p1 = match.player1_id ? playerMap.get(match.player1_id) : undefined;
  const p2 = match.player2_id ? playerMap.get(match.player2_id) : undefined;

  // For doubles: include partner names
  const p1Partner = match.player1_partner_id ? playerMap.get(match.player1_partner_id) : undefined;
  const p2Partner = match.player2_partner_id ? playerMap.get(match.player2_partner_id) : undefined;

  const p1Name = p1Partner
    ? `${playerName(p1)} / ${playerName(p1Partner)}`
    : playerName(p1);
  const p2Name = p2Partner
    ? `${playerName(p2)} / ${playerName(p2Partner)}`
    : playerName(p2);

  // Type label
  const typeLabel = match.type ? ` · ${match.type}` : "";

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      {/* Meta row */}
      <View style={styles.cardMeta}>
        {match.court ? (
          <Text style={styles.metaText}>{match.court}{typeLabel}</Text>
        ) : (
          <Text style={styles.metaText}>{match.type ?? ""}</Text>
        )}
        {live && <LiveBadge />}
        {finished && <Text style={styles.finalBadge}>Final</Text>}
        {scheduled && match.starts_at && (
          <Text style={styles.timeText}>
            {formatTime(match.starts_at)}
          </Text>
        )}
      </View>

      {/* Score row */}
      <View style={styles.scoreRow}>
        {/* Player names — tappable to open scorecard */}
        <View style={styles.playerCol}>
          <TouchableOpacity
            onPress={() => match.player1_id && onPlayerPress(match.player1_id)}
            disabled={!match.player1_id}
            activeOpacity={0.6}
            hitSlop={{ top: 4, bottom: 4, left: 0, right: 0 }}
          >
            <Text
              style={[styles.playerName, match.winner === 1 && styles.winner]}
              numberOfLines={1}
            >
              {p1Name}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => match.player2_id && onPlayerPress(match.player2_id)}
            disabled={!match.player2_id}
            activeOpacity={0.6}
            hitSlop={{ top: 4, bottom: 4, left: 0, right: 0 }}
          >
            <Text
              style={[styles.playerName, match.winner === 2 && styles.winner]}
              numberOfLines={1}
            >
              {p2Name}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Set scores */}
        <View style={styles.setsRow}>
          {(match.sets ?? []).map((set, i) => (
            <View key={i} style={styles.setCol}>
              <Text style={[styles.setScore, match.winner === 1 && i === (match.sets.length - 1) && finished && styles.winningSet]}>
                {set["1"].games}{set["1"].tiebreak != null ? `(${set["1"].tiebreak})` : ""}
              </Text>
              <Text style={[styles.setScore, match.winner === 2 && i === (match.sets.length - 1) && finished && styles.winningSet]}>
                {set["2"].games}{set["2"].tiebreak != null ? `(${set["2"].tiebreak})` : ""}
              </Text>
            </View>
          ))}

          {/* Live game score */}
          {live && match.live && (
            <View style={[styles.setCol, styles.liveSetCol]}>
              <Text style={[styles.setScore, styles.liveScore]}>
                {match.live.game_score_1 ?? ""}
              </Text>
              <Text style={[styles.setScore, styles.liveScore]}>
                {match.live.game_score_2 ?? ""}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

function createStyles(colors: Palette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.background,
    },
    empty: { ...typography.body, color: colors.textSecondary },

    // Filter bar
    filterBar: {
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    filterScroll: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      gap: spacing.xs,
    },
    pill: {
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: radius.full,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    pillActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    pillText: { ...typography.label, color: colors.textSecondary, fontWeight: "600" },
    pillTextActive: { color: colors.textOnPrimary },

    // List
    list: { paddingHorizontal: spacing.md, paddingBottom: spacing.lg },

    // Section header
    sectionHeader: {
      paddingTop: spacing.lg,
      paddingBottom: spacing.xs,
    },
    sectionTitle: {
      ...typography.label,
      color: colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      fontWeight: "700",
    },

    // Match card
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
    cardMeta: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    metaText: { ...typography.caption, color: colors.textSecondary, flex: 1 },
    finalBadge: { ...typography.caption, color: colors.textSecondary, fontWeight: "600" },
    timeText: { ...typography.caption, color: colors.primary, fontWeight: "600" },

    // Score layout
    scoreRow: { flexDirection: "row", alignItems: "center" },
    playerCol: { flex: 1, marginRight: spacing.sm },
    playerName: {
      ...typography.body,
      color: colors.text,
      marginBottom: 4,
    },
    winner: { fontWeight: "700" },

    // Sets
    setsRow: { flexDirection: "row", gap: 6 },
    setCol: { alignItems: "center", minWidth: 22 },
    liveSetCol: {
      borderLeftWidth: 1,
      borderLeftColor: colors.border,
      paddingLeft: 6,
    },
    setScore: {
      ...typography.body,
      color: colors.text,
      textAlign: "center",
      marginBottom: 4,
    },
    winningSet: { fontWeight: "700" },
    liveScore: { color: colors.live ?? colors.primary, fontWeight: "700" },
  });
}
