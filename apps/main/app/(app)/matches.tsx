import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  SectionList,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { tennis, TennisMatch, TennisPlayer, TennisTournament } from "@juno/api";
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

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

function isLiveMatch(match: TennisMatch): boolean {
  return ["on_court", "warmup", "playing"].includes(match.status);
}

function isFinishedMatch(match: TennisMatch): boolean {
  return match.status.startsWith("finished");
}

function surfaceLabel(surface: string | null): string {
  if (!surface) return "";
  return surface.charAt(0).toUpperCase() + surface.slice(1).toLowerCase();
}

// ---------------------------------------------------------------------------
// Tab / filter types
// ---------------------------------------------------------------------------

type StatusTab = "live" | "upcoming" | "final";

const STATUS_TABS: { key: StatusTab; label: string }[] = [
  { key: "live", label: "Live" },
  { key: "upcoming", label: "Upcoming" },
  { key: "final", label: "Final" },
];

type FilterType = "all" | "ms" | "ws" | "doubles";

const FILTERS: { key: FilterType; label: string }[] = [
  { key: "all", label: "All" },
  { key: "ms", label: "Men's Singles" },
  { key: "ws", label: "Women's Singles" },
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

// ---------------------------------------------------------------------------
// Section type
// ---------------------------------------------------------------------------

type TournamentSection = {
  tournament: TennisTournament;
  data: TennisMatch[];
};

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function MatchesScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [tournaments, setTournaments] = useState<TennisTournament[]>([]);
  const [allMatches, setAllMatches] = useState<TennisMatch[]>([]);
  const [playerMap, setPlayerMap] = useState<Map<string, TennisPlayer>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusTab, setStatusTab] = useState<StatusTab>("live");
  const [filter, setFilter] = useState<FilterType>("all");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const initialAutoSwitch = useRef(true);
  const router = useRouter();

  const load = useCallback(() => {
    return Promise.all([
      tennis.getTournaments(TEAM_ID),
      tennis.getTournamentMatches(TEAM_ID),
      tennis.getTournamentPlayers(TEAM_ID),
    ]).then(([{ data: tournamentData }, { data: matchData }, { data: playerData }]) => {
      setTournaments(tournamentData);
      setAllMatches(matchData);
      const map = new Map<string, TennisPlayer>();
      for (const p of playerData) map.set(p.id, p);
      setPlayerMap(map);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  function onRefresh() {
    setRefreshing(true);
    load().finally(() => setRefreshing(false));
  }

  // Auto-switch to Upcoming if no live matches on first load
  const liveCount = allMatches.filter(isLiveMatch).length;
  useEffect(() => {
    if (!loading && statusTab === "live" && liveCount === 0 && initialAutoSwitch.current) {
      initialAutoSwitch.current = false;
      setStatusTab("upcoming");
    }
  }, [loading, liveCount, statusTab]);

  // Build a map from tournament_id → tournament
  const tournamentMap = useMemo(() => {
    const m = new Map<string, TennisTournament>();
    for (const t of tournaments) m.set(t.id, t);
    return m;
  }, [tournaments]);

  // Build sections grouped by tournament for the current tab + filter
  const sections = useMemo((): TournamentSection[] => {
    let filtered: TennisMatch[];
    if (statusTab === "live") {
      filtered = allMatches.filter(isLiveMatch);
    } else if (statusTab === "upcoming") {
      filtered = allMatches
        .filter((m) => !isLiveMatch(m) && !isFinishedMatch(m))
        .sort((a, b) => (a.starts_at ?? "").localeCompare(b.starts_at ?? ""));
    } else {
      filtered = allMatches
        .filter(isFinishedMatch)
        .sort((a, b) => (b.finished_at ?? "").localeCompare(a.finished_at ?? ""));
    }
    filtered = filtered.filter((m) => matchPassesFilter(m, filter));

    // Group by tournament_id preserving order of first appearance
    const groupMap = new Map<string, TennisMatch[]>();
    for (const m of filtered) {
      const tid = m.tournament_id;
      if (!groupMap.has(tid)) groupMap.set(tid, []);
      groupMap.get(tid)!.push(m);
    }

    const result: TournamentSection[] = [];
    for (const [tid, matches] of groupMap.entries()) {
      const t = tournamentMap.get(tid);
      if (!t) continue;
      result.push({ tournament: t, data: matches });
    }
    return result;
  }, [allMatches, statusTab, filter, tournamentMap]);

  // Live tab: expand all by default (you want to see scores immediately).
  // Upcoming / Final: start collapsed so you can browse the tournament list.
  useEffect(() => {
    setExpandedIds(
      statusTab === "live"
        ? new Set(sections.map((s) => s.tournament.id))
        : new Set()
    );
  }, [statusTab, filter]);

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const totalMatches = sections.reduce((acc, s) => acc + s.data.length, 0);

  const emptyMessage =
    statusTab === "live" ? "No matches live right now."
    : statusTab === "upcoming" ? "No upcoming matches."
    : "No finished matches.";

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      {/* Live / Upcoming / Final tabs */}
      <View style={styles.tabBar}>
        {STATUS_TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tabItem, statusTab === t.key && styles.tabItemActive]}
            onPress={() => setStatusTab(t.key)}
            activeOpacity={0.7}
          >
            {t.key === "live" && statusTab !== "live" && liveCount > 0 && (
              <View style={styles.liveDot} />
            )}
            <Text style={[styles.tabLabel, statusTab === t.key && styles.tabLabelActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Match type filter pills */}
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

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : totalMatches === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>No matches found</Text>
          <Text style={styles.emptyText}>{emptyMessage}</Text>
        </View>
      ) : (
        <SectionList
          sections={sections.map((s) => ({
            ...s,
            totalCount: s.data.length,
            data: expandedIds.has(s.tournament.id) ? s.data : [],
          }))}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          renderSectionHeader={({ section }) => (
            <TournamentHeader
              tournament={section.tournament}
              statusTab={statusTab}
              expanded={expandedIds.has(section.tournament.id)}
              matchCount={(section as any).totalCount ?? 0}
              onToggle={() => toggleExpanded(section.tournament.id)}
            />
          )}
          renderItem={({ item }) => (
            <MatchCard
              match={item}
              playerMap={playerMap}
              onPress={() => {
                const p1 = item.player1_id ? playerMap.get(item.player1_id) : undefined;
                const p2 = item.player2_id ? playerMap.get(item.player2_id) : undefined;
                router.push({
                  pathname: `/match/${item.id}`,
                  params: { p1Name: playerName(p1), p2Name: playerName(p2) },
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
          SectionSeparatorComponent={() => <View style={styles.sectionGap} />}
        />
      )}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Tournament section header
// ---------------------------------------------------------------------------

function TournamentHeader({
  tournament,
  statusTab,
  expanded,
  matchCount,
  onToggle,
}: {
  tournament: TennisTournament;
  statusTab: StatusTab;
  expanded: boolean;
  matchCount: number;
  onToggle: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Animated chevron rotation
  const rotation = useRef(new Animated.Value(expanded ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(rotation, {
      toValue: expanded ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [expanded]);
  const rotate = rotation.interpolate({ inputRange: [0, 1], outputRange: ["-90deg", "0deg"] });

  const surface = surfaceLabel(tournament.surface);
  const dateRange = (() => {
    if (tournament.start_date && tournament.end_date) {
      return `${formatDate(tournament.start_date)} – ${formatDate(tournament.end_date)}`;
    }
    if (tournament.start_date) return formatDate(tournament.start_date);
    return null;
  })();

  return (
    <TouchableOpacity
      style={styles.tournamentHeader}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      <View style={styles.tournamentHeaderRow}>
        <Text style={styles.tournamentName} numberOfLines={1}>{tournament.name}</Text>
        {statusTab === "live" && (
          <View style={styles.liveIndicator}>
            <Text style={styles.liveIndicatorText}>LIVE</Text>
          </View>
        )}
        {!expanded && (
          <Text style={styles.collapsedCount}>
            {matchCount} {matchCount === 1 ? "match" : "matches"}
          </Text>
        )}
        <Animated.View style={{ transform: [{ rotate }] }}>
          <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
        </Animated.View>
      </View>
      <View style={styles.tournamentMeta}>
        {surface ? <Text style={styles.tournamentMetaText}>{surface}</Text> : null}
        {surface && dateRange ? <Text style={styles.tournamentMetaDot}>·</Text> : null}
        {dateRange ? <Text style={styles.tournamentMetaText}>{dateRange}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Match card
// ---------------------------------------------------------------------------

function MatchCard({
  match,
  playerMap,
  onPress,
  onPlayerPress,
}: {
  match: TennisMatch;
  playerMap: Map<string, TennisPlayer>;
  onPress: () => void;
  onPlayerPress: (playerId: string) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const live = isLiveMatch(match);
  const finished = isFinishedMatch(match);

  const p1 = match.player1_id ? playerMap.get(match.player1_id) : undefined;
  const p2 = match.player2_id ? playerMap.get(match.player2_id) : undefined;
  const p1Partner = match.player1_partner_id ? playerMap.get(match.player1_partner_id) : undefined;
  const p2Partner = match.player2_partner_id ? playerMap.get(match.player2_partner_id) : undefined;

  const p1Name = p1Partner ? `${playerName(p1)} / ${playerName(p1Partner)}` : playerName(p1);
  const p2Name = p2Partner ? `${playerName(p2)} / ${playerName(p2Partner)}` : playerName(p2);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      {/* Status row */}
      <View style={styles.statusRow}>
        {live ? (
          <>
            <View style={styles.liveDotCard} />
            <Text style={styles.liveText}>Live</Text>
            {match.court ? <Text style={styles.statusDetail}>· {match.court}</Text> : null}
          </>
        ) : finished ? (
          <Text style={styles.finalText}>Final</Text>
        ) : (
          <>
            {match.starts_at
              ? <Text style={styles.scheduleText}>{formatTime(match.starts_at)}</Text>
              : <Text style={styles.scheduleText}>Scheduled</Text>}
            {match.court ? <Text style={styles.statusDetail}>· {match.court}</Text> : null}
          </>
        )}
        {match.round ? <Text style={styles.roundBadge}>{match.round}</Text> : null}
        {!match.round && match.type ? <Text style={styles.roundBadge}>{match.type}</Text> : null}
      </View>

      {/* Player rows with set scores */}
      <View style={styles.scoreRow}>
        <View style={styles.playerCol}>
          <TouchableOpacity
            onPress={() => match.player1_id && onPlayerPress(match.player1_id)}
            disabled={!match.player1_id}
            activeOpacity={0.6}
            hitSlop={{ top: 4, bottom: 4, left: 0, right: 0 }}
          >
            <Text style={[styles.playerName, match.winner === 1 && styles.winner]} numberOfLines={1}>
              {p1Name}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => match.player2_id && onPlayerPress(match.player2_id)}
            disabled={!match.player2_id}
            activeOpacity={0.6}
            hitSlop={{ top: 4, bottom: 4, left: 0, right: 0 }}
          >
            <Text style={[styles.playerName, match.winner === 2 && styles.winner]} numberOfLines={1}>
              {p2Name}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Set scores */}
        <View style={styles.setsRow}>
          {(match.sets ?? []).map((set, i) => {
            const isLastSet = i === (match.sets.length - 1);
            return (
              <View key={i} style={styles.setCol}>
                <Text style={[
                  styles.setScore,
                  match.winner === 1 && isLastSet && finished && styles.winningSet,
                ]}>
                  {set["1"].games}{set["1"].tiebreak != null ? `(${set["1"].tiebreak})` : ""}
                </Text>
                <Text style={[
                  styles.setScore,
                  match.winner === 2 && isLastSet && finished && styles.winningSet,
                ]}>
                  {set["2"].games}{set["2"].tiebreak != null ? `(${set["2"].tiebreak})` : ""}
                </Text>
              </View>
            );
          })}

          {/* Live game score */}
          {live && match.live && (
            <View style={[styles.setCol, styles.liveSetCol]}>
              <Text style={[styles.setScore, styles.liveScore]}>{match.live.game_score_1 ?? ""}</Text>
              <Text style={[styles.setScore, styles.liveScore]}>{match.live.game_score_2 ?? ""}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

function createStyles(colors: Palette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },

    // Live / Upcoming / Final tab bar
    tabBar: {
      flexDirection: "row",
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.divider,
    },
    tabItem: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: spacing.sm + 2,
      gap: 5,
    },
    tabItemActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
    tabLabel: { ...typography.label, color: colors.textSecondary },
    tabLabelActive: { color: colors.primary, fontWeight: "700" },
    liveDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: "#ef4444",
    },

    // Type filter pills
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
    pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    pillText: { ...typography.label, color: colors.textSecondary, fontWeight: "600" },
    pillTextActive: { color: colors.textOnPrimary },

    // List
    listContent: { padding: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.xl },
    sectionGap: { height: spacing.md },
    emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, padding: spacing.lg },
    emptyTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.xs },
    emptyText: { ...typography.body, color: colors.textSecondary, textAlign: "center" },

    // Tournament section header
    tournamentHeader: {
      paddingHorizontal: spacing.sm,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xs,
    },
    tournamentHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    tournamentName: {
      ...typography.h3,
      color: colors.text,
      flex: 1,
    },
    collapsedCount: {
      ...typography.caption,
      color: colors.textSecondary,
    },
    liveIndicator: {
      backgroundColor: "#ef4444",
      borderRadius: radius.full,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
    },
    liveIndicatorText: {
      ...typography.caption,
      color: "#fff",
      fontWeight: "700",
      letterSpacing: 0.5,
    },
    tournamentMeta: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      marginTop: 2,
    },
    tournamentMetaText: { ...typography.caption, color: colors.textSecondary },
    tournamentMetaDot: { ...typography.caption, color: colors.textSecondary },

    // Match card
    card: {
      backgroundColor: colors.card,
      borderRadius: radius.md,
      padding: spacing.md,
      marginTop: spacing.xs,
      shadowColor: "#000",
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },

    // Status row
    statusRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: spacing.sm,
      gap: 5,
    },
    liveDotCard: {
      width: 7,
      height: 7,
      borderRadius: radius.full,
      backgroundColor: "#ef4444",
    },
    liveText: { ...typography.caption, color: "#ef4444", fontWeight: "700" },
    finalText: { ...typography.caption, color: colors.textSecondary, fontWeight: "600" },
    scheduleText: { ...typography.caption, color: colors.textSecondary },
    statusDetail: { ...typography.caption, color: colors.textSecondary },
    roundBadge: {
      ...typography.caption,
      color: colors.textSecondary,
      marginLeft: "auto",
      fontWeight: "600",
    },

    // Player / score layout
    scoreRow: { flexDirection: "row", alignItems: "center" },
    playerCol: { flex: 1, marginRight: spacing.sm },
    playerName: { ...typography.body, color: colors.text, marginBottom: 4 },
    winner: { fontWeight: "700", color: colors.text },

    // Sets
    setsRow: { flexDirection: "row", gap: 6 },
    setCol: { alignItems: "center", minWidth: 22 },
    liveSetCol: {
      borderLeftWidth: 1,
      borderLeftColor: colors.border,
      paddingLeft: 6,
    },
    setScore: { ...typography.body, color: colors.text, textAlign: "center", marginBottom: 4 },
    winningSet: { fontWeight: "700" },
    liveScore: { color: colors.live ?? colors.primary, fontWeight: "700" },
  });
}
