import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  golf,
  GolfTournament,
  GolfScore,
  GolfRoundDetail,
  GolfScheduleEntry,
  joinGolfChannel,
} from "@juno/api";
import { useTheme, spacing, radius, typography, type Palette } from "@juno/ui";

const TEAM_ID = process.env.EXPO_PUBLIC_GOLF_TEAM_ID ?? "00000000-0000-0000-0000-000000000001";

// ---------------------------------------------------------------------------
// Tab types
// ---------------------------------------------------------------------------

type StatusTab = "live" | "upcoming" | "final";

const STATUS_TABS: { key: StatusTab; label: string }[] = [
  { key: "live", label: "Live" },
  { key: "upcoming", label: "Upcoming" },
  { key: "final", label: "Final" },
];

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function TournamentsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();

  const [statusTab, setStatusTab] = useState<StatusTab>("live");
  const [query, setQuery] = useState("");
  const [tournaments, setTournaments] = useState<GolfTournament[]>([]);
  const [scheduleEntries, setScheduleEntries] = useState<GolfScheduleEntry[]>([]);
  const [selected, setSelected] = useState<GolfTournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const channelRef = useRef<ReturnType<typeof joinGolfChannel> | null>(null);

  const load = useCallback(() => {
    return Promise.all([
      golf.getTournaments(TEAM_ID),
      golf.getScheduleEntries(),
    ]).then(([{ data: tourData }, { data: schedData }]) => {
      setTournaments(tourData);
      setScheduleEntries(schedData);
      const active =
        tourData.find((t) => t.events?.some((e) => e.live)) ??
        tourData.find((t) => t.events?.length > 0) ??
        tourData[0] ??
        null;
      setSelected((prev) => prev ?? active);
    }).catch(() => {});
  }, []);

  function onRefresh() {
    setRefreshing(true);
    load().finally(() => setRefreshing(false));
  }

  useEffect(() => {
    load().finally(() => setLoading(false));

    const channel = joinGolfChannel(TEAM_ID, {
      onState: (t) => {
        setTournaments((prev) => prev.map((existing) => (existing.id === t.id ? t : existing)));
        setSelected((prev) => (prev?.id === t.id ? t : prev));
      },
      onDelta: (diff) => {
        setSelected((prev) => (prev ? { ...prev, ...diff } : prev));
      },
    });
    channelRef.current = channel;
    return () => { channel.leave(); };
  }, []);

  // Derived data
  const today = new Date().toISOString().slice(0, 10);
  const liveTournaments = tournaments.filter((t) => {
    const hasLiveEvent = t.events?.some((e) => e.live);
    const notEnded = !t.end_date || t.end_date.slice(0, 10) >= today;
    return hasLiveEvent && notEnded;
  });
  const hasLive = liveTournaments.length > 0;

  const upcomingEntries = useMemo(() =>
    scheduleEntries
      .filter((e) => !e.end_date || e.end_date.slice(0, 10) >= today)
      .sort((a, b) => (a.start_date ?? "").localeCompare(b.start_date ?? "")),
    [scheduleEntries, today]
  );

  const finalEntries = useMemo(() =>
    scheduleEntries
      .filter((e) => e.end_date && e.end_date.slice(0, 10) < today)
      .sort((a, b) => (b.end_date ?? "").localeCompare(a.end_date ?? "")),
    [scheduleEntries, today]
  );

  // Leaderboard for selected live tournament
  const scores = useMemo(() => {
    const raw = selected?.events?.[0]?.scores ?? [];
    return [...raw].sort((a, b) => {
      const group = (s: GolfScore) => s.dq || s.wd ? 2 : s.made_cut ? 0 : 1;
      const ga = group(a), gb = group(b);
      if (ga !== gb) return ga - gb;
      if (a.par !== b.par) return a.par - b.par;
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });
  }, [selected]);

  const selectedIsLive = selected?.events?.some((e) => e.live) ?? false;

  // Filtered data for search
  const q = query.trim().toLowerCase();
  const filteredScores = useMemo(() => {
    if (!q) return scores;
    return scores.filter((s) => {
      const first = (s.player?.display_first_name ?? s.player?.first_name ?? "").toLowerCase();
      const last = (s.player?.display_last_name ?? s.player?.last_name ?? "").toLowerCase();
      return first.includes(q) || last.includes(q) || `${first} ${last}`.includes(q);
    });
  }, [scores, q]);

  const filteredUpcoming = useMemo(() => {
    if (!q) return upcomingEntries;
    return upcomingEntries.filter((e) => e.name?.toLowerCase().includes(q));
  }, [upcomingEntries, q]);

  const filteredFinal = useMemo(() => {
    if (!q) return finalEntries;
    return finalEntries.filter((e) => e.name?.toLowerCase().includes(q));
  }, [finalEntries, q]);

  // Default to live tab if something is actually live, otherwise upcoming
  useEffect(() => {
    if (!loading) setStatusTab(hasLive ? "live" : "upcoming");
  }, [loading]);

  // Reset search when switching tabs
  useEffect(() => { setQuery(""); }, [statusTab]);

  if (loading) {
    return (
      <SafeAreaView style={styles.center} edges={["left", "right"]}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

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
            {t.key === "live" && statusTab !== "live" && hasLive && (
              <View style={styles.liveDotTab} />
            )}
            <Text style={[styles.tabLabel, statusTab === t.key && styles.tabLabelActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search bar */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder={
            statusTab === "live" ? "Search players…" : "Search tournaments…"
          }
          value={query}
          onChangeText={setQuery}
          placeholderTextColor={colors.textSecondary}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      {/* ── Live tab ───────────────────────────────────────────────────── */}
      {statusTab === "live" && (
        !hasLive ? (
          <View style={styles.center}>
            <Text style={styles.emptyTitle}>No live tournaments</Text>
            <Text style={styles.emptyText}>Check back when a tournament is in progress.</Text>
          </View>
        ) : (
          <>
            {/* Tournament picker chips — if multiple live */}
            {liveTournaments.length > 1 && (
              <FlatList
                horizontal
                data={liveTournaments}
                keyExtractor={(t) => t.id}
                showsHorizontalScrollIndicator={false}
                style={styles.picker}
                contentContainerStyle={styles.pickerContent}
                renderItem={({ item }) => {
                  const active = selected?.id === item.id;
                  return (
                    <TouchableOpacity
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setSelected(item)}
                    >
                      <View style={styles.liveDotChip} />
                      <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
                        {item.name}
                      </Text>
                    </TouchableOpacity>
                  );
                }}
              />
            )}

            {/* Tournament header */}
            {selected && (
              <View style={styles.header}>
                <View style={styles.headerRow}>
                  <Text style={styles.headerTitle}>{selected.name}</Text>
                  <View style={styles.liveBadge}>
                    <Text style={styles.liveBadgeText}>LIVE</Text>
                  </View>
                </View>
                {selected.events?.[0]?.name ? (
                  <Text style={styles.headerSubtitle}>{selected.events[0].name}</Text>
                ) : null}
              </View>
            )}

            {/* Leaderboard */}
            {filteredScores.length === 0 ? (
              <View style={styles.center}>
                <Text style={styles.emptyText}>{q ? `No players matching "${query}"` : "No scores yet"}</Text>
              </View>
            ) : (
              <FlatList
                data={filteredScores}
                keyExtractor={(s) => s.id}
                refreshControl={
                  <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
                }
                renderItem={({ item }) => (
                  <LeaderboardRow
                    score={item}
                    onPress={() => {
                      const firstName = item.player?.display_first_name ?? item.player?.first_name ?? "";
                      const lastName = item.player?.display_last_name ?? item.player?.last_name ?? "";
                      router.push({
                        pathname: "/(app)/scorecard",
                        params: {
                          playerName: `${firstName} ${lastName}`.trim(),
                          tournamentName: selected?.name ?? "",
                          mostRecentRound: selected?.events?.[0]?.most_recently_scored_round ?? "",
                          details: JSON.stringify(item.details ?? {}),
                          totalPar: item.par,
                          totalStrokes: item.strokes,
                          displayPlace: item.display_place ?? "",
                          courses: JSON.stringify(selected?.courses ?? []),
                        },
                      });
                    }}
                  />
                )}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
              />
            )}
          </>
        )
      )}

      {/* ── Upcoming tab ───────────────────────────────────────────────── */}
      {statusTab === "upcoming" && (
        <FlatList
          data={filteredUpcoming}
          keyExtractor={(e) => e.id}
          contentContainerStyle={filteredUpcoming.length === 0 ? styles.emptyContent : styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          renderItem={({ item }) => (
            <TournamentCard
              entry={item}
              onPress={() => router.push(`/tournament/${item.id}?sport=golf`)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>{q ? "No results" : "No upcoming tournaments"}</Text>
              <Text style={styles.emptyText}>{q ? `No tournaments matching "${query}".` : "Check back soon for the next event."}</Text>
            </View>
          }
        />
      )}

      {/* ── Final tab ──────────────────────────────────────────────────── */}
      {statusTab === "final" && (
        <FlatList
          data={filteredFinal}
          keyExtractor={(e) => e.id}
          contentContainerStyle={filteredFinal.length === 0 ? styles.emptyContent : styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          renderItem={({ item }) => (
            <TournamentCard
              entry={item}
              onPress={() => router.push(`/tournament/${item.id}?sport=golf`)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>{q ? "No results" : "No past tournaments"}</Text>
              <Text style={styles.emptyText}>{q ? `No tournaments matching "${query}".` : "Results will appear here after events conclude."}</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Tournament card (Upcoming + Final)
// ---------------------------------------------------------------------------

function TournamentCard({ entry, onPress }: { entry: GolfScheduleEntry; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const dateStr = [
    entry.start_date?.slice(5, 10).replace("-", "/"),
    entry.end_date?.slice(5, 10).replace("-", "/"),
  ].filter(Boolean).join(" – ");

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <Text style={styles.cardName}>{entry.name}</Text>
      {dateStr ? <Text style={styles.cardDates}>{dateStr}</Text> : null}
      {entry.winners_name ? (
        <Text style={styles.cardWinner}>🏆 {entry.winners_name}</Text>
      ) : null}
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Leaderboard row (Live tab)
// ---------------------------------------------------------------------------

function LeaderboardRow({ score, onPress }: { score: GolfScore; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const badge = score.dq ? "DQ" : score.wd ? "WD" : !score.made_cut && score.par !== 0 ? "MC" : null;
  const hasRoundData = Object.values(score.details ?? {}).some(
    (r) => (r as GolfRoundDetail)?.strokes != null && (r as GolfRoundDetail).strokes! > 0
  );

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={hasRoundData ? onPress : undefined}
      activeOpacity={hasRoundData ? 0.7 : 1}
    >
      <Text style={styles.place}>{score.display_place ?? "—"}</Text>
      <View style={styles.playerInfo}>
        <Text style={styles.playerName}>
          {score.player?.display_first_name ?? score.player?.first_name}{" "}
          {score.player?.display_last_name ?? score.player?.last_name}
        </Text>
        <Text style={styles.country}>{score.player?.country}</Text>
      </View>
      <View style={styles.scoreRight}>
        {badge ? (
          <Text style={styles.badge}>{badge}</Text>
        ) : hasRoundData ? (
          <Text style={[styles.score, score.par < 0 && styles.under]}>
            {score.par === 0 ? "E" : score.par > 0 ? `+${score.par}` : score.par}
          </Text>
        ) : null}
        {hasRoundData && <Text style={styles.chevron}>›</Text>}
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
    center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },

    // Tabs
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
    liveDotTab: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#ef4444" },

    // Search bar
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

    // Tournament picker chips (live tab)
    picker: { flexGrow: 0, flexShrink: 0, marginHorizontal: spacing.md, marginTop: spacing.md },
    pickerContent: { gap: spacing.xs },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.full,
      backgroundColor: colors.card,
      gap: spacing.xs,
    },
    chipActive: { backgroundColor: colors.primary },
    chipText: { ...typography.label, color: colors.textSecondary },
    chipTextActive: { color: colors.textOnPrimary, fontWeight: "700" },
    liveDotChip: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.live ?? "#ef4444" },

    // Live tournament header
    header: {
      padding: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.card,
      marginTop: spacing.sm,
    },
    headerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    headerTitle: { ...typography.h2, color: colors.text, flex: 1 },
    headerSubtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
    liveBadge: {
      backgroundColor: colors.live ?? "#ef4444",
      borderRadius: radius.sm,
      paddingHorizontal: spacing.xs,
      paddingVertical: 2,
    },
    liveBadgeText: { ...typography.caption, color: "#fff", fontWeight: "700", fontSize: 10 },

    // Leaderboard rows
    row: { flexDirection: "row", alignItems: "center", padding: spacing.md, backgroundColor: colors.card },
    place: { width: 36, ...typography.label, color: colors.textSecondary },
    playerInfo: { flex: 1 },
    playerName: { ...typography.body, color: colors.text, fontWeight: "600" },
    country: { ...typography.caption, color: colors.textSecondary },
    scoreRight: { flexDirection: "row", alignItems: "center", gap: 4 },
    score: { ...typography.h3, color: colors.text },
    under: { color: colors.primary },
    badge: { ...typography.caption, color: colors.textSecondary, fontWeight: "700" },
    chevron: { ...typography.h2, color: colors.textSecondary, lineHeight: 24 },
    separator: { height: 1, backgroundColor: colors.border },

    // Tournament card (upcoming / final)
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
    cardName: { ...typography.h3, color: colors.text, fontWeight: "700", marginBottom: 4 },
    cardDates: { ...typography.caption, color: colors.textSecondary, marginBottom: 4 },
    cardWinner: { ...typography.label, color: colors.primary, fontWeight: "600", marginTop: 2 },
  });
}
