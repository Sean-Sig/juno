import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import * as Localization from "expo-localization";
import { Ionicons } from "@expo/vector-icons";
import { golf, tennis, basketball, hockey, football, soccer, GolfPlayer, GolfPlayerScore, TennisPlayer, TennisMatch, BasketballPlayer, BasketballPlayerStats, HockeyPlayer, FootballPlayer, SoccerPlayer, useAuth, useSport, type Sport } from "@juno/api";
import { useTheme, spacing, typography, radius, InjuryStatusBadge, type Palette } from "@juno/ui";
import { useFollowedPlayers } from "../../../context/FollowedPlayersContext";
import { useScoutLineup } from "../../../context/ScoutLineupContext";

type Player = GolfPlayer | TennisPlayer | BasketballPlayer | HockeyPlayer | FootballPlayer | SoccerPlayer;

const ROUND_ORDER: Record<string, number> = {
  R128: 0, R64: 1, R32: 2, R16: 3, QF: 4, SF: 5, F: 6,
};

const ROUND_LABELS: Record<string, string> = {
  F: "Final", SF: "Semi-Final", QF: "Quarter-Final",
  R16: "Round of 16", R32: "Round of 32", R64: "Round of 64", R128: "Round of 128",
};

function getDisplayName(player: Player) {
  return `${player.first_name} ${player.last_name}`;
}

function calculateAge(dob: string): number | null {
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const hasNotHadBirthdayThisYear =
    now.getMonth() < birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate());
  if (hasNotHadBirthdayThisYear) age--;
  return age;
}

function formatDob(dob: string): string {
  const date = new Date(dob);
  if (isNaN(date.getTime())) return dob;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/** "us" (feet/inches, lbs) for the US locale region; "metric"/"uk" everywhere else uses cm/kg. */
const usesImperial = Localization.getLocales()[0]?.measurementSystem === "us";

/** Backend sends height in cm. */
function formatHeight(heightCm: string): string {
  const cm = parseFloat(heightCm);
  if (isNaN(cm)) return heightCm;
  if (!usesImperial) return `${Math.round(cm)} cm`;
  const totalInches = Math.round(cm / 2.54);
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return `${feet}'${inches}"`;
}

/** Backend sends weight in kg. */
function formatWeight(weightKg: string): string {
  const kg = parseFloat(weightKg);
  if (isNaN(kg)) return weightKg;
  if (!usesImperial) return `${Math.round(kg)} kg`;
  return `${Math.round(kg * 2.20462)} lbs`;
}

/** Per-game averages are null-safe — a player can have no stats on file yet. */
function formatAvg(value: number | null): string {
  return value != null ? value.toFixed(1) : "—";
}

/** Backend sends shooting splits as 0.0-1.0 decimals. */
function formatPct(value: number | null): string {
  return value != null ? `${(value * 100).toFixed(1)}%` : "—";
}

function getBioStats(player: Player, sport: Sport) {
  if (sport === "golf" || sport === "tennis") return [];
  const p = player as BasketballPlayer | FootballPlayer | SoccerPlayer | HockeyPlayer;
  const age = p.birth_date ? calculateAge(p.birth_date) : null;
  return [
    age != null && { label: "Age", value: `${age}` },
    p.height != null && { label: "Height", value: formatHeight(p.height) },
    p.weight != null && { label: "Weight", value: formatWeight(p.weight) },
  ].filter(Boolean) as { label: string; value: string }[];
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
  } else if (sport === "soccer") {
    const p = player as SoccerPlayer;
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
  const { id, teamId, from, sport: sportParam } = useLocalSearchParams<{ id: string; teamId?: string; from?: string; sport?: string }>();
  const { activeSport: contextSport } = useSport();
  const activeSport = (sportParam as typeof contextSport | undefined) ?? contextSport;
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

  const api =
    activeSport === "golf" ? golf :
    activeSport === "tennis" ? tennis :
    activeSport === "hockey" ? hockey :
    activeSport === "football" ? football :
    activeSport === "soccer" ? soccer :
    basketball;
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
    setGolfScores([]);
    if (activeSport !== "golf" || !id) return;
    golf.getPlayerScores(id)
      .then(({ data }) => setGolfScores(data))
      .catch(() => {});
  }, [id, activeSport]);

  // Fetch this player's matches for the current tournament
  useEffect(() => {
    setTournamentMatches([]);
    setPlayerMap(new Map());
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
  const stats = [...getRankStats(player, activeSport as Sport), ...getBioStats(player, activeSport as Sport)];

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.profile}>
          {player.photo ? (
            <Image source={{ uri: player.photo }} style={styles.photo} cachePolicy="memory-disk" />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Text style={styles.initials}>
                {player.first_name[0]}{player.last_name[0]}
              </Text>
            </View>
          )}
          <Text style={styles.name}>{displayName}</Text>
          {player.country && <Text style={styles.country}>{player.country}</Text>}
          {activeSport === "basketball" && (player as BasketballPlayer).injury && (
            <View style={styles.injuryBadgeRow}>
              <InjuryStatusBadge status={(player as BasketballPlayer).injury!.status} />
            </View>
          )}

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

          {/* Add to Scout — hidden until launch
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
          */}
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

        {activeSport === "basketball" && (player as BasketballPlayer).injury && (
          <InjuryReportCard injury={(player as BasketballPlayer).injury!} />
        )}

        {activeSport === "basketball" && (
          <BasketballSeasonStats
            stats={(player as BasketballPlayer).stats}
            history={(player as BasketballPlayer & { stats_history?: BasketballPlayerStats[] }).stats_history ?? []}
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
          ? `${opponent.first_name} ${opponent.last_name}`
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
// Basketball Injury Report
// ---------------------------------------------------------------------------

function InjuryReportCard({ injury }: { injury: NonNullable<BasketballPlayer["injury"]> }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const detailParts = [injury.injury_type, injury.side, injury.detail].filter(Boolean);

  return (
    <View style={styles.scorecard}>
      <View style={styles.bbHeaderRow}>
        <Text style={styles.scorecardTitle}>Injury Report</Text>
        <InjuryStatusBadge status={injury.status} />
      </View>
      {detailParts.length > 0 && (
        <Text style={styles.injuryDetailText}>{detailParts.join(" · ")}</Text>
      )}
      {injury.return_date && (
        <Text style={styles.injuryReturnText}>Est. return: {injury.return_date}</Text>
      )}
      {injury.short_comment && (
        <Text style={styles.injuryCommentText}>{injury.short_comment}</Text>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Basketball Season Stats
// ---------------------------------------------------------------------------

function BasketballSeasonStats({
  stats,
  history,
}: {
  stats: BasketballPlayerStats | null;
  history: BasketballPlayerStats[];
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.scorecard}>
      <View style={styles.bbHeaderRow}>
        <Text style={styles.scorecardTitle}>Season Stats</Text>
        {stats && (
          <Text style={styles.bbSeasonMeta}>
            {stats.season}{stats.team_abbr ? ` · ${stats.team_abbr}` : ""}
          </Text>
        )}
      </View>

      {!stats ? (
        <Text style={styles.bbEmpty}>No stats on file for the current season yet.</Text>
      ) : (
        <>
          {/* Headline per-game averages */}
          <View style={styles.scStatsRow}>
            <View style={styles.scStat}>
              <Text style={styles.statValue}>{formatAvg(stats.pts_per_g)}</Text>
              <Text style={styles.scStatLabel}>PTS</Text>
            </View>
            <View style={styles.scStatDivider} />
            <View style={styles.scStat}>
              <Text style={styles.statValue}>{formatAvg(stats.trb_per_g)}</Text>
              <Text style={styles.scStatLabel}>REB</Text>
            </View>
            <View style={styles.scStatDivider} />
            <View style={styles.scStat}>
              <Text style={styles.statValue}>{formatAvg(stats.ast_per_g)}</Text>
              <Text style={styles.scStatLabel}>AST</Text>
            </View>
          </View>

          {/* Secondary counting stats */}
          <View style={[styles.scStatsRow, styles.bbSecondaryRow]}>
            <View style={styles.scStat}>
              <Text style={styles.bbSecondaryValue}>{formatAvg(stats.mp_per_g)}</Text>
              <Text style={styles.scStatLabel}>MIN</Text>
            </View>
            <View style={styles.scStatDivider} />
            <View style={styles.scStat}>
              <Text style={styles.bbSecondaryValue}>{formatAvg(stats.stl_per_g)}</Text>
              <Text style={styles.scStatLabel}>STL</Text>
            </View>
            <View style={styles.scStatDivider} />
            <View style={styles.scStat}>
              <Text style={styles.bbSecondaryValue}>{formatAvg(stats.blk_per_g)}</Text>
              <Text style={styles.scStatLabel}>BLK</Text>
            </View>
            <View style={styles.scStatDivider} />
            <View style={styles.scStat}>
              <Text style={styles.bbSecondaryValue}>{stats.games ?? "—"}</Text>
              <Text style={styles.scStatLabel}>GP</Text>
            </View>
          </View>

          {/* Shooting splits */}
          <View style={[styles.scStatsRow, styles.bbSecondaryRow]}>
            <View style={styles.scStat}>
              <Text style={styles.bbSecondaryValue}>{formatPct(stats.fg_pct)}</Text>
              <Text style={styles.scStatLabel}>FG%</Text>
            </View>
            <View style={styles.scStatDivider} />
            <View style={styles.scStat}>
              <Text style={styles.bbSecondaryValue}>{formatPct(stats.fg3_pct)}</Text>
              <Text style={styles.scStatLabel}>3P%</Text>
            </View>
            <View style={styles.scStatDivider} />
            <View style={styles.scStat}>
              <Text style={styles.bbSecondaryValue}>{formatPct(stats.ft_pct)}</Text>
              <Text style={styles.scStatLabel}>FT%</Text>
            </View>
          </View>
        </>
      )}

      {history.length > 0 && (
        <View style={styles.bbHistory}>
          <View style={styles.bbHistoryRow}>
            <Text style={[styles.bbHistoryCell, styles.bbHistorySeasonCell, styles.bbHistoryHeaderText]}>SEASON</Text>
            <Text style={[styles.bbHistoryCell, styles.bbHistoryHeaderText]}>TEAM</Text>
            <Text style={[styles.bbHistoryCell, styles.bbHistoryHeaderText]}>GP</Text>
            <Text style={[styles.bbHistoryCell, styles.bbHistoryHeaderText]}>PTS</Text>
            <Text style={[styles.bbHistoryCell, styles.bbHistoryHeaderText]}>REB</Text>
            <Text style={[styles.bbHistoryCell, styles.bbHistoryHeaderText]}>AST</Text>
            <Text style={[styles.bbHistoryCell, styles.bbHistoryHeaderText]}>FG%</Text>
          </View>
          {history.map((season, i) => (
            <View key={`${season.season}-${i}`} style={[styles.bbHistoryRow, i % 2 === 1 && styles.bbHistoryRowAlt]}>
              <Text style={[styles.bbHistoryCell, styles.bbHistorySeasonCell]}>{season.season}</Text>
              <Text style={styles.bbHistoryCell}>{season.team_abbr ?? "—"}</Text>
              <Text style={styles.bbHistoryCell}>{season.games ?? "—"}</Text>
              <Text style={styles.bbHistoryCell}>{formatAvg(season.pts_per_g)}</Text>
              <Text style={styles.bbHistoryCell}>{formatAvg(season.trb_per_g)}</Text>
              <Text style={styles.bbHistoryCell}>{formatAvg(season.ast_per_g)}</Text>
              <Text style={styles.bbHistoryCell}>{formatPct(season.fg_pct)}</Text>
            </View>
          ))}
        </View>
      )}
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
    injuryBadgeRow: { marginTop: spacing.sm },
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
    // Basketball season stats
    bbHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.md,
    },
    bbSeasonMeta: { ...typography.caption, color: colors.textSecondary, fontWeight: "600" },
    bbEmpty: { ...typography.body, color: colors.textSecondary },
    injuryDetailText: { ...typography.label, color: colors.text, fontWeight: "600", marginBottom: spacing.xs },
    injuryReturnText: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.xs },
    injuryCommentText: { ...typography.body, color: colors.textSecondary },
    bbSecondaryRow: { marginTop: spacing.md },
    bbSecondaryValue: { ...typography.h3, color: colors.text, fontWeight: "700" },
    bbHistory: {
      marginTop: spacing.lg,
      paddingTop: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    bbHistoryRow: {
      flexDirection: "row",
      paddingVertical: spacing.xs,
    },
    bbHistoryRowAlt: {
      backgroundColor: colors.background,
    },
    bbHistoryCell: {
      ...typography.caption,
      color: colors.text,
      flex: 1,
      textAlign: "center",
    },
    bbHistorySeasonCell: {
      flex: 1.3,
      textAlign: "left",
    },
    bbHistoryHeaderText: {
      color: colors.textSecondary,
      fontWeight: "700",
    },
  });
}
