import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  Animated,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  basketball,
  hockey,
  football,
  soccer,
  joinBasketballGamesChannel,
  joinHockeyGamesChannel,
  joinSoccerGamesChannel,
  useSport,
  type BasketballGame,
  type HockeyGame,
  type FootballGame,
  type SoccerGame,
} from "@juno/api";
import { Channel } from "phoenix";
import { useTheme, spacing, typography, radius, countryFlag, type Palette } from "@juno/ui";
import { useFollowedTeams } from "../../../context/FollowedTeamsContext";

type Game = BasketballGame | HockeyGame | FootballGame | SoccerGame;

function isHockeyGame(game: Game, sport: string): game is HockeyGame {
  return sport === "hockey";
}

function isFootballGame(game: Game, sport: string): game is FootballGame {
  return sport === "football";
}

function isSoccerGame(game: Game, sport: string): game is SoccerGame {
  return sport === "soccer";
}

function periodLabel(game: Game, sport: string): string {
  if (sport === "soccer") {
    if (game.status_detail === "HT") return "HT";
    if (!game.period) return "";
    const p = game.period;
    if (p === 1) return "1H";
    if (p === 2) return "2H";
    if (p === 3) return "ET1";
    if (p === 4) return "ET2";
    return "PEN";
  }
  if (!game.period) return "";
  const p = game.period;
  if (sport === "hockey") {
    if (p <= 3) return `P${p}`;
    if (p === 4) return "OT";
    return "SO";
  }
  if (sport === "football") {
    if (p <= 4) return `Q${p}`;
    return "OT";
  }
  if (p <= 4) return `Q${p}`;
  const ot = p - 4;
  return ot === 1 ? "OT" : `OT${ot}`;
}

export default function GameScreen() {
  const { id, sport: sportParam } = useLocalSearchParams<{ id: string; sport?: string }>();
  const { activeSport: contextSport } = useSport();
  const activeSport = (sportParam as typeof contextSport | undefined) ?? contextSport;
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation();
  const router = useRouter();
  const { isFollowed, follow, unfollow } = useFollowedTeams();

  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);

  // Goal-flash animation — pop the scorer's number and flash a "GOAL" banner
  // whenever a live soccer score ticks up (driven by the soccer_delta push).
  const prevScores = useRef<{ away: number | null; home: number | null }>({ away: null, home: null });
  const [goalTeam, setGoalTeam] = useState<"home" | "away" | null>(null);
  const awayPulse = useRef(new Animated.Value(1)).current;
  const homePulse = useRef(new Animated.Value(1)).current;
  const bannerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    prevScores.current = { away: null, home: null };
    setGoalTeam(null);
  }, [id]);

  useEffect(() => {
    if (activeSport !== "soccer" || !game) return;
    const prev = prevScores.current;
    prevScores.current = { away: game.away_score, home: game.home_score };

    const scored: "home" | "away" | null =
      game.status === "live" && game.away_score != null && prev.away != null && game.away_score > prev.away
        ? "away"
        : game.status === "live" && game.home_score != null && prev.home != null && game.home_score > prev.home
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
  }, [game?.away_score, game?.home_score, game?.status, activeSport]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setGame(null);
    const api =
      activeSport === "hockey" ? hockey :
      activeSport === "football" ? football :
      activeSport === "soccer" ? soccer :
      basketball;
    api
      .getGame(id)
      .then(({ data }) => setGame(data as Game))
      .catch(() => {})
      .finally(() => setLoading(false));

    if (activeSport === "soccer") {
      const channel: Channel = joinSoccerGamesChannel({
        onState: (games) => {
          const match = games.find((g) => g.id === id);
          if (match) setGame(match as Game);
        },
        onDelta: (games) => {
          const match = games.find((g) => g.id === id);
          if (match) setGame((prev) => (prev ? { ...prev, ...match } : (match as Game)));
        },
      });
      return () => { channel.leave(); };
    }

    if (activeSport === "hockey") {
      const channel: Channel = joinHockeyGamesChannel({
        onState: (games) => {
          const match = games.find((g) => g.id === id);
          if (match) setGame(match as Game);
        },
        onDelta: (games) => {
          const match = games.find((g) => g.id === id);
          if (match) setGame((prev) => (prev ? { ...prev, ...match } : (match as Game)));
        },
      });
      return () => { channel.leave(); };
    }

    if (activeSport === "basketball") {
      const channel = joinBasketballGamesChannel({
        onState: (games) => {
          const match = games.find((g) => g.id === id);
          if (match) setGame(match as Game);
        },
        onDelta: (games) => {
          const match = games.find((g) => g.id === id);
          if (match) setGame((prev) => (prev ? { ...prev, ...match } : (match as Game)));
        },
      });
      return () => { channel.leave(); };
    }
  }, [id, activeSport]);

  // Set header title + back button once game loads
  useEffect(() => {
    const away = game?.away_team;
    const home = game?.home_team;
    // National-team abbreviations are unreliable (often a literal "TBD"
    // placeholder) — prefer the team name for soccer.
    const awayLabel = activeSport === "soccer" ? away?.name : away?.abbreviation ?? away?.name;
    const homeLabel = activeSport === "soccer" ? home?.name : home?.abbreviation ?? home?.name;
    const title = away && home ? `${awayLabel} @ ${homeLabel}` : "Game";
    navigation.setOptions({
      title,
      headerLeft: () => (
        <TouchableOpacity onPress={() => router.back()} style={{ paddingRight: spacing.sm }}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
      ),
      headerRight: () => null,
    });
  }, [game, colors.text, activeSport]);

  if (loading) {
    return (
      <SafeAreaView style={styles.center} edges={["bottom"]}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!game) {
    return (
      <SafeAreaView style={styles.center} edges={["bottom"]}>
        <Text style={styles.empty}>Game not found</Text>
      </SafeAreaView>
    );
  }

  const isLive = game.status === "live";
  const isFinished = game.status === "finished";
  const away = game.away_team;
  const home = game.home_team;
  const awayId = away?.id;
  const homeId = home?.id;
  const awayFollowed = awayId ? isFollowed(activeSport as any, awayId) : false;
  const homeFollowed = homeId ? isFollowed(activeSport as any, homeId) : false;

  // National-team abbreviations are unreliable (often a literal "TBD"
  // placeholder) — fall back to a flag derived from the team/country name.
  const awayFlag = activeSport === "soccer" ? countryFlag(away?.name) : null;
  const homeFlag = activeSport === "soccer" ? countryFlag(home?.name) : null;

  // A penalty shootout is only played after regulation/ET ends level, so
  // away_score/home_score are tied by definition — the actual winner has to
  // be read off the penalty score instead.
  const decidedByPens =
    isFinished &&
    isSoccerGame(game, activeSport) &&
    game.penalty_shootout === true &&
    game.away_score_pen != null &&
    game.home_score_pen != null;
  const awayPenScore = decidedByPens ? (game as SoccerGame).away_score_pen : null;
  const homePenScore = decidedByPens ? (game as SoccerGame).home_score_pen : null;

  const awayWins = decidedByPens
    ? awayPenScore! > homePenScore!
    : isFinished && (game.away_score ?? 0) > (game.home_score ?? 0);
  const homeWins = decidedByPens
    ? homePenScore! > awayPenScore!
    : isFinished && (game.home_score ?? 0) > (game.away_score ?? 0);

  // Build period breakdown
  let periods: { label: string; away: number | null; home: number | null }[];
  if (isSoccerGame(game, activeSport)) {
    periods = [
      { label: "1H", away: game.away_score_h1, home: game.home_score_h1 },
      { label: "2H", away: game.away_score_h2, home: game.home_score_h2 },
    ];
    if (game.home_score_et != null || game.away_score_et != null) {
      periods.push({ label: "ET", away: game.away_score_et, home: game.home_score_et });
    }
    if (game.home_score_pen != null || game.away_score_pen != null) {
      periods.push({ label: "PEN", away: game.away_score_pen, home: game.home_score_pen });
    }
  } else if (isHockeyGame(game, activeSport)) {
    periods = [
      { label: "P1", away: game.away_score_p1, home: game.home_score_p1 },
      { label: "P2", away: game.away_score_p2, home: game.home_score_p2 },
      { label: "P3", away: game.away_score_p3, home: game.home_score_p3 },
    ];
    if (game.home_score_ot != null || game.away_score_ot != null) {
      periods.push({
        label: game.shootout ? "SO" : "OT",
        away: game.away_score_ot,
        home: game.home_score_ot,
      });
    }
  } else if (isFootballGame(game, activeSport)) {
    periods = [
      { label: "Q1", away: game.away_score_q1, home: game.home_score_q1 },
      { label: "Q2", away: game.away_score_q2, home: game.home_score_q2 },
      { label: "Q3", away: game.away_score_q3, home: game.home_score_q3 },
      { label: "Q4", away: game.away_score_q4, home: game.home_score_q4 },
    ];
    if (game.home_score_ot != null || game.away_score_ot != null) {
      periods.push({ label: "OT", away: game.away_score_ot, home: game.home_score_ot });
    }
  } else {
    const g = game as BasketballGame;
    periods = [
      { label: "Q1", away: g.away_score_q1, home: g.home_score_q1 },
      { label: "Q2", away: g.away_score_q2, home: g.home_score_q2 },
      { label: "Q3", away: g.away_score_q3, home: g.home_score_q3 },
      { label: "Q4", away: g.away_score_q4, home: g.home_score_q4 },
    ];
  }

  const hasPeriods = periods.some((p) => p.away != null || p.home != null);

  // Team records
  const homeRecord = home
    ? isHockeyGame(game, activeSport)
      ? `${home.wins}-${(game as HockeyGame).home_team?.overtime_losses != null ? `${(game as HockeyGame).home_team!.overtime_losses}` : (home as any).overtime_losses != null ? (home as any).overtime_losses : home.losses}`
      : `${home.wins}-${home.losses}`
    : null;

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* League + status */}
        <View style={styles.metaRow}>
          {game.league && (
            <Text style={styles.league}>{game.league.toUpperCase()}</Text>
          )}
          {isLive ? (
            game.status_detail === "Halftime" ? (
              <View style={styles.halftimeChip}>
                <Text style={styles.halftimeText}>Halftime</Text>
              </View>
            ) : (
              <View style={styles.liveChip}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>
                  {periodLabel(game, activeSport)}
                  {game.period_time ? ` · ${game.period_time}${activeSport === "soccer" ? "'" : ""}` : ""}
                </Text>
              </View>
            )
          ) : isFinished ? (
            <Text style={styles.statusText}>{game.status_detail ?? "Final"}</Text>
          ) : (
            game.scheduled_at && (
              <Text style={styles.statusText}>
                {new Date(game.scheduled_at).toLocaleString([], {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            )
          )}
        </View>

        {/* Scoreboard */}
        <View style={styles.scoreboard}>
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
                ⚽ GOAL — {goalTeam === "away" ? (away?.name ?? "Away") : (home?.name ?? "Home")}
              </Text>
            </Animated.View>
          )}
          <View style={[styles.teamBlock, awayWins && styles.teamBlockWinner]}>
            {awayFlag && <Text style={styles.teamFlagLarge}>{awayFlag}</Text>}
            <Text style={styles.teamName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
              {(away as any)?.short_name ?? away?.name ?? "TBD"}
            </Text>
            {(away as any)?.short_name && away?.name && (away as any).short_name !== away.name && (
              <Text style={styles.teamFullName} numberOfLines={1}>
                {away.name}
              </Text>
            )}
            {(isLive || isFinished) && game.away_score != null && (
              <Animated.Text style={[styles.score, awayWins && styles.scoreWinner, { transform: [{ scale: awayPulse }] }]}>
                {game.away_score}
                {awayPenScore != null && <Text style={styles.scorePen}> ({awayPenScore})</Text>}
              </Animated.Text>
            )}
            {awayId && (
              <TouchableOpacity
                onPress={() => awayFollowed ? unfollow(activeSport as any, awayId) : follow(activeSport as any, awayId)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.teamFollowBtn}
              >
                <Ionicons
                  name={awayFollowed ? "checkmark-circle" : "add-circle-outline"}
                  size={26}
                  color={colors.primary}
                />
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.vsText}>@</Text>

          <View style={[styles.teamBlock, homeWins && styles.teamBlockWinner]}>
            {homeFlag && <Text style={styles.teamFlagLarge}>{homeFlag}</Text>}
            <Text style={styles.teamName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
              {(home as any)?.short_name ?? home?.name ?? "TBD"}
            </Text>
            {(home as any)?.short_name && home?.name && (home as any).short_name !== home.name && (
              <Text style={styles.teamFullName} numberOfLines={1}>
                {home.name}
              </Text>
            )}
            {(isLive || isFinished) && game.home_score != null && (
              <Animated.Text style={[styles.score, homeWins && styles.scoreWinner, { transform: [{ scale: homePulse }] }]}>
                {game.home_score}
                {homePenScore != null && <Text style={styles.scorePen}> ({homePenScore})</Text>}
              </Animated.Text>
            )}
            {homeId && (
              <TouchableOpacity
                onPress={() => homeFollowed ? unfollow(activeSport as any, homeId) : follow(activeSport as any, homeId)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.teamFollowBtn}
              >
                <Ionicons
                  name={homeFollowed ? "checkmark-circle" : "add-circle-outline"}
                  size={26}
                  color={colors.primary}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Period breakdown */}
        {hasPeriods && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Box Score</Text>
            <View style={styles.quarterTable}>
              <View style={styles.qRow}>
                <Text style={[styles.qCell, styles.qTeamCell, styles.qHead]} />
                {periods.map((p) => (
                  <Text key={p.label} style={[styles.qCell, styles.qHead]}>
                    {p.label}
                  </Text>
                ))}
                <Text style={[styles.qCell, styles.qHead]}>T</Text>
              </View>
              <View style={styles.qRow}>
                <View style={[styles.qCell, styles.qTeamCell, styles.qTeamCellRow]}>
                  {!awayFlag && away?.logo ? (
                    <Image source={{ uri: away.logo }} style={styles.qTeamLogo} cachePolicy="memory-disk" contentFit="contain" />
                  ) : (
                    <Text style={styles.qTeamName} numberOfLines={1}>
                      {awayFlag ?? away?.abbreviation ?? "AWY"}
                    </Text>
                  )}
                </View>
                {periods.map((p, i) => (
                  <Text key={i} style={styles.qCell}>{p.away ?? "-"}</Text>
                ))}
                <Text style={[styles.qCell, styles.qTotal]}>{game.away_score ?? "-"}</Text>
              </View>
              <View style={styles.qRow}>
                <View style={[styles.qCell, styles.qTeamCell, styles.qTeamCellRow]}>
                  {!homeFlag && home?.logo ? (
                    <Image source={{ uri: home.logo }} style={styles.qTeamLogo} cachePolicy="memory-disk" contentFit="contain" />
                  ) : (
                    <Text style={styles.qTeamName} numberOfLines={1}>
                      {homeFlag ?? home?.abbreviation ?? "HME"}
                    </Text>
                  )}
                </View>
                {periods.map((p, i) => (
                  <Text key={i} style={styles.qCell}>{p.home ?? "-"}</Text>
                ))}
                <Text style={[styles.qCell, styles.qTotal]}>{game.home_score ?? "-"}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Series / venue info */}
        {(() => {
          if (isSoccerGame(game, activeSport)) {
            const g = game as SoccerGame;
            const hasInfo = g.round || g.venue_name || g.spectators != null;
            if (!hasInfo) return null;
            return (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Game Info</Text>
                <View style={styles.infoCard}>
                  {g.round && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Round</Text>
                      <Text style={styles.infoValue}>{g.round}</Text>
                    </View>
                  )}
                  {g.venue_name && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Venue</Text>
                      <Text style={styles.infoValue}>
                        {[g.venue_name, g.venue_city].filter(Boolean).join(", ")}
                      </Text>
                    </View>
                  )}
                  {g.spectators != null && (
                    <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                      <Text style={styles.infoLabel}>Attendance</Text>
                      <Text style={styles.infoValue}>{g.spectators.toLocaleString()}</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          }

          if (isHockeyGame(game, activeSport)) {
            const g = game as HockeyGame;
            const hasInfo = g.series_round || g.series_game_num || g.venue_name;
            if (!hasInfo) return null;
            return (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Game Info</Text>
                <View style={styles.infoCard}>
                  {(g.series_round || g.series_game_num) && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Series</Text>
                      <Text style={styles.infoValue}>
                        {[
                          g.series_round,
                          g.series_game_num != null && g.series_best_of != null
                            ? `Game ${g.series_game_num} of ${g.series_best_of}`
                            : g.series_game_num != null
                            ? `Game ${g.series_game_num}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join("  ·  ")}
                      </Text>
                    </View>
                  )}
                  {g.venue_name && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Venue</Text>
                      <Text style={styles.infoValue}>
                        {[g.venue_name, g.venue_city].filter(Boolean).join(", ")}
                      </Text>
                    </View>
                  )}
                  {g.venue_capacity != null && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Capacity</Text>
                      <Text style={styles.infoValue}>{g.venue_capacity.toLocaleString()}</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          }

          if (isFootballGame(game, activeSport)) {
            const awayDiv = (away as any)?.division as string | null | undefined;
            const homeDiv = (home as any)?.division as string | null | undefined;
            if (!awayDiv && !homeDiv) return null;
            return (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Game Info</Text>
                <View style={styles.infoCard}>
                  <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                    <Text style={styles.infoLabel}>Matchup</Text>
                    <Text style={styles.infoValue}>
                      {[awayDiv, homeDiv].filter(Boolean).join(" vs ")}
                    </Text>
                  </View>
                </View>
              </View>
            );
          }

          const g = game as BasketballGame;
          const hasInfo = g.series_round || g.series_game_num || g.venue_name || g.attendance;
          if (!hasInfo) return null;
          return (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Game Info</Text>
              <View style={styles.infoCard}>
                {(g.series_round || g.series_game_num) && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Series</Text>
                    <Text style={styles.infoValue}>
                      {[
                        g.series_round,
                        g.series_game_num != null && g.series_best_of != null
                          ? `Game ${g.series_game_num} of ${g.series_best_of}`
                          : g.series_game_num != null
                          ? `Game ${g.series_game_num}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join("  ·  ")}
                    </Text>
                  </View>
                )}
                {g.venue_name && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Venue</Text>
                    <Text style={styles.infoValue}>{g.venue_name}</Text>
                  </View>
                )}
                {g.attendance != null && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Attendance</Text>
                    <Text style={styles.infoValue}>{g.attendance.toLocaleString()}</Text>
                  </View>
                )}
              </View>
            </View>
          );
        })()}

        {/* Team records — hide if both teams have no standing data */}
        {(away || home) && !!(away?.wins || away?.losses || home?.wins || home?.losses) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Team Records</Text>
            {[away, home].map((team) =>
              team ? (
                <View key={team.id} style={styles.recordRow}>
                  <Text style={styles.recordTeam} numberOfLines={1}>
                    {(team as any).short_name ?? team.name}
                  </Text>
                  <Text style={styles.recordWL}>
                    {isSoccerGame(game, activeSport)
                      ? `${team.wins}-${(team as any).draws}-${team.losses}`
                      : isHockeyGame(game, activeSport)
                      ? `${team.wins}-${team.losses}${(team as any).overtime_losses != null ? `-${(team as any).overtime_losses}` : ""}`
                      : isFootballGame(game, activeSport)
                      ? `${team.wins}-${team.losses}${(team as any).ties != null && (team as any).ties > 0 ? `-${(team as any).ties}` : ""}`
                      : `${team.wins}-${team.losses}`}
                    {team.conference ? `  ·  ${team.conference}` : ""}
                  </Text>
                </View>
              ) : null
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: Palette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.background,
    },
    scroll: { padding: spacing.md },
    empty: { ...typography.body, color: colors.textSecondary },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.md,
    },
    league: {
      ...typography.caption,
      color: colors.textSecondary,
      fontWeight: "700",
      letterSpacing: 0.5,
    },
    liveChip: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#fef2f2",
      borderRadius: radius.full,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      gap: 5,
    },
    liveDot: { width: 6, height: 6, borderRadius: radius.full, backgroundColor: "#ef4444" },
    liveText: { ...typography.caption, color: "#ef4444", fontWeight: "700" },
    halftimeChip: {
      backgroundColor: "#fff7ed",
      borderRadius: radius.full,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
    },
    halftimeText: { ...typography.caption, color: "#f97316", fontWeight: "700" },
    statusText: { ...typography.caption, color: colors.textSecondary },
    scoreboard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      padding: spacing.lg,
      marginBottom: spacing.md,
      position: "relative",
      overflow: "hidden",
    },
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
    teamBlock: { flex: 1, alignItems: "center", gap: 3 },
    teamFollowBtn: { marginTop: 4 },
    teamBlockWinner: {},
    teamFlagLarge: { fontSize: 34, marginBottom: 2 },
    teamName: { ...typography.h2, color: colors.text, fontWeight: "800" },
    teamFullName: { ...typography.caption, color: colors.textSecondary },
    score: { ...typography.h1, color: colors.text, fontWeight: "800", marginTop: spacing.xs },
    scoreWinner: { color: colors.primary },
    scorePen: { ...typography.h3, color: colors.textSecondary, fontWeight: "700" },
    vsText: { ...typography.h3, color: colors.textSecondary, paddingHorizontal: spacing.sm },
    section: { marginTop: spacing.md },
    sectionTitle: {
      ...typography.label,
      color: colors.textSecondary,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: spacing.sm,
    },
    quarterTable: { backgroundColor: colors.card, borderRadius: radius.md, overflow: "hidden" },
    qRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    qCell: { ...typography.label, color: colors.text, flex: 1, textAlign: "center" },
    qTeamCell: { flex: 1.5, textAlign: "left" },
    qTeamCellRow: { flexDirection: "row", alignItems: "center" },
    qTeamLogo: { width: 20, height: 20 },
    qHead: { color: colors.textSecondary, fontWeight: "700" },
    qTeamName: { fontWeight: "600" },
    qTotal: { fontWeight: "800", color: colors.primary },
    recordRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.card,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.xs,
    },
    recordTeam: { ...typography.body, color: colors.text, fontWeight: "600", flex: 1, marginRight: spacing.sm },
    recordWL: { ...typography.label, color: colors.textSecondary, flexShrink: 0 },
    infoCard: {
      backgroundColor: colors.card,
      borderRadius: radius.md,
      overflow: "hidden",
    },
    infoRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    infoLabel: { ...typography.label, color: colors.textSecondary, fontWeight: "600" },
    infoValue: { ...typography.label, color: colors.text, flex: 1, textAlign: "right" },
  });
}
