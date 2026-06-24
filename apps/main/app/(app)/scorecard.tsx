import React, { useMemo, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { GolfRoundDetail, GolfCourse } from "@juno/api";
import { useTheme, spacing, typography, radius, type Palette } from "@juno/ui";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROUND_KEYS = ["round_1", "round_2", "round_3", "round_4", "round_5"];
const ROUND_LABELS: Record<string, string> = {
  round_1: "Round 1",
  round_2: "Round 2",
  round_3: "Round 3",
  round_4: "Round 4",
  round_5: "Round 5",
};
const ROUND_SHORT: Record<string, string> = {
  round_1: "R1", round_2: "R2", round_3: "R3", round_4: "R4", round_5: "R5",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPar(par: number): string {
  if (par === 0) return "E";
  return par > 0 ? `+${par}` : `${par}`;
}

function parColor(par: number, colors: Palette): string {
  if (par < 0) return colors.primary;
  if (par > 0) return colors.error ?? "#ef4444";
  return colors.textSecondary;
}

function hasHoleData(detail: GolfRoundDetail | undefined): boolean {
  return !!(
    (detail?.scores && Object.keys(detail.scores).length > 0) ||
    (detail?.to_pars && Object.keys(detail.to_pars).length > 0)
  );
}

function holeScoreColors(toPar: number | null, colors: Palette) {
  if (toPar == null)  return { bg: "transparent", border: colors.border, text: colors.text };
  if (toPar <= -2)    return { bg: "#EAB308",      border: "#EAB308",      text: "#fff" }; // eagle – gold
  if (toPar === -1)   return { bg: colors.primary, border: colors.primary, text: "#fff" }; // birdie – green
  if (toPar === 0)    return { bg: "transparent",  border: colors.border,  text: colors.text }; // par
  if (toPar === 1)    return { bg: "transparent",  border: colors.error ?? "#ef4444", text: colors.error ?? "#ef4444" }; // bogey
  return               { bg: colors.error ?? "#ef4444", border: colors.error ?? "#ef4444", text: "#fff" }; // double+
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function ScorecardScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation();
  const router = useRouter();

  const {
    playerName,
    tournamentName,
    details: detailsJson,
    totalPar,
    totalStrokes,
    displayPlace,
    courses: coursesJson,
  } = useLocalSearchParams<{
    playerName: string;
    tournamentName: string;
    details: string;
    totalPar: string;
    totalStrokes: string;
    displayPlace: string;
    courses: string;
  }>();

  const details = useMemo<Record<string, GolfRoundDetail>>(() => {
    try { return JSON.parse(detailsJson ?? "{}"); } catch { return {}; }
  }, [detailsJson]);

  const courses = useMemo<GolfCourse[]>(() => {
    try { return JSON.parse(coursesJson ?? "[]"); } catch { return []; }
  }, [coursesJson]);

  // Rounds that have actual stroke data, in order
  const rounds = ROUND_KEYS
    .map((key) => ({ key, detail: details[key] }))
    .filter(({ detail }) => detail?.strokes != null && detail.strokes > 0);

  // Course par from the primary course (fall back to 72)
  const primaryCourse = courses.find((c) => c.primary_course) ?? courses[0];
  const coursePar = primaryCourse?.total_par ?? 72;

  // Which round's hole-by-hole grid to show — defaults to the most recent round with hole data
  const roundsWithHoles = rounds.filter(({ detail }) => hasHoleData(detail));
  const [selectedRoundKey, setSelectedRoundKey] = useState<string | null>(null);
  const displayRoundKey = selectedRoundKey ?? roundsWithHoles[roundsWithHoles.length - 1]?.key ?? null;
  const displayDetail = displayRoundKey ? details[displayRoundKey] : null;

  useEffect(() => {
    navigation.setOptions({
      title: playerName ?? "Scorecard",
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => router.navigate("/(app)/tournaments")}
          style={{ paddingRight: spacing.sm }}
        >
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
      ),
      headerRight: () => null,
    });
  }, [playerName, colors.text]);

  const parInt = parseInt(String(totalPar), 10);
  const strokesInt = parseInt(String(totalStrokes), 10);

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* ── Player / tournament header ───────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.playerName}>{playerName}</Text>
            <Text style={styles.tournamentName}>{tournamentName}</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={[styles.totalPar, { color: parColor(parInt, colors) }]}>
              {formatPar(parInt)}
            </Text>
            {displayPlace ? (
              <Text style={styles.totalPlace}>{displayPlace}</Text>
            ) : null}
          </View>
        </View>

        {/* ── Course info ──────────────────────────────────────────────── */}
        {primaryCourse && (
          <View style={styles.courseBar}>
            <Text style={styles.courseText}>
              {primaryCourse.name}
              {primaryCourse.city ? ` · ${primaryCourse.city}` : ""}
            </Text>
            <Text style={styles.courseText}>Par {coursePar}</Text>
          </View>
        )}

        {rounds.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.empty}>No round data available</Text>
          </View>
        ) : (
          <>
            {/* ── Round-by-round table ─────────────────────────────────── */}
            <View style={styles.table}>

              {/* Header row */}
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.th, styles.colRound]}>Round</Text>
                <Text style={[styles.th, styles.colStrokes]}>Strokes</Text>
                <Text style={[styles.th, styles.colPar]}>To Par</Text>
                <Text style={[styles.th, styles.colRunning]}>Running</Text>
              </View>

              {/* Round rows */}
              {(() => {
                let running = 0;
                return rounds.map(({ key, detail }, i) => {
                  const strokes = detail.strokes ?? 0;
                  const roundPar = strokes - coursePar;
                  running += roundPar;
                  const isLast = i === rounds.length - 1;
                  const status = detail.thru === "F"
                    ? null
                    : detail.thru
                    ? `Thru ${detail.thru}`
                    : null;

                  const tappable = hasHoleData(detail);
                  const isActive = tappable && displayRoundKey === key;

                  return (
                    <TouchableOpacity
                      key={key}
                      disabled={!tappable}
                      activeOpacity={0.7}
                      onPress={() => setSelectedRoundKey(isActive ? null : key)}
                      style={[
                        styles.tableRow,
                        isLast && styles.tableRowLast,
                        isActive && styles.tableRowActive,
                      ]}
                    >
                      <View style={[styles.colRound, { flexDirection: "row", alignItems: "center", gap: 6 }]}>
                        <Text style={styles.roundLabel}>{ROUND_LABELS[key] ?? key}</Text>
                        {status && (
                          <View style={styles.thruBadge}>
                            <Text style={styles.thruText}>{status}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.td, styles.colStrokes]}>{strokes}</Text>
                      <Text style={[styles.td, styles.colPar, { color: parColor(roundPar, colors) }]}>
                        {formatPar(roundPar)}
                      </Text>
                      <Text style={[styles.td, styles.colRunning, { color: parColor(running, colors) }]}>
                        {formatPar(running)}
                      </Text>
                    </TouchableOpacity>
                  );
                });
              })()}

              {/* Total row */}
              {rounds.length > 1 && (
                <View style={styles.totalRow}>
                  <Text style={[styles.totalLabel, styles.colRound]}>Total</Text>
                  <Text style={[styles.totalValue, styles.colStrokes]}>{strokesInt || "—"}</Text>
                  <Text style={[styles.totalValue, styles.colPar, { color: parColor(parInt, colors) }]}>
                    {formatPar(parInt)}
                  </Text>
                  <View style={styles.colRunning} />
                </View>
              )}
            </View>

            {/* ── Hole-by-hole grid for the selected round ─────────────── */}
            {displayDetail && hasHoleData(displayDetail) && (
              <HoleGrid detail={displayDetail} colors={colors} styles={styles} />
            )}

            {/* ── Round breakdown bars ─────────────────────────────────── */}
            <RoundBars rounds={rounds} coursePar={coursePar} colors={colors} styles={styles} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Hole-by-hole grid — shown below the round table for the selected round
// ---------------------------------------------------------------------------

const HOLE_TOTAL_COL = 36;

function HoleGrid({
  detail,
  colors,
  styles,
}: {
  detail: GolfRoundDetail;
  colors: Palette;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.holeGrid}>
      <HoleHalf holes={[1, 2, 3, 4, 5, 6, 7, 8, 9]} label="OUT" detail={detail} colors={colors} />
      <View style={styles.holeGridDivider} />
      <HoleHalf holes={[10, 11, 12, 13, 14, 15, 16, 17, 18]} label="IN" detail={detail} colors={colors} />
    </View>
  );
}

function HoleHalf({
  holes,
  label,
  detail,
  colors,
}: {
  holes: number[];
  label: string;
  detail: GolfRoundDetail;
  colors: Palette;
}) {
  const played = holes.filter((h) => detail.scores?.[String(h)] != null);
  const totalStrokes = played.reduce((s, h) => s + (detail.scores![String(h)] ?? 0), 0);
  const totalPar = played.reduce((s, h) => s + (detail.course_pars?.[String(h)] ?? 0), 0);
  const halfToPar = played.length > 0 ? totalStrokes - totalPar : null;

  const headerStyle: object = { fontSize: 10, fontWeight: "700" as const, color: colors.textSecondary, textAlign: "center" as const, flex: 1 };
  const parStyle: object = { fontSize: 10, color: colors.textSecondary, textAlign: "center" as const, flex: 1, marginTop: 2 };

  return (
    <View>
      {/* Row 1: hole numbers */}
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {holes.map((h) => (
          <Text key={h} style={headerStyle}>{h}</Text>
        ))}
        <Text style={{ ...headerStyle, flex: 0, width: HOLE_TOTAL_COL }}>{label}</Text>
      </View>

      {/* Row 2: par */}
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {holes.map((h) => (
          <Text key={h} style={parStyle}>{detail.course_pars?.[String(h)] ?? "—"}</Text>
        ))}
        <Text style={{ ...parStyle, flex: 0, width: HOLE_TOTAL_COL, fontWeight: "600" as const }}>
          {totalPar || "—"}
        </Text>
      </View>

      {/* Row 3: player scores */}
      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
        {holes.map((h) => {
          const strokes = detail.scores?.[String(h)] ?? null;
          const toPar = detail.to_pars?.[String(h)] ?? null;
          const { bg, border, text } = holeScoreColors(strokes != null ? toPar : null, colors);
          const isCircle = toPar != null && toPar <= 0;
          return (
            <View key={h} style={{ flex: 1, alignItems: "center" }}>
              {strokes != null ? (
                <View style={{
                  width: 22, height: 22,
                  borderRadius: isCircle ? 11 : 3,
                  backgroundColor: bg,
                  borderWidth: 1.5,
                  borderColor: border,
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: text }}>{strokes}</Text>
                </View>
              ) : (
                <Text style={{ fontSize: 11, color: colors.border }}>·</Text>
              )}
            </View>
          );
        })}
        {/* Half total */}
        <View style={{ flex: 0, width: HOLE_TOTAL_COL, alignItems: "center" }}>
          {played.length > 0 && (
            <Text style={{
              fontSize: 13, fontWeight: "700",
              color: halfToPar != null && halfToPar < 0 ? colors.primary
                   : halfToPar != null && halfToPar > 0 ? (colors.error ?? "#ef4444")
                   : colors.text,
            }}>
              {totalStrokes}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Visual round bars — shows each round as a horizontal bar proportional to score
// ---------------------------------------------------------------------------

function RoundBars({
  rounds,
  coursePar,
  colors,
  styles,
}: {
  rounds: { key: string; detail: GolfRoundDetail }[];
  coursePar: number;
  colors: Palette;
  styles: ReturnType<typeof createStyles>;
}) {
  if (rounds.length < 2) return null;

  const strokes = rounds.map((r) => r.detail.strokes ?? 0).filter((s) => s > 0);
  const min = Math.min(...strokes);
  const max = Math.max(...strokes);
  const range = max - min || 1;

  return (
    <View style={styles.barsSection}>
      <Text style={styles.barsSectionTitle}>Round Comparison</Text>
      {rounds.map(({ key, detail }) => {
        const s = detail.strokes ?? 0;
        if (s === 0) return null;
        const roundPar = s - coursePar;
        const fill = 0.3 + ((s - min) / range) * 0.7; // 30%–100% width

        return (
          <View key={key} style={styles.barRow}>
            <Text style={styles.barLabel}>{ROUND_SHORT[key] ?? key}</Text>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  {
                    flex: fill,
                    backgroundColor:
                      roundPar < 0
                        ? colors.primary
                        : roundPar > 0
                        ? (colors.error ?? "#ef4444")
                        : colors.border,
                  },
                ]}
              />
              <View style={{ flex: 1 - fill }} />
            </View>
            <Text style={[styles.barStrokes, { color: parColor(roundPar, colors) }]}>
              {s}  <Text style={styles.barPar}>({formatPar(roundPar)})</Text>
            </Text>
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
    scroll: { paddingBottom: spacing.xl },
    center: { paddingTop: spacing.xl, alignItems: "center" },
    empty: { ...typography.body, color: colors.textSecondary },

    // Header
    header: {
      flexDirection: "row",
      alignItems: "center",
      padding: spacing.md,
      backgroundColor: colors.card,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    headerLeft: { flex: 1 },
    playerName: { ...typography.h3, color: colors.text, fontWeight: "700" },
    tournamentName: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
    headerRight: { alignItems: "flex-end" },
    totalPar: { ...typography.h2, fontWeight: "700" },
    totalPlace: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },

    // Course bar
    courseBar: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    courseText: { ...typography.caption, color: colors.textSecondary },

    // Table
    table: {
      margin: spacing.md,
      backgroundColor: colors.card,
      borderRadius: radius.md,
      overflow: "hidden",
      shadowColor: "#000",
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    tableHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      backgroundColor: colors.background,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    th: {
      ...typography.caption,
      color: colors.textSecondary,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    tableRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    tableRowLast: {
      borderBottomWidth: 0,
    },
    tableRowActive: {
      backgroundColor: colors.primary + "10",
    },
    roundLabel: { ...typography.body, color: colors.text, fontWeight: "600" },
    thruBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      backgroundColor: (colors.live ?? colors.primary) + "25",
      borderRadius: radius.sm,
    },
    thruText: {
      ...typography.caption,
      color: colors.live ?? colors.primary,
      fontWeight: "700",
      fontSize: 10,
    },
    td: { ...typography.body, color: colors.text, fontWeight: "600" },
    totalRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
    },
    totalLabel: { ...typography.label, color: colors.textSecondary, fontWeight: "700", textTransform: "uppercase" },
    totalValue: { ...typography.h3, fontWeight: "700", color: colors.text },

    // Column widths
    colRound: { flex: 1 },
    colStrokes: { width: 64, textAlign: "right" },
    colPar: { width: 64, textAlign: "right" },
    colRunning: { width: 72, textAlign: "right" },

    // Hole-by-hole grid
    holeGrid: {
      marginHorizontal: spacing.md,
      marginTop: spacing.xs,
      backgroundColor: colors.card,
      borderRadius: radius.md,
      padding: spacing.md,
      shadowColor: "#000",
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    holeGridDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginVertical: spacing.xs,
    },

    // Round bars
    barsSection: {
      marginHorizontal: spacing.md,
      marginTop: spacing.xs,
      backgroundColor: colors.card,
      borderRadius: radius.md,
      padding: spacing.md,
      shadowColor: "#000",
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    barsSectionTitle: {
      ...typography.label,
      color: colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      fontWeight: "700",
      marginBottom: spacing.md,
    },
    barRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: spacing.sm,
      gap: spacing.sm,
    },
    barLabel: { ...typography.label, color: colors.textSecondary, width: 24, fontWeight: "700" },
    barTrack: {
      flex: 1,
      height: 10,
      flexDirection: "row",
      borderRadius: radius.full,
      overflow: "hidden",
      backgroundColor: colors.border,
    },
    barFill: { borderRadius: radius.full },
    barStrokes: { ...typography.label, fontWeight: "700", width: 80, textAlign: "right" },
    barPar: { ...typography.caption, color: colors.textSecondary, fontWeight: "400" },
  });
}
