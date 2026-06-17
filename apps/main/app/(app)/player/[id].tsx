import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Image,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { golf, tennis, basketball, hockey, football, GolfPlayer, GolfPlayerScore, TennisPlayer, TennisMatch, BasketballPlayer, HockeyPlayer, FootballPlayer, useAuth, useSport, type Sport } from "@juno/api";
import { useTheme, spacing, typography, radius, type Palette } from "@juno/ui";
import { useFollowedPlayers } from "../../../context/FollowedPlayersContext";
import { useScoutLineup } from "../../../context/ScoutLineupContext";

type Player = GolfPlayer | TennisPlayer | BasketballPlayer | HockeyPlayer | FootballPlayer;

const ROUND_ORDER: Record<string, number> = {
  R128: 0, R64: 1, R32: 2, R16: 3, QF: 4, SF: 5, F: 6,
};

const ROUND_LABELS: Record<string, string> = {
  F: "Final", SF: "Semi-Final", QF: "Quarter-Final",
  R16: "Round of 16", R32: "Round of 32", R64: "Round of 64", R128: "Round of 128",
};

function getDisplayName(player: Player) {
  return `${(player as GolfPlayer).display_first_name ?? player.first_name} ${(player as GolfPlayer).display_last_name ?? player.last_name}`;
}

function getRankStats(player: Player, sport: Sport) {
  if (sport === "golf") {
    const p = player as GolfPlayer;
    return [
      p.world_rankings_rank != null && { label: "World Ranking", value: `#${p.world_rankings_rank}` },
      p.rolex_world_rankings_rank != null && { label: "Rolex Ranking", value: `#${p.rolex_world_rankings_rank}` },
    ].filter(Boolean) as { label: string; value: string }[];
  } else if (sport === "tennis") {
    const p = player as TennisPlayer;
    return [
      p.singles_rank != null && { label: "Singles Rank", value: `#${p.singles_rank}` },
      p.doubles_rank != null && { label: "Doubles Rank", value: `#${p.doubles_rank}` },
      p.singles_race_rank != null && { label: "Race Rank", value: `#${p.singles_race_rank}` },
    ].filter(Boolean) as { label: string; value: string }[];
  } else if (sport === "hockey") {
    const p = player as HockeyPlayer;
    return [
      p.position != null && { label: "Position", value: p.position },
      p.jersey_number != null && { label: "Jersey", value: `#${p.jersey_number}` },
      p.league != null && { label: "League", value: p.league },
    ].filter(Boolean) as { label: string; value: string }[];
  } else if (sport === "football") {
    const p = player as FootballPlayer;
    return [
      p.position != null && { label: "Position", value: p.position },
      p.jersey_number != null && { label: "Jersey", value: `#${p.jersey_number}` },
      p.league != null && { label: "League", value: p.league },
    ].filter(Boolean) as { label: string; value: string }[];
  } else {
    const p = player as BasketballPlayer;
    return [
      p.position != null && { label: "Position", value: p.position },
      p.jersey_number != null && { label: "Jersey", value: `#${p.jersey_number}` },
      p.league != null && { label: "League", value: p.league },
    ].filter(Boolean) as { label: string; value: string }[];
  }
}

export default function PlayerScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { id, teamId, from } = useLocalSearchParams<{ id: string; teamId?: string; from?: string }>();
  const { activeSport } = useSport();
  const { session } = useAuth();
  const { isFollowed, follow, unfollow } = useFollowedPlayers();
  const { queuePlayer } = useScoutLineup();
  const router = useRouter();
  const navigation = useNavigation();

  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);
  // Golf scorecard
  const [golfScores, setGolfScores] = useState<GolfPlayerScore[]>([]);
  // Tennis scorecard: all tournament matches for this player
  const [tournamentMatches, setTournamentMatches] = useState<TennisMatch[]>([]);
  const [playerMap, setPlayerMap] = useState<Map<string, TennisPlayer>>(new Map());

  const api = activeSport === "golf" ? golf : activeSport === "tennis" ? tennis : activeSport === "hockey" ? hockey : activeSport === "football" ? football : basketball;
  const followed = id ? isFollowed(id) : false;

  const backDestination = from === "matches" ? "/(app)/matches" : "/(app)/rankings";

  // Set header title + back button (overrides global sport switcher pill)
  useEffect(() => {
    const title = player ? getDisplayName(player) : "Player";
    navigation.setOptions({
      title,
      headerLeft: () => (
        <TouchableOpacity onPress={() => router.navigate(backDestination as any)} style={{ paddingRight: spacing.sm }}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
      ),
      headerRight: () => null,
    });
  }, [player, colors.text, backDestination]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.getPlayer(id)
      .then(({ data }) => setPlayer(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id, activeSport]);

  // Fetch golf scorecard
  useEffect(() => {
    if (activeSport !== "golf" || !id) return;
    golf.getPlayerScores(id)
      .then(({ data }) => setGolfScores(data))
      .catch(() => {});
  }, [id, activeSport]);

  // Fetch this player's matches for the current tournament
  useEffect(() => {
    if (activeSport !== "tennis" || !id || !teamId) return;
    tennis.getPlayerMatches(id, teamId)
      .then(({ data }) => {
        const sorted = [...data].sort(
          (a, b) => (ROUND_ORDER[a.round ?? ""] ?? 99) - (ROUND_ORDER[b.round ?? ""] ?? 99)
        );
        // Build playerMap from embedded player objects
        const map = new Map<string, TennisPlayer>();
        for (const m of data) {
          if (m.player1) map.set(m.player1_id!, m.player1);
          if (m.player2) map.set(m.player2_id!, m.player2);
          if (m.player1_partner) map.set(m.player1_partner_id!, m.player1_partner);
          if (m.player2_partner) map.set(m.player2_partner_id!, m.player2_partner);
        }
        setPlayerMap(map);
        setTournamentMatches(sorted);
      })
      .catch(() => {});
  }, [id, activeSport, teamId]);

  async function toggleFollow() {
    if (!session || !id) return;
    setFollowLoading(true);
    try {
      if (followed) {
        await unfollow(id);
      } else {
        await follow(id);
      }
    } finally {
      setFollowLoading(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center} edges={["bottom"]}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!player) {
    return (
      <SafeAreaView style={styles.center} edges={["bottom"]}>
        <Text style={styles.empty}>Player not found</Text>
      </SafeAreaView>
    );
  }

  const displayName = getDisplayName(player);
  const stats = getRankStats(player, activeSport as Sport);

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.profile}>
          {player.photo ? (
            <Image source={{ uri: player.photo }} style={styles.photo} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Text style={styles.initials}>
                {player.first_name[0]}{player.last_name[0]}
              </Text>
            </View>
          )}
          <Text style={styles.name}>{displayName}</Text>
          {player.country && <Text style={styles.country}>{player.country}</Text>}

          {session ? (
            <TouchableOpacity
              style={[styles.followButton, followed && styles.followingButton]}
              onPress={toggleFollow}
              disabled={followLoading}
            >
              {followLoading ? (
                <ActivityIndicator color={followed ? colors.primary : "#fff"} size="small" />
              ) : (
                <Text style={[styles.followButtonText, followed && styles.followingButtonText]}>
                  {followed ? "Following" : "Follow"}
                </Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.signInButton}
              onPress={() => router.push("/(auth)/login")}
            >
              <Text style={styles.signInButtonText}>Sign in to follow</Text>
            </TouchableOpacity>
          )}

          {activeSport === "tennis" && player && (
            <TouchableOpacity
              style={[styles.scoutButton, { borderColor: colors.primary }]}
              onPress={() => {
                queuePlayer(player as TennisPlayer);
                router.navigate("/(app)/scout");
              }}
              activeOpacity={0.75}
            >
              <Ionicons name="telescope-outline" size={15} color={colors.primary} />
              <Text style={[styles.scoutButtonText, { color: colors.primary }]}>Add to Scout</Text>
            </TouchableOpacity>
          )}
        </View>

        {stats.length > 0 && (
          <View style={styles.statsRow}>
            {stats.map((s) => (
              <View key={s.label} style={styles.statBox}>
                <Text style={styles.statValue}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
        )}

        {golfScores.length > 0 && (
          <GolfScorecard scores={golfScores} />
        )}

        {tournamentMatches.length > 0 && (
          <TennisScorecard
            playerId={id!}
            matches={tournamentMatches}
            playerMap={playerMap}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Golf Scorecard component
// ---------------------------------------------------------------------------

function formatPar(par: number): string {
  if (par === 0) return "E";
  return par > 0 ? `+${par}` : `${par}`;
}

/** Group scores by tournament event, newest first. */
function groupByEvent(scores: GolfPlayerScore[]) {
  const groups = new Map<string, { eventName: string; eventStatus: string; live: boolean; scores: GolfPlayerScore[] }>();
  for (const s of scores) {
    const key = s.event?.id ?? s.event_id;
    const name = s.event?.name ?? "Round";
    const status = s.event?.status ?? "upcoming";
    const live = s.event?.live ?? false;
    if (!groups.has(key)) groups.set(key, { eventName: name, eventStatus: status, live, scores: [] });
    groups.get(key)!.scores.push(s);
  }
  return Array.from(groups.values());
}

function GolfScorecard({ scores }: { scores: GolfPlayerScore[] }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const groups = useMemo(() => groupByEvent(scores), [scores]);
  const roundsInOrder = [...groups].reverse();

  return (
    <View style={styles.scorecard}>
      <Text style={styles.scorecardTitle}>Recent Scores</Text>

      {roundsInOrder.map((group, i) => {
        const s = group.scores[0];

        const statusBadge = group.live
          ? "LIVE"
          : s.dq
          ? "DQ"
          : s.wd
          ? "WD"
          : !s.made_cut && !s.is_playing && s.strokes > 0
          ? "MC"
          : null;

        const parColor =
          s.par < 0 ? colors.primary : s.par > 0 ? (colors.error ?? "#ef4444") : colors.text;
        const hasScore = s.strokes > 0;

        return (
          <View
            key={group.eventName + i}
            style={[styles.scCard, i < roundsInOrder.length - 1 && styles.scCardBorder]}
          >
            {/* Event name + status badge */}
            <View style={styles.scCardHeader}>
              <Text style={styles.scEventName} numberOfLines={2}>
                {group.eventName}
              </Text>
              {statusBadge && (
                <View style={[styles.badge, group.live && styles.badgeLive]}>
                  <Text style={[styles.badgeText, group.live && styles.badgeTextLive]}>
                    {statusBadge}
                  </Text>
                </View>
              )}
            </View>

            {/* Stats row */}
            <View style={styles.scStatsRow}>
              <View style={styles.scStat}>
                <Text style={styles.scStatValue}>{hasScore ? s.strokes : "—"}</Text>
                <Text style={styles.scStatLabel}>Strokes</Text>
              </View>
              <View style={styles.scStatDivider} />
              <View style={styles.scStat}>
                <Text style={[styles.scStatValue, { color: hasScore ? parColor : colors.textSecondary }]}>
                  {hasScore ? formatPar(s.par) : "—"}
                </Text>
                <Text style={styles.scStatLabel}>To Par</Text>
              </View>
              <View style={styles.scStatDivider} />
              <View style={styles.scStat}>
                <Text style={styles.scStatValue}>{s.display_place ?? "—"}</Text>
                <Text style={styles.scStatLabel}>Position</Text>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Tennis Scorecard component
// ---------------------------------------------------------------------------

function TennisScorecard({
  playerId,
  matches,
  playerMap,
}: {
  playerId: string;
  matches: TennisMatch[];
  playerMap: Map<string, TennisPlayer>;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const wins = matches.filter(
    (m) =>
      (m.player1_id === playerId && m.winner === 1) ||
      (m.player2_id === playerId && m.winner === 2)
  ).length;
  const losses = matches.filter(
    (m) =>
      (m.player1_id === playerId && m.winner === 2) ||
      (m.player2_id === playerId && m.winner === 1)
  ).length;

  return (
    <View style={styles.scorecard}>
      <Text style={styles.scorecardTitle}>Tournament Results</Text>

      {/* W-L summary */}
      <View style={styles.wlRow}>
        <View style={styles.wlBox}>
          <Text style={[styles.wlNum, styles.wNum]}>{wins}</Text>
          <Text style={styles.wlLabel}>W</Text>
        </View>
        <View style={styles.wlDivider} />
        <View style={styles.wlBox}>
          <Text style={[styles.wlNum, styles.lNum]}>{losses}</Text>
          <Text style={styles.wlLabel}>L</Text>
        </View>
      </View>

      {/* Match rows */}
      {matches.map((match) => {
        const isP1 = match.player1_id === playerId;
        const opponentId = isP1 ? match.player2_id : match.player1_id;
        const opponent = opponentId ? playerMap.get(opponentId) : undefined;
        const opponentName = opponent
          ? `${opponent.display_first_name ?? opponent.first_name} ${opponent.display_last_name ?? opponent.last_name}`
          : "TBD";

        const playerSide = isP1 ? "1" : "2";
        const opponentSide = isP1 ? "2" : "1";

        const isWinner =
          (isP1 && match.winner === 1) || (!isP1 && match.winner === 2);
        const isFinished = match.status.startsWith("finished");
        const isLive = ["on_court", "warmup", "playing"].includes(match.status);

        const round = match.round
          ? (ROUND_LABELS[match.round] ?? match.round)
          : "—";

        return (
          <View key={match.id} style={styles.matchRow}>
            {/* Round pill */}
            <View style={[styles.roundPill, isWinner && styles.roundPillWin, !isWinner && isFinished && styles.roundPillLoss]}>
              <Text style={[styles.roundPillText, isWinner && styles.roundPillTextWin, !isWinner && isFinished && styles.roundPillTextLoss]}>
                {match.round ?? "—"}
              </Text>
            </View>

            {/* Opponent + round label */}
            <View style={styles.matchMeta}>
              <Text style={styles.opponentName} numberOfLines={1}>
                {round}
              </Text>
              <Text style={styles.opponentSub} numberOfLines={1}>
                {isFinished || isLive ? (isWinner ? "vs" : "vs") : "vs"} {opponentName}
              </Text>
            </View>

            {/* Set scores */}
            <View style={styles.matchSets}>
              {isLive && (
                <View style={styles.liveDot} />
              )}
              {(match.sets ?? []).map((set, i) => {
                const myGames = set[playerSide as "1" | "2"].games;
                const oppGames = set[opponentSide as "1" | "2"].games;
                const wonSet = myGames > oppGames;
                return (
                  <View key={i} style={styles.setChip}>
                    <Text style={[styles.setChipText, wonSet && styles.setChipWon]}>
                      {myGames}–{oppGames}
                    </Text>
                  </View>
                );
              })}
              {!isFinished && !isLive && (
                <Text style={styles.scheduledText}>Scheduled</Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

function createStyles(colors: Palette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
    scroll: { padding: spacing.md },
    profile: { alignItems: "center", paddingVertical: spacing.xl },
    photo: { width: 100, height: 100, borderRadius: radius.full, marginBottom: spacing.md },
    photoPlaceholder: {
      width: 100,
      height: 100,
      borderRadius: radius.full,
      backgroundColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.md,
    },
    initials: { ...typography.h2, color: colors.textSecondary },
    name: { ...typography.h2, color: colors.text, textAlign: "center" },
    country: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs },
    followButton: {
      backgroundColor: colors.primary,
      borderRadius: radius.full,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      marginTop: spacing.md,
      minWidth: 120,
      alignItems: "center",
    },
    followingButton: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    followButtonText: { ...typography.label, color: "#fff", fontWeight: "700" },
    followingButtonText: { color: colors.primary },
    signInButton: {
      borderRadius: radius.full,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      marginTop: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    signInButtonText: { ...typography.label, color: colors.textSecondary },
    scoutButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      borderRadius: radius.full,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      marginTop: spacing.sm,
      borderWidth: 1.5,
    },
    scoutButtonText: { ...typography.label, fontWeight: "700" },
    statsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: spacing.md,
      marginTop: spacing.md,
    },
    statBox: {
      backgroundColor: colors.card,
      borderRadius: radius.md,
      padding: spacing.md,
      alignItems: "center",
      minWidth: 110,
      shadowColor: "#000",
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    statValue: { ...typography.h2, color: colors.primary },
    statLabel: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
    empty: { ...typography.body, color: colors.textSecondary },

    // Scorecard (shared)
    scorecard: {
      marginTop: spacing.lg,
      backgroundColor: colors.card,
      borderRadius: radius.md,
      padding: spacing.md,
      shadowColor: "#000",
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    scorecardTitle: {
      ...typography.label,
      color: colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      fontWeight: "700",
      marginBottom: spacing.md,
    },
    // Golf scorecard cards
    scCard: {
      paddingVertical: spacing.md,
    },
    scCardBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    scCardHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    scEventName: {
      ...typography.body,
      color: colors.text,
      fontWeight: "600",
      flex: 1,
    },
    scStatsRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    scStat: {
      flex: 1,
      alignItems: "center",
    },
    scStatValue: {
      ...typography.h3,
      color: colors.text,
      fontWeight: "700",
    },
    scStatLabel: {
      ...typography.caption,
      color: colors.textSecondary,
      marginTop: 2,
    },
    scStatDivider: {
      width: 1,
      height: 32,
      backgroundColor: colors.border,
    },
    badge: {
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: radius.sm,
      backgroundColor: colors.border,
    },
    badgeLive: { backgroundColor: (colors.live ?? colors.primary) + "25" },
    badgeText: { ...typography.caption, color: colors.textSecondary, fontWeight: "700", fontSize: 10 },
    badgeTextLive: { color: colors.live ?? colors.primary },
    // W-L summary
    wlRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.md,
      paddingBottom: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    wlBox: { alignItems: "center", paddingHorizontal: spacing.xl },
    wlDivider: { width: 1, height: 36, backgroundColor: colors.border },
    wlNum: { ...typography.h2, fontWeight: "700" },
    wNum: { color: colors.primary },
    lNum: { color: colors.textSecondary },
    wlLabel: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
    // Match rows
    matchRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      gap: spacing.sm,
    },
    roundPill: {
      width: 36,
      height: 36,
      borderRadius: radius.sm,
      backgroundColor: colors.background,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    roundPillWin: {
      backgroundColor: colors.primary + "20",
      borderColor: colors.primary,
    },
    roundPillLoss: {
      backgroundColor: colors.border,
      borderColor: "transparent",
    },
    roundPillText: {
      ...typography.caption,
      fontWeight: "700",
      color: colors.textSecondary,
      fontSize: 10,
    },
    roundPillTextWin: { color: colors.primary },
    roundPillTextLoss: { color: colors.textSecondary },
    matchMeta: { flex: 1 },
    opponentName: { ...typography.label, color: colors.text, fontWeight: "600" },
    opponentSub: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
    matchSets: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    setChip: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: radius.sm,
      backgroundColor: colors.background,
    },
    setChipText: { ...typography.caption, color: colors.textSecondary, fontWeight: "600" },
    setChipWon: { color: colors.text, fontWeight: "700" },
    scheduledText: { ...typography.caption, color: colors.textSecondary, fontStyle: "italic" },
    liveDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: colors.live ?? colors.primary,
      marginRight: 2,
    },
  });
}
