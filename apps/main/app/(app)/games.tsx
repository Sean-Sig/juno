import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  SectionList,
  ScrollView,
  View,
  Text,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Animated,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  basketball,
  hockey,
  football,
  soccer,
  useSport,
  joinBasketballGamesChannel,
  joinSoccerGamesChannel,
  type BasketballGame,
  type HockeyGame,
  type FootballGame,
  type SoccerGame,
} from "@juno/api";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, spacing, typography, radius, countryFlag, type Palette } from "@juno/ui";

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
  home_team: { id: string; name: string; full_name?: string | null; abbreviation: string | null; logo?: string | null } | null;
  away_team: { id: string; name: string; full_name?: string | null; abbreviation: string | null; logo?: string | null } | null;
  // Soccer-only — undefined for basketball/hockey games, harmless to check.
  penalty_shootout?: boolean | null;
  home_score_pen?: number | null;
  away_score_pen?: number | null;
};

function GameCardShell({
  game,
  isLive,
  isFinished,
  statusLabel,
  onPress,
  children,
  awayFlag,
  homeFlag,
  periodTimeSuffix,
  goalAnimation,
}: {
  game: SharedGame;
  isLive: boolean;
  isFinished: boolean;
  statusLabel?: string;
  onPress: () => void;
  children?: React.ReactNode;
  awayFlag?: string | null;
  homeFlag?: string | null;
  periodTimeSuffix?: string;
  goalAnimation?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // A penalty shootout is only played after regulation/ET ends level, so
  // away_score/home_score are tied by definition — read the real winner off
  // the penalty score instead.
  const decidedByPens =
    isFinished && game.penalty_shootout === true && game.away_score_pen != null && game.home_score_pen != null;
  const awayPenScore = decidedByPens ? game.away_score_pen : null;
  const homePenScore = decidedByPens ? game.home_score_pen : null;

  const awayWins = decidedByPens
    ? awayPenScore! > homePenScore!
    : isFinished && (game.away_score ?? 0) > (game.home_score ?? 0);
  const homeWins = decidedByPens
    ? homePenScore! > awayPenScore!
    : isFinished && (game.home_score ?? 0) > (game.away_score ?? 0);

  // Goal-flash animation — pop the scorer's number and flash a "GOAL" banner
  // whenever a live score ticks up (driven by the soccer_delta websocket push).
  const prevScores = useRef({ away: game.away_score, home: game.home_score });
  const [goalTeam, setGoalTeam] = useState<"home" | "away" | null>(null);
  const awayPulse = useRef(new Animated.Value(1)).current;
  const homePulse = useRef(new Animated.Value(1)).current;
  const bannerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const prev = prevScores.current;
    prevScores.current = { away: game.away_score, home: game.home_score };
    if (!goalAnimation) return;

    const scored: "home" | "away" | null =
      isLive && game.away_score != null && prev.away != null && game.away_score > prev.away
        ? "away"
        : isLive && game.home_score != null && prev.home != null && game.home_score > prev.home
          ? "home"
          : null;
    if (!scored) return;

    setGoalTeam(scored);
    const pulse = scored === "away" ? awayPulse : homePulse;
    Animated.sequence([
      Animated.spring(pulse, { toValue: 1.5, friction: 3, useNativeDriver: true }),
      Animated.spring(pulse, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();

    bannerAnim.setValue(0);
    Animated.sequence([
      Animated.spring(bannerAnim, { toValue: 1, friction: 5, useNativeDriver: true }),
      Animated.delay(1400),
      Animated.timing(bannerAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => setGoalTeam(null));
  }, [game.away_score, game.home_score, isLive, goalAnimation]);

  return (
    <TouchableOpacity
      style={[styles.card, isLive && styles.cardLive]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {/* ── Goal banner — flashes over the card on a score change ── */}
      {goalTeam && (
        <Animated.View
          style={[
            styles.goalBanner,
            {
              opacity: bannerAnim,
              transform: [
                { translateY: bannerAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) },
                { scale: bannerAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) },
              ],
            },
          ]}
        >
          <Text style={styles.goalBannerText}>
            ⚽ GOAL — {goalTeam === "away" ? (game.away_team?.name ?? "Away") : (game.home_team?.name ?? "Home")}
          </Text>
        </Animated.View>
      )}

      {/* ── Live capsule — absolute top-left corner ── */}
      {isLive && (
        <View style={styles.liveCapsule}>
          <View style={styles.liveDot} />
          <Text style={styles.liveCapsuleText}>
            {statusLabel ?? "LIVE"}
            {game.period_time ? `  ·  ${game.period_time}${periodTimeSuffix ?? ""}` : ""}
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
          logo={game.away_team?.logo ?? null}
          flag={awayFlag}
          name={game.away_team?.name ?? "TBD"}
          fullName={game.away_team?.full_name}
          score={game.away_score}
          penScore={awayPenScore}
          showScore={isLive || isFinished}
          winner={awayWins}
          loser={homeWins}
          pulse={awayPulse}
        />
        <TeamScoreRow
          abbrev={game.home_team?.abbreviation ?? null}
          logo={game.home_team?.logo ?? null}
          flag={homeFlag}
          name={game.home_team?.name ?? "TBD"}
          fullName={game.home_team?.full_name}
          score={game.home_score}
          penScore={homePenScore}
          showScore={isLive || isFinished}
          winner={homeWins}
          loser={awayWins}
          pulse={homePulse}
        />
      </View>

      {/* ── Period breakdown (passed as children) ── */}
      {children}
    </TouchableOpacity>
  );
}

function TeamScoreRow({
  abbrev,
  logo,
  flag,
  name,
  fullName,
  score,
  penScore,
  showScore,
  winner,
  loser,
  pulse,
}: {
  abbrev: string | null;
  logo?: string | null;
  flag?: string | null;
  name: string;
  fullName?: string | null;
  score: number | null;
  penScore?: number | null;
  showScore: boolean;
  winner: boolean;
  loser: boolean;
  pulse?: Animated.Value;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.teamRow}>
      {flag ? (
        <Text style={styles.teamFlag}>{flag}</Text>
      ) : logo ? (
        <Image source={{ uri: logo }} style={styles.teamLogo} cachePolicy="memory-disk" contentFit="contain" />
      ) : (
        <Text style={[styles.teamAbbrev, loser && styles.teamMuted]} numberOfLines={1}>
          {abbrev ?? name.slice(0, 3).toUpperCase()}
        </Text>
      )}
      <View style={styles.teamNameCol}>
        <Text style={[styles.teamName, loser && styles.teamMuted]} numberOfLines={1}>
          {name}
        </Text>
        {fullName && fullName !== name ? (
          <Text style={[styles.teamFullName, loser && styles.teamMuted]} numberOfLines={1}>
            {fullName}
          </Text>
        ) : null}
      </View>
      {showScore && score != null ? (
        <Animated.Text
          style={[
            styles.teamScore,
            winner && styles.teamScoreWinner,
            loser && styles.teamScoreMuted,
            pulse ? { transform: [{ scale: pulse }] } : null,
          ]}
        >
          {score}
          {penScore != null && <Text style={styles.teamScorePen}> ({penScore})</Text>}
        </Animated.Text>
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

    // REST fallback so the spinner always clears even if the socket never
    // delivers `basketball_state` — the channel still drives real-time
    // updates once/if it connects (see soccer's identical fix above).
    const refetch = () =>
      basketball.getGames({ status: "live" })
        .then(({ data }) => setGames(data))
        .catch(() => {});
    refetch().finally(() => setLoading(false));

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

    // `basketball_delta` isn't guaranteed to fire promptly for every score
    // change, so poll REST as a safety net (same fix as soccer/golf).
    const pollId = setInterval(refetch, 30_000);

    return () => {
      channel.leave();
      clearInterval(pollId);
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
// NFL — helpers
// ---------------------------------------------------------------------------

function nflKickoffTime(iso: string | null): string {
  if (!iso) return "TBD";
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

// Return the date (YYYY-MM-DD) of the Thursday that starts the NFL week
// containing a given UTC ISO string. NFL weeks run Thu–Wed.
function nflWeekThursday(iso: string): string {
  const d = new Date(iso);
  // getDay(): 0=Sun,1=Mon,2=Tue,3=Wed,4=Thu,5=Fri,6=Sat
  // Days since the most recent Thursday
  const dow = d.getUTCDay();
  const daysBack = (dow + 3) % 7; // Thu=0, Fri=1, Sat=2, Sun=3, Mon=4, Tue=5, Wed=6
  const thu = new Date(d);
  thu.setUTCDate(d.getUTCDate() - daysBack);
  return thu.toISOString().slice(0, 10);
}

type NFLWeekSection = {
  weekKey: string;   // Thursday date YYYY-MM-DD for sorting
  weekNum: number;
  title: string;     // "WEEK 1", "WEEK 2", etc.
  data: FootballGame[];
};

function groupNFLByWeek(games: FootballGame[]): NFLWeekSection[] {
  // Group into week buckets
  const map = new Map<string, FootballGame[]>();
  for (const g of games) {
    const key = g.scheduled_at ? nflWeekThursday(g.scheduled_at) : "9999-99-99";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(g);
  }

  // Sort week keys to assign week numbers
  const sortedKeys = Array.from(map.keys()).sort();
  const sections: NFLWeekSection[] = sortedKeys.map((key, idx) => ({
    weekKey: key,
    weekNum: idx + 1,
    title: `WEEK ${idx + 1}`,
    data: map.get(key)!.slice().sort(
      (a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""),
    ),
  }));

  return sections;
}

// ---------------------------------------------------------------------------
// NFL game card (upcoming only)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// NFL game card — handles upcoming, live, and final states
// ---------------------------------------------------------------------------

function nflGameDayTime(iso: string | null): string {
  if (!iso) return "TBD";
  const d = new Date(iso);
  const day = d.toLocaleDateString([], { weekday: "short" }).toUpperCase();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `${day}  ·  ${time}`;
}

function nflQuarterLabel(game: FootballGame): string {
  if (!game.period) return game.status_detail ?? "LIVE";
  if (game.period <= 4) return `Q${game.period}`;
  return "OT";
}

function kickoffDay(iso: string | null): string {
  if (!iso) return "TBD";
  return new Date(iso).toLocaleDateString([], { weekday: "short" }).toUpperCase();
}

function kickoffTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function nflNickname(name: string | null | undefined): string {
  if (!name) return "TBD";
  return name.split(" ").at(-1) ?? name;
}

function nflRecord(team: FootballGame["away_team"] | FootballGame["home_team"]): string | null {
  if (!team) return null;
  const w = team.wins ?? 0;
  const l = team.losses ?? 0;
  const t = (team as any).ties ?? 0;
  return t > 0 ? `${w}-${l}-${t}` : `${w}-${l}`;
}

function NFLGameCard({ game, onPress }: { game: FootballGame; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isLive = game.status === "live";
  const isFinal = game.status === "finished";
  const away = game.away_team;
  const home = game.home_team;
  const awayWins = isFinal && (game.away_score ?? 0) > (game.home_score ?? 0);
  const homeWins = isFinal && (game.home_score ?? 0) > (game.away_score ?? 0);

  const awayAbbrev = away?.abbreviation ?? away?.name?.slice(0, 3).toUpperCase() ?? "TBD";
  const homeAbbrev = home?.abbreviation ?? home?.name?.slice(0, 3).toUpperCase() ?? "TBD";

  const isUpcoming = !isLive && !isFinal;

  return (
    <TouchableOpacity style={styles.nflCard} onPress={onPress} activeOpacity={0.75}>
      {/* Matchup rows */}
      <View style={styles.nflMatchup}>
        {/* Away */}
        <View style={styles.nflTeamRow}>
          {away?.logo ? (
            <Image source={{ uri: away.logo }} style={styles.nflLogo} cachePolicy="memory-disk" contentFit="contain" />
          ) : (
            <Text style={[styles.nflAbbrev, (isFinal && !awayWins) && styles.nflMuted]} numberOfLines={1}>
              {awayAbbrev}
            </Text>
          )}
          <View style={styles.nflTeamInfo}>
            <View style={styles.nflNameRow}>
              <Text style={[styles.nflTeamName, (isFinal && !awayWins) && styles.nflMuted]} numberOfLines={1}>
                {away?.short_name ?? nflNickname(away?.name)}
              </Text>
              <Text style={styles.nflHomeAwayLabel}>(away)</Text>
            </View>
            {nflRecord(away) && (
              <Text style={[styles.nflRecord, (isFinal && !awayWins) && styles.nflMuted]}>
                {nflRecord(away)}
              </Text>
            )}
          </View>
          {isLive ? (
            <View style={styles.nflStatusRow}>
              <View style={styles.nflLiveDot} />
              <Text style={styles.nflLiveLabel}>
                {nflQuarterLabel(game)}
                {game.period_time ? `  ·  ${game.period_time}` : ""}
              </Text>
            </View>
          ) : isFinal ? (
            <Text style={styles.nflFinalLabel}>FINAL</Text>
          ) : (
            <View style={styles.nflTimeBlock}>
              <Text style={styles.nflTimeValue}>{kickoffTime(game.scheduled_at)}</Text>
              <Text style={styles.nflTimeDay}>{kickoffDay(game.scheduled_at)}</Text>
            </View>
          )}
        </View>

        {/* Home */}
        <View style={styles.nflTeamRow}>
          {home?.logo ? (
            <Image source={{ uri: home.logo }} style={styles.nflLogo} cachePolicy="memory-disk" contentFit="contain" />
          ) : (
            <Text style={[styles.nflAbbrev, (isFinal && !homeWins) && styles.nflMuted]} numberOfLines={1}>
              {homeAbbrev}
            </Text>
          )}
          <View style={styles.nflTeamInfo}>
            <View style={styles.nflNameRow}>
              <Text style={[styles.nflTeamName, (isFinal && !homeWins) && styles.nflMuted]} numberOfLines={1}>
                {home?.short_name ?? nflNickname(home?.name)}
              </Text>
              <Text style={styles.nflHomeAwayLabel}>(home)</Text>
            </View>
            {nflRecord(home) && (
              <Text style={[styles.nflRecord, (isFinal && !homeWins) && styles.nflMuted]}>
                {nflRecord(home)}
              </Text>
            )}
          </View>
          {(isLive || isFinal) && game.home_score != null && (
            <Text style={[styles.nflScore, homeWins && styles.nflScoreWinner, (isFinal && !homeWins) && styles.nflScoreMuted]}>
              {game.home_score}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// NFL games view — Live / Upcoming / Final
// ---------------------------------------------------------------------------

const NFL_TABS: { key: FilterTab; label: string }[] = [
  { key: "live",     label: "Live" },
  { key: "upcoming", label: "Upcoming" },
  { key: "final",    label: "Final" },
];

type NFLLeague = "all" | "NFL" | "NFL Preseason";
const NFL_LEAGUE_FILTERS: { key: NFLLeague; label: string }[] = [
  { key: "all",          label: "All" },
  { key: "NFL",          label: "Regular Season" },
  { key: "NFL Preseason", label: "Preseason" },
];

function weekSectionHeader(sec: NFLWeekSection) {
  if (sec.weekKey === "9999-99-99") return { title: sec.title, range: "" };
  const thu = new Date(sec.weekKey + "T00:00:00");
  const wed = new Date(thu);
  wed.setDate(thu.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString([], { month: "short", day: "numeric" });
  return { title: sec.title, range: `${fmt(thu)} – ${fmt(wed)}` };
}

function FootballGamesView() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();

  const [tab, setTab] = useState<FilterTab>("live");
  const [leagueFilter, setLeagueFilter] = useState<NFLLeague>("all");
  const [games, setGames] = useState<FootballGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const initialAutoSwitch = useRef(true);

  const load = useCallback(async (filter: FilterTab, league: NFLLeague) => {
    const params: Parameters<typeof football.getGames>[0] = {};
    if (league !== "all") params.league = league;
    if (filter === "live")          params.status = "live";
    else if (filter === "upcoming") params.status = "scheduled";
    else                            params.status = "finished";
    const { data } = await football.getGames(params);
    setGames(data);
  }, []);

  useEffect(() => {
    setLoading(true);
    setQuery("");
    load(tab, leagueFilter).finally(() => setLoading(false));
  }, [tab, leagueFilter, load]);

  // Auto-switch to Upcoming if no live games on first load
  useEffect(() => {
    if (!loading && tab === "live" && games.length === 0 && initialAutoSwitch.current) {
      initialAutoSwitch.current = false;
      setTab("upcoming");
    }
  }, [loading, games.length, tab]);

  function onRefresh() {
    setRefreshing(true);
    load(tab, leagueFilter).finally(() => setRefreshing(false));
  }

  const hasLive = tab === "live" && games.length > 0;

  const filteredGames = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return games;
    return games.filter(
      (g) =>
        g.home_team?.name?.toLowerCase().includes(q) ||
        g.home_team?.abbreviation?.toLowerCase().includes(q) ||
        g.away_team?.name?.toLowerCase().includes(q) ||
        g.away_team?.abbreviation?.toLowerCase().includes(q),
    );
  }, [games, query]);

  // Upcoming + Final: group by week. Live: flat list sorted by time.
  const weekSections = useMemo((): NFLWeekSection[] => {
    if (tab === "live") return [];
    const sorted = tab === "final"
      ? filteredGames.slice().sort((a, b) => (b.scheduled_at ?? "").localeCompare(a.scheduled_at ?? ""))
      : filteredGames;
    return groupNFLByWeek(sorted);
  }, [filteredGames, tab]);

  const liveGames = useMemo(() =>
    tab === "live"
      ? filteredGames.slice().sort((a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""))
      : [],
    [filteredGames, tab],
  );

  const emptyMessage = query.trim()
    ? `No games matching "${query}".`
    : tab === "live"    ? "No games live right now."
    : tab === "upcoming" ? "Check back when the schedule is released."
    : "No finished games found.";

  const emptyTitle = query.trim() ? "No results"
    : tab === "live" ? "Nothing live" : "No games found";

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      {/* Live / Upcoming / Final tabs */}
      <View style={styles.tabBar}>
        {NFL_TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tabItem, tab === t.key && styles.tabItemActive]}
            onPress={() => setTab(t.key)}
            activeOpacity={0.7}
          >
            {t.key === "live" && tab !== "live" && hasLive && (
              <View style={styles.nflLiveDotTab} />
            )}
            <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* League filter */}
      <View style={styles.nflLeagueBar}>
        {NFL_LEAGUE_FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.nflLeagueChip, leagueFilter === f.key && styles.nflLeagueChipActive]}
            onPress={() => setLeagueFilter(f.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.nflLeagueChipText, leagueFilter === f.key && styles.nflLeagueChipTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search */}
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
      ) : tab === "live" ? (
        liveGames.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>{emptyTitle}</Text>
            <Text style={styles.emptyText}>{emptyMessage}</Text>
          </View>
        ) : (
          <FlatList
            data={liveGames}
            keyExtractor={(g) => g.id}
            contentContainerStyle={styles.nflListContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
            }
            renderItem={({ item }) => (
              <NFLGameCard game={item} onPress={() => router.push(`/game/${item.id}`)} />
            )}
          />
        )
      ) : weekSections.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>{emptyTitle}</Text>
          <Text style={styles.emptyText}>{emptyMessage}</Text>
        </View>
      ) : (
        <SectionList
          sections={weekSections}
          keyExtractor={(g) => g.id}
          contentContainerStyle={styles.nflListContent}
          stickySectionHeadersEnabled
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          renderSectionHeader={({ section: s }) => {
            const sec = s as NFLWeekSection;
            const { title, range } = weekSectionHeader(sec);
            const isPreseason = sec.data[0]?.league === "NFL Preseason";
            return (
              <View style={styles.nflWeekHeader}>
                <View style={styles.nflWeekLeft}>
                  <Text style={styles.nflWeekTitle}>{title}</Text>
                  {range ? <Text style={styles.nflWeekRange}>{range}</Text> : null}
                </View>
                {isPreseason && <Text style={styles.nflWeekLeagueTag}>PRESEASON</Text>}
              </View>
            );
          }}
          renderItem={({ item }) => (
            <NFLGameCard game={item} onPress={() => router.push(`/game/${item.id}`)} />
          )}
        />
      )}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Soccer — helpers
// ---------------------------------------------------------------------------
function soccerPeriodLabel(game: SoccerGame): string {
  if (game.status_detail === "HT") return "HT";
  if (!game.period) return game.status_detail ?? "LIVE";
  switch (game.period) {
    case 1:
      return "1H";
    case 2:
      return "2H";
    case 3:
      return "ET1";
    case 4:
      return "ET2";
    case 5:
      return "PEN";
    default:
      return game.status_detail ?? "LIVE";
  }
}

function SoccerGameCard({ game, onPress }: { game: SoccerGame; onPress: () => void }) {
  const isLive = game.status === "live";
  const isFinished = game.status === "finished";

  return (
    <GameCardShell
      game={game}
      isLive={isLive}
      isFinished={isFinished}
      statusLabel={isLive ? soccerPeriodLabel(game) : undefined}
      onPress={onPress}
      awayFlag={countryFlag(game.away_team?.name)}
      homeFlag={countryFlag(game.home_team?.name)}
      periodTimeSuffix="'"
      goalAnimation
    />
  );
}

type SoccerLeague = "all" | "EPL" | "LaLiga" | "SerieA" | "Bundesliga" | "Ligue1" | "MLS" | "UCL" | "UEL" | "WorldCup";
const SOCCER_LEAGUE_FILTERS: { key: SoccerLeague; label: string }[] = [
  { key: "all", label: "All" },
  { key: "EPL", label: "EPL" },
  { key: "LaLiga", label: "La Liga" },
  { key: "SerieA", label: "Serie A" },
  { key: "Bundesliga", label: "Bundesliga" },
  { key: "Ligue1", label: "Ligue 1" },
  { key: "MLS", label: "MLS" },
  { key: "UCL", label: "UCL" },
  { key: "UEL", label: "UEL" },
  { key: "WorldCup", label: "World Cup" },
];

// Soccer fixtures (especially tournaments like the World Cup) can span many
// days, so games are grouped into date sections rather than one flat list —
// a bare "6:00 PM" / "11:00 PM" / "1:00 PM" list reads as out-of-order when
// those times are actually on different days.
function localDateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function soccerSectionTitle(key: string): string {
  if (key === "9999-99-99") return "Date TBD";
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (key === localDateKey(today.toISOString())) return "Today";
  if (key === localDateKey(tomorrow.toISOString())) return "Tomorrow";
  return new Date(`${key}T00:00:00`).toLocaleDateString([], {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

type SoccerDateSection = { key: string; title: string; data: SoccerGame[] };

function groupSoccerByDate(games: SoccerGame[], descending: boolean): SoccerDateSection[] {
  const map = new Map<string, SoccerGame[]>();
  for (const g of games) {
    const key = g.scheduled_at ? localDateKey(g.scheduled_at) : "9999-99-99";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(g);
  }
  const sortedKeys = Array.from(map.keys()).sort();
  if (descending) sortedKeys.reverse();
  return sortedKeys.map((key) => ({
    key,
    title: soccerSectionTitle(key),
    data: map
      .get(key)!
      .slice()
      .sort((a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? "")),
  }));
}

// ---------------------------------------------------------------------------
// Soccer games view
// ---------------------------------------------------------------------------
function SoccerGamesView() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();

  const [tab, setTab] = useState<FilterTab>("live");
  const [leagueFilter, setLeagueFilter] = useState<SoccerLeague>("all");
  const [games, setGames] = useState<SoccerGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [liveConnectionFailed, setLiveConnectionFailed] = useState(false);
  const [liveRetryToken, setLiveRetryToken] = useState(0);
  const initialAutoSwitch = useRef(true);

  // Live tab: subscribe to WebSocket channel for real-time score updates.
  useEffect(() => {
    if (tab !== "live") return;
    setLoading(true);
    setLiveConnectionFailed(false);

    // REST fallback so the spinner always clears even if the socket never
    // delivers `soccer_state` (mirrors matches.tsx's tennis pattern, where
    // `loading` is gated by a REST call, not the channel). The channel below
    // still drives real-time updates once/if it connects.
    const refetch = () =>
      soccer.getGames({ status: "live" })
        .then(({ data }) => setGames(data))
        .catch(() => {});
    refetch().finally(() => setLoading(false));

    const channel = joinSoccerGamesChannel({
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
      onError: () => {
        setLoading(false);
        setLiveConnectionFailed(true);
      },
    });

    // `soccer_delta` isn't guaranteed to fire promptly (or at all) for every
    // score change, so poll REST as a safety net — same fix as golf's
    // tournament list — to keep scores from going stale indefinitely.
    const pollId = setInterval(refetch, 30_000);

    return () => {
      channel.leave();
      clearInterval(pollId);
    };
  }, [tab, liveRetryToken]);

  // Upcoming / Final tabs: REST API.
  const load = useCallback(async (filter: FilterTab, league: SoccerLeague) => {
    const params: Parameters<typeof soccer.getGames>[0] = {};
    if (league !== "all") params.league = league;
    if (filter === "upcoming") params.status = "scheduled";
    else params.status = "finished";
    const { data } = await soccer.getGames(params);
    setGames(data);
  }, []);

  useEffect(() => {
    if (tab === "live") return; // handled by channel above
    setLoading(true);
    setQuery("");
    load(tab, leagueFilter).finally(() => setLoading(false));
  }, [tab, leagueFilter, load]);

  // Auto-switch to Upcoming if no live games on first load
  useEffect(() => {
    if (!loading && tab === "live" && games.length === 0 && initialAutoSwitch.current) {
      initialAutoSwitch.current = false;
      setTab("upcoming");
    }
  }, [loading, games.length, tab]);

  function onRefresh() {
    if (tab === "live") {
      if (liveConnectionFailed) setLiveRetryToken((n) => n + 1);
      return;
    }
    setRefreshing(true);
    load(tab, leagueFilter).finally(() => setRefreshing(false));
  }

  const hasLive = tab === "live" && games.length > 0;

  const filteredGames = useMemo(() => {
    let result = games;
    if (tab === "live" && leagueFilter !== "all") {
      result = result.filter((g) => g.league === leagueFilter);
    }
    const q = query.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (g) =>
          g.home_team?.name?.toLowerCase().includes(q) ||
          g.home_team?.full_name?.toLowerCase().includes(q) ||
          g.home_team?.abbreviation?.toLowerCase().includes(q) ||
          g.away_team?.name?.toLowerCase().includes(q) ||
          g.away_team?.full_name?.toLowerCase().includes(q) ||
          g.away_team?.abbreviation?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [games, tab, leagueFilter, query]);

  const liveGames = useMemo(
    () =>
      tab === "live"
        ? filteredGames.slice().sort((a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""))
        : [],
    [filteredGames, tab]
  );

  const dateSections = useMemo(
    () => (tab === "live" ? [] : groupSoccerByDate(filteredGames, tab === "final")),
    [filteredGames, tab]
  );

  const emptyTitle = query.trim() ? "No results" : tab === "live" ? "Nothing live" : "No games found";
  const emptyMessage = query.trim()
    ? `No games matching "${query}".`
    : tab === "live"
    ? "No games are live right now."
    : tab === "upcoming"
    ? "Check back when the schedule is released."
    : "No finished games found.";

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      <View style={styles.tabBar}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tabItem, tab === t.key && styles.tabItemActive]}
            onPress={() => setTab(t.key)}
            activeOpacity={0.7}
          >
            {t.key === "live" && tab !== "live" && hasLive && <View style={styles.nflLiveDotTab} />}
            <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.soccerLeagueBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.soccerLeagueBarContent}
        >
          {SOCCER_LEAGUE_FILTERS.map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[styles.nflLeagueChip, leagueFilter === f.key && styles.nflLeagueChipActive]}
              onPress={() => setLeagueFilter(f.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.nflLeagueChipText, leagueFilter === f.key && styles.nflLeagueChipTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

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
      ) : tab === "live" ? (
        // Only show the hard error if we truly have nothing to display —
        // a REST-loaded game list should win over a separately-failed socket.
        liveConnectionFailed && liveGames.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>Can't connect</Text>
            <Text style={styles.emptyText}>Couldn't reach live scores. Check your connection and try again.</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => setLiveRetryToken((n) => n + 1)}
              activeOpacity={0.7}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : liveGames.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>{emptyTitle}</Text>
            <Text style={styles.emptyText}>{emptyMessage}</Text>
          </View>
        ) : (
          <FlatList
            data={liveGames}
            keyExtractor={(g) => g.id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
            }
            renderItem={({ item }) => (
              <SoccerGameCard game={item} onPress={() => router.push(`/game/${item.id}`)} />
            )}
          />
        )
      ) : dateSections.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>{emptyTitle}</Text>
          <Text style={styles.emptyText}>{emptyMessage}</Text>
        </View>
      ) : (
        <SectionList
          sections={dateSections}
          keyExtractor={(g) => g.id}
          contentContainerStyle={styles.nflListContent}
          stickySectionHeadersEnabled
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          renderSectionHeader={({ section: s }) => (
            <View style={styles.nflWeekHeader}>
              <Text style={styles.nflWeekTitle}>{(s as SoccerDateSection).title}</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <SoccerGameCard game={item} onPress={() => router.push(`/game/${item.id}`)} />
          )}
        />
      )}
    </SafeAreaView>
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
  if (activeSport === "soccer") return <SoccerGamesView />;
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
    retryButton: {
      marginTop: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: radius.full,
      backgroundColor: colors.primary,
    },
    retryButtonText: { ...typography.label, color: colors.textOnPrimary ?? "#fff", fontWeight: "700" },

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

    // ── Goal banner (absolute, centered top) ──
    goalBanner: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      alignItems: "center",
      paddingVertical: 6,
      backgroundColor: "#16a34a",
      zIndex: 2,
    },
    goalBannerText: {
      fontSize: 12,
      fontWeight: "800",
      color: "#fff",
      letterSpacing: 0.3,
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
    teamFlag: {
      fontSize: 22,
      width: 36,
    },
    teamLogo: {
      width: 28,
      height: 28,
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
    teamScorePen: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.textSecondary,
    },
    teamScoreMuted: {
      color: colors.textSecondary,
      fontWeight: "600",
    },
    teamScorePlaceholder: {
      width: 42,
    },
    followHeart: {
      marginLeft: spacing.xs,
      padding: 2,
    },

    // ── NFL games ──
    nflLeagueBar: {
      flexDirection: "row",
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.divider,
    },
    // ── Soccer league bar — a plain View pins the height; giving a fixed
    // height directly to a horizontal ScrollView's own style isn't reliably
    // respected, so the ScrollView just fills this fixed-height wrapper ──
    soccerLeagueBar: {
      height: 52,
      flexGrow: 0,
      flexShrink: 0,
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.divider,
    },
    soccerLeagueBarContent: {
      alignItems: "center",
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
    },
    nflLeagueChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2,
      borderRadius: radius.full,
      backgroundColor: colors.card,
    },
    nflLeagueChipActive: {
      backgroundColor: colors.primary,
    },
    nflLeagueChipText: {
      ...typography.label,
      color: colors.textSecondary,
      fontWeight: "500",
    },
    nflLeagueChipTextActive: {
      color: colors.textOnPrimary,
      fontWeight: "700",
    },
    nflListContent: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xl },
    nflLiveDotTab: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#ef4444" },
    nflWeekHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      marginHorizontal: -spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    nflWeekLeft: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: spacing.sm,
    },
    nflWeekTitle: {
      ...typography.label,
      color: colors.text,
      fontWeight: "800",
      letterSpacing: 0.6,
    },
    nflWeekRange: {
      ...typography.caption,
      color: colors.textSecondary,
    },
    nflWeekLeagueTag: {
      ...typography.caption,
      color: colors.textSecondary,
      fontWeight: "600",
      letterSpacing: 0.4,
    },
    nflCard: {
      backgroundColor: colors.card,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      borderRadius: radius.lg,
      shadowColor: "#000",
      shadowOpacity: 0.05,
      shadowOffset: { width: 0, height: 1 },
      shadowRadius: 4,
      elevation: 2,
    },
    nflStatusRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    nflTimeBlock: {
      alignItems: "flex-end",
    },
    nflLiveDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: "#ef4444",
    },
    nflLiveLabel: {
      ...typography.caption,
      color: "#ef4444",
      fontWeight: "700",
      letterSpacing: 0.3,
    },
    nflFinalLabel: {
      ...typography.caption,
      color: colors.textSecondary,
      fontWeight: "700",
      letterSpacing: 0.5,
    },
    nflKickoff: {
      ...typography.caption,
      color: colors.textSecondary,
      fontWeight: "600",
    },
    nflMatchup: {
      gap: spacing.xs,
    },
    nflTeamRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    nflAbbrev: {
      fontSize: 13,
      fontWeight: "800",
      color: colors.text,
      width: 36,
      letterSpacing: 0.3,
    },
    nflLogo: {
      width: 28,
      height: 28,
    },
    nflTeamInfo: {
      flex: 1,
      gap: 1,
    },
    nflTeamName: {
      ...typography.body,
      color: colors.text,
      fontWeight: "500",
    },
    nflRecord: {
      fontSize: 11,
      color: colors.textSecondary,
      fontWeight: "400",
    },
    nflScore: {
      fontSize: 20,
      fontWeight: "800",
      color: colors.text,
      minWidth: 32,
      textAlign: "right",
    },
    nflScoreWinner: { color: colors.primary },
    nflScoreMuted: { color: colors.textSecondary, fontWeight: "600" },
    nflMuted: { color: colors.textSecondary },
    nflTimeValue: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.text,
      textAlign: "right",
    },
    nflTimeDay: {
      fontSize: 11,
      fontWeight: "500",
      color: colors.textSecondary,
      textAlign: "right",
      letterSpacing: 0.3,
    },
    nflNameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
    },
    nflHomeAwayLabel: {
      fontSize: 11,
      color: colors.textSecondary,
      fontWeight: "400",
    },
    nflSeparator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginLeft: spacing.md,
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
