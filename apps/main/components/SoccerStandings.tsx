import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  SectionList,
  FlatList,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { soccer, type SoccerTeam, type SoccerPlayer, type SoccerGame } from "@juno/api";
import {
  PlayerCard,
  SkeletonCard,
  LiveBadge,
  countryFlag,
  useTheme,
  spacing,
  typography,
  radius,
  type Palette,
} from "@juno/ui";
import { useFollowedPlayers } from "../context/FollowedPlayersContext";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ViewMode = "teams" | "players";
type StandingsSection = { kind: "standings"; title: string; data: SoccerTeam[] };
type RoundSection = { kind: "round"; title: string; data: SoccerGame[] };
type Section = StandingsSection | RoundSection;

const LEAGUE_LABELS: Record<string, string> = {
  EPL: "EPL",
  LaLiga: "La Liga",
  SerieA: "Serie A",
  Bundesliga: "Bundesliga",
  Ligue1: "Ligue 1",
  MLS: "MLS",
  UCL: "Champions League",
  UEL: "Europa League",
  WorldCup: "World Cup",
};

const PER_PAGE = 50;

// ---------------------------------------------------------------------------
// Teams view helpers
// ---------------------------------------------------------------------------

function groupByLeague(teams: SoccerTeam[]): StandingsSection[] {
  // Tournament leagues (e.g. World Cup) split teams into groups via `conference`
  // ("Group A", "Group B", ...) and rank standings within each group separately,
  // so groups must stay separate sections rather than one flat league-wide list.
  const map = new Map<string, { league: string; conference: string | null; data: SoccerTeam[] }>();
  for (const t of teams) {
    const league = t.league ?? "Other";
    const conference = t.conference ?? null;
    const key = conference ? `${league}::${conference}` : league;
    if (!map.has(key)) map.set(key, { league, conference, data: [] });
    map.get(key)!.data.push(t);
  }
  const leagueOrder = Object.keys(LEAGUE_LABELS);
  const groups = [...map.values()].sort((a, b) => {
    const order = leagueOrder.indexOf(a.league) - leagueOrder.indexOf(b.league);
    if (order !== 0) return order;
    return (a.conference ?? "").localeCompare(b.conference ?? "");
  });

  return groups.map(({ league, conference, data }) => {
    const leagueLabel = LEAGUE_LABELS[league] ?? league;
    return {
      kind: "standings" as const,
      title: conference ? `${leagueLabel} · ${conference}` : leagueLabel,
      data: data.sort((a, b) => {
        if (a.standing_rank != null && b.standing_rank != null) {
          return a.standing_rank - b.standing_rank;
        }
        if ((b.points ?? 0) !== (a.points ?? 0)) return (b.points ?? 0) - (a.points ?? 0);
        return (b.goal_difference ?? 0) - (a.goal_difference ?? 0);
      }),
    };
  });
}

// ---------------------------------------------------------------------------
// Knockout rounds view helpers
// ---------------------------------------------------------------------------

// Once a competition is down to a knockout bracket, its group table is frozen
// (knockout games never feed the standings computer) and stops reflecting
// who's actually still alive. Swap that league's section(s) for a
// rounds-grouped fixture list instead — grouped by whatever `round` the
// provider sent, ordered by when the round actually kicked off, not by
// guessing at round-name text ("Quarterfinal" vs "Quarter-final" etc. vary
// by competition).
function groupKnockoutByRound(games: SoccerGame[]): RoundSection[] {
  const map = new Map<string, { league: string; round: string; data: SoccerGame[] }>();
  for (const g of games) {
    const league = g.league ?? "Other";
    const round = g.round ?? "Knockout stage";
    const key = `${league}::${round}`;
    if (!map.has(key)) map.set(key, { league, round, data: [] });
    map.get(key)!.data.push(g);
  }

  const earliestStart = (data: SoccerGame[]) =>
    Math.min(...data.map((g) => (g.scheduled_at ? new Date(g.scheduled_at).getTime() : Infinity)));

  const leagueOrder = Object.keys(LEAGUE_LABELS);
  const groups = [...map.values()].sort((a, b) => {
    const order = leagueOrder.indexOf(a.league) - leagueOrder.indexOf(b.league);
    if (order !== 0) return order;
    return earliestStart(a.data) - earliestStart(b.data);
  });

  return groups.map(({ league, round, data }) => {
    const leagueLabel = LEAGUE_LABELS[league] ?? league;
    return {
      kind: "round" as const,
      title: `${leagueLabel} · ${formatRoundLabel(round)}`,
      data: data.sort((a, b) => {
        const aTime = a.scheduled_at ? new Date(a.scheduled_at).getTime() : Infinity;
        const bTime = b.scheduled_at ? new Date(b.scheduled_at).getTime() : Infinity;
        return aTime - bTime;
      }),
    };
  });
}

// Enet's `Round` property mixes two formats: a fraction string for earlier
// knockout rounds ("1/16" = 16 matches = round of 32, "1/8" = 8 matches =
// round of 16 — the denominator is match count, not team count or "1/Nth of
// the final") and plain English for the later ones ("Quarter Finals").
// Confirmed against real World Cup data before writing this — "1/16" reads
// like "round of 16" at a glance but is actually round of 32.
function formatRoundLabel(round: string): string {
  const fraction = round.match(/^1\/(\d+)$/);
  if (fraction) {
    const teams = parseInt(fraction[1], 10) * 2;
    if (teams === 4) return "Semifinals";
    if (teams === 8) return "Quarterfinals";
    return `Round of ${teams}`;
  }

  const normalized = round.trim().toLowerCase().replace(/[\s-]+/g, " ");
  if (normalized === "quarter finals" || normalized === "quarterfinals") return "Quarterfinals";
  if (normalized === "semi finals" || normalized === "semifinals") return "Semifinals";
  if (normalized === "final") return "Final";
  return round;
}

function formatKickoff(scheduledAt: string | null): string {
  if (!scheduledAt) return "TBD";
  const d = new Date(scheduledAt);
  const date = d.toLocaleDateString([], { month: "short", day: "numeric" });
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `${date}, ${time}`;
}

function TeamRow({ team, rank }: { team: SoccerTeam; rank: number }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.teamRow}>
      <Text style={styles.rank}>{rank}</Text>
      <View style={styles.nameCol}>
        <View style={styles.nameRow}>
          {team.logo ? (
            <Image source={{ uri: team.logo }} style={styles.teamLogo} cachePolicy="memory-disk" contentFit="contain" />
          ) : (
            (() => {
              const flag = countryFlag(team.name);
              return flag ? <Text style={styles.teamFlag}>{flag}</Text> : null;
            })()
          )}
          <Text style={styles.teamName} numberOfLines={1}>
            {team.name}
          </Text>
        </View>
        {team.abbreviation && <Text style={styles.teamAbbrev}>{team.abbreviation}</Text>}
      </View>
      <Text style={styles.wdl}>{team.wins}-{team.draws}-{team.losses}</Text>
      <Text style={styles.split}>{team.goal_difference != null ? (team.goal_difference > 0 ? `+${team.goal_difference}` : team.goal_difference) : "-"}</Text>
      <Text style={styles.pts}>{team.points ?? "-"}</Text>
    </View>
  );
}

function TableHeader() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={[styles.teamRow, styles.headerRow]}>
      <Text style={[styles.rank, styles.headerText]}>#</Text>
      <View style={styles.nameCol}>
        <Text style={styles.headerText}>Team</Text>
      </View>
      <Text style={[styles.wdl, styles.headerText]}>W-D-L</Text>
      <Text style={[styles.split, styles.headerText]}>GD</Text>
      <Text style={[styles.pts, styles.headerText]}>PTS</Text>
    </View>
  );
}

function TeamSideRow({
  name,
  logo,
  score,
  penScore,
  won,
  faded,
  styles,
}: {
  name: string;
  logo: string | null | undefined;
  score: number | null;
  penScore: number | null;
  won: boolean;
  faded: boolean;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.matchTeamRow}>
      <View style={styles.nameRow}>
        {logo ? (
          <Image source={{ uri: logo }} style={styles.teamLogo} cachePolicy="memory-disk" contentFit="contain" />
        ) : (
          (() => {
            const flag = countryFlag(name);
            return flag ? <Text style={styles.teamFlag}>{flag}</Text> : null;
          })()
        )}
        <Text style={[styles.matchTeamName, faded && styles.matchTeamNameFaded]} numberOfLines={1}>
          {name}
        </Text>
        {won && <Text style={styles.winnerMark}>✓</Text>}
      </View>
      {score != null && (
        <Text style={styles.matchScore}>
          {score}
          {penScore != null && <Text style={styles.matchScorePen}> ({penScore})</Text>}
        </Text>
      )}
    </View>
  );
}

function MatchRow({ game }: { game: SoccerGame }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const isLive = game.status === "live";
  const isFinished = game.status === "finished";

  // Final score includes extra-time goals when played (mirrors games.tsx —
  // a match decided 1-0 in extra time after a 2-2 draw is 3-2, not a tie).
  const finalHomeScore =
    isFinished && game.home_score != null ? game.home_score + (game.home_score_et ?? 0) : game.home_score;
  const finalAwayScore =
    isFinished && game.away_score != null ? game.away_score + (game.away_score_et ?? 0) : game.away_score;

  // A penalty shootout is only played after regulation/ET ends level, so the
  // final score is tied by definition — read the real winner off the penalty
  // score instead.
  const decidedByPens =
    isFinished && game.penalty_shootout === true && game.home_score_pen != null && game.away_score_pen != null;
  const homePenScore = decidedByPens ? game.home_score_pen : null;
  const awayPenScore = decidedByPens ? game.away_score_pen : null;

  const homeWon = decidedByPens
    ? homePenScore! > awayPenScore!
    : isFinished && (finalHomeScore ?? 0) > (finalAwayScore ?? 0);
  const awayWon = decidedByPens
    ? awayPenScore! > homePenScore!
    : isFinished && (finalAwayScore ?? 0) > (finalHomeScore ?? 0);

  const showScore = isFinished || isLive;

  return (
    <View style={styles.matchCard}>
      {isLive && (
        <View style={styles.matchStatusRow}>
          <LiveBadge />
        </View>
      )}
      <TeamSideRow
        name={game.home_team?.name ?? "TBD"}
        logo={game.home_team?.logo}
        score={showScore ? finalHomeScore : null}
        penScore={homePenScore ?? null}
        won={homeWon}
        faded={isFinished && !homeWon}
        styles={styles}
      />
      <TeamSideRow
        name={game.away_team?.name ?? "TBD"}
        logo={game.away_team?.logo}
        score={showScore ? finalAwayScore : null}
        penScore={awayPenScore ?? null}
        won={awayWon}
        faded={isFinished && !awayWon}
        styles={styles}
      />
      {!isLive && !isFinished && <Text style={styles.matchKickoff}>{formatKickoff(game.scheduled_at)}</Text>}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Teams view
// ---------------------------------------------------------------------------

function TeamsView({ colors }: { colors: Palette }) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [{ data: teams }, { data: knockoutGames }] = await Promise.all([
      soccer.getTeams({ per_page: 100 }),
      soccer.getGames({ season_type: "knockout" }),
    ]);

    // Leagues currently in a knockout bracket get a rounds view instead of a
    // group table — their group standings are frozen and no longer useful
    // (see groupKnockoutByRound).
    const knockoutLeagues = new Set(knockoutGames.map((g) => g.league).filter((l): l is string => !!l));
    const standingsSections = groupByLeague(teams.filter((t) => !t.league || !knockoutLeagues.has(t.league)));
    const roundSections = groupKnockoutByRound(knockoutGames);

    setSections([...roundSections, ...standingsSections]);
  }, []);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  function onRefresh() {
    setRefreshing(true);
    load().finally(() => setRefreshing(false));
  }

  return (
    <View style={{ flex: 1 }}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : sections.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>No standings yet</Text>
          <Text style={styles.emptyText}>Standings will appear once the season is underway.</Text>
        </View>
      ) : (
        <SectionList<SoccerTeam | SoccerGame, Section>
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          stickySectionHeadersEnabled
          renderSectionHeader={({ section }) => (
            <View>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
              </View>
              {section.kind === "standings" && <TableHeader />}
            </View>
          )}
          renderItem={({ item, index, section }) =>
            section.kind === "round" ? (
              <MatchRow game={item as SoccerGame} />
            ) : (
              <TeamRow team={item as SoccerTeam} rank={index + 1} />
            )
          }
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Players view
// ---------------------------------------------------------------------------

function formatMarketValue(value: number | null | undefined): string | undefined {
  if (value == null) return undefined;
  if (value >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `€${(value / 1_000).toFixed(0)}K`;
  return `€${value}`;
}

function PlayersView({ colors }: { colors: Palette }) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { isFollowed, follow, unfollow } = useFollowedPlayers();

  const [players, setPlayers] = useState<SoccerPlayer[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const load = useCallback((page = 1, q?: string) => {
    return soccer
      .getPlayers({ sort: "market_value", page, per_page: PER_PAGE, q: q || undefined })
      .then(({ data }) => {
        if (page === 1) setPlayers(data);
        else setPlayers((prev) => [...prev, ...data]);
        setHasMore(data.length === PER_PAGE);
      });
  }, []);

  useEffect(() => {
    setLoading(true);
    load(1).finally(() => setLoading(false));
  }, [load]);

  // Debounced search
  useEffect(() => {
    const q = query.trim();
    const timer = setTimeout(() => {
      setLoading(true);
      load(1, q || undefined).finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  function onRefresh() {
    setRefreshing(true);
    load(1, query.trim() || undefined).finally(() => setRefreshing(false));
  }

  function loadMore() {
    if (loadingMore || !hasMore || loading) return;
    setLoadingMore(true);
    const nextPage = Math.floor(players.length / PER_PAGE) + 1;
    load(nextPage, query.trim() || undefined).finally(() => setLoadingMore(false));
  }

  async function toggleFollow(playerId: string) {
    if (isFollowed(playerId)) await unfollow(playerId);
    else await follow(playerId);
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.searchBar}>
        <TextInput
          style={styles.input}
          placeholder="Search players…"
          value={query}
          onChangeText={setQuery}
          placeholderTextColor={colors.textSecondary}
          returnKeyType="search"
          autoCorrect={false}
        />
      </View>

      {loading ? (
        <View style={styles.playerList}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : (
        <FlatList
          data={players}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.playerList}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator color={colors.primary} style={styles.footerSpinner} /> : null
          }
          renderItem={({ item }) => (
            <PlayerCard
              firstName={item.first_name}
              lastName={item.last_name}
              country={item.country}
              photo={item.photo}
              photoFit="contain"
              rank={item.rank ?? null}
              rankLabel="#"
              subtitle={formatMarketValue(item.market_value)}
              following={isFollowed(item.id)}
              onToggleFollow={() => toggleFollow(item.id)}
              onPress={() => router.push(`/(app)/player/${item.id}`)}
            />
          )}
          ListEmptyComponent={<Text style={styles.empty}>No player rankings available.</Text>}
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Root export
// ---------------------------------------------------------------------------

export default function SoccerStandings() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [view, setView] = useState<ViewMode>("players");

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      {/* Players / Rankings toggle */}
      <View style={styles.tabBar}>
        {(["players", "teams"] as ViewMode[]).map((v) => (
          <TouchableOpacity
            key={v}
            style={[styles.tabItem, view === v && styles.tabItemActive]}
            onPress={() => setView(v)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabLabel, view === v && styles.tabLabelActive]}>
              {v === "players" ? "Players" : "Standings"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {view === "teams" ? (
        <TeamsView colors={colors} />
      ) : (
        <PlayersView colors={colors} />
      )}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

function createStyles(colors: Palette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },

    // Toggle tab bar
    tabBar: {
      flexDirection: "row",
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.divider,
    },
    tabItem: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: spacing.sm + 2,
    },
    tabItemActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
    tabLabel: { ...typography.label, color: colors.textSecondary },
    tabLabelActive: { color: colors.primary, fontWeight: "700" },

    // Teams view
    listContent: { paddingBottom: spacing.lg },
    emptyTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.xs },
    emptyText: { ...typography.body, color: colors.textSecondary, textAlign: "center" },
    sectionHeader: {
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    sectionTitle: {
      ...typography.label,
      color: colors.textSecondary,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    headerRow: {
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.divider,
    },
    headerText: {
      ...typography.caption,
      color: colors.textSecondary,
      fontWeight: "700",
      textTransform: "uppercase",
    },
    teamRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
    },
    rank: { ...typography.caption, color: colors.textSecondary, width: 22, textAlign: "center" },
    nameCol: { flex: 1, paddingHorizontal: spacing.xs },
    nameRow: { flexDirection: "row", alignItems: "center" },
    teamLogo: { width: 20, height: 20, marginRight: spacing.xs },
    teamFlag: { fontSize: 18, marginRight: spacing.xs },
    teamName: { ...typography.label, color: colors.text, fontWeight: "600", flexShrink: 1 },
    teamAbbrev: { ...typography.caption, color: colors.textSecondary },
    wdl: { ...typography.label, color: colors.text, width: 60, textAlign: "center" },
    pts: { ...typography.label, color: colors.primary, width: 36, textAlign: "center", fontWeight: "700" },
    split: { ...typography.caption, color: colors.textSecondary, width: 44, textAlign: "center" },

    // Knockout rounds view
    matchCard: {
      backgroundColor: colors.background,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    matchStatusRow: { marginBottom: spacing.xs },
    matchTeamRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 3,
    },
    matchTeamName: { ...typography.label, color: colors.text, fontWeight: "600", flexShrink: 1 },
    matchTeamNameFaded: { color: colors.textSecondary, fontWeight: "400" },
    winnerMark: { ...typography.caption, color: colors.primary, marginLeft: spacing.xs, fontWeight: "700" },
    matchScore: { ...typography.label, color: colors.text, fontWeight: "700" },
    matchScorePen: { ...typography.caption, color: colors.textSecondary, fontWeight: "400" },
    matchKickoff: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },

    // Players view
    searchBar: { padding: spacing.md, paddingBottom: spacing.sm },
    input: {
      backgroundColor: colors.card,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      fontSize: 15,
      color: colors.text,
    },
    playerList: { padding: spacing.md, paddingTop: 0 },
    footerSpinner: { marginVertical: spacing.md },
    empty: { ...typography.body, color: colors.textSecondary, textAlign: "center", marginTop: spacing.lg },
  });
}
