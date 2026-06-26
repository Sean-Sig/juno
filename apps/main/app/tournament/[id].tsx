import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  golf,
  tennis,
  GolfScheduleEntry,
  GolfTournament,
  GolfScore,
  GolfRoundDetail,
  TennisScheduleEntry,
} from "@juno/api";
import { useTheme, spacing, typography, radius, type Palette } from "@juno/ui";
import { Ionicons } from "@expo/vector-icons";

// Mirrors the sort used in the main leaderboard (tournaments.tsx)
function sortScores(scores: GolfScore[]): GolfScore[] {
  return [...scores].sort((a, b) => {
    const group = (s: GolfScore) => (s.dq || s.wd ? 2 : s.made_cut ? 0 : 1);
    const ga = group(a);
    const gb = group(b);
    if (ga !== gb) return ga - gb;
    if (a.par !== b.par) return a.par - b.par;
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });
}

function hasRoundData(score: GolfScore): boolean {
  return Object.values(score.details ?? {}).some(
    (r) => (r as GolfRoundDetail)?.strokes != null && (r as GolfRoundDetail).strokes! > 0
  );
}

// ---------------------------------------------------------------------------
// Golf detail
// ---------------------------------------------------------------------------
function GolfTournamentDetail({ id }: { id: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();

  const [entry, setEntry] = useState<GolfScheduleEntry | null>(null);
  const [tournament, setTournament] = useState<GolfTournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(() => {
    let scheduleEntry: GolfScheduleEntry;
    return golf
      .getScheduleEntry(id)
      .then(({ data }) => {
        scheduleEntry = data;
        setEntry(data);
        return golf.getTournaments(data.team_id);
      })
      .then(({ data: tournaments }) => {
        const matched =
          tournaments.find(
            (t) =>
              t.enet_tournament_stage_id != null &&
              t.enet_tournament_stage_id === scheduleEntry?.enet_stage_id
          ) ?? null;
        setTournament(matched);
      })
      .catch((e) => console.error("[TournamentDetail] load error:", e));
  }, [id]);

  useEffect(() => {
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData().finally(() => setRefreshing(false));
  }, [loadData]);

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!entry) {
    return (
      <SafeAreaView style={styles.center}>
        <BackHeader />
        <Text style={styles.empty}>Tournament not found</Text>
      </SafeAreaView>
    );
  }

  // Pick the best event: live first, then most scores, then first
  const event =
    tournament?.events?.find((e) => e.live) ??
    tournament?.events?.reduce((best, e) =>
      (e.scores?.length ?? 0) > (best.scores?.length ?? 0) ? e : best,
      tournament.events[0]
    ) ??
    null;

  const scores = sortScores(event?.scores ?? []).filter(
    // Keep anyone who has actually played (par set, strokes set, or round details),
    // plus anyone with a terminal status (DQ/WD) or who missed the cut.
    // Filters out placeholder rows where everything is zero and no status.
    (s) => s.par !== 0 || s.strokes > 0 || hasRoundData(s) || s.dq || s.wd || !s.made_cut
  );

  return (
    <SafeAreaView style={styles.container}>
      <BackHeader />
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {entry.image_url && (
          <Image source={{ uri: entry.image_url }} style={styles.image} cachePolicy="memory-disk" />
        )}
        <View style={styles.infoBlock}>
          <Text style={styles.name}>{entry.name}</Text>
          <Text style={styles.dates}>
            {entry.start_date?.slice(0, 10)} – {entry.end_date?.slice(0, 10)}
          </Text>
          {entry.winners_name && (
            <View style={styles.winnerRow}>
              <Text style={styles.winnerLabel}>🏆 Winner</Text>
              <Text style={styles.winnerName}>{entry.winners_name}</Text>
              {entry.winners_score && (
                <Text style={styles.winnerScore}>{entry.winners_score}</Text>
              )}
            </View>
          )}
        </View>

        {!tournament && (
          <Text style={[styles.dates, { padding: spacing.md }]}>
            No live tournament data linked to this event.
          </Text>
        )}
        {tournament && scores.length === 0 && (
          <Text style={[styles.dates, { padding: spacing.md }]}>
            Tournament found ({tournament.name}) — no scores yet.
          </Text>
        )}
        {scores.length > 0 && (
          <View style={styles.leaderboard}>
            <Text style={styles.sectionTitle}>
              {event?.name ?? "Leaderboard"}
            </Text>
            {scores.map((score) => {
              const hasData = hasRoundData(score) || score.par !== 0 || score.strokes > 0;
              const badge = score.dq ? "DQ" : score.wd ? "WD" : !score.made_cut ? "MC" : null;
              const firstName = score.player?.display_first_name ?? score.player?.first_name ?? "";
              const lastName = score.player?.display_last_name ?? score.player?.last_name ?? "";
              return (
                <TouchableOpacity
                  key={score.id}
                  style={styles.scoreRow}
                  activeOpacity={0.7}
                  onPress={() => {
                    router.push({
                      pathname: "/scorecard",
                      params: {
                        playerId: score.player_id ?? score.player?.id ?? "",
                        playerName: `${firstName} ${lastName}`.trim(),
                        country: score.player?.country ?? "",
                        photo: score.player?.photo ?? "",
                        ranking: String(score.player?.world_rankings_rank ?? score.player?.rolex_world_rankings_rank ?? ""),
                        tournamentName: tournament?.name ?? entry.name ?? "",
                        mostRecentRound: event?.most_recently_scored_round ?? "",
                        details: JSON.stringify(score.details ?? {}),
                        totalPar: score.par,
                        totalStrokes: score.strokes,
                        displayPlace: score.display_place ?? "",
                        courses: JSON.stringify(tournament?.courses ?? []),
                      },
                    });
                  }}
                >
                  <Text style={styles.place}>{score.display_place ?? "—"}</Text>
                  <View style={styles.playerInfo}>
                    <Text style={styles.playerName}>
                      {firstName} {lastName}
                    </Text>
                    {score.player?.country && (
                      <Text style={styles.country}>{score.player.country}</Text>
                    )}
                  </View>
                  {badge ? (
                    <Text style={styles.badge}>{badge}</Text>
                  ) : hasData ? (
                    <Text style={[styles.par, score.par < 0 && styles.under]}>
                      {score.par === 0 ? "E" : score.par > 0 ? `+${score.par}` : score.par}
                    </Text>
                  ) : null}
                  <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} style={{ marginLeft: spacing.xs }} />
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Tennis detail
// ---------------------------------------------------------------------------
function TennisTournamentDetail({ id }: { id: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();

  const [entry, setEntry] = useState<TennisScheduleEntry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    tennis
      .getScheduleEntry(id)
      .then(({ data }) => setEntry(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!entry) {
    return (
      <SafeAreaView style={styles.center}>
        <BackHeader />
        <Text style={styles.empty}>Tournament not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <BackHeader />
      <ScrollView>
        {entry.image_url && (
          <Image source={{ uri: entry.image_url }} style={styles.image} cachePolicy="memory-disk" />
        )}
        <View style={styles.infoBlock}>
          <Text style={styles.name}>{entry.name}</Text>
          {(entry.start_date || entry.end_date) && (
            <Text style={styles.dates}>
              {entry.start_date?.slice(0, 10)} – {entry.end_date?.slice(0, 10)}
            </Text>
          )}
          {entry.gender && (
            <Text style={styles.level}>{entry.gender === "male" ? "ATP" : entry.gender === "female" ? "WTA" : entry.gender.toUpperCase()}</Text>
          )}
          <Text style={styles.level}>{entry.partnership_level.toUpperCase()}</Text>
        </View>

        {/* CTA to matches tab */}
        <TouchableOpacity
          style={styles.matchesCta}
          onPress={() => router.push("/(app)/matches")}
          activeOpacity={0.8}
        >
          <Text style={styles.matchesCtaText}>View matches</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.textOnPrimary} />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Shared back header
// ---------------------------------------------------------------------------
function BackHeader() {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        padding: spacing.md,
        backgroundColor: colors.card,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
      }}
    >
      <TouchableOpacity
        onPress={() => router.back()}
        style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
      >
        <Ionicons name="chevron-back" size={22} color={colors.primary} />
        <Text style={{ ...typography.body, color: colors.primary }}>Back</Text>
      </TouchableOpacity>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Root — picks golf or tennis based on ?sport= param
// ---------------------------------------------------------------------------
export default function TournamentScreen() {
  const { id, sport } = useLocalSearchParams<{ id: string; sport?: string }>();

  if (!id) return null;

  return sport === "tennis" ? (
    <TennisTournamentDetail id={id} />
  ) : (
    // golf or unspecified
    <GolfTournamentDetail id={id} />
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
function createStyles(colors: Palette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.background,
    },
    image: { width: "100%", height: 200 },
    infoBlock: { padding: spacing.md, backgroundColor: colors.card },
    name: { ...typography.h2, color: colors.text },
    dates: {
      ...typography.caption,
      color: colors.textSecondary,
      marginTop: spacing.xs,
    },
    level: {
      ...typography.caption,
      color: colors.primary,
      marginTop: spacing.xs,
      fontWeight: "600",
    },
    winnerRow: {
      marginTop: spacing.md,
      padding: spacing.md,
      backgroundColor: colors.background,
      borderRadius: radius.md,
    },
    winnerLabel: { ...typography.caption, color: colors.textSecondary },
    winnerName: {
      ...typography.h3,
      color: colors.text,
      marginTop: spacing.xs,
    },
    winnerScore: {
      ...typography.body,
      color: colors.primary,
      marginTop: spacing.xs,
    },
    leaderboard: { margin: spacing.md },
    sectionTitle: {
      ...typography.h3,
      color: colors.text,
      marginBottom: spacing.sm,
    },
    scoreRow: {
      flexDirection: "row",
      alignItems: "center",
      padding: spacing.md,
      backgroundColor: colors.card,
      borderRadius: radius.sm,
      marginBottom: 1,
    },
    place: { width: 36, ...typography.label, color: colors.textSecondary },
    playerInfo: { flex: 1 },
    playerName: { ...typography.body, color: colors.text, fontWeight: "600" },
    country: { ...typography.caption, color: colors.textSecondary },
    par: { ...typography.h3, color: colors.text },
    under: { color: colors.primary },
    badge: { ...typography.caption, color: colors.textSecondary, fontWeight: "700" },
    empty: { ...typography.body, color: colors.textSecondary },
    matchesCta: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      margin: spacing.md,
      backgroundColor: colors.primary,
      borderRadius: radius.md,
      padding: spacing.md,
    },
    matchesCtaText: {
      ...typography.label,
      color: colors.textOnPrimary,
      fontWeight: "700",
    },
  });
}
