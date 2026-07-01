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
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { tennis, joinTennisGamesChannel, TennisMatch, TennisPlayer, TennisTournament } from "@juno/api";
import { LiveBadge, useTheme, spacing, typography, radius, type Palette } from "@juno/ui";

const TEAM_ID = process.env.EXPO_PUBLIC_TENNIS_TEAM_ID ?? "00000000-0000-0000-0000-000000000002";

// Scout isn't live yet, so the H2H "Compare" button has nowhere useful to send
// players — hide it until Scout ships, then flip this back on.
const SHOW_COMPARE_BUTTON = false;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function playerName(player: TennisPlayer | null | undefined): string {
  if (!player) return "";
  const first = player.first_name ?? "";
  const last = player.last_name ?? "";
  return `${first} ${last}`.trim();
}

// Use backend-computed short_name ("C. Norrie"), fall back to full name
// if short_name hasn't arrived yet (e.g. older cached responses).
function playerShortName(player: TennisPlayer | null | undefined): string {
  if (!player) return "";
  if (player.short_name) return player.short_name;
  const first = player.first_name ?? "";
  const last = player.last_name ?? "";
  return `${first} ${last}`.trim();
}

// Resolve a player: prefer the embedded object on the match, fall back to the
// playerMap (populated via getTournamentPlayers + supplementary fetches).
function resolvePlayer(
  embedded: TennisPlayer | null | undefined,
  id: string | null | undefined,
  map: Map<string, TennisPlayer>,
): TennisPlayer | undefined {
  if (embedded) return embedded;
  if (id) return map.get(id);
  return undefined;
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    const date = d.toLocaleDateString([], { month: "short", day: "numeric" });
    const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return `${date} · ${time}`;
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

const ROUND_NAMES: Record<string, string> = {
  F:    "Final",
  SF:   "Semi Final",
  QF:   "Quarter Final",
  R16:  "Round of 16",
  R32:  "Round of 32",
  R64:  "Round of 64",
  R128: "Round of 128",
  RR:   "Round Robin",
  BR:   "Bronze Medal",
};

function roundLabel(round: string | null | undefined, court: string | null | undefined): string {
  const roundName = round ? (ROUND_NAMES[round] ?? round) : null;
  if (roundName && court) return `${roundName} · ${court}`;
  if (roundName) return roundName;
  if (court) return court;
  return "";
}

function isFinishedMatch(match: TennisMatch): boolean {
  return match.status.startsWith("finished");
}

function surfaceLabel(surface: string | null): string {
  if (!surface) return "";
  return surface.charAt(0).toUpperCase() + surface.slice(1).toLowerCase();
}

function surfaceAccentColor(surface: string | null): string {
  switch (surface?.toLowerCase()) {
    case "clay":    return "#C17A3A"; // terracotta
    case "grass":   return "#3A8C4A"; // court green
    case "hard":    return "#3A6FC1"; // hard court blue
    case "carpet":  return "#7C5CBF"; // muted purple
    case "indoor":  return "#5C7A8C"; // slate
    default:        return "#888888"; // neutral fallback
  }
}

function tierLabel(tier: string | null | undefined): string | null {
  if (!tier) return null;
  const map: Record<string, string> = {
    grand_slam:    "Grand Slam",
    masters_1000:  "Masters 1000",
    atp_500:       "ATP 500",
    atp_250:       "ATP 250",
    wta_1000:      "WTA 1000",
    wta_500:       "WTA 500",
    wta_250:       "WTA 250",
    itf_davis_cup: "Davis Cup",
    major:         "Major",
    pga_tour:      "PGA Tour",
    liv_golf:      "LIV Golf",
    dp_world_tour: "DP World Tour",
    lpga:          "LPGA",
    champions:     "Champions Tour",
  };
  return map[tier] ?? tier.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function doublesLabel(type: string | null | undefined): string | null {
  if (!type) return null;
  const t = type.toUpperCase();
  if (t === "XD" || t === "MX") return "Mixed Doubles";
  if (["MD", "LD", "WD", "QD", "RD"].includes(t)) return "Doubles";
  return null;
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

function matchPassesFilter(
  match: TennisMatch,
  filter: FilterType,
  playerMap: Map<string, TennisPlayer>,
): boolean {
  if (filter === "all") return true;

  const type = (match.type ?? "").toUpperCase().trim();

  // Doubles: any type that clearly indicates doubles
  const isDoubles = ["MD", "WD", "MX", "XD", "D", "MIXED"].some((t) => type.includes(t));
  if (filter === "doubles") return isDoubles;

  // Singles only from here
  if (isDoubles) return false;

  // Try to determine gender from type string first
  const typeImpliesMale   = type === "MS" || type === "M" || type === "M_SINGLES" || type.startsWith("M");
  const typeImpliesFemale = type === "WS" || type === "W" || type === "LS" || type === "W_SINGLES" || type.startsWith("W") || type.startsWith("L");

  if (filter === "ms") {
    if (typeImpliesMale)   return true;
    if (typeImpliesFemale) return false;
    const g = resolvePlayer(match.player1, match.player1_id, playerMap)?.gender;
    return g === "male" || g === "M";
  }

  if (filter === "ws") {
    if (typeImpliesFemale) return true;
    if (typeImpliesMale)   return false;
    const g = resolvePlayer(match.player1, match.player1_id, playerMap)?.gender;
    return g === "female" || g === "F";
  }

  return true;
}

// ---------------------------------------------------------------------------
// Section / court grouping types
// ---------------------------------------------------------------------------

type CourtHeaderItem = { _courtHeader: true; court: string; id: string };
type MatchListItem = TennisMatch | CourtHeaderItem;

function isCourtHeader(item: MatchListItem): item is CourtHeaderItem {
  return "_courtHeader" in item && item._courtHeader === true;
}

// Injects CourtHeaderItem sentinels between court groups.
// Only activates when 2+ distinct non-null court values are present.
function groupByCourt(matches: TennisMatch[]): MatchListItem[] {
  const courts = new Set(matches.map((m) => m.court).filter(Boolean));
  if (courts.size < 2) return matches;

  const grouped = new Map<string, TennisMatch[]>();
  const uncourted: TennisMatch[] = [];

  for (const m of matches) {
    if (m.court) {
      if (!grouped.has(m.court)) grouped.set(m.court, []);
      grouped.get(m.court)!.push(m);
    } else {
      uncourted.push(m);
    }
  }

  const result: MatchListItem[] = [];
  const sortedCourts = [...grouped.keys()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  for (const court of sortedCourts) {
    result.push({ _courtHeader: true, court, id: `court-header-${court}` });
    result.push(...grouped.get(court)!);
  }
  if (uncourted.length > 0) {
    result.push({ _courtHeader: true, court: "Other", id: "court-header-other" });
    result.push(...uncourted);
  }
  return result;
}

type TournamentSection = {
  tournament: TennisTournament;
  data: MatchListItem[];
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
  const [query, setQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const initialAutoSwitch = useRef(true);
  const router = useRouter();

  // ---------------------------------------------------------------------------
  // Load tournaments + matches + players together.
  // Players are also embedded on each match by the API, but we keep the
  // playerMap as a fallback for any matches where embedded data is null
  // (e.g. backend hasn't fully deployed the changelog yet, or opponents
  // not in the followed-player list).
  // ---------------------------------------------------------------------------
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

      // Fetch any player IDs referenced in matches that aren't in the list
      // (opponents, non-followed players, etc.) so names never show as "…".
      const missing = new Set<string>();
      for (const m of matchData) {
        // If the API has embedded the player, no need to fetch separately
        if (!m.player1    && m.player1_id    && !map.has(m.player1_id))    missing.add(m.player1_id);
        if (!m.player2    && m.player2_id    && !map.has(m.player2_id))    missing.add(m.player2_id);
        if (!m.player1_partner && m.player1_partner_id && !map.has(m.player1_partner_id)) missing.add(m.player1_partner_id);
        if (!m.player2_partner && m.player2_partner_id && !map.has(m.player2_partner_id)) missing.add(m.player2_partner_id);
      }

      if (missing.size > 0) {
        Promise.allSettled(
          Array.from(missing).map((id) => tennis.getPlayer(id))
        ).then((results) => {
          const extra: TennisPlayer[] = [];
          for (const r of results) {
            if (r.status === "fulfilled" && r.value.data) extra.push(r.value.data);
          }
          if (extra.length > 0) {
            setPlayerMap((prev) => {
              const next = new Map(prev);
              for (const p of extra) next.set(p.id, p);
              return next;
            });
          }
        }).catch(() => {});
      }
    }).catch(() => {});
  }, []);

  // Initial load (runs once on mount regardless of tab)
  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  // ---------------------------------------------------------------------------
  // Live tab: WebSocket channel (sport:tennis:games)
  //   tennis_state → full snapshot of live matches on join
  //   tennis_delta → changed matches only; merge by id
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (statusTab !== "live") return;

    const channel = joinTennisGamesChannel({
      onState: (incoming) => {
        setAllMatches(incoming);
        // Fetch any players missing from the map (embedded may be null)
        setPlayerMap((prev) => {
          const missing = new Set<string>();
          for (const m of incoming) {
            if (!m.player1    && m.player1_id    && !prev.has(m.player1_id))    missing.add(m.player1_id);
            if (!m.player2    && m.player2_id    && !prev.has(m.player2_id))    missing.add(m.player2_id);
            if (!m.player1_partner && m.player1_partner_id && !prev.has(m.player1_partner_id)) missing.add(m.player1_partner_id);
            if (!m.player2_partner && m.player2_partner_id && !prev.has(m.player2_partner_id)) missing.add(m.player2_partner_id);
          }
          if (missing.size > 0) {
            Promise.allSettled(Array.from(missing).map((id) => tennis.getPlayer(id)))
              .then((results) => {
                const extra: TennisPlayer[] = [];
                for (const r of results) {
                  if (r.status === "fulfilled" && r.value.data) extra.push(r.value.data);
                }
                if (extra.length > 0) {
                  setPlayerMap((p) => {
                    const next = new Map(p);
                    for (const player of extra) next.set(player.id, player);
                    return next;
                  });
                }
              }).catch(() => {});
          }
          return prev;
        });
      },
      onDelta: (changed) => {
        setAllMatches((prev) => {
          const map = new Map(prev.map((m) => [m.id, m]));
          changed.forEach((m) => map.set(m.id, m));
          return Array.from(map.values());
        });
      },
    });

    return () => { channel.leave(); };
  }, [statusTab]);

  // Upcoming / Final tabs: re-fetch matches on tab switch
  useEffect(() => {
    if (statusTab === "live") return;
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [statusTab]);

  function onRefresh() {
    if (statusTab === "live") return; // socket pushes updates automatically
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
      const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2h ago
      filtered = allMatches
        .filter((m) => !isLiveMatch(m) && !isFinishedMatch(m) && (m.starts_at == null || m.starts_at >= cutoff))
        .sort((a, b) => (a.starts_at ?? "").localeCompare(b.starts_at ?? ""));
    } else {
      filtered = allMatches
        .filter(isFinishedMatch)
        .sort((a, b) => (b.finished_at ?? "").localeCompare(a.finished_at ?? ""));
    }
    filtered = filtered.filter((m) => matchPassesFilter(m, filter, playerMap));

    // Player name search
    const q = query.trim().toLowerCase();
    if (q.length > 0) {
      filtered = filtered.filter((m) => {
        const p1 = resolvePlayer(m.player1, m.player1_id, playerMap);
        const p2 = resolvePlayer(m.player2, m.player2_id, playerMap);
        const p1p = resolvePlayer(m.player1_partner, m.player1_partner_id, playerMap);
        const p2p = resolvePlayer(m.player2_partner, m.player2_partner_id, playerMap);
        return (
          playerName(p1).toLowerCase().includes(q) ||
          playerName(p2).toLowerCase().includes(q) ||
          playerName(p1p).toLowerCase().includes(q) ||
          playerName(p2p).toLowerCase().includes(q)
        );
      });
    }

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
      result.push({ tournament: t, data: groupByCourt(matches) });
    }

    // Sort tournament sections: upcoming → soonest first; finished → most recent first
    if (statusTab === "upcoming") {
      result.sort((a, b) => {
        const aFirst = a.data.find((i): i is TennisMatch => !isCourtHeader(i))?.starts_at ?? "";
        const bFirst = b.data.find((i): i is TennisMatch => !isCourtHeader(i))?.starts_at ?? "";
        return aFirst.localeCompare(bFirst);
      });
    } else if (statusTab === "final") {
      result.sort((a, b) => {
        const aLast = [...a.data].reverse().find((i): i is TennisMatch => !isCourtHeader(i))?.finished_at ?? "";
        const bLast = [...b.data].reverse().find((i): i is TennisMatch => !isCourtHeader(i))?.finished_at ?? "";
        return bLast.localeCompare(aLast);
      });
    }

    return result;
  }, [allMatches, statusTab, filter, query, tournamentMap, playerMap]);

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

  const totalMatches = sections.reduce((acc, s) => acc + s.data.filter((i) => !isCourtHeader(i)).length, 0);

  const emptyMessage = query.trim().length > 0
    ? `No matches found for "${query}".`
    : statusTab === "live" ? "No matches live right now."
    : statusTab === "upcoming" ? "No upcoming matches."
    : "No finished matches.";

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
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

      {/* Player search */}
      <View style={[styles.searchBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Ionicons name="search" size={16} color={colors.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search players…"
          placeholderTextColor={colors.textSecondary}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          clearButtonMode="never"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={17} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
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
            totalCount: s.data.filter((i) => !isCourtHeader(i)).length,
            data: expandedIds.has(s.tournament.id) ? s.data : [],
          }))}
          keyExtractor={(item) => isCourtHeader(item) ? item.id : item.id}
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
          ItemSeparatorComponent={({ leadingItem }) =>
            isCourtHeader(leadingItem) ? null : <View style={styles.matchSeparator} />
          }
          renderItem={({ item }) => {
            if (isCourtHeader(item)) {
              return (
                <View style={styles.courtHeader}>
                  <Text style={styles.courtHeaderText}>{item.court}</Text>
                  <View style={styles.courtHeaderRule} />
                </View>
              );
            }
            return (
              <View>
                {statusTab === "live" && roundLabel(item.round, item.court) ? (
                  <Text style={styles.courtLabel}>{roundLabel(item.round, item.court)}</Text>
                ) : null}
                <MatchCard
                  match={item}
                  playerMap={playerMap}
                  accentColor={surfaceAccentColor(item.surface ?? tournamentMap.get(item.tournament_id)?.surface ?? null)}
                  onPress={() => {
                    const p1 = resolvePlayer(item.player1, item.player1_id, playerMap);
                    const p2 = resolvePlayer(item.player2, item.player2_id, playerMap);
                    const tournamentName = tournamentMap.get(item.tournament_id)?.name;
                    router.push({
                      pathname: `/match/${item.id}`,
                      params: { p1Name: playerName(p1), p2Name: playerName(p2), tournamentName },
                    });
                  }}
                  onPlayerPress={(playerId) => {
                    router.push({
                      pathname: `/(app)/player/${playerId}`,
                      params: { teamId: item.tournament_id, from: "matches" },
                    });
                  }}
                  onH2HPress={() => {
                    router.push(`/(app)/match/h2h/${item.id}?from=matches`);
                  }}
                />
              </View>
            );
          }}
          SectionSeparatorComponent={() => <View style={styles.sectionGap} />}
        />
      )}
    </KeyboardAvoidingView>
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
  const accentColor = surfaceAccentColor(tournament.surface);
  const tier = tierLabel(tournament.tier);
  const dateRange = (() => {
    if (tournament.start_date && tournament.end_date) {
      return `${formatDate(tournament.start_date)} – ${formatDate(tournament.end_date)}`;
    }
    if (tournament.start_date) return formatDate(tournament.start_date);
    return null;
  })();

  return (
    <TouchableOpacity
      style={[styles.tournamentHeader, { borderLeftColor: accentColor }]}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      <View style={styles.tournamentHeaderRow}>
        <Text style={styles.tournamentName} numberOfLines={1}>{tournament.name}</Text>
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
        {tier ? (
          <View style={[styles.tierBadge, { backgroundColor: accentColor + "22", borderColor: accentColor + "55" }]}>
            <Text style={[styles.tierBadgeText, { color: accentColor }]}>{tier}</Text>
          </View>
        ) : null}
        {surface ? <Text style={[styles.tournamentMetaText, { color: accentColor, fontWeight: "600" }]}>{surface}</Text> : null}
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
  accentColor,
  onPress,
  onPlayerPress,
  onH2HPress,
}: {
  match: TennisMatch;
  playerMap: Map<string, TennisPlayer>;
  accentColor: string;
  onPress: () => void;
  onPlayerPress: (playerId: string) => void;
  onH2HPress?: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const live = isLiveMatch(match);
  const finished = isFinishedMatch(match);
  const cancelled = match.status === "cancelled" || match.status === "postponed";

  // Prefer embedded player objects (API changelog); fall back to playerMap
  // (populated via getTournamentPlayers + supplementary fetches) so names
  // always resolve regardless of whether the backend has deployed embedding.
  const p1Name        = match.player1_id ? (playerShortName(resolvePlayer(match.player1, match.player1_id, playerMap)) || "…") : "TBD";
  const p1PartnerName = match.player1_partner_id ? (playerShortName(resolvePlayer(match.player1_partner, match.player1_partner_id, playerMap)) || null) : null;
  const p2Name        = match.player2_id ? (playerShortName(resolvePlayer(match.player2, match.player2_id, playerMap)) || "…") : "TBD";
  const p2PartnerName = match.player2_partner_id ? (playerShortName(resolvePlayer(match.player2_partner, match.player2_partner_id, playerMap)) || null) : null;

  return (
    <TouchableOpacity style={[styles.card, { borderLeftColor: accentColor }]} onPress={onPress} activeOpacity={0.7}>

      {/* Live capsule — absolute top-left corner */}
      {live && (
        <View style={styles.liveCapsule}>
          <View style={styles.liveCapsuleDot} />
          <Text style={styles.liveCapsuleText}>LIVE</Text>
        </View>
      )}

      {/* Status row (non-live only) */}
      {!live && (
        <View style={styles.statusRow}>
          {finished ? (
            <>
              <Text style={styles.finalText}>Final</Text>
              {match.finished_at ? <Text style={styles.statusDetail}>· {formatDate(match.finished_at)}</Text> : null}
            </>
          ) : cancelled ? (
            <Text style={styles.cancelledText}>Cancelled</Text>
          ) : (
            <>
              {match.starts_at
                ? <Text style={styles.scheduleText}>{formatTime(match.starts_at)}</Text>
                : <Text style={styles.scheduleText}>Scheduled</Text>}
              {match.court ? <Text style={styles.statusDetail}>· {match.court}</Text> : null}
            </>
          )}
          <View style={styles.statusBadgeGroup}>
            {match.round && !/^\d+$/.test(match.round) ? <Text style={styles.roundBadge}>{match.round}</Text> : null}
            {doublesLabel(match.type) ? <Text style={styles.doublesBadge}>{doublesLabel(match.type)}</Text> : null}
          </View>
        </View>
      )}

      {/* Round + doubles badge top-right when live */}
      {live && (
        <View style={styles.liveBadgeRow}>
          {doublesLabel(match.type) ? <Text style={styles.doublesBadgeLive}>{doublesLabel(match.type)}</Text> : null}
          {match.round && !/^\d+$/.test(match.round) ? <Text style={styles.roundBadgeLive}>{match.round}</Text> : null}
        </View>
      )}

      {/* Score grid — one row per team so doubles partners stack naturally */}
      <View style={[styles.scoreGrid, live && styles.scoreGridLive]}>
        {([
          { team: 1 as const, mainId: match.player1_id, partnerId: match.player1_partner_id, mainName: p1Name, partnerName: p1PartnerName },
          { team: 2 as const, mainId: match.player2_id, partnerId: match.player2_partner_id, mainName: p2Name, partnerName: p2PartnerName },
        ]).map(({ team, mainId, partnerId, mainName, partnerName }) => {
          const isWinner  = finished && match.winner === team;
          const isLoser   = finished && match.winner !== null && match.winner !== team;
          const isServing = live && match.live?.server === String(team);
          const opp       = team === 1 ? "2" : "1";

          return (
            <View key={team} style={styles.teamRow}>

              {/* Serving dot (or placeholder to keep alignment) */}
              {live
                ? <View style={isServing ? styles.servingDot : styles.servingDotPlaceholder} />
                : null}

              {/* Names — main player (tappable) + optional partner */}
              <View style={styles.teamNames}>
                {partnerName ? (
                  // Doubles: names column + single checkmark vertically centered
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View style={{ flexShrink: 1, gap: 2 }}>
                      <TouchableOpacity
                        onPress={() => mainId && onPlayerPress(mainId)}
                        disabled={!mainId}
                        activeOpacity={0.6}
                        hitSlop={{ top: 4, bottom: 4, left: 0, right: 0 }}
                      >
                        <Text style={[styles.playerName, isWinner && styles.playerWon, isLoser && styles.playerLost]} numberOfLines={1}>
                          {mainName}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => partnerId && onPlayerPress(partnerId)}
                        disabled={!partnerId}
                        activeOpacity={0.6}
                        hitSlop={{ top: 4, bottom: 4, left: 0, right: 0 }}
                      >
                        <Text style={[styles.partnerName, isWinner && styles.playerWon, isLoser && styles.playerLost]} numberOfLines={1}>
                          {partnerName}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    {isWinner && (
                      <Ionicons name="checkmark-circle" size={14} color={colors.primary} style={{ marginLeft: 4, flexShrink: 0 }} />
                    )}
                  </View>
                ) : (
                  // Singles: name with inline checkmark
                  <TouchableOpacity
                    onPress={() => mainId && onPlayerPress(mainId)}
                    disabled={!mainId}
                    activeOpacity={0.6}
                    hitSlop={{ top: 4, bottom: 4, left: 0, right: 0 }}
                  >
                    <View style={styles.playerNameRow}>
                      <Text style={[styles.playerName, isWinner && styles.playerWon, isLoser && styles.playerLost]} numberOfLines={1}>
                        {mainName}
                      </Text>
                      {isWinner && (
                        <Ionicons name="checkmark-circle" size={14} color={colors.primary} style={styles.winnerIcon} />
                      )}
                    </View>
                  </TouchableOpacity>
                )}
              </View>

              {/* Set scores for this team */}
              {(match.sets ?? []).map((set, i) => {
                const myGames  = set[String(team) as "1" | "2"].games ?? 0;
                const oppGames = set[opp as "1" | "2"].games ?? 0;
                const myTb     = set[String(team) as "1" | "2"].tiebreak;
                const wonSet   = myGames > oppGames;
                const lostSet  = myGames < oppGames;
                const showTb   = lostSet && myTb != null;

                // For live matches: skip a 0-0 set that hasn't started yet
                // (the API includes the current set in match.sets even before
                // any games are played). The live game score covers this state.
                if (live && myGames === 0 && oppGames === 0) return null;

                return (
                  <View key={i} style={styles.setScoreCell}>
                    <Text style={[styles.setGames, wonSet && styles.setGamesWon, lostSet && styles.setGamesLost]}>
                      {myGames}
                    </Text>
                    {showTb && <Text style={styles.tiebreakScore}>{myTb}</Text>}
                  </View>
                );
              })}


              {/* Live game score — hidden when both players are at 0 (no game started yet) */}
              {live && match.live && (() => {
                const gs1 = match.live.game_score_1;
                const gs2 = match.live.game_score_2;
                const bothZero = (!gs1 || gs1 === "0") && (!gs2 || gs2 === "0");
                if (bothZero) return null;
                const myGs = team === 1 ? (gs1 || "0") : (gs2 || "0");
                return (
                  <View style={[styles.setScoreCell, styles.gameScoreCell]}>
                    <Text style={styles.gameScore}>{myGs}</Text>
                  </View>
                );
              })()}
            </View>
          );
        })}
      </View>

      {/* H2H button — upcoming matches with two known players only */}
      {SHOW_COMPARE_BUTTON && !live && !finished && match.status === "scheduled" && match.player1_id && match.player2_id && onH2HPress && (
        <TouchableOpacity style={[styles.h2hButton, { borderTopColor: accentColor + "33" }]} onPress={onH2HPress} activeOpacity={0.7}>
          <Ionicons name="stats-chart" size={13} color={accentColor} />
          <Text style={[styles.h2hButtonText, { color: accentColor }]}>Compare</Text>
        </TouchableOpacity>
      )}
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

    // Player search bar
    searchBar: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      gap: spacing.xs,
    },
    searchIcon: { flexShrink: 0 },
    searchInput: {
      flex: 1,
      ...typography.body,
      paddingVertical: 0,
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
      paddingLeft: spacing.md,
      paddingRight: spacing.sm,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xs,
      borderLeftWidth: 4,
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
    tournamentMeta: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      marginTop: 2,
    },
    tournamentMetaText: { ...typography.caption, color: colors.textSecondary },
    tournamentMetaDot: { ...typography.caption, color: colors.textSecondary },
    collapsedCount: { ...typography.caption, color: colors.textSecondary },
    tierBadge: {
      borderRadius: radius.full,
      borderWidth: 1,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    tierBadgeText: {
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 0.4,
    },

    // Match card
    card: {
      backgroundColor: colors.card,
      borderRadius: radius.md,
      padding: spacing.md,
      borderWidth: 0.5,
      borderColor: colors.divider,
      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowRadius: 3,
      elevation: 1,
      overflow: "hidden",
    },
    matchSeparator: {
      height: spacing.sm,
    },
    h2hButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      marginTop: spacing.sm,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
    },
    h2hButtonText: {
      ...typography.caption,
      fontWeight: "700",
      letterSpacing: 0.3,
    },
    courtLabel: {
      ...typography.caption,
      color: colors.textSecondary,
      fontWeight: "600",
      letterSpacing: 0.5,
      textTransform: "uppercase",
      marginTop: spacing.sm,
      marginBottom: 4,
      marginLeft: spacing.md,
    },
    courtHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginTop: spacing.md,
      marginBottom: spacing.xs,
    },
    courtHeaderText: {
      ...typography.caption,
      color: colors.textSecondary,
      fontWeight: "700",
      letterSpacing: 0.6,
      textTransform: "uppercase",
      flexShrink: 0,
    },
    courtHeaderRule: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.divider,
    },

    // Live capsule — absolute top-left
    liveCapsule: {
      position: "absolute",
      top: 0,
      left: 0,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#ef4444",
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: 5,
      borderBottomRightRadius: radius.md,
      gap: 5,
      zIndex: 1,
    },
    liveCapsuleDot: {
      width: 6,
      height: 6,
      borderRadius: radius.full,
      backgroundColor: "#fff",
    },
    liveCapsuleText: {
      fontSize: 11,
      fontWeight: "700",
      color: "#fff",
      letterSpacing: 0.4,
    },
    liveBadgeRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 6,
      marginBottom: spacing.xs,
    },
    roundBadgeLive: {
      ...typography.caption,
      color: colors.textSecondary,
      fontWeight: "600",
    },
    doublesBadge: {
      ...typography.caption,
      color: colors.primary,
      fontWeight: "600",
    },
    doublesBadgeLive: {
      ...typography.caption,
      color: colors.primary,
      fontWeight: "600",
    },

    // Status row (non-live)
    statusRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: spacing.sm,
      gap: 5,
    },
    finalText: { ...typography.caption, color: colors.textSecondary, fontWeight: "600" },
    cancelledText: { ...typography.caption, color: "#E05252", fontWeight: "600" },
    scheduleText: { ...typography.caption, color: colors.textSecondary },
    statusDetail: { ...typography.caption, color: colors.textSecondary },
    statusBadgeGroup: {
      flexDirection: "row",
      alignItems: "center",
      marginLeft: "auto",
      gap: 6,
    },
    roundBadge: {
      ...typography.caption,
      color: colors.textSecondary,
      fontWeight: "600",
    },

    // Score grid — outer column, one teamRow per team
    scoreGrid: { flexDirection: "column", gap: 8 },
    scoreGridLive: { marginTop: spacing.xs },

    // One horizontal row per team (names + set scores side by side)
    teamRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },

    // Serving indicator
    servingDot: {
      width: 7,
      height: 7,
      borderRadius: radius.full,
      backgroundColor: "#c8f000", // tennis-ball yellow-green
      flexShrink: 0,
    },
    servingDotPlaceholder: { width: 7, height: 7, flexShrink: 0 },

    // Names column
    teamNames: { flex: 1, gap: 2 },
    playerNameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    winnerIcon: { flexShrink: 0 },
    playerName: { ...typography.body, color: colors.text, flexShrink: 1 },
    partnerName: { ...typography.caption, color: colors.textSecondary, fontWeight: "500" },
    playerWon:  { fontWeight: "700", color: colors.text },
    playerLost: { color: colors.textSecondary },

    // Set score cell (one per set per team)
    setScoreCell: {
      flexDirection: "row",
      alignItems: "flex-start",
      minWidth: 20,
      justifyContent: "center",
    },
    setGames: {
      fontSize: 16,
      fontWeight: "500",
      color: colors.text,
      textAlign: "center",
      lineHeight: 20,
    },
    setGamesWon:  { fontWeight: "700", color: colors.text },
    setGamesLost: { color: colors.textSecondary, fontWeight: "400" },
    tiebreakScore: {
      fontSize: 8,
      color: colors.textSecondary,
      lineHeight: 10,
      marginTop: 0,
      alignSelf: "flex-start",
    },

    // Sets won total cell (rightmost on finished cards, separated by hairline)
    setsWonCell: {
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderLeftColor: colors.border,
      paddingLeft: 8,
      minWidth: 20,
    },

    // Live game score cell (rightmost, separated by hairline)
    gameScoreCell: {
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderLeftColor: colors.border,
      paddingLeft: 8,
      minWidth: 28,
      justifyContent: "center",
    },
    gameScore: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.live ?? colors.primary,
      textAlign: "center",
      lineHeight: 20,
    },
  });
}
