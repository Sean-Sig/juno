import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  View,
  Text,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { basketball, hockey, football, useSport, joinBasketballGamesChannel, type BasketballGame, type HockeyGame, type FootballGame } from "@juno/api";
import { useTheme, spacing, typography, radius, type Palette } from "@juno/ui";

type FilterTab = "live" | "upcoming" | "final";

const TABS: { key: FilterTab; label: string }[] = [
  { key: "live", label: "Live" },
  { key: "upcoming", label: "Upcoming" },
  { key: "final", label: "Final" },
];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function tomorrowStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function formatTime(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ---------------------------------------------------------------------------
// Basketball GameCard
// ---------------------------------------------------------------------------
function basketballPeriodLabel(game: BasketballGame) {
  if (!game.period) return game.status_detail ?? "";
  const p = game.period;
  if (p <= 4) return `Q${p}`;
  return `OT${p - 4 > 1 ? p - 4 : ""}`;
}

function BasketballGameCard({ game, onPress }: { game: BasketballGame; onPress: () => void }) {
  const isLive = game.status === "live";
  const isFinished = game.status === "finished";

  return (
    <GameCardShell
      game={game}
      isLive={isLive}
      isFinished={isFinished}
      statusLabel={isLive ? basketballPeriodLabel(game) : undefined}
      onPress={onPress}
    />
  );
}

// ---------------------------------------------------------------------------
// Hockey GameCard
// ---------------------------------------------------------------------------
function hockeyPeriodLabel(game: HockeyGame) {
  if (!game.period) return game.status_detail ?? "";
  const p = game.period;
  if (p <= 3) return `P${p}`;
  if (p === 4) return "OT";
  return "SO";
}

function HockeyGameCard({ game, onPress }: { game: HockeyGame; onPress: () => void }) {
  const isLive = game.status === "live";
  const isFinished = game.status === "finished";

  return (
    <GameCardShell
      game={game}
      isLive={isLive}
      isFinished={isFinished}
      statusLabel={isLive ? hockeyPeriodLabel(game) : undefined}
      onPress={onPress}
    />
  );
}

// ---------------------------------------------------------------------------
// Shared card shell — reimagined
// ---------------------------------------------------------------------------
type SharedGame = {
  id: string;
  league: string | null;
  status: string;
  scheduled_at: string | null;
  period_time: string | null;
  home_score: number | null;
  away_score: number | null;
  home_team: { name: string; full_name?: string | null; abbreviation: string | null } | null;
  away_team: { name: string; full_name?: string | null; abbreviation: string | null } | null;
};

function GameCardShell({
  game,
  isLive,
  isFinished,
  statusLabel,
  onPress,
  children,
}: {
  game: SharedGame;
  isLive: boolean;
  isFinished: boolean;
  statusLabel?: string;
  onPress: () => void;
  children?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const awayWins = isFinished && (game.away_score ?? 0) > (game.home_score ?? 0);
  const homeWins = isFinished && (game.home_score ?? 0) > (game.away_score ?? 0);

  return (
    <TouchableOpacity
      style={[styles.card, isLive && styles.cardLive]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {/* ── Live capsule — absolute top-left corner ── */}
      {isLive && (
        <View style={styles.liveCapsule}>
          <View style={styles.liveDot} />
          <Text style={styles.liveCapsuleText}>
            {statusLabel ?? "LIVE"}
            {game.period_time ? `  ·  ${game.period_time}` : ""}
          </Text>
        </View>
      )}

      {/* ── Status bar (non-live only) ── */}
      {!isLive && (
        <View style={styles.cardHeader}>
          {isFinished ? (
            <Text style={styles.finalBadge}>FINAL</Text>
          ) : (
            <Text style={styles.scheduleTime}>{formatTime(game.scheduled_at)}</Text>
          )}
          <Text style={styles.leagueBadge}>{game.league?.toUpperCase() ?? ""}</Text>
        </View>
      )}

      {/* League badge sits top-right when live */}
      {isLive && (
        <Text style={styles.leagueBadgeLive}>{game.league?.toUpperCase() ?? ""}</Text>
      )}

      {/* ── Teams + scores ── */}
      <View style={[styles.teamsContainer, isLive && styles.teamsContainerLive]}>
        <TeamScoreRow
          abbrev={game.away_team?.abbreviation ?? null}
          name={game.away_team?.name ?? "TBD"}
          fullName={game.away_team?.full_name}
          score={game.away_score}
          showScore={isLive || isFinished}
          winner={awayWins}
          loser={homeWins}   /* home won → away lost */
        />
        <TeamScoreRow
          abbrev={game.home_team?.abbreviation ?? null}
          name={game.home_team?.name ?? "TBD"}
          fullName={game.home_team?.full_name}
          score={game.home_score}
          showScore={isLive || isFinished}
          winner={homeWins}
          loser={awayWins}   /* away won → home lost */
        />
      </View>

      {/* ── Period breakdown (passed as children) ── */}
      {children}
    </TouchableOpacity>
  );
}

function TeamScoreRow({
  abbrev,
  name,
  fullName,
  score,
  showScore,
  winner,
  loser,
}: {
  abbrev: string | null;
  name: string;
  fullName?: string | null;
  score: number | null;
  showScore: boolean;
  winner: boolean;
  loser: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.teamRow}>
      <Text style={[styles.teamAbbrev, loser && styles.teamMuted]} numberOfLines={1}>
        {abbrev ?? name.slice(0, 3).toUpperCase()}
      </Text>
      <View style={styles.teamNameCol}>
        <Text style={[styles.teamName, loser && styles.teamMuted]} numberOfLines={1}>
          {name}
        </Text>
        {fullName ? (
          <Text style={[styles.teamFullName, loser && styles.teamMuted]} numberOfLines={1}>
            {fullName}
          </Text>
        ) : null}
      </View>
      {showScore && score != null ? (
        <Text style={[styles.teamScore, winner && styles.teamScoreWinner, loser && styles.teamScoreMuted]}>
          {score}
        </Text>
      ) : !showScore ? (
        <View style={styles.teamScorePlaceholder} />
      ) : null}
    </View>
  );
}

function PeriodRow({
  periods,
  awayAbbrev,
  homeAbbrev,
}: {
  periods: { label: string; away: number | null | undefined; home: number | null | undefined }[];
  awayAbbrev?: string | null;
  homeAbbrev?: string | null;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const hasData = periods.some((p) => p.away != null || p.home != null);
  if (!hasData) return null;

  return (
    <View style={styles.periodGrid}>
      {/* Header row */}
      <View style={styles.periodRow}>
        <Text style={styles.periodTeamLabel} />
        {periods.map(({ label }) => (
          <Text key={label} style={styles.periodHead}>{label}</Text>
        ))}
      </View>
      {/* Away row */}
      <View style={styles.periodRow}>
        <Text style={styles.periodTeamLabel} numberOfLines={1}>
          {awayAbbrev ?? "AWY"}
        </Text>
        {periods.map(({ label, away }) => (
          <Text key={label} style={styles.periodScore}>{away ?? "–"}</Text>
        ))}
      </View>
      {/* Home row */}
      <View style={styles.periodRow}>
        <Text style={styles.periodTeamLabel} numberOfLines={1}>
          {homeAbbrev ?? "HME"}
        </Text>
        {periods.map(({ label, home }) => (
          <Text key={label} style={styles.periodScore}>{home ?? "–"}</Text>
        ))}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Basketball games view
// ---------------------------------------------------------------------------
function BasketballGamesView() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();

  const [tab, setTab] = useState<FilterTab>("live");
  const [games, setGames] = useState<BasketballGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const initialAutoSwitch = useRef(true);

  // Auto-switch to Upcoming if no live games on first load
  useEffect(() => {
    if (!loading && tab === "live" && games.length === 0 && initialAutoSwitch.current) {
      initialAutoSwitch.current = false;
      setTab("upcoming");
    }
  }, [loading, games.length, tab]);

  // Live tab: subscribe to WebSocket channel for real-time score updates.
  // On join the server immediately pushes `basketball_state` (full snapshot),
  // then pushes `basketball_delta` (changed games only) on each import cycle.
  useEffect(() => {
    if (tab !== "live") return;
    setLoading(true);

    const channel = joinBasketballGamesChannel({
      onState: (incoming) => {
        setGames(incoming);
        setLoading(false);
      },
      onDelta: (changed) => {
        setGames((prev) => {
          const map = new Map(prev.map((g) => [g.id, g]));
          changed.forEach((g) => map.set(g.id, g));
          return Array.from(map.values());
        });
      },
    });

    return () => {
      channel.leave();
    };
  }, [tab]);

  // Upcoming / Final tabs: REST API (no live data needed).
  const load = useCallback(async (filter: FilterTab) => {
    const params: Parameters<typeof basketball.getGames>[0] = {};
    if (filter === "upcoming") params.status = "scheduled";
    else params.status = "finished";
    const { data } = await basketball.getGames(params);
    if (filter === "final") {
      setGames([...data].sort((a, b) => (b.scheduled_at ?? "").localeCompare(a.scheduled_at ?? "")));
    } else {
      setGames(data);
    }
  }, []);

  useEffect(() => {
    if (tab === "live") return; // handled by channel above
    setLoading(true);
    load(tab).finally(() => setLoading(false));
  }, [tab, load]);

  function onRefresh() {
    if (tab === "live") return; // socket pushes updates automatically
    setRefreshing(true);
    load(tab).finally(() => setRefreshing(false));
  }

  return (
    <GamesListView
      tab={tab}
      onTabChange={setTab}
      loading={loading}
      refreshing={refreshing}
      onRefresh={onRefresh}
      games={games}
      filterFn={(g, q) =>
        (g.home_team?.name?.toLowerCase().includes(q) ?? false) ||
        (g.home_team?.full_name?.toLowerCase().includes(q) ?? false) ||
        (g.home_team?.abbreviation?.toLowerCase().includes(q) ?? false) ||
        (g.away_team?.name?.toLowerCase().includes(q) ?? false) ||
        (g.away_team?.full_name?.toLowerCase().includes(q) ?? false) ||
        (g.away_team?.abbreviation?.toLowerCase().includes(q) ?? false)
      }
      renderGame={(item) => (
        <BasketballGameCard
          game={item}
          onPress={() => router.push(`/game/${item.id}`)}
        />
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// Hockey games view
// ---------------------------------------------------------------------------
function HockeyGamesView() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();

  const [tab, setTab] = useState<FilterTab>("live");
  const [games, setGames] = useState<HockeyGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const initialAutoSwitch = useRef(true);

  // Auto-switch to Upcoming if no live games on first load
  useEffect(() => {
    if (!loading && tab === "live" && games.length === 0 && initialAutoSwitch.current) {
      initialAutoSwitch.current = false;
      setTab("upcoming");
    }
  }, [loading, games.length, tab]);

  const load = useCallback(async (filter: FilterTab) => {
    if (filter === "live") {
      const { data } = await hockey.getGames({ status: "live", league: "NHL" });
      setGames(data);
    } else if (filter === "upcoming") {
      const { data } = await hockey.getGames({ status: "scheduled", league: "NHL" });
      setGames([...data].sort((a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? "")));
    } else {
      const { data } = await hockey.getGames({ status: "finished", league: "NHL" });
      setGames([...data].sort((a, b) => (b.scheduled_at ?? "").localeCompare(a.scheduled_at ?? "")));
    }
  }, []);

  useEffect(() => { setLoading(true); load(tab).finally(() => setLoading(false)); }, [tab, load]);
  function onRefresh() { setRefreshing(true); load(tab).finally(() => setRefreshing(false)); }

  return (
    <GamesListView
      tab={tab}
      onTabChange={setTab}
      loading={loading}
      refreshing={refreshing}
      onRefresh={onRefresh}
      games={games}
      filterFn={(g, q) =>
        (g.home_team?.name?.toLowerCase().includes(q) ?? false) ||
        (g.home_team?.full_name?.toLowerCase().includes(q) ?? false) ||
        (g.home_team?.abbreviation?.toLowerCase().includes(q) ?? false) ||
        (g.away_team?.name?.toLowerCase().includes(q) ?? false) ||
        (g.away_team?.full_name?.toLowerCase().includes(q) ?? false) ||
        (g.away_team?.abbreviation?.toLowerCase().includes(q) ?? false)
      }
      renderGame={(item) => (
        <HockeyGameCard
          game={item}
          onPress={() => router.push(`/game/${item.id}`)}
        />
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// Football GameCard
// ---------------------------------------------------------------------------
function footballQuarterLabel(game: FootballGame) {
  if (!game.period) return game.status_detail ?? "";
  const p = game.period;
  if (p <= 4) return `Q${p}`;
  return `OT`;
}

function FootballGameCard({ game, onPress }: { game: FootballGame; onPress: () => void }) {
  const isLive = game.status === "live";
  const isFinished = game.status === "finished";

  return (
    <GameCardShell
      game={game}
      isLive={isLive}
      isFinished={isFinished}
      statusLabel={isLive ? footballQuarterLabel(game) : undefined}
      onPress={onPress}
    />
  );
}

// ---------------------------------------------------------------------------
// Football games view
// ---------------------------------------------------------------------------
function FootballGamesView() {
  const router = useRouter();

  const [tab, setTab] = useState<FilterTab>("live");
  const [games, setGames] = useState<FootballGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const initialAutoSwitch = useRef(true);

  // Auto-switch to Upcoming if no live games on first load
  useEffect(() => {
    if (!loading && tab === "live" && games.length === 0 && initialAutoSwitch.current) {
      initialAutoSwitch.current = false;
      setTab("upcoming");
    }
  }, [loading, games.length, tab]);

  const load = useCallback(async (filter: FilterTab) => {
    const params: Parameters<typeof football.getGames>[0] = {};
    if (filter === "live") params.status = "live";
    else if (filter === "upcoming") { params.date = tomorrowStr(); params.status = "scheduled"; }
    else { params.date = todayStr(); params.status = "finished"; }
    const { data } = await football.getGames(params);
    setGames(data);
  }, []);

  useEffect(() => { setLoading(true); load(tab).finally(() => setLoading(false)); }, [tab, load]);
  function onRefresh() { setRefreshing(true); load(tab).finally(() => setRefreshing(false)); }

  return (
    <GamesListView
      tab={tab}
      onTabChange={setTab}
      loading={loading}
      refreshing={refreshing}
      onRefresh={onRefresh}
      games={games}
      filterFn={(g, q) =>
        (g.home_team?.name?.toLowerCase().includes(q) ?? false) ||
        (g.home_team?.abbreviation?.toLowerCase().includes(q) ?? false) ||
        (g.away_team?.name?.toLowerCase().includes(q) ?? false) ||
        (g.away_team?.abbreviation?.toLowerCase().includes(q) ?? false)
      }
      renderGame={(item) => (
        <FootballGameCard
          game={item}
          onPress={() => router.push(`/game/${item.id}`)}
        />
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// Shared list shell
// ---------------------------------------------------------------------------
function GamesListView<T extends { id: string }>({
  tab,
  onTabChange,
  loading,
  refreshing,
  onRefresh,
  games,
  renderGame,
  filterFn,
  leagueSwitcher,
}: {
  tab: FilterTab;
  onTabChange: (t: FilterTab) => void;
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  games: T[];
  renderGame: (item: T) => React.ReactElement;
  filterFn?: (item: T, query: string) => boolean;
  leagueSwitcher?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [query, setQuery] = useState("");

  // Reset search when switching tabs
  useEffect(() => { setQuery(""); }, [tab]);

  const displayed = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !filterFn) return games;
    return games.filter((g) => filterFn(g, q));
  }, [games, query, filterFn]);

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      {leagueSwitcher}
      <View style={styles.tabBar}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tabItem, tab === t.key && styles.tabItemActive]}
            onPress={() => onTabChange(t.key)}
          >
            <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search bar */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search teams…"
          value={query}
          onChangeText={setQuery}
          placeholderTextColor={colors.textSecondary}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={displayed}
          keyExtractor={(g) => g.id}
          contentContainerStyle={displayed.length === 0 ? styles.emptyContent : styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          renderItem={({ item }) => renderGame(item)}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>
                {query.trim() ? "No results" : "No games found"}
              </Text>
              <Text style={styles.emptyText}>
                {query.trim()
                  ? `No games matching "${query}".`
                  : tab === "live"
                  ? "No games are live right now."
                  : tab === "upcoming"
                  ? "No upcoming games found."
                  : "No finished games found."}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Root export
// ---------------------------------------------------------------------------
export default function GamesScreen() {
  const { activeSport } = useSport();
  if (activeSport === "hockey") return <HockeyGamesView />;
  if (activeSport === "football") return <FootballGamesView />;
  return <BasketballGamesView />;
}

function createStyles(colors: Palette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    tabBar: {
      flexDirection: "row",
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.divider,
    },
    tabItem: { flex: 1, paddingVertical: spacing.sm + 2, alignItems: "center" },
    tabItemActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
    tabLabel: { ...typography.label, color: colors.textSecondary },
    tabLabelActive: { color: colors.primary, fontWeight: "700" },
    searchBar: {
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.divider,
    },
    searchInput: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      ...typography.body,
      color: colors.text,
      height: 40,
    },
    listContent: { padding: spacing.md, gap: spacing.sm },
    emptyContent: { flexGrow: 1, padding: spacing.md },
    emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80 },
    emptyTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.xs },
    emptyText: { ...typography.body, color: colors.textSecondary, textAlign: "center" },

    // ── Card shell ──
    card: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      padding: spacing.md,
      shadowColor: "#000",
      shadowOpacity: 0.06,
      shadowOffset: { width: 0, height: 2 },
      shadowRadius: 8,
      elevation: 3,
      borderLeftWidth: 3,
      borderLeftColor: "transparent",
      overflow: "hidden",
    },
    cardLive: {
      borderLeftColor: "transparent", // capsule replaces the stripe when live
    },

    // ── Live capsule (absolute top-left) ──
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
    liveDot: {
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
    teamsContainerLive: {
      marginTop: spacing.lg + 4, // push teams below the capsule
    },
    leagueBadgeLive: {
      ...typography.caption,
      color: colors.textSecondary,
      fontWeight: "600",
      letterSpacing: 0.8,
      textAlign: "right",
      marginBottom: spacing.xs,
    },

    // ── Status bar (non-live) ──
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.md,
    },
    finalBadge: {
      ...typography.caption,
      color: colors.textSecondary,
      fontWeight: "700",
      letterSpacing: 0.8,
    },
    scheduleTime: {
      ...typography.label,
      color: colors.text,
      fontWeight: "600",
    },
    leagueBadge: {
      ...typography.caption,
      color: colors.textSecondary,
      fontWeight: "600",
      letterSpacing: 0.8,
    },

    // ── Teams ──
    teamsContainer: {
      gap: spacing.xs,
    },
    teamRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    teamAbbrev: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.text,
      width: 36,
      letterSpacing: 0.3,
    },
    teamNameCol: {
      flex: 1,
      gap: 1,
    },
    teamName: {
      ...typography.body,
      color: colors.text,
      fontWeight: "500",
    },
    teamFullName: {
      fontSize: 11,
      color: colors.textSecondary,
      fontWeight: "400",
    },
    teamMuted: {
      color: colors.textSecondary,
    },
    teamScore: {
      fontSize: 26,
      fontWeight: "800",
      color: colors.text,
      minWidth: 42,
      textAlign: "right",
      lineHeight: 30,
    },
    teamScoreWinner: {
      color: colors.primary,
    },
    teamScoreMuted: {
      color: colors.textSecondary,
      fontWeight: "600",
    },
    teamScorePlaceholder: {
      width: 42,
    },

    // ── Period / quarter grid ──
    periodGrid: {
      marginTop: spacing.md,
      paddingTop: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      gap: 3,
    },
    periodRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    periodTeamLabel: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.textSecondary,
      width: 36,
      letterSpacing: 0.3,
    },
    periodHead: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.textSecondary,
      flex: 1,
      textAlign: "center",
      letterSpacing: 0.3,
    },
    periodScore: {
      fontSize: 12,
      fontWeight: "500",
      color: colors.text,
      flex: 1,
      textAlign: "center",
    },
  });
}
