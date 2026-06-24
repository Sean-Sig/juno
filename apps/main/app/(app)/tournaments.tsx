import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  Platform,
  PanResponder,
} from "react-native";
import { Image } from "expo-image";
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
import { useFollowedPlayers } from "../../context/FollowedPlayersContext";

const TEAM_ID = process.env.EXPO_PUBLIC_GOLF_TEAM_ID ?? "00000000-0000-0000-0000-000000000001";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * The backend sends player: null on live update events.
 * Copy player objects from `prev` into `next` wherever they are missing.
 */
function withPlayers(next: GolfTournament, prev: GolfTournament | null): GolfTournament {
  if (!prev?.events?.length) return next;
  return {
    ...next,
    events: next.events.map((nextEvent) => {
      const prevEvent = prev.events.find((e) => e.id === nextEvent.id);
      if (!prevEvent?.scores?.length || !nextEvent.scores?.length) return nextEvent;
      return {
        ...nextEvent,
        scores: nextEvent.scores.map((nextScore) => {
          if (nextScore.player) return nextScore;
          const prevScore = prevEvent.scores.find((s) => s.id === nextScore.id);
          return prevScore?.player ? { ...nextScore, player: prevScore.player } : nextScore;
        }),
      };
    }),
  };
}

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
  const [sheetScore, setSheetScore] = useState<GolfScore | null>(null);
  const channelRef = useRef<ReturnType<typeof joinGolfChannel> | null>(null);

  const loadTournaments = useCallback(() => {
    return golf.getTournaments(TEAM_ID).then(({ data: tourData }) => {
      setTournaments(tourData);
      const active =
        tourData.find((t) => t.events?.some((e) => e.live)) ??
        tourData.find((t) => t.events?.length > 0) ??
        tourData[0] ??
        null;
      setSelected((prev) => prev ?? active);
    }).catch(() => {});
  }, []);

  // Schedule entries are seeded once via REST for the very first render, then
  // kept in sync by the `schedule_state` channel push (sent on join and again
  // whenever the backend re-imports the schedule) — no polling needed.
  const load = useCallback(() => {
    return Promise.all([loadTournaments(), golf.getScheduleEntries().then(({ data }) => {
      setScheduleEntries(data);
    })]).catch(() => {});
  }, [loadTournaments]);

  function onRefresh() {
    setRefreshing(true);
    load().finally(() => setRefreshing(false));
  }

  useEffect(() => {
    load().finally(() => setLoading(false));

    const channel = joinGolfChannel(TEAM_ID, {
      onState: (t) => {
        setTournaments((prev) => {
          const existing = prev.find((p) => p.id === t.id);
          const merged = withPlayers(t, existing ?? null);
          return existing
            ? prev.map((p) => (p.id === t.id ? merged : p))
            : [...prev, merged];
        });
        setSelected((prev) => prev?.id === t.id ? withPlayers(t, prev) : prev);
      },
      onDelta: (diff) => {
        // Only patch `selected` — never `tournaments`.
        // `tournaments` is the source of truth for the live tab list; it should only
        // be updated by the REST load or a full `tournament_state` push so transient
        // mid-import fluctuations in the delta (e.g. live flag toggling) never cause
        // the live list to blank out.
        setSelected((prev) => {
          if (!prev) return prev;
          // Ignore deltas that belong to a different tournament
          if (diff.id && diff.id !== prev.id) return prev;

          // Merge changed events BY ID so unchanged events are not dropped.
          let next = { ...prev };

          if (diff.events && Array.isArray(diff.events)) {
            const changedById = new Map(
              (diff.events as GolfTournament["events"]).map((e) => [e.id, e])
            );
            next.events = (prev.events ?? []).map((existingEvent) => {
              const changedEvent = changedById.get(existingEvent.id);
              if (!changedEvent) return existingEvent;
              const mergedEvent = { ...existingEvent, ...changedEvent };
              if (Array.isArray(changedEvent.scores)) {
                mergedEvent.scores = changedEvent.scores.map((nextScore) => {
                  if (nextScore.player) return nextScore;
                  const prevScore = existingEvent.scores?.find((s) => s.id === nextScore.id);
                  return prevScore?.player ? { ...nextScore, player: prevScore.player } : nextScore;
                });
              }
              return mergedEvent;
            });
          }

          if (diff.courses && Array.isArray(diff.courses)) {
            const changedById = new Map((diff.courses as any[]).map((c: any) => [c.id, c]));
            next.courses = (prev.courses as any[] ?? []).map(
              (c: any) => changedById.get(c.id) ?? c
            );
          }

          return next;
        });
      },
      onScheduleState: (entries) => {
        setScheduleEntries(entries);
      },
    });
    channelRef.current = channel;

    // `tournament_state` is only pushed once, right after join — it never repeats,
    // so a tournament going live later in a long-lived session would otherwise
    // never appear (and one going final would never disappear) until the screen
    // remounts. Poll the REST list periodically as a fallback so `tournaments`
    // stays current regardless of channel/join timing.
    //
    // `scheduleEntries` doesn't need this fallback poll — the backend broadcasts
    // a fresh `schedule_state` over this same channel whenever the schedule is
    // re-imported, so `onScheduleState` keeps it current without polling.
    const pollId = setInterval(loadTournaments, 30_000);

    return () => { channel.leave(); clearInterval(pollId); };
  }, [load, loadTournaments]);

  // Derived data
  const today = new Date().toISOString().slice(0, 10);

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

  // The schedule entry's end_date is the authoritative "has this tournament actually
  // concluded" signal — cross-reference via enet_stage_id so a tournament whose
  // `events[].live` flag is stale (slow to flip server-side after the event ends)
  // doesn't keep showing in Live once its schedule entry has already moved to Final.
  const endedEnetStageIds = useMemo(() =>
    new Set(finalEntries.map((e) => e.enet_stage_id).filter((id): id is string => id != null)),
    [finalEntries]
  );

  const liveTournaments = tournaments.filter((t) =>
    t.events?.some((e) => e.live) &&
    !(t.enet_tournament_stage_id != null && endedEnetStageIds.has(t.enet_tournament_stage_id))
  );
  const hasLive = liveTournaments.length > 0;

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

  const mostRecentRound = selected?.events?.[0]?.most_recently_scored_round ?? null;
  // Course par used as fallback when Enet sends stroke totals without per-round to-par
  const coursePar: number | null =
    (selected?.courses as any[])?.find((c: any) => c.primary_course)?.total_par ??
    (selected?.courses as any[])?.[0]?.total_par ??
    null;
  const showToday = scores.some((s) => {
    const round = mostRecentRound ?? detectCurrentRound(s.details);
    return detailHasData(round ? s.details?.[round] as GolfRoundDetail | undefined : null);
  });

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
                      activeOpacity={0.8}
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
                {selected.events?.[0]?.name && selected.events[0].name !== selected.name ? (
                  <Text style={styles.headerSubtitle}>{selected.events[0].name}</Text>
                ) : null}
                {scores.length >= 2 && scores[0].par !== scores[1].par && (
                  <Text style={styles.leadMargin}>
                    {(() => {
                      const gap = scores[1].par - scores[0].par;
                      const leader = `${scores[0].player?.display_last_name ?? scores[0].player?.last_name ?? "Leader"}`;
                      return `${leader} leads by ${gap} shot${gap !== 1 ? "s" : ""}`;
                    })()}
                  </Text>
                )}
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
                ListHeaderComponent={
                  <View style={styles.colHeader}>
                    <Text style={[styles.colHeaderText, styles.colHeaderPlace]}>POS</Text>
                    <Text style={[styles.colHeaderText, { flex: 1 }]}>PLAYER</Text>
                    {showToday && <Text style={[styles.colHeaderText, styles.colHeaderToday]}>TODAY</Text>}
                    <Text style={[styles.colHeaderText, styles.colHeaderTotal]}>TOTAL</Text>
                  </View>
                }
                renderItem={({ item }) => (
                  <LeaderboardRow
                    score={item}
                    mostRecentRound={mostRecentRound}
                    showToday={showToday}
                    coursePar={coursePar}
                    onPlayerPress={() => setSheetScore(item)}
                    onScorecard={() => {
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

      {/* Player detail sheet */}
      <PlayerSheet
        score={sheetScore}
        tournamentName={selected?.name ?? null}
        coursePar={coursePar}
        onClose={() => setSheetScore(null)}
      />
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

const ROUND_ORDER = ["round_1", "round_2", "round_3", "round_4", "round_5"];

function formatScore(par: number): string {
  if (par === 0) return "E";
  return par > 0 ? `+${par}` : `${par}`;
}

/** When most_recently_scored_round is null, find the latest round with any data. */
function detectCurrentRound(details: Record<string, GolfRoundDetail> | null): string | null {
  if (!details) return null;
  for (let i = ROUND_ORDER.length - 1; i >= 0; i--) {
    if (detailHasData(details[ROUND_ORDER[i]])) return ROUND_ORDER[i];
  }
  return null;
}

/** Compute round-to-par from hole to_pars when detail.par is null.
 *  Falls back to strokes - coursePar when Enet only gives stroke totals. */
function roundParFromDetail(detail: GolfRoundDetail, coursePar?: number | null): number | null {
  if (detail.par != null) return detail.par;
  if (detail.to_pars) {
    const vals = Object.values(detail.to_pars);
    if (vals.length > 0) return vals.reduce((s, v) => s + v, 0);
  }
  // Enet "result" shape: only stroke totals, no per-round to-par
  if (detail.strokes != null && detail.strokes > 0 && coursePar != null) {
    return detail.strokes - coursePar;
  }
  return null;
}

/** True if a round detail has any meaningful data. */
function detailHasData(d: GolfRoundDetail | undefined | null): boolean {
  if (!d) return false;
  if (d.strokes != null && d.strokes > 0) return true;
  if (d.par != null) return true;
  if (d.thru != null) return true;
  if (d.to_pars && Object.keys(d.to_pars).length > 0) return true;
  if (d.scores && Object.keys(d.scores).length > 0) return true;
  return false;
}

function LeaderboardRow({
  score,
  mostRecentRound,
  showToday,
  coursePar,
  onPlayerPress,
  onScorecard,
}: {
  score: GolfScore;
  mostRecentRound: string | null;
  showToday: boolean;
  coursePar: number | null;
  onPlayerPress: () => void;
  onScorecard: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const terminalBadge = score.dq ? "DQ" : score.wd ? "WD" : null;
  const missedCut = !terminalBadge && !score.made_cut && score.par !== 0;

  const hasRoundData = Object.values(score.details ?? {}).some(
    (r) => detailHasData(r as GolfRoundDetail)
  );

  const resolvedRound = mostRecentRound ?? detectCurrentRound(score.details);
  const todayDetail = (resolvedRound && score.details?.[resolvedRound]) as GolfRoundDetail | null ?? null;
  const todayStarted = detailHasData(todayDetail);
  const todayPar: number | null = todayStarted ? roundParFromDetail(todayDetail!, coursePar) : null;
  const todayThru: string | null = todayStarted ? (todayDetail?.thru ?? null) : null;

  return (
    <TouchableOpacity style={styles.row} onPress={onScorecard} activeOpacity={0.7}>
      <Text style={styles.place}>{score.display_place ?? "—"}</Text>
      <TouchableOpacity style={styles.playerInfo} onPress={onPlayerPress} activeOpacity={0.6}>
        <Text style={styles.playerName}>
          {score.player?.display_first_name ?? score.player?.first_name}{" "}
          {score.player?.display_last_name ?? score.player?.last_name}
        </Text>
        <Text style={styles.country}>{score.player?.country}</Text>
      </TouchableOpacity>
      <View style={styles.scoreRight}>
        {terminalBadge ? (
          <Text style={[styles.badge, { width: showToday ? 68 + 52 + 8 : 52, textAlign: "right" }]}>{terminalBadge}</Text>
        ) : (
          <>
            {showToday && (
              <View style={styles.todayCell}>
                {hasRoundData && todayPar != null ? (
                  <>
                    <Text style={[styles.todayScore, todayPar < 0 && styles.under, todayPar > 0 && styles.over]}>
                      {formatScore(todayPar)}
                    </Text>
                    <Text style={styles.thruText}>
                      {todayThru === "F" ? "F" : todayThru ? `T${todayThru}` : ""}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.thruText}>—</Text>
                )}
              </View>
            )}
            <View style={styles.totalCellWrap}>
              {missedCut ? (
                <Text style={styles.badge}>MC</Text>
              ) : (
                <Text style={[styles.score, score.par < 0 && styles.under, score.par > 0 && styles.over]}>
                  {formatScore(score.par)}
                </Text>
              )}
            </View>
          </>
        )}
        <Text style={styles.expandCaret}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Player detail sheet
// ---------------------------------------------------------------------------

const SCREEN_HEIGHT = Dimensions.get("window").height;
const SHEET_HEIGHT = Math.min(SCREEN_HEIGHT * 0.65, 520);

function PlayerSheet({
  score,
  tournamentName,
  coursePar,
  onClose,
}: {
  score: GolfScore | null;
  tournamentName: string | null;
  coursePar: number | null;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const { isFollowed, follow, unfollow } = useFollowedPlayers();
  const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const [followLoading, setFollowLoading] = useState(false);
  const visible = score !== null;

  // Keep onClose in a ref so PanResponder closure doesn't go stale
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  // Slide in when score appears, reset when cleared
  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 20,
        stiffness: 200,
      }).start();
    } else {
      slideAnim.setValue(SHEET_HEIGHT);
    }
  }, [visible]);

  const dismiss = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: SHEET_HEIGHT,
      duration: 220,
      useNativeDriver: true,
    }).start(() => onCloseRef.current());
  }, []);

  // Pan responder — drag handle area only
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, { dy }) => dy > 4,
      onPanResponderMove: (_, { dy }) => {
        // Only allow downward drag
        if (dy > 0) slideAnim.setValue(dy);
      },
      onPanResponderRelease: (_, { dy, vy }) => {
        if (dy > 80 || vy > 0.5) {
          // Flicked or dragged far enough — dismiss
          Animated.timing(slideAnim, {
            toValue: SHEET_HEIGHT,
            duration: 200,
            useNativeDriver: true,
          }).start(() => onCloseRef.current());
        } else {
          // Snap back
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
            damping: 20,
            stiffness: 200,
          }).start();
        }
      },
    })
  ).current;

  if (!score) return null;

  const player = score.player;
  const playerId = score.player_id ?? player?.id ?? "";
  const followed = playerId ? isFollowed(playerId) : false;

  const firstName = player?.display_first_name ?? player?.first_name ?? "";
  const lastName = player?.display_last_name ?? player?.last_name ?? "";
  const fullName = `${firstName} ${lastName}`.trim();
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

  const roundBreakdown = ROUND_ORDER
    .map((key) => {
      const d = score.details?.[key] as GolfRoundDetail | undefined;
      if (!detailHasData(d)) return null;
      const par = roundParFromDetail(d!, coursePar);
      return { key, label: key.replace("round_", "R"), par, thru: d!.thru };
    })
    .filter((r): r is { key: string; label: string; par: number | null; thru: string | null } => r !== null);

  const ranking = player?.world_rankings_rank ?? (player as any)?.rolex_world_rankings_rank ?? null;

  const handleFollow = async () => {
    if (!playerId || followLoading) return;
    setFollowLoading(true);
    try {
      if (followed) await unfollow(playerId);
      else await follow(playerId);
    } finally {
      setFollowLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={dismiss}>
      {/* Backdrop */}
      <TouchableOpacity
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }}
        activeOpacity={1}
        onPress={dismiss}
      />

      {/* Sheet */}
      <Animated.View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: SHEET_HEIGHT,
          backgroundColor: colors.surface ?? colors.background,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          transform: [{ translateY: slideAnim }],
          paddingBottom: Platform.OS === "ios" ? 34 : 16,
        }}
      >
        {/* Drag handle — this View owns the pan responder */}
        <View
          {...panResponder.panHandlers}
          style={{ alignItems: "center", paddingTop: 12, paddingBottom: 8 }}
        >
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16 }}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
        >
          {/* Player header row */}
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 18 }}>
            {/* Avatar */}
            <View style={{ marginRight: 14 }}>
              {player?.photo ? (
                <Image
                  source={{ uri: player.photo }}
                  style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.border }}
                  cachePolicy="memory-disk"
                />
              ) : (
                <View style={{
                  width: 64, height: 64, borderRadius: 32,
                  backgroundColor: colors.primary + "22",
                  alignItems: "center", justifyContent: "center",
                }}>
                  <Text style={{ fontSize: 22, fontWeight: "700", color: colors.primary }}>{initials || "?"}</Text>
                </View>
              )}
            </View>

            {/* Name + meta */}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 20, fontWeight: "700", color: colors.text, marginBottom: 3 }}>
                {fullName || "Unknown Player"}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                {player?.country ? (
                  <Text style={{ fontSize: 13, color: colors.textSecondary }}>{player.country}</Text>
                ) : null}
                {ranking != null ? (
                  <View style={{
                    backgroundColor: colors.primary + "18",
                    borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
                  }}>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: colors.primary }}>WR #{ranking}</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* Follow button */}
            {playerId ? (
              <TouchableOpacity
                onPress={handleFollow}
                disabled={followLoading}
                activeOpacity={0.75}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 20,
                  backgroundColor: followed ? colors.primary : "transparent",
                  borderWidth: 1.5,
                  borderColor: colors.primary,
                  opacity: followLoading ? 0.5 : 1,
                }}
              >
                <Text style={{
                  fontSize: 13,
                  fontWeight: "700",
                  color: followed ? (colors.background) : colors.primary,
                }}>
                  {followed ? "Following" : "Follow"}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Divider */}
          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginBottom: 18 }} />

          {/* Tournament label */}
          {tournamentName ? (
            <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textSecondary, letterSpacing: 0.8, marginBottom: 12 }}>
              {tournamentName.toUpperCase()}
            </Text>
          ) : null}

          {/* Stat cards: position / total / strokes */}
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
            <View style={{
              flex: 1, backgroundColor: colors.background,
              borderRadius: 10, padding: 14, alignItems: "center",
              borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
            }}>
              <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textSecondary, marginBottom: 4 }}>POSITION</Text>
              <Text style={{ fontSize: 24, fontWeight: "800", color: colors.text }}>{score.display_place ?? "—"}</Text>
            </View>
            <View style={{
              flex: 1, backgroundColor: colors.background,
              borderRadius: 10, padding: 14, alignItems: "center",
              borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
            }}>
              <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textSecondary, marginBottom: 4 }}>TOTAL</Text>
              <Text style={[
                { fontSize: 24, fontWeight: "800" },
                score.par < 0 ? { color: colors.primary }
                  : score.par > 0 ? { color: colors.error ?? "#ef4444" }
                  : { color: colors.text },
              ]}>
                {formatScore(score.par)}
              </Text>
            </View>
            {score.strokes > 0 && (
              <View style={{
                flex: 1, backgroundColor: colors.background,
                borderRadius: 10, padding: 14, alignItems: "center",
                borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
              }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textSecondary, marginBottom: 4 }}>STROKES</Text>
                <Text style={{ fontSize: 24, fontWeight: "800", color: colors.text }}>{score.strokes}</Text>
              </View>
            )}
          </View>

          {/* Round breakdown */}
          {roundBreakdown.length > 0 && (
            <>
              <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textSecondary, letterSpacing: 0.8, marginBottom: 10 }}>ROUNDS</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {roundBreakdown.map((r) => (
                  <View key={r.key} style={{
                    flex: 1, backgroundColor: colors.background,
                    borderRadius: 10, padding: 12, alignItems: "center",
                    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
                  }}>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textSecondary, marginBottom: 4 }}>{r.label}</Text>
                    <Text style={[
                      { fontSize: 18, fontWeight: "800" },
                      r.par != null && r.par < 0 ? { color: colors.primary }
                        : r.par != null && r.par > 0 ? { color: colors.error ?? "#ef4444" }
                        : { color: colors.text },
                    ]}>
                      {r.par != null ? formatScore(r.par) : "—"}
                    </Text>
                    {r.thru ? (
                      <Text style={{ fontSize: 10, color: colors.textSecondary, marginTop: 2 }}>
                        {r.thru === "F" ? "Final" : `Thru ${r.thru}`}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      </Animated.View>
    </Modal>
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
    leadMargin: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
    liveBadge: {
      backgroundColor: colors.live ?? "#ef4444",
      borderRadius: radius.sm,
      paddingHorizontal: spacing.xs,
      paddingVertical: 2,
    },
    liveBadgeText: { ...typography.caption, color: "#fff", fontWeight: "700", fontSize: 10 },

    // Column header row
    colHeader: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2,
      backgroundColor: colors.background,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      gap: 4,
    },
    colHeaderText: {
      ...typography.caption,
      color: colors.textSecondary,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    colHeaderPlace: { width: 36 },
    colHeaderToday: { width: 68, textAlign: "right" },
    colHeaderTotal: { width: 52, textAlign: "right" },

    // Leaderboard rows
    row: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md, backgroundColor: colors.card },
    place: { width: 36, ...typography.label, color: colors.textSecondary },
    playerInfo: { flex: 1 },
    playerName: { ...typography.body, color: colors.text, fontWeight: "600" },
    country: { ...typography.caption, color: colors.textSecondary },
    scoreRight: { flexDirection: "row", alignItems: "center", gap: 4 },
    // Today's round cell
    todayCell: { width: 68, alignItems: "flex-end" },
    todayScore: { ...typography.label, color: colors.text, fontWeight: "700" },
    thruText: { ...typography.caption, color: colors.textSecondary, marginTop: 1 },
    // Total score cell
    totalCellWrap: { width: 52, alignItems: "flex-end" },
    score: { ...typography.h3, color: colors.text },
    under: { color: colors.primary },
    over: { color: colors.error ?? "#ef4444" },
    badge: { ...typography.caption, color: colors.textSecondary, fontWeight: "700" },
    chevron: { ...typography.h2, color: colors.textSecondary, lineHeight: 24 },
    expandCaret: { ...typography.body, color: colors.textSecondary, marginLeft: 4 },
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
