import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { basketball, hockey, useSport, type BasketballGame, type HockeyGame } from "@juno/api";
import { useTheme, spacing, typography, radius, type Palette } from "@juno/ui";

type Game = BasketballGame | HockeyGame;

function isHockeyGame(game: Game, sport: string): game is HockeyGame {
  return sport === "hockey";
}

function periodLabel(game: Game, sport: string): string {
  if (!game.period) return "";
  const p = game.period;
  if (sport === "hockey") {
    if (p <= 3) return `P${p}`;
    if (p === 4) return "OT";
    return "SO";
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

  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setGame(null);
    const api = activeSport === "hockey" ? hockey : basketball;
    api
      .getGame(id)
      .then(({ data }) => setGame(data as Game))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id, activeSport]);

  // Update header title once game loads
  useEffect(() => {
    if (!game) return;
    const away = game.away_team;
    const home = game.home_team;
    if (away && home) {
      navigation.setOptions({
        title: `${away.abbreviation ?? away.name} @ ${home.abbreviation ?? home.name}`,
      });
    }
  }, [game]);

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

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* League + status */}
        <View style={styles.metaRow}>
          {game.league && (
            <Text style={styles.league}>{game.league.toUpperCase()}</Text>
          )}
          {isLive ? (
            <View style={styles.liveChip}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>
                {periodLabel(game, activeSport)}
                {game.period_time ? ` · ${game.period_time}` : ""}
              </Text>
            </View>
          ) : isFinished ? (
            <Text style={styles.statusText}>Final</Text>
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

        {/* Team records */}
        {(away || home) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Team Records</Text>
            {[away, home].map((team) =>
              team ? (
                <View key={team.id} style={styles.recordRow}>
                  <Text style={styles.recordTeam}>{team.name}</Text>
                  <Text style={styles.recordWL}>
                    {isHockeyGame(game, activeSport)
                      ? `${team.wins}-${team.losses}${(team as any).overtime_losses != null ? `-${(team as any).overtime_losses}` : ""}`
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
    center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
    scroll: { padding: spacing.md },
    empty: { ...typography.body, color: colors.textSecondary },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.md,
    },
    league: { ...typography.caption, color: colors.textSecondary, fontWeight: "700", letterSpacing: 0.5 },
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
  });
}
