import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { basketball, hockey, football, joinBasketballGamesChannel, joinHockeyGamesChannel, useSport, type BasketballGame, type HockeyGame, type FootballGame } from "@juno/api";
import { Channel } from "phoenix";
import { useTheme, spacing, typography, radius, type Palette } from "@juno/ui";

type Game = BasketballGame | HockeyGame | FootballGame;

function isHockeyGame(game: Game, sport: string): game is HockeyGame {
  return sport === "hockey";
}

function isFootballGame(game: Game, sport: string): game is FootballGame {
  return sport === "football";
}

function periodLabel(game: Game, sport: string): string {
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
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activeSport } = useSport();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation();
  const router = useRouter();

  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setGame(null);
    const api = activeSport === "hockey" ? hockey : activeSport === "football" ? football : basketball;
    api
      .getGame(id)
      .then(({ data }) => setGame(data as Game))
      .catch(() => {})
      .finally(() => setLoading(false));

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
    const title =
      away && home
        ? `${away.abbreviation ?? away.name} @ ${home.abbreviation ?? home.name}`
        : "Game";
    navigation.setOptions({
      title,
      headerLeft: () => (
        <TouchableOpacity onPress={() => router.back()} style={{ paddingRight: spacing.sm }}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
      ),
      headerRight: () => null,
    });
  }, [game, colors.text]);

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

  const awayWins = isFinished && (game.away_score ?? 0) > (game.home_score ?? 0);
  const homeWins = isFinished && (game.home_score ?? 0) > (game.away_score ?? 0);

  // Build period breakdown
  let periods: { label: string; away: number | null; home: number | null }[];
  if (isHockeyGame(game, activeSport)) {
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
                  {game.period_time ? ` · ${game.period_time}` : ""}
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
          <View style={[styles.teamBlock, awayWins && styles.teamBlockWinner]}>
            <Text style={styles.teamAbbrev} numberOfLines={1}>
              {away?.abbreviation ?? away?.name ?? "TBD"}
            </Text>
            <Text style={styles.teamFullName} numberOfLines={1}>
              {away?.name ?? "Away"}
            </Text>
            {(isLive || isFinished) && game.away_score != null && (
              <Text style={[styles.score, awayWins && styles.scoreWinner]}>
                {game.away_score}
              </Text>
            )}
          </View>

          <Text style={styles.vsText}>@</Text>

          <View style={[styles.teamBlock, homeWins && styles.teamBlockWinner]}>
            <Text style={styles.teamAbbrev} numberOfLines={1}>
              {home?.abbreviation ?? home?.name ?? "TBD"}
            </Text>
            <Text style={styles.teamFullName} numberOfLines={1}>
              {home?.name ?? "Home"}
            </Text>
            {(isLive || isFinished) && game.home_score != null && (
              <Text style={[styles.score, homeWins && styles.scoreWinner]}>
                {game.home_score}
              </Text>
            )}
          </View>
        </View>

        {/* Timeouts — basketball only, live games only */}
        {isLive && activeSport === "basketball" && (() => {
          const g = game as BasketballGame;
          const showTimeouts =
            g.home_timeouts_remaining != null || g.away_timeouts_remaining != null;
          if (!showTimeouts) return null;

          const dot = (filled: boolean) => (
            <View
              key={Math.random()}
              style={[styles.timeoutDot, filled ? styles.timeoutDotFull : styles.timeoutDotEmpty]}
            />
          );

          const renderDots = (remaining: number | null) => {
            const total = 7; // NBA: 7 full-game timeouts (2 mandatory + remaining)
            const used = total - (remaining ?? total);
            return Array.from({ length: total }, (_, i) => dot(i >= used));
          };

          return (
            <View style={styles.timeoutRow}>
              <View style={styles.timeoutTeam}>
                <Text style={styles.timeoutLabel}>{away?.abbreviation ?? "AWY"}</Text>
                <View style={styles.timeoutDots}>
                  {renderDots(g.away_timeouts_remaining)}
                </View>
              </View>
              <Text style={styles.timeoutTitle}>Timeouts</Text>
              <View style={[styles.timeoutTeam, styles.timeoutTeamRight]}>
                <View style={styles.timeoutDots}>
                  {renderDots(g.home_timeouts_remaining)}
                </View>
                <Text style={styles.timeoutLabel}>{home?.abbreviation ?? "HME"}</Text>
              </View>
            </View>
          );
        })()}

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
                <Text style={[styles.qCell, styles.qTeamCell, styles.qTeamName]} numberOfLines={1}>
                  {away?.abbreviation ?? "AWY"}
                </Text>
                {periods.map((p, i) => (
                  <Text key={i} style={styles.qCell}>{p.away ?? "-"}</Text>
                ))}
                <Text style={[styles.qCell, styles.qTotal]}>{game.away_score ?? "-"}</Text>
              </View>
              <View style={styles.qRow}>
                <Text style={[styles.qCell, styles.qTeamCell, styles.qTeamName]} numberOfLines={1}>
                  {home?.abbreviation ?? "HME"}
                </Text>
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

          if (isFootballGame(game, activeSport)) return null;

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
                  <Text style={styles.recordTeam}>{team.name}</Text>
                  <Text style={styles.recordWL}>
                    {isHockeyGame(game, activeSport)
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
    },
    teamBlock: { flex: 1, alignItems: "center", gap: 4 },
    teamBlockWinner: {},
    teamAbbrev: { ...typography.h2, color: colors.text, fontWeight: "800" },
    teamFullName: { ...typography.caption, color: colors.textSecondary },
    score: { ...typography.h1, color: colors.text, fontWeight: "800", marginTop: spacing.xs },
    scoreWinner: { color: colors.primary },
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
    recordTeam: { ...typography.body, color: colors.text, fontWeight: "600" },
    recordWL: { ...typography.label, color: colors.textSecondary },
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
    timeoutRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.card,
      borderRadius: radius.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      marginBottom: spacing.md,
    },
    timeoutTeam: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
    timeoutTeamRight: { justifyContent: "flex-end" },
    timeoutLabel: { ...typography.label, color: colors.text, fontWeight: "700", minWidth: 32 },
    timeoutTitle: {
      ...typography.caption,
      color: colors.textSecondary,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 0.4,
      textAlign: "center",
    },
    timeoutDots: { flexDirection: "row", gap: 3 },
    timeoutDot: { width: 8, height: 8, borderRadius: 4 },
    timeoutDotFull: { backgroundColor: colors.primary },
    timeoutDotEmpty: { backgroundColor: colors.border },
  });
}
