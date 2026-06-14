import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  ScrollView,
  View,
  Text,
  Image,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  golf,
  tennis,
  basketball,
  hockey,
  football,
  joinBasketballGamesChannel,
  joinHockeyGamesChannel,
  GolfScheduleEntry,
  GolfTournament,
  TennisScheduleEntry,
  TennisMatch,
  BasketballGame,
  BasketballScheduleEntry,
  HockeyGame,
  FootballGame,
  useSport,
} from "@juno/api";
import { Channel } from "phoenix";
import { SkeletonCard, useTheme, spacing, typography, radius, type Palette } from "@juno/ui";

const GOLF_TEAM_ID = process.env.EXPO_PUBLIC_GOLF_TEAM_ID ?? "00000000-0000-0000-0000-000000000001";

// ---------------------------------------------------------------------------
// Shared horizontal schedule list
// ---------------------------------------------------------------------------
function HorizontalScheduleList({
  title,
  data,
  sport,
  placeholder,
  getSubtitle,
  onPress,
}: {
  title: string;
  data: (GolfScheduleEntry | TennisScheduleEntry | BasketballScheduleEntry)[];
  sport: "golf" | "tennis" | "basketball";
  placeholder: string;
  getSubtitle?: (item: GolfScheduleEntry | TennisScheduleEntry | BasketballScheduleEntry) => string | null;
  onPress?: (item: GolfScheduleEntry | TennisScheduleEntry | BasketballScheduleEntry) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();

  if (data.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { paddingHorizontal: spacing.md }]}>{title}</Text>
      <FlatList
        horizontal
        data={data}
        keyExtractor={(e) => e.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.upcomingList}
        renderItem={({ item }) => {
          const subtitle = getSubtitle?.(item) ?? null;
          return (
            <TouchableOpacity
              style={styles.upcomingCard}
              onPress={() =>
                onPress
                  ? onPress(item)
                  : router.push(`/tournament/${item.id}?sport=${sport}`)
              }
              activeOpacity={0.8}
            >
              {item.image_url ? (
                <Image source={{ uri: item.image_url }} style={styles.upcomingImage} />
              ) : (
                <View style={[styles.upcomingImage, styles.upcomingImagePlaceholder]}>
                  <Text style={styles.upcomingImagePlaceholderText}>{placeholder}</Text>
                </View>
              )}
              <View style={styles.upcomingInfo}>
                <Text style={styles.upcomingName} numberOfLines={2}>{item.name}</Text>
                <Text style={styles.upcomingDates}>
                  {item.start_date?.slice(5, 10).replace("-", "/")}
                  {item.end_date ? ` – ${item.end_date.slice(5, 10).replace("-", "/")}` : ""}
                </Text>
                {subtitle ? (
                  <Text style={styles.upcomingWinner} numberOfLines={1}>{subtitle}</Text>
                ) : null}
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Golf home
// ---------------------------------------------------------------------------
function GolfHome() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [entries, setEntries] = useState<GolfScheduleEntry[]>([]);
  const [liveTournaments, setLiveTournaments] = useState<GolfTournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const load = useCallback(() => {
    return Promise.all([
      golf.getScheduleEntries(),
      golf.getTournaments(GOLF_TEAM_ID),
    ]).then(([{ data: scheduleData }, { data: tournaments }]) => {
      setEntries(scheduleData);
      setLiveTournaments(tournaments.filter((t) => t.events?.some((e) => e.live)));
    });
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  function onRefresh() {
    setRefreshing(true);
    load().finally(() => setRefreshing(false));
  }

  // Schedule entries that currently have a live tournament — exclude from upcoming/past
  const liveStageIds = new Set(liveTournaments.map((t) => t.enet_tournament_stage_id).filter(Boolean));
  const isLiveEntry = (e: GolfScheduleEntry) => e.enet_stage_id != null && liveStageIds.has(e.enet_stage_id);

  // Split entries: upcoming (today or future) vs past (ended before today), excluding live
  const upcomingEntries = entries.filter(
    (e) => !isLiveEntry(e) && (!e.end_date || e.end_date.slice(0, 10) >= today)
  );
  const pastEntries = entries
    .filter((e) => !isLiveEntry(e) && e.end_date && e.end_date.slice(0, 10) < today)
    .sort((a, b) => b.end_date!.localeCompare(a.end_date!));

  if (loading) {
    return (
      <ScrollView contentContainerStyle={styles.list}>
        <SkeletonCard />
        <SkeletonCard />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.golfScroll}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      {/* ── Live section ─────────────────────────────────────────────── */}
      {liveTournaments.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.liveDot} />
            <Text style={styles.sectionTitle}>Live Now</Text>
          </View>
          {liveTournaments.map((t) => {
            // Prefer matching by enet_stage_id so duplicate-named entries (e.g. prior years)
            // don't shadow the current year's entry.
            const entryId = (
              entries.find((e) => e.enet_stage_id != null && e.enet_stage_id === t.enet_tournament_stage_id) ??
              entries.find((e) => e.name === t.name)
            )?.id;
            return (
            <TouchableOpacity
              key={t.id}
              style={styles.liveEventCard}
              activeOpacity={0.8}
              onPress={() =>
                entryId
                  ? router.push(`/tournament/${entryId}?sport=golf`)
                  : router.push("/(app)/tournaments")
              }
            >
              <View style={styles.liveEventTop}>
                <Text style={styles.liveEventName} numberOfLines={1}>{t.name}</Text>
                <View style={styles.liveBadge}>
                  <Text style={styles.liveBadgeText}>LIVE</Text>
                </View>
              </View>
              {t.events?.[0] && (
                <Text style={styles.liveEventSub}>
                  {t.events[0].name ?? "In progress"} · {t.events[0].scores?.length ?? 0} players
                </Text>
              )}
              <Text style={styles.liveEventCta}>View leaderboard →</Text>
            </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* ── Upcoming section ─────────────────────────────────────────── */}
      <HorizontalScheduleList
        title="Upcoming"
        data={upcomingEntries}
        sport="golf"
        placeholder="⛳"
        getSubtitle={(item) => {
          const e = item as GolfScheduleEntry;
          return e.winners_name ? `🏆 ${e.winners_name}` : null;
        }}
      />

      {/* ── Past section ─────────────────────────────────────────────── */}
      <HorizontalScheduleList
        title="Past"
        data={pastEntries}
        sport="golf"
        placeholder="⛳"
        getSubtitle={(item) => {
          const e = item as GolfScheduleEntry;
          return e.winners_name ? `🏆 ${e.winners_name}` : null;
        }}
      />

      {liveTournaments.length === 0 && upcomingEntries.length === 0 && pastEntries.length === 0 && (
        <View style={styles.center}>
          <Text style={styles.empty}>No tournaments available</Text>
        </View>
      )}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Tennis home
// ---------------------------------------------------------------------------
function TennisHome() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [entries, setEntries] = useState<TennisScheduleEntry[]>([]);
  const [liveMatches, setLiveMatches] = useState<TennisMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const load = useCallback(() => {
    return Promise.all([tennis.getScheduleEntries(), tennis.getTicker()]).then(
      ([{ data: scheduleData }, { data: ticker }]) => {
        setEntries(scheduleData);
        setLiveMatches(ticker.filter((m) => ["on_court", "warmup", "playing"].includes(m.status)));
      }
    );
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  function onRefresh() {
    setRefreshing(true);
    load().finally(() => setRefreshing(false));
  }

  // Group live matches by tournament name for the live section.
  // Also carry the matching schedule entry id so we can navigate to the detail screen.
  const liveTournaments = liveMatches.reduce<{ name: string; count: number; entryId?: string }[]>((acc, m) => {
    const name = (m as any).tournament_name ?? "Live Match";
    const existing = acc.find((t) => t.name === name);
    if (existing) {
      existing.count++;
    } else {
      const entryId = entries.find((e) => e.name === name)?.id;
      acc.push({ name, count: 1, entryId });
    }
    return acc;
  }, []);

  // Exclude entries whose tournament is currently live
  const liveTournamentNames = new Set(liveTournaments.map((t) => t.name));
  const upcomingEntries = entries.filter(
    (e) => !liveTournamentNames.has(e.name) && (!e.end_date || e.end_date.slice(0, 10) >= today)
  );
  const pastEntries = entries
    .filter((e) => !liveTournamentNames.has(e.name) && e.end_date && e.end_date.slice(0, 10) < today)
    .sort((a, b) => b.end_date!.localeCompare(a.end_date!));

  if (loading) {
    return (
      <ScrollView contentContainerStyle={styles.list}>
        <SkeletonCard />
        <SkeletonCard />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.golfScroll}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      {/* ── Live section ─────────────────────────────────────────────── */}
      {liveMatches.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.liveDot} />
            <Text style={styles.sectionTitle}>Live Now</Text>
          </View>
          {liveTournaments.map((t) => (
            <TouchableOpacity
              key={t.name}
              style={styles.liveEventCard}
              activeOpacity={0.8}
              onPress={() =>
                t.entryId
                  ? router.push(`/tournament/${t.entryId}?sport=tennis`)
                  : router.push("/(app)/matches")
              }
            >
              <View style={styles.liveEventTop}>
                <Text style={styles.liveEventName} numberOfLines={1}>{t.name}</Text>
                <View style={styles.liveBadge}>
                  <Text style={styles.liveBadgeText}>LIVE</Text>
                </View>
              </View>
              <Text style={styles.liveEventSub}>
                {t.count} {t.count === 1 ? "match" : "matches"} in progress
              </Text>
              <Text style={styles.liveEventCta}>View tournament →</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* ── Upcoming section ─────────────────────────────────────────── */}
      <HorizontalScheduleList
        title="Upcoming"
        data={upcomingEntries}
        sport="tennis"
        placeholder="🎾"
        getSubtitle={(item) => {
          const e = item as TennisScheduleEntry;
          return e.gender === "male" ? "ATP" : e.gender === "female" ? "WTA" : null;
        }}
      />

      {/* ── Past section ─────────────────────────────────────────────── */}
      <HorizontalScheduleList
        title="Past"
        data={pastEntries}
        sport="tennis"
        placeholder="🎾"
        getSubtitle={(item) => {
          const e = item as TennisScheduleEntry;
          return e.gender === "male" ? "ATP" : e.gender === "female" ? "WTA" : null;
        }}
      />

      {liveMatches.length === 0 && upcomingEntries.length === 0 && pastEntries.length === 0 && (
        <View style={styles.center}>
          <Text style={styles.empty}>No tournaments available</Text>
        </View>
      )}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Basketball horizontal game list — used when no schedule entries exist
// ---------------------------------------------------------------------------
function BbHorizontalGameList({ title, games: gameList }: { title: string; games: BasketballGame[] }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();

  if (gameList.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { paddingHorizontal: spacing.md }]}>{title}</Text>
      <FlatList
        horizontal
        data={gameList}
        keyExtractor={(g) => g.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.upcomingList}
        renderItem={({ item: g }) => {
          const isFinished = g.status === "finished";
          const awayWins = isFinished && (g.away_score ?? 0) > (g.home_score ?? 0);
          const homeWins = isFinished && (g.home_score ?? 0) > (g.away_score ?? 0);
          return (
            <TouchableOpacity
              style={styles.bbHorizontalCard}
              onPress={() => router.push(`/game/${g.id}`)}
              activeOpacity={0.8}
            >
              <View style={styles.bbHorizontalPlaceholder}>
                <Text style={styles.upcomingImagePlaceholderText}>🏀</Text>
              </View>
              <View style={styles.upcomingInfo}>
                <Text style={[styles.bbHorizontalTeam, awayWins && styles.bbTeamWinner]} numberOfLines={1}>
                  {g.away_team?.abbreviation ?? g.away_team?.name ?? "TBD"}
                </Text>
                <Text style={[styles.bbHorizontalTeam, homeWins && styles.bbTeamWinner]} numberOfLines={1}>
                  {g.home_team?.abbreviation ?? g.home_team?.name ?? "TBD"}
                </Text>
                {isFinished ? (
                  <Text style={styles.bbHorizontalMeta}>
                    {g.away_score} – {g.home_score}
                  </Text>
                ) : (
                  <Text style={styles.bbHorizontalMeta}>
                    {g.scheduled_at
                      ? new Date(g.scheduled_at).toLocaleDateString([], { month: "short", day: "numeric" })
                      : "TBD"}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Basketball home — single game card (navigates to game detail)
// ---------------------------------------------------------------------------
function BbHomeGameCard({ game }: { game: BasketballGame }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();

  const isLive = game.status === "live";
  const isFinished = game.status === "finished";
  const away = game.away_team;
  const home = game.home_team;
  const awayWins = isFinished && (game.away_score ?? 0) > (game.home_score ?? 0);
  const homeWins = isFinished && (game.home_score ?? 0) > (game.away_score ?? 0);

  const periods = [
    { label: "Q1", away: game.away_score_q1, home: game.home_score_q1 },
    { label: "Q2", away: game.away_score_q2, home: game.home_score_q2 },
    { label: "Q3", away: game.away_score_q3, home: game.home_score_q3 },
    { label: "Q4", away: game.away_score_q4, home: game.home_score_q4 },
  ];
  const hasPeriodData = periods.some((p) => p.away != null || p.home != null);

  function periodLabel() {
    if (!game.period) return game.status_detail ?? "Live";
    const p = game.period;
    if (p <= 4) return `Q${p}`;
    return `OT${p - 4 > 1 ? String(p - 4) : ""}`;
  }

  return (
    <TouchableOpacity
      style={styles.bbCard}
      onPress={() => router.push(`/game/${game.id}`)}
      activeOpacity={0.8}
    >
      {/* League + status */}
      <View style={styles.bbCardHeader}>
        {game.league && (
          <Text style={styles.bbLeague}>{game.league.toUpperCase()}</Text>
        )}
        {isLive ? (
          <View style={styles.bbStatusRow}>
            <View style={styles.bbLiveDot} />
            <Text style={styles.bbLiveText}>
              {periodLabel()}
              {game.period_time ? ` · ${game.period_time}` : ""}
            </Text>
          </View>
        ) : isFinished ? (
          <Text style={styles.bbFinalText}>Final</Text>
        ) : (
          <Text style={styles.bbScheduleText}>
            {game.scheduled_at
              ? new Date(game.scheduled_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "TBD"}
          </Text>
        )}
      </View>

      {/* Away / home rows */}
      <View style={styles.bbMatchup}>
        <View style={styles.bbTeamRow}>
          <Text style={[styles.bbTeamName, awayWins && styles.bbTeamWinner]} numberOfLines={1}>
            {away?.abbreviation ?? away?.name ?? "TBD"}
          </Text>
          {(isLive || isFinished) && game.away_score != null && (
            <Text style={[styles.bbTeamScore, awayWins && styles.bbScoreWinner]}>
              {game.away_score}
            </Text>
          )}
        </View>
        <View style={styles.bbTeamRow}>
          <Text style={[styles.bbTeamName, homeWins && styles.bbTeamWinner]} numberOfLines={1}>
            {home?.abbreviation ?? home?.name ?? "TBD"}
          </Text>
          {(isLive || isFinished) && game.home_score != null && (
            <Text style={[styles.bbTeamScore, homeWins && styles.bbScoreWinner]}>
              {game.home_score}
            </Text>
          )}
        </View>
      </View>

      {/* Quarter breakdown */}
      {(isLive || isFinished) && hasPeriodData && (
        <View style={styles.bbQuarterRow}>
          {periods.map(({ label, away: a, home: h }) => (
            <View key={label} style={styles.bbQuarterCol}>
              <Text style={styles.bbQuarterHead}>{label}</Text>
              <Text style={styles.bbQuarterScore}>{a ?? "-"}</Text>
              <Text style={styles.bbQuarterScore}>{h ?? "-"}</Text>
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Basketball home
// ---------------------------------------------------------------------------
function BasketballHome() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [games, setGames] = useState<BasketballGame[]>([]);
  const [entries, setEntries] = useState<BasketballScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    return Promise.all([
      basketball.getGames({ league: "NBA" }),
      basketball.getScheduleEntries({ league: "NBA" }),
    ]).then(([{ data: gamesData }, { data: entriesData }]) => {
      setGames(gamesData);
      setEntries(entriesData);
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  // Real-time updates for live game scores
  useEffect(() => {
    const channel = joinBasketballGamesChannel({
      onState: (liveGamesFromServer) => {
        setGames((prev) => {
          const updated = new Map(prev.map((g) => [g.id, g]));
          for (const g of liveGamesFromServer) updated.set(g.id, g);
          return [...updated.values()];
        });
      },
      onDelta: (changedGames) => {
        setGames((prev) => {
          const updated = new Map(prev.map((g) => [g.id, g]));
          for (const g of changedGames) {
            const existing = updated.get(g.id);
            updated.set(g.id, existing ? { ...existing, ...g } : g);
          }
          return [...updated.values()];
        });
      },
    });
    return () => { channel.leave(); };
  }, []);

  function onRefresh() {
    setRefreshing(true);
    load().finally(() => setRefreshing(false));
  }

  const today = new Date().toISOString().slice(0, 10);

  const liveGames = games.filter((g) => g.status === "live");

  // Prefer schedule entries for Upcoming/Past; fall back to individual games when none exist.
  const hasEntries = entries.length > 0;

  const upcomingEntries = entries.filter(
    (e) => !e.end_date || e.end_date.slice(0, 10) >= today
  );
  const pastEntries = entries
    .filter((e) => e.end_date && e.end_date.slice(0, 10) < today)
    .sort((a, b) => b.end_date!.localeCompare(a.end_date!));

  const upcomingGames = games
    .filter((g) => g.status === "scheduled")
    .sort((a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""));
  const pastGames = games
    .filter((g) => g.status === "finished")
    .sort((a, b) => (b.scheduled_at ?? "").localeCompare(a.scheduled_at ?? ""));

  const hasContent =
    liveGames.length > 0 ||
    (hasEntries ? upcomingEntries.length > 0 || pastEntries.length > 0
                : upcomingGames.length > 0 || pastGames.length > 0);

  if (loading) {
    return (
      <ScrollView contentContainerStyle={styles.list}>
        <SkeletonCard />
        <SkeletonCard />
      </ScrollView>
    );
  }

  return (
    <ScrollView
        contentContainerStyle={styles.golfScroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
      {/* ── Live section ─────────────────────────────────────────────── */}
      {liveGames.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.liveDot} />
            <Text style={styles.sectionTitle}>Live Now</Text>
          </View>
          {liveGames.map((g) => (
            <TouchableOpacity
              key={g.id}
              style={styles.liveEventCard}
              activeOpacity={0.8}
              onPress={() => router.push(`/game/${g.id}`)}
            >
              <View style={styles.liveEventTop}>
                <Text style={styles.liveEventName} numberOfLines={1}>
                  {(g.away_team?.abbreviation ?? g.away_team?.name ?? "TBD")}
                  {" vs "}
                  {(g.home_team?.abbreviation ?? g.home_team?.name ?? "TBD")}
                </Text>
                <View style={styles.liveBadge}>
                  <Text style={styles.liveBadgeText}>LIVE</Text>
                </View>
              </View>
              <Text style={styles.liveEventSub}>
                {g.away_score ?? 0} – {g.home_score ?? 0}
                {g.period ? ` · ${g.period <= 4 ? `Q${g.period}` : `OT`}` : ""}
                {g.period_time ? ` · ${g.period_time}` : ""}
              </Text>
              <Text style={styles.liveEventCta}>View game →</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {hasEntries ? (
        <>
          {/* ── Upcoming schedule entries ─────────────────────────────── */}
          <HorizontalScheduleList
            title="Upcoming"
            data={upcomingEntries}
            sport="basketball"
            placeholder="🏀"
            onPress={() => router.push("/(app)/games")}
            getSubtitle={(item) => (item as BasketballScheduleEntry).league ?? null}
          />

          {/* ── Past schedule entries ─────────────────────────────────── */}
          <HorizontalScheduleList
            title="Past"
            data={pastEntries}
            sport="basketball"
            placeholder="🏀"
            onPress={() => router.push("/(app)/games")}
            getSubtitle={(item) => (item as BasketballScheduleEntry).league ?? null}
          />
        </>
      ) : (
        <>
          {/* ── Upcoming games (fallback) ─────────────────────────────── */}
          {upcomingGames.length > 0 && (
            <BbHorizontalGameList title="Upcoming" games={upcomingGames} />
          )}

          {/* ── Past games (fallback) ─────────────────────────────────── */}
          {pastGames.length > 0 && (
            <BbHorizontalGameList title="Past" games={pastGames} />
          )}
        </>
      )}

      {!hasContent && (
        <View style={styles.center}>
          <Text style={styles.empty}>No games available</Text>
        </View>
      )}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Hockey home — game card
// ---------------------------------------------------------------------------
function HockeyHomeGameCard({ game }: { game: HockeyGame }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();

  const isLive = game.status === "live";
  const isFinished = game.status === "finished";
  const away = game.away_team;
  const home = game.home_team;
  const awayWins = isFinished && (game.away_score ?? 0) > (game.home_score ?? 0);
  const homeWins = isFinished && (game.home_score ?? 0) > (game.away_score ?? 0);

  const periods = [
    { label: "P1", away: game.away_score_p1, home: game.home_score_p1 },
    { label: "P2", away: game.away_score_p2, home: game.home_score_p2 },
    { label: "P3", away: game.away_score_p3, home: game.home_score_p3 },
    ...(game.home_score_ot != null || game.away_score_ot != null
      ? [{ label: game.shootout ? "SO" : "OT", away: game.away_score_ot, home: game.home_score_ot }]
      : []),
  ];
  const hasPeriodData = periods.some((p) => p.away != null || p.home != null);

  function hkPeriodLabel() {
    if (!game.period) return game.status_detail ?? "Live";
    const p = game.period;
    if (p <= 3) return `P${p}`;
    if (p === 4) return "OT";
    return "SO";
  }

  return (
    <TouchableOpacity
      style={styles.bbCard}
      onPress={() => router.push(`/game/${game.id}`)}
      activeOpacity={0.8}
    >
      <View style={styles.bbCardHeader}>
        {game.league && <Text style={styles.bbLeague}>{game.league.toUpperCase()}</Text>}
        {isLive ? (
          <View style={styles.bbStatusRow}>
            <View style={styles.bbLiveDot} />
            <Text style={styles.bbLiveText}>
              {hkPeriodLabel()}{game.period_time ? ` · ${game.period_time}` : ""}
            </Text>
          </View>
        ) : isFinished ? (
          <Text style={styles.bbFinalText}>Final{game.shootout ? " (SO)" : game.home_score_ot != null ? " (OT)" : ""}</Text>
        ) : (
          <Text style={styles.bbScheduleText}>
            {game.scheduled_at
              ? new Date(game.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : "TBD"}
          </Text>
        )}
      </View>

      <View style={styles.bbMatchup}>
        <View style={styles.bbTeamRow}>
          <Text style={[styles.bbTeamName, awayWins && styles.bbTeamWinner]} numberOfLines={1}>
            {away?.abbreviation ?? away?.name ?? "TBD"}
          </Text>
          {(isLive || isFinished) && game.away_score != null && (
            <Text style={[styles.bbTeamScore, awayWins && styles.bbScoreWinner]}>{game.away_score}</Text>
          )}
        </View>
        <View style={styles.bbTeamRow}>
          <Text style={[styles.bbTeamName, homeWins && styles.bbTeamWinner]} numberOfLines={1}>
            {home?.abbreviation ?? home?.name ?? "TBD"}
          </Text>
          {(isLive || isFinished) && game.home_score != null && (
            <Text style={[styles.bbTeamScore, homeWins && styles.bbScoreWinner]}>{game.home_score}</Text>
          )}
        </View>
      </View>

      {(isLive || isFinished) && hasPeriodData && (
        <View style={styles.bbQuarterRow}>
          {periods.map(({ label, away: a, home: h }) => (
            <View key={label} style={styles.bbQuarterCol}>
              <Text style={styles.bbQuarterHead}>{label}</Text>
              <Text style={styles.bbQuarterScore}>{a ?? "-"}</Text>
              <Text style={styles.bbQuarterScore}>{h ?? "-"}</Text>
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Hockey home
// ---------------------------------------------------------------------------
function HockeyHome() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [games, setGames] = useState<HockeyGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10);
    const dates = [1, 2, 3].map((offset) => {
      const d = new Date();
      d.setDate(d.getDate() + offset);
      return d.toISOString().slice(0, 10);
    });
    const [todayRes, ...futureResults] = await Promise.all([
      hockey.getGames({ league: "NHL", date: today }),
      ...dates.map((date) => hockey.getGames({ league: "NHL", date, status: "scheduled" })),
    ]);
    const byId = new Map<string, HockeyGame>();
    for (const g of [...todayRes.data, ...futureResults.flatMap((r) => r.data)]) byId.set(g.id, g);
    setGames([...byId.values()]);
  }, []);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  // Real-time updates for live game scores
  useEffect(() => {
    const channel: Channel = joinHockeyGamesChannel({
      onState: (liveGamesFromServer) => {
        setGames((prev) => {
          const updated = new Map(prev.map((g) => [g.id, g]));
          for (const g of liveGamesFromServer) updated.set(g.id, g);
          return [...updated.values()];
        });
      },
      onDelta: (changedGames) => {
        setGames((prev) => {
          const updated = new Map(prev.map((g) => [g.id, g]));
          for (const g of changedGames) {
            const existing = updated.get(g.id);
            updated.set(g.id, existing ? { ...existing, ...g } : g);
          }
          return [...updated.values()];
        });
      },
    });
    return () => { channel.leave(); };
  }, []);

  function onRefresh() {
    setRefreshing(true);
    load().finally(() => setRefreshing(false));
  }

  const liveGames = games.filter((g) => g.status === "live");
  const scheduledGames = games
    .filter((g) => g.status === "scheduled")
    .sort((a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""));
  const finishedGames = games
    .filter((g) => g.status === "finished")
    .sort((a, b) => (b.scheduled_at ?? "").localeCompare(a.scheduled_at ?? ""));

  const hasContent = liveGames.length > 0 || scheduledGames.length > 0 || finishedGames.length > 0;

  if (loading) {
    return (
      <ScrollView contentContainerStyle={styles.list}>
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.golfScroll}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      {/* ── Live section ─────────────────────────────────────────────── */}
      {liveGames.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.liveDot} />
            <Text style={styles.sectionTitle}>Live Now</Text>
          </View>
          {liveGames.map((g) => <HockeyHomeGameCard key={g.id} game={g} />)}
        </View>
      )}

      {/* ── Upcoming section ─────────────────────────────────────────── */}
      {scheduledGames.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { paddingHorizontal: spacing.md }]}>Upcoming</Text>
          {scheduledGames.map((g) => <HockeyHomeGameCard key={g.id} game={g} />)}
        </View>
      )}

      {/* ── Recent results ───────────────────────────────────────────── */}
      {finishedGames.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { paddingHorizontal: spacing.md }]}>Recent Results</Text>
          {finishedGames.map((g) => <HockeyHomeGameCard key={g.id} game={g} />)}
        </View>
      )}

      {!hasContent && (
        <View style={styles.center}>
          <Text style={styles.empty}>No games available</Text>
        </View>
      )}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Football home
// ---------------------------------------------------------------------------
function FootballHome() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [games, setGames] = useState<FootballGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const todayStr = new Date().toISOString().slice(0, 10);

  const load = useCallback(() => {
    return football.getGames({ date: todayStr }).then(({ data }) => setGames(data));
  }, [todayStr]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  function onRefresh() {
    setRefreshing(true);
    load().finally(() => setRefreshing(false));
  }

  const liveGames = games.filter((g) => g.status === "live");

  if (loading) {
    return (
      <View style={styles.list}>
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </View>
    );
  }

  return (
    <FlatList
      data={games}
      keyExtractor={(g) => g.id}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
      ListHeaderComponent={
        liveGames.length > 0 ? (
          <TouchableOpacity
            style={styles.liveCard}
            onPress={() => router.push("/(app)/games")}
          >
            <View style={styles.liveDot} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[styles.name, { color: "#fff", fontWeight: "700" }]}>
                {liveGames.length} game{liveGames.length > 1 ? "s" : ""} live
              </Text>
            </View>
            <Text style={styles.liveCta}>View scores →</Text>
          </TouchableOpacity>
        ) : null
      }
      ListHeaderComponentStyle={styles.listHeader}
      ListEmptyComponent={
        <View style={{ alignItems: "center", paddingTop: 40 }}>
          <Text style={[styles.name, { color: colors.textSecondary }]}>No games today</Text>
        </View>
      }
      renderItem={({ item }) => {
        const isLive = item.status === "live";
        const isFinished = item.status === "finished";
        const away = item.away_team;
        const home = item.home_team;
        return (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push("/(app)/games")}
          >
            {item.league && (
              <Text style={[styles.dates, { marginBottom: 4, fontWeight: "600" }]}>
                {item.league.toUpperCase()}
              </Text>
            )}
            <Text style={styles.name}>
              {away?.abbreviation ?? away?.name ?? "TBD"} @ {home?.abbreviation ?? home?.name ?? "TBD"}
            </Text>
            {(isLive || isFinished) && item.home_score != null && item.away_score != null ? (
              <Text style={[styles.meta, { color: isLive ? "#ef4444" : colors.textSecondary }]}>
                {isLive ? "🔴 LIVE · " : "Final · "}
                {item.away_score} – {item.home_score}
              </Text>
            ) : (
              item.scheduled_at && (
                <Text style={styles.dates}>
                  {new Date(item.scheduled_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              )
            )}
          </TouchableOpacity>
        );
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Root export — picks the right home based on activeSport
// ---------------------------------------------------------------------------
export default function HomeScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { activeSport } = useSport();

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      {activeSport === "golf" ? (
        <GolfHome />
      ) : activeSport === "tennis" ? (
        <TennisHome />
      ) : activeSport === "hockey" ? (
        <HockeyHome />
      ) : activeSport === "football" ? (
        <FootballHome />
      ) : (
        <BasketballHome />
      )}
    </SafeAreaView>
  );
}

function createStyles(colors: Palette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    list: { padding: spacing.md, paddingTop: spacing.lg },
    listHeader: { marginBottom: spacing.sm },
    liveCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.primary,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    liveDot: {
      width: 10,
      height: 10,
      borderRadius: radius.full,
      backgroundColor: colors.secondary,
      marginRight: spacing.sm,
    },
    liveInfo: { flex: 1 },
    liveLabel: { ...typography.caption, color: colors.textOnPrimary, opacity: 0.8 },
    liveName: { ...typography.h3, color: colors.textOnPrimary, marginTop: 2 },
    liveCta: { ...typography.label, color: colors.textOnPrimary, fontWeight: "700" },
    card: {
      backgroundColor: colors.card,
      borderRadius: radius.md,
      marginBottom: spacing.sm,
      overflow: "hidden",
      shadowColor: "#000",
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    image: { width: "100%", height: 140 },
    info: { padding: spacing.md },
    name: { ...typography.h3, color: colors.text },
    dates: { ...typography.caption, color: colors.textSecondary, marginTop: 4 },
    meta: { ...typography.caption, color: colors.textSecondary, marginTop: 4 },

    // Golf home
    golfScroll: { paddingTop: spacing.lg, paddingBottom: spacing.xl },
    section: { marginBottom: spacing.lg },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      marginBottom: spacing.sm,
    },
    sectionTitle: {
      ...typography.label,
      color: colors.textSecondary,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginBottom: spacing.sm,
    },
    // Live event card
    liveEventCard: {
      marginHorizontal: spacing.md,
      marginBottom: spacing.sm,
      backgroundColor: colors.card,
      borderRadius: radius.md,
      padding: spacing.md,
      borderLeftWidth: 3,
      borderLeftColor: colors.live ?? colors.primary,
      shadowColor: "#000",
      shadowOpacity: 0.06,
      shadowRadius: 6,
      elevation: 3,
    },
    liveEventTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.xs,
    },
    liveEventName: { ...typography.h3, color: colors.text, fontWeight: "700", flex: 1 },
    liveBadge: {
      backgroundColor: colors.live ?? colors.primary,
      borderRadius: radius.sm,
      paddingHorizontal: 7,
      paddingVertical: 3,
      marginLeft: spacing.sm,
    },
    liveBadgeText: { ...typography.caption, color: "#fff", fontWeight: "800", fontSize: 10 },
    liveEventSub: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.sm },
    liveEventCta: { ...typography.label, color: colors.primary, fontWeight: "700" },
    // Upcoming horizontal cards
    upcomingList: {
      paddingHorizontal: spacing.md,
      gap: spacing.sm,
    },
    upcomingCard: {
      width: 160,
      backgroundColor: colors.card,
      borderRadius: radius.md,
      overflow: "hidden",
      shadowColor: "#000",
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    upcomingImage: { width: "100%", height: 90 },
    upcomingImagePlaceholder: {
      backgroundColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    upcomingImagePlaceholderText: { fontSize: 28 },
    upcomingInfo: { padding: spacing.sm },
    upcomingName: { ...typography.label, color: colors.text, fontWeight: "600", lineHeight: 18 },
    upcomingDates: { ...typography.caption, color: colors.textSecondary, marginTop: 3 },
    upcomingWinner: { ...typography.caption, color: colors.primary, marginTop: 3 },
    center: { flex: 1, alignItems: "center" as const, justifyContent: "center" as const, paddingTop: 60 },
    empty: { ...typography.body, color: colors.textSecondary },

    // Basketball schedule entry banner card
    bbEntryCard: {
      marginHorizontal: spacing.md,
      marginBottom: spacing.md,
      backgroundColor: colors.card,
      borderRadius: radius.md,
      overflow: "hidden" as const,
      shadowColor: "#000",
      shadowOpacity: 0.06,
      shadowRadius: 6,
      elevation: 3,
    },
    bbEntryImage: {
      width: "100%" as const,
      height: 120,
    },
    bbEntryBody: {
      padding: spacing.md,
    },
    bbEntryLeague: {
      ...typography.caption,
      color: colors.primary,
      fontWeight: "700" as const,
      textTransform: "uppercase" as const,
      letterSpacing: 0.6,
      marginBottom: 3,
    },
    bbEntryName: {
      ...typography.h3,
      color: colors.text,
      fontWeight: "700" as const,
    },
    bbEntryDesc: {
      ...typography.caption,
      color: colors.textSecondary,
      marginTop: 3,
    },
    bbEntryDates: {
      ...typography.caption,
      color: colors.textSecondary,
      marginTop: 4,
    },

    // Basketball horizontal compact game card
    bbHorizontalCard: {
      width: 140,
      backgroundColor: colors.card,
      borderRadius: radius.md,
      overflow: "hidden" as const,
      shadowColor: "#000",
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    bbHorizontalPlaceholder: {
      width: "100%" as const,
      height: 70,
      backgroundColor: colors.border,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    bbHorizontalTeam: {
      ...typography.label,
      color: colors.text,
      fontWeight: "500" as const,
    },
    bbHorizontalMeta: {
      ...typography.caption,
      color: colors.textSecondary,
      marginTop: 4,
    },

    // Basketball home game cards
    bbCard: {
      backgroundColor: colors.card,
      borderRadius: radius.md,
      padding: spacing.md,
      marginHorizontal: spacing.md,
      marginBottom: spacing.sm,
      shadowColor: "#000",
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    bbCardHeader: {
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
      marginBottom: spacing.sm,
    },
    bbLeague: {
      ...typography.caption,
      color: colors.textSecondary,
      fontWeight: "600" as const,
      letterSpacing: 0.5,
    },
    bbStatusRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 4 },
    bbLiveDot: {
      width: 6,
      height: 6,
      borderRadius: radius.full,
      backgroundColor: "#ef4444",
    },
    bbLiveText: { ...typography.caption, color: "#ef4444", fontWeight: "700" as const },
    bbFinalText: { ...typography.caption, color: colors.textSecondary, fontWeight: "600" as const },
    bbScheduleText: { ...typography.caption, color: colors.textSecondary },
    bbMatchup: { gap: 4 },
    bbTeamRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "space-between" as const,
    },
    bbTeamName: { ...typography.body, color: colors.text, flex: 1, fontWeight: "500" as const },
    bbTeamWinner: { fontWeight: "700" as const },
    bbTeamScore: {
      ...typography.h3,
      color: colors.text,
      minWidth: 28,
      textAlign: "right" as const,
    },
    bbScoreWinner: { color: colors.primary, fontWeight: "800" as const },
    bbQuarterRow: {
      flexDirection: "row" as const,
      marginTop: spacing.sm,
      paddingTop: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      gap: spacing.sm,
    },
    bbQuarterCol: { alignItems: "center" as const, flex: 1 },
    bbQuarterHead: { ...typography.caption, color: colors.textSecondary, marginBottom: 2 },
    bbQuarterScore: { ...typography.caption, color: colors.text, fontWeight: "500" as const },
    bbViewAllBtn: {
      marginHorizontal: spacing.md,
      marginTop: spacing.xs,
      marginBottom: spacing.lg,
      paddingVertical: spacing.sm,
      alignItems: "center" as const,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    bbViewAllText: { ...typography.label, color: colors.primary, fontWeight: "600" as const },

    // Basketball home league switcher
    bbLeagueSwitcher: {
      flexDirection: "row" as const,
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.divider,
    },
    bbLeagueTab: {
      flex: 1,
      paddingVertical: spacing.sm + 2,
      alignItems: "center" as const,
    },
    bbLeagueTabActive: {
      borderBottomWidth: 2,
      borderBottomColor: colors.primary,
    },
    bbLeagueTabLabel: { ...typography.label, color: colors.textSecondary },
    bbLeagueTabLabelActive: { color: colors.primary, fontWeight: "700" as const },
  });
}
