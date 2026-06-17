import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Image,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useNavigation, usePathname, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { tennis, useAuth, type H2HResponse, type MatchAnalysis } from "@juno/api";
import { useScoutCredits } from "../../../../context/ScoutCreditsContext";
import { useTheme, spacing, typography, radius, countryFlag, type Palette } from "@juno/ui";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "";
  return ((parts[0][0] ?? "") + (parts[parts.length - 1][0] ?? "")).toUpperCase();
}

function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0][0]?.toUpperCase() ?? ""}. ${parts[parts.length - 1]}`;
}

function tierLabel(tier: string | null | undefined): string | null {
  if (!tier) return null;
  const map: Record<string, string> = {
    grand_slam:    "Grand Slam",
    masters_1000:  "Masters 1000",
    atp_500:       "ATP 500",
    atp_250:       "ATP 250",
    wta_1000:      "WTA 1000",
    wta_500:       "WTA 500",
    wta_250:       "WTA 250",
    itf_davis_cup: "Davis Cup",
    major:         "Major",
    pga_tour:      "PGA Tour",
    liv_golf:      "LIV Golf",
  };
  return map[tier] ?? tier.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function surfaceColor(surface: string | null | undefined): string {
  switch (surface?.toLowerCase()) {
    case "clay":   return "#C17A3A";
    case "grass":  return "#3A8C4A";
    case "hard":   return "#3A6FC1";
    case "carpet": return "#7C5CBF";
    default:       return "#888888";
  }
}


// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function DoublesTeamCol({ p1, p2 }: { p1: { name: string; photo?: string | null; country?: string | null }; p2: { name: string; photo?: string | null; country?: string | null } | null }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      {/* Two small photos side by side */}
      <View style={{ flexDirection: "row", marginBottom: spacing.xs }}>
        {[p1, p2].map((p, i) => (
          p ? (
            <View key={i} style={{ position: "relative", marginHorizontal: 2 }}>
              {p.photo ? (
                <Image source={{ uri: p.photo }} style={{ width: 48, height: 48, borderRadius: 24 }} />
              ) : (
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.card, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: colors.textSecondary }}>
                    {initials(p.name)}
                  </Text>
                </View>
              )}
              {countryFlag(p.country) ? (
                <View style={{ position: "absolute", right: -2, bottom: -2, backgroundColor: colors.card, borderRadius: 5, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 1, paddingVertical: 1 }}>
                  <Text style={{ fontSize: 11, lineHeight: 13 }}>{countryFlag(p.country)}</Text>
                </View>
              ) : null}
            </View>
          ) : null
        ))}
      </View>
      {/* Names stacked */}
      <Text style={{ ...typography.label, color: colors.text, fontWeight: "700", textAlign: "center", fontSize: 12 }} numberOfLines={1}>
        {p1.name.split(" ").pop()}
      </Text>
      {p2 ? (
        <Text style={{ ...typography.caption, color: colors.textSecondary, textAlign: "center", marginTop: 1 }} numberOfLines={1}>
          {p2.name.split(" ").pop()}
        </Text>
      ) : null}
    </View>
  );
}

function FormDot({ result }: { result: "W" | "L" }) {
  const { colors } = useTheme();
  const isWin = result === "W";
  return (
    <View style={{
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: isWin ? "#22c55e" : colors.surface,
      borderWidth: 1,
      borderColor: isWin ? "#22c55e" : colors.divider,
      alignItems: "center",
      justifyContent: "center",
    }}>
      <Text style={{
        fontSize: 11,
        fontWeight: "700",
        color: isWin ? "#fff" : colors.textSecondary,
      }}>{result}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function H2HScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation();
  const router = useRouter();
  const { session } = useAuth();
  const { credits, setCredits, openSheet } = useScoutCredits();

  // Prefer the dynamic segment param; fall back to parsing the pathname directly
  // because Expo Router v56 doesn't always scope nested-directory params correctly.
  const { id: paramId, from } = useLocalSearchParams<{ id: string; from?: string }>();
  const pathname = usePathname(); // e.g. "/match/h2h/5156a54f-..."
  const match_id = paramId || pathname.split("/").filter(Boolean).pop();

  const [data, setData] = useState<H2HResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [analysis, setAnalysis] = useState<MatchAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const analyzingRef = useRef(false); // synchronous guard against double-tap race

  useEffect(() => {
    // Reset ALL state when match changes (component may be reused across navigations)
    setData(null);
    setError(null);
    setLoading(true);
    setAnalysis(null);
    setAnalysisError(null);
    setAnalyzing(false);
    analyzingRef.current = false;

    if (!match_id) {
      setError("Match not found.");
      setLoading(false);
      return;
    }

    let cancelled = false;

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Request timed out. Please try again.")), 25_000)
    );

    const h2hPromise = Promise.race([tennis.getMatchH2H(match_id), timeoutPromise]);

    // Fetch H2H data and any existing analysis in parallel
    const promises: [Promise<any>, Promise<any>] = [
      h2hPromise,
      session?.token ? tennis.getAnalysis(match_id, session.token).catch(() => null) : Promise.resolve(null),
    ];

    Promise.all(promises)
      .then(([h2hRes, analysisRes]) => {
        if (cancelled) return;
        setData(h2hRes.data);
        if (analysisRes?.data) setAnalysis(analysisRes.data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load comparison data.");
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [match_id]);

  useEffect(() => {
    const outOfCredits = credits !== null && credits <= 0;
    navigation.setOptions({
      title: "Head to Head",
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => from === "scout" ? router.navigate("/(app)/scout") : router.navigate("/(app)/matches")}
          style={{ paddingRight: spacing.sm }}
        >
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
      ),
      headerRight: credits === null ? undefined : () => (
        <TouchableOpacity
          onPress={openSheet}
          activeOpacity={0.75}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
            backgroundColor: outOfCredits ? "#FF3B30" : colors.primary,
            borderRadius: 999,
            paddingVertical: 5,
            paddingHorizontal: 10,
            marginRight: spacing.sm,
          }}
        >
          <View style={{
            width: 16, height: 16, borderRadius: 8,
            backgroundColor: "#FFD700",
            borderWidth: 2, borderColor: "#B8860B",
          }} />
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>{credits}</Text>
        </TouchableOpacity>
      ),
    });
  }, [colors.text, colors.primary, credits]);

  async function runAnalysis() {
    if (!match_id || !session?.token || analyzingRef.current) return;
    // No credits — open the purchase sheet instead of hitting the API
    if (credits !== null && credits <= 0) {
      openSheet();
      return;
    }
    analyzingRef.current = true; // block any concurrent call immediately (sync)
    setAnalyzing(true);
    setAnalysisError(null);
    try {
      const { data: result } = await tennis.analyzeMatch(match_id, session.token);
      setAnalysis(result);
      // Reflect the deducted credit immediately in the nav chip
      setCredits((prev) => (prev !== null ? Math.max(0, prev - 1) : prev));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Analysis failed.";
      if (msg.includes("402")) {
        setAnalysisError("No Scout credits remaining. Purchase more to continue.");
        setCredits(0);
      } else {
        setAnalysisError(msg);
      }
    } finally {
      analyzingRef.current = false;
      setAnalyzing(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["left", "right"]}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !data) {
    return (
      <SafeAreaView style={styles.container} edges={["left", "right"]}>
        <View style={styles.center}>
          <Text style={styles.errorText}>{error ?? "No data available."}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { match, player1, player2, player1_partner, player2_partner, h2h } = data;
  const accent = surfaceColor(match.surface);
  const tier = tierLabel(match.tier);
  const total = h2h.total;
  const p1Ratio = total > 0 ? h2h.player1_wins / total : 0.5;
  const isDoubles = match.type != null && ["MD", "LD", "XD", "QD", "RD"].includes(match.type);

  return (
    <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Match header ── */}
        <View style={[styles.matchHeader, { borderLeftColor: accent }]}>
          <View style={styles.matchHeaderTop}>
            <Text style={styles.tournamentName} numberOfLines={1}>
              {match.tournament_name ?? "Unknown Tournament"}
            </Text>
            {tier && (
              <View style={[styles.tierBadge, { backgroundColor: accent + "22", borderColor: accent + "55" }]}>
                <Text style={[styles.tierBadgeText, { color: accent }]}>{tier}</Text>
              </View>
            )}
          </View>
          <View style={styles.matchMeta}>
            {match.round ? <Text style={[styles.matchMetaText, { color: accent, fontWeight: "600" }]}>{match.round}</Text> : null}
            {match.round && match.surface ? <Text style={styles.matchMetaDot}>·</Text> : null}
            {match.surface ? <Text style={styles.matchMetaText}>{match.surface}</Text> : null}
          </View>
        </View>

        {/* ── Player comparison row ── */}
        <View style={styles.playersRow}>
          {isDoubles ? (
            <>
              <DoublesTeamCol p1={player1} p2={player1_partner} />
              <View style={styles.vsCol}>
                <Text style={styles.vsText}>VS</Text>
              </View>
              <DoublesTeamCol p1={player2} p2={player2_partner} />
            </>
          ) : (
            <>
              {/* Player 1 */}
              <View style={styles.playerCol}>
                <View style={styles.photoWrapper}>
                  {player1.photo ? (
                    <Image source={{ uri: player1.photo }} style={styles.playerPhoto} />
                  ) : (
                    <View style={[styles.playerPhoto, styles.playerPhotoFallback]}>
                      <Text style={styles.playerPhotoInitials}>{initials(player1.name)}</Text>
                    </View>
                  )}
                  {countryFlag(player1.country) ? (
                    <View style={styles.flagBadge}>
                      <Text style={styles.flagText}>{countryFlag(player1.country)}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.playerName} numberOfLines={2}>{player1.name}</Text>
                {player1.country ? <Text style={styles.playerCountry}>{player1.country}</Text> : null}
                {player1.singles_rank != null && (
                  <Text style={styles.playerRank}>#{player1.singles_rank}</Text>
                )}
              </View>

              {/* VS */}
              <View style={styles.vsCol}>
                <Text style={styles.vsText}>VS</Text>
              </View>

              {/* Player 2 */}
              <View style={styles.playerCol}>
                <View style={styles.photoWrapper}>
                  {player2.photo ? (
                    <Image source={{ uri: player2.photo }} style={styles.playerPhoto} />
                  ) : (
                    <View style={[styles.playerPhoto, styles.playerPhotoFallback]}>
                      <Text style={styles.playerPhotoInitials}>{initials(player2.name)}</Text>
                    </View>
                  )}
                  {countryFlag(player2.country) ? (
                    <View style={styles.flagBadge}>
                      <Text style={styles.flagText}>{countryFlag(player2.country)}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.playerName} numberOfLines={2}>{player2.name}</Text>
                {player2.country ? <Text style={styles.playerCountry}>{player2.country}</Text> : null}
                {player2.singles_rank != null && (
                  <Text style={styles.playerRank}>#{player2.singles_rank}</Text>
                )}
              </View>
            </>
          )}
        </View>

        {/* ── H2H record ── */}
        {!isDoubles && <View style={styles.section}>
          <Text style={styles.sectionTitle}>Head to Head</Text>

          {!h2h.available ? (
            <Text style={styles.unavailableText}>H2H data unavailable</Text>
          ) : (
            <>
              <View style={styles.h2hScoreRow}>
                <Text style={styles.h2hScore}>{h2h.player1_wins}</Text>
                <Text style={styles.h2hTotal}>
                  {total} {total === 1 ? "match" : "matches"}
                </Text>
                <Text style={styles.h2hScore}>{h2h.player2_wins}</Text>
              </View>

              {/* Win bar */}
              <View style={styles.barContainer}>
                <View style={[styles.barFill, { flex: p1Ratio, backgroundColor: accent }]} />
                <View style={[styles.barFill, { flex: 1 - p1Ratio, backgroundColor: colors.divider }]} />
              </View>

              {/* Recent meetings */}
              {h2h.matches.length > 0 && (
                <View style={styles.meetingsList}>
                  {h2h.matches.map((m, i) => {
                    const p1Won = m.winner === "team1";
                    const p2Won = m.winner === "team2";
                    const winnerName = p1Won
                      ? player1.name.split(" ").pop()
                      : p2Won
                      ? player2.name.split(" ").pop()
                      : null;

                    // Build set score string e.g. "6-3, 4-6, 7-5"
                    const t1Sets: number[] = m.sets?.team1 ?? [];
                    const t2Sets: number[] = m.sets?.team2 ?? [];
                    const scoreStr = t1Sets.length > 0
                      ? t1Sets.map((g, si) => `${g}-${t2Sets[si] ?? 0}`).join(", ")
                      : null;

                    return (
                      <View key={i} style={styles.meetingRow}>
                        <View style={styles.meetingLeft}>
                          <Text style={styles.meetingTournament} numberOfLines={1}>
                            {m.tournament ?? "—"}{m.year ? ` ${m.year}` : ""}
                          </Text>
                          {scoreStr ? (
                            <Text style={styles.meetingRound}>{scoreStr}</Text>
                          ) : null}
                        </View>
                        {winnerName ? (
                          <View style={styles.meetingRight}>
                            <Ionicons name="arrow-forward" size={12} color={colors.textSecondary} />
                            <Text style={styles.meetingWinner}>{winnerName}</Text>
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              )}
            </>
          )}
        </View>}

        {/* ── Recent form ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Form</Text>
          {isDoubles ? (
            <>
              {/* Team 1 */}
              <View style={styles.formRow}>
                <Text style={styles.formPlayerName} numberOfLines={1}>{shortName(player1.name)}</Text>
                <View style={styles.formDots}>
                  {player1.recent_form.map((f, i) => <FormDot key={i} result={f.result} />)}
                </View>
              </View>
              {player1_partner?.recent_form && (
                <View style={[styles.formRow, { marginTop: spacing.xs }]}>
                  <Text style={styles.formPlayerName} numberOfLines={1}>{shortName(player1_partner.name)}</Text>
                  <View style={styles.formDots}>
                    {player1_partner.recent_form.map((f, i) => <FormDot key={i} result={f.result} />)}
                  </View>
                </View>
              )}
              {/* Divider between teams */}
              <View style={styles.formDivider} />
              {/* Team 2 */}
              <View style={styles.formRow}>
                <Text style={styles.formPlayerName} numberOfLines={1}>{shortName(player2.name)}</Text>
                <View style={styles.formDots}>
                  {player2.recent_form.map((f, i) => <FormDot key={i} result={f.result} />)}
                </View>
              </View>
              {player2_partner?.recent_form && (
                <View style={[styles.formRow, { marginTop: spacing.xs }]}>
                  <Text style={styles.formPlayerName} numberOfLines={1}>{shortName(player2_partner.name)}</Text>
                  <View style={styles.formDots}>
                    {player2_partner.recent_form.map((f, i) => <FormDot key={i} result={f.result} />)}
                  </View>
                </View>
              )}
            </>
          ) : (
            <>
              <View style={styles.formRow}>
                <Text style={styles.formPlayerName} numberOfLines={1}>{shortName(player1.name)}</Text>
                <View style={styles.formDots}>
                  {player1.recent_form.map((f, i) => <FormDot key={i} result={f.result} />)}
                </View>
              </View>
              <View style={[styles.formRow, { marginTop: spacing.sm }]}>
                <Text style={styles.formPlayerName} numberOfLines={1}>{shortName(player2.name)}</Text>
                <View style={styles.formDots}>
                  {player2.recent_form.map((f, i) => <FormDot key={i} result={f.result} />)}
                </View>
              </View>
            </>
          )}
        </View>

        {/* ── Scout Report ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Scout Report</Text>

          {analysis ? (
            <>
              {/* Predicted winner banner */}
              <View style={[styles.predictionBanner, { backgroundColor: accent + "18", borderColor: accent + "44" }]}>
                <View style={styles.predictionLeft}>
                  <Text style={[styles.predictionLabel, { color: colors.textSecondary }]}>Predicted Winner</Text>
                  <Text style={[styles.predictionName, { color: colors.text }]}>
                    {analysis.predicted_winner === "player1" ? player1.name : player2.name}
                  </Text>
                </View>
                <View style={[styles.confidencePill, { backgroundColor: accent }]}>
                  <Text style={styles.confidenceText}>{analysis.confidence}%</Text>
                </View>
              </View>

              {/* Narrative */}
              <Text style={[styles.narrative, { color: colors.text }]}>{analysis.narrative}</Text>

              {/* Key factors */}
              <Text style={[styles.factorsLabel, { color: colors.textSecondary }]}>Key Factors</Text>
              {analysis.key_factors.map((f, i) => (
                <View key={i} style={styles.factorRow}>
                  <Ionicons name="chevron-forward" size={12} color={accent} />
                  <Text style={[styles.factorText, { color: colors.text }]}>{f}</Text>
                </View>
              ))}

              {/* Edges */}
              <View style={styles.edgesRow}>
                <View style={styles.edgeCol}>
                  <Text style={[styles.edgePlayer, { color: accent }]} numberOfLines={1}>
                    {player1.name.split(" ").pop()}
                  </Text>
                  <Text style={[styles.edgeText, { color: colors.textSecondary }]}>{analysis.player1_edge}</Text>
                </View>
                <View style={[styles.edgeCol, styles.edgeColRight]}>
                  <Text style={[styles.edgePlayer, { color: accent, textAlign: "right" }]} numberOfLines={1}>
                    {player2.name.split(" ").pop()}
                  </Text>
                  <Text style={[styles.edgeText, { color: colors.textSecondary, textAlign: "right" }]}>{analysis.player2_edge}</Text>
                </View>
              </View>
            </>
          ) : (
            <>
              {analysisError && (
                <Text style={[styles.analysisError, { color: colors.error ?? "#E05252" }]}>{analysisError}</Text>
              )}
              <TouchableOpacity
                style={[styles.analyzeBtn, { backgroundColor: colors.primary }, analyzing && styles.analyzeBtnDisabled]}
                onPress={runAnalysis}
                disabled={analyzing}
                activeOpacity={0.8}
              >
                {analyzing ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="sparkles" size={15} color="#fff" />
                    <Text style={styles.analyzeBtnText}>Analyze Matchup · 1 credit</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

function createStyles(colors: Palette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    scroll: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
    errorText: { ...typography.body, color: colors.textSecondary, textAlign: "center" },

    // Match header
    matchHeader: {
      borderLeftWidth: 4,
      paddingLeft: spacing.md,
      paddingVertical: spacing.xs,
      marginBottom: spacing.lg,
    },
    matchHeaderTop: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      flexWrap: "wrap",
    },
    tournamentName: {
      ...typography.h3,
      color: colors.text,
      fontWeight: "700",
      flex: 1,
    },
    tierBadge: {
      borderRadius: radius.full,
      borderWidth: 1,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    tierBadgeText: {
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 0.4,
    },
    matchMeta: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      marginTop: 3,
    },
    matchMetaText: { ...typography.caption, color: colors.textSecondary },
    matchMetaDot: { ...typography.caption, color: colors.textSecondary },

    // Players
    playersRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.lg,
    },
    playerCol: {
      flex: 1,
      alignItems: "center",
    },
    photoWrapper: {
      position: "relative",
      marginBottom: spacing.sm,
    },
    playerPhoto: {
      width: 72,
      height: 72,
      borderRadius: 36,
    },
    playerPhotoFallback: {
      backgroundColor: colors.card,
      alignItems: "center",
      justifyContent: "center",
    },
    playerPhotoInitials: {
      ...typography.h3,
      color: colors.textSecondary,
      fontWeight: "600",
    },
    flagBadge: {
      position: "absolute",
      right: -2,
      bottom: -2,
      backgroundColor: colors.card,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 2,
      paddingVertical: 1,
    },
    flagText: {
      fontSize: 14,
      lineHeight: 16,
    },
    playerName: {
      ...typography.label,
      color: colors.text,
      fontWeight: "700",
      textAlign: "center",
    },
    playerCountry: {
      ...typography.caption,
      color: colors.textSecondary,
      textAlign: "center",
      marginTop: 2,
    },
    playerRank: {
      ...typography.caption,
      color: colors.textSecondary,
      fontWeight: "600",
      textAlign: "center",
      marginTop: 1,
    },
    vsCol: {
      paddingHorizontal: spacing.sm,
      alignItems: "center",
    },
    vsText: {
      ...typography.caption,
      color: colors.textSecondary,
      fontWeight: "700",
      letterSpacing: 1,
    },

    // Sections
    section: {
      backgroundColor: colors.card,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.md,
      borderWidth: 0.5,
      borderColor: colors.divider,
    },
    sectionTitle: {
      ...typography.label,
      color: colors.textSecondary,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: spacing.md,
    },
    unavailableText: {
      ...typography.body,
      color: colors.textSecondary,
      textAlign: "center",
      paddingVertical: spacing.sm,
    },

    // H2H record
    h2hScoreRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.sm,
    },
    h2hScore: {
      ...typography.h2,
      color: colors.text,
      fontWeight: "700",
    },
    h2hTotal: {
      ...typography.caption,
      color: colors.textSecondary,
    },
    barContainer: {
      flexDirection: "row",
      height: 6,
      borderRadius: radius.full,
      overflow: "hidden",
      marginBottom: spacing.md,
    },
    barFill: {
      height: "100%",
    },

    // Recent meetings
    meetingsList: {
      gap: spacing.sm,
    },
    meetingRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    meetingLeft: {
      flex: 1,
    },
    meetingTournament: {
      ...typography.body,
      color: colors.text,
      fontWeight: "500",
    },
    meetingRound: {
      ...typography.caption,
      color: colors.textSecondary,
    },
    meetingRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    meetingWinner: {
      ...typography.caption,
      color: colors.textSecondary,
      fontWeight: "600",
    },

    // Recent form
    formRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    formPlayerName: {
      ...typography.body,
      color: colors.text,
      fontWeight: "600",
      flexShrink: 0,
      maxWidth: "45%",
    },
    formDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.divider,
      marginVertical: spacing.sm,
    },
    formDots: {
      flexDirection: "row",
      gap: spacing.xs,
      flex: 1,
    },

    // Scout Report
    predictionBanner: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderRadius: radius.md,
      borderWidth: 1,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    predictionLeft: { flex: 1 },
    predictionLabel: { ...typography.caption, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
    predictionName: { ...typography.h3, fontWeight: "700" },
    confidencePill: {
      borderRadius: radius.full,
      paddingHorizontal: 10,
      paddingVertical: 4,
      marginLeft: spacing.sm,
    },
    confidenceText: { color: "#fff", fontWeight: "800", fontSize: 14 },
    narrative: { ...typography.body, lineHeight: 22, marginBottom: spacing.md },
    factorsLabel: {
      ...typography.caption,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: spacing.sm,
    },
    factorRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 6,
      marginBottom: 6,
    },
    factorText: { ...typography.body, flex: 1, lineHeight: 20 },
    edgesRow: {
      flexDirection: "row",
      gap: spacing.md,
      marginTop: spacing.md,
      paddingTop: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: "rgba(128,128,128,0.2)",
    },
    edgeCol: { flex: 1 },
    edgeColRight: { alignItems: "flex-end" },
    edgePlayer: { ...typography.label, fontWeight: "700", marginBottom: 3 },
    edgeText: { ...typography.caption, lineHeight: 18 },
    analyzeBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.xs,
      borderRadius: radius.md,
      paddingVertical: 13,
      marginBottom: spacing.xs,
    },
    analyzeBtnDisabled: { opacity: 0.55 },
    analyzeBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
    analyzeCaption: { ...typography.caption, textAlign: "center" },
    analysisError: { ...typography.caption, textAlign: "center", marginBottom: spacing.sm },
  });
}
