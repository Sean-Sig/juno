import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  View,
  Text,
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
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isLive = game.status === "live";
  const isFinished = game.status === "finished";

  const periods = [
    { label: "Q1", away: game.away_score_q1, home: game.home_score_q1 },
    { label: "Q2", away: game.away_score_q2, home: game.home_score_q2 },
    { label: "Q3", away: game.away_score_q3, home: game.home_score_q3 },
    { label: "Q4", away: game.away_score_q4, home: game.home_score_q4 },
  ];
  const hasPeriodData = periods.some((p) => p.away != null || p.home != null);

  return (
    <GameCardShell
      game={game}
      isLive={isLive}
      isFinished={isFinished}
      statusLabel={isLive ? basketballPeriodLabel(game) : undefined}
      onPress={onPress}
    >
      {(isLive || isFinished) && hasPeriodData && (
        <PeriodRow periods={periods} />
      )}
    </GameCardShell>
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
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isLive = game.status === "live";
  const isFinished = game.status === "finished";

  const periods = [
    { label: "P1", away: game.away_score_p1, home: game.home_score_p1 },
    { label: "P2", away: game.away_score_p2, home: game.home_score_p2 },
    { label: "P3", away: game.away_score_p3, home: game.home_score_p3 },
    ...(game.home_score_ot != null || game.away_score_ot != null
      ? [{ label: game.shootout ? "SO" : "OT", away: game.away_score_ot, home: game.home_score_ot }]
      : []),
  ];
  const hasPeriodData = periods.some((p) => p.away != null || p.home != null);

  return (
    <GameCardShell
      game={game}
      isLive={isLive}
      isFinished={isFinished}
      statusLabel={isLive ? hockeyPeriodLabel(game) : undefined}
      onPress={onPress}
    >
      {(isLive || isFinished) && hasPeriodData && (
        <PeriodRow periods={periods} />
      )}
    </GameCardShell>
  );
}

// ---------------------------------------------------------------------------
// Shared card shell
// ---------------------------------------------------------------------------
type SharedGame = {
  id: string;
  league: string | null;
  status: string;
  scheduled_at: string | null;
  period_time: string | null;
  home_score: number | null;
  away_score: number | null;
  home_team: { name: string; abbreviation: string | null } | null;
  away_team: { name: string; abbreviation: string | null } | null;
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

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      {game.league && (
        <Text style={styles.leagueBadge}>{game.league.toUpperCase()}</Text>
      )}

      <View style={styles.statusRow}>
        {isLive ? (
          <>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>
              {statusLabel}
              {game.period_time ? ` · ${game.period_time}` : ""}
            </Text>
          </>
        ) : isFinished ? (
          <Text style={styles.finalText}>Final</Text>
        ) : (
          <Text style={styles.scheduleText}>{formatTime(game.scheduled_at)}</Text>
        )}
      </View>

      <View style={styles.matchup}>
        <TeamRow
          name={game.away_team?.name ?? "TBD"}
          abbrev={game.away_team?.abbreviation ?? null}
          score={game.away_score}
          showScore={isLive || isFinished}
          winner={isFinished && (game.away_score ?? 0) > (game.home_score ?? 0)}
        />
        <Text style={styles.at}>@</Text>
        <TeamRow
          name={game.home_team?.name ?? "TBD"}
          abbrev={game.home_team?.abbreviation ?? null}
          score={game.home_score}
          showScore={isLive || isFinished}
          winner={isFinished && (game.home_score ?? 0) > (game.away_score ?? 0)}
        />
      </View>

      {children}
    </TouchableOpacity>
  );
}

function PeriodRow({ periods }: { periods: { label: string; away: number | null | undefined; home: number | null | undefined }[] }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.quarterRow}>
      {periods.map(({ label, away, home }) => (
        <View key={label} style={styles.quarterCol}>
          <Text style={styles.quarterHead}>{label}</Text>
          <Text style={styles.quarterScore}>{away ?? "-"}</Text>
          <Text style={styles.quarterScore}>{home ?? "-"}</Text>
        </View>
      ))}
    </View>
  );
}

function TeamRow({
  name,
  abbrev,
  score,
  showScore,
  winner,
}: {
  name: string;
  abbrev: string | null;
  score: number | null;
  showScore: boolean;
  winner: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.teamRow}>
      <Text style={[styles.teamName, winner && styles.teamNameWinner]} numberOfLines={1}>
        {abbrev ?? name}
      </Text>
      {showScore && score != null && (
        <Text style={[styles.teamScore, winner && styles.teamScoreWinner]}>{score}</Text>
      )}
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

  const quarters = [
    { label: "Q1", away: game.away_score_q1, home: game.home_score_q1 },
    { label: "Q2", away: game.away_score_q2, home: game.home_score_q2 },
    { label: "Q3", away: game.away_score_q3, home: game.home_score_q3 },
    { label: "Q4", away: game.away_score_q4, home: game.home_score_q4 },
    ...(game.home_score_ot != null || game.away_score_ot != null
      ? [{ label: "OT", away: game.away_score_ot, home: game.home_score_ot }]
      : []),
  ];
  const hasQuarterData = quarters.some((q) => q.away != null || q.home != null);

  return (
    <GameCardShell
      game={game}
      isLive={isLive}
      isFinished={isFinished}
      statusLabel={isLive ? footballQuarterLabel(game) : undefined}
      onPress={onPress}
    >
      {(isLive || isFinished) && hasQuarterData && (
        <PeriodRow periods={quarters} />
      )}
    </GameCardShell>
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
  leagueSwitcher,
}: {
  tab: FilterTab;
  onTabChange: (t: FilterTab) => void;
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  games: T[];
  renderGame: (item: T) => React.ReactElement;
  leagueSwitcher?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

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

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={games}
          keyExtractor={(g) => g.id}
          contentContainerStyle={games.length === 0 ? styles.emptyContent : styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          renderItem={({ item }) => renderGame(item)}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>No games found</Text>
              <Text style={styles.emptyText}>
                {tab === "live"
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
    listContent: { padding: spacing.md, gap: spacing.sm },
    emptyContent: { flexGrow: 1, padding: spacing.md },
    emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80 },
    emptyTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.xs },
    emptyText: { ...typography.body, color: colors.textSecondary, textAlign: "center" },

    card: {
      backgroundColor: colors.card,
      borderRadius: radius.md,
      padding: spacing.md,
      shadowColor: "#000",
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    leagueBadge: {
      ...typography.caption,
      color: colors.textSecondary,
      marginBottom: spacing.xs,
      fontWeight: "600",
      letterSpacing: 0.5,
    },
    statusRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.sm },
    liveDot: {
      width: 7,
      height: 7,
      borderRadius: radius.full,
      backgroundColor: "#ef4444",
      marginRight: 5,
    },
    liveText: { ...typography.caption, color: "#ef4444", fontWeight: "700" },
    finalText: { ...typography.caption, color: colors.textSecondary, fontWeight: "600" },
    scheduleText: { ...typography.caption, color: colors.textSecondary },
    matchup: { gap: spacing.xs },
    at: {
      ...typography.caption,
      color: colors.textSecondary,
      alignSelf: "center",
      marginVertical: 2,
    },
    teamRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    teamName: { ...typography.body, color: colors.text, flex: 1, fontWeight: "500" },
    teamNameWinner: { fontWeight: "700", color: colors.text },
    teamScore: { ...typography.h3, color: colors.text, minWidth: 30, textAlign: "right" },
    teamScoreWinner: { color: colors.primary, fontWeight: "800" },
    quarterRow: {
      flexDirection: "row",
      marginTop: spacing.sm,
      paddingTop: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      gap: spacing.sm,
    },
    quarterCol: { alignItems: "center", flex: 1 },
    quarterHead: { ...typography.caption, color: colors.textSecondary, marginBottom: 2 },
    quarterScore: { ...typography.caption, color: colors.text, fontWeight: "500" },
  });
}
