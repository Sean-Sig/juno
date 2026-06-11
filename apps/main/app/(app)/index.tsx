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
  GolfScheduleEntry,
  GolfTournament,
  TennisScheduleEntry,
  TennisMatch,
  BasketballGame,
  HockeyGame,
  FootballGame,
  useSport,
} from "@juno/api";
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
}: {
  title: string;
  data: (GolfScheduleEntry | TennisScheduleEntry)[];
  sport: "golf" | "tennis";
  placeholder: string;
  getSubtitle?: (item: GolfScheduleEntry | TennisScheduleEntry) => string | null;
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
              onPress={() => router.push(`/tournament/${item.id}?sport=${sport}`)}
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
// Basketball home
// ---------------------------------------------------------------------------
function BasketballHome() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [games, setGames] = useState<BasketballGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const todayStr = new Date().toISOString().slice(0, 10);

  const load = useCallback(() => {
    return basketball.getGames({ date: todayStr }).then(({ data }) => setGames(data));
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
            activeOpacity={0.8}
            onPress={() => router.push("/(app)/games")}
          >
            <View style={styles.liveDot} />
            <View style={styles.liveInfo}>
              <Text style={styles.liveLabel}>Live now</Text>
              <Text style={styles.liveName}>
                {liveGames.length} {liveGames.length === 1 ? "game" : "games"} in progress
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
// Hockey home
// ---------------------------------------------------------------------------
function HockeyHome() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [games, setGames] = useState<HockeyGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const todayStr = new Date().toISOString().slice(0, 10);

  const load = useCallback(() => {
    return hockey.getGames({ date: todayStr }).then(({ data }) => setGames(data));
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
            activeOpacity={0.8}
            onPress={() => router.push("/(app)/games")}
          >
            <View style={styles.liveDot} />
            <View style={styles.liveInfo}>
              <Text style={styles.liveLabel}>Live now</Text>
              <Text style={styles.liveName}>
                {liveGames.length} {liveGames.length === 1 ? "game" : "games"} in progress
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
  });
}
