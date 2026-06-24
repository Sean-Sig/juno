import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
  Pressable,
  Animated,
  Easing,
  FlatList,
  SectionList,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { tennis, scout, useAuth, type TennisPlayer, type ScoutResult, type PlayerScore, type UpcomingMatchup } from "@juno/api";
import { useTheme, spacing, radius, typography, type Palette } from "@juno/ui";
import { useFollowedPlayers } from "../context/FollowedPlayersContext";
import { useScoutCredits } from "../context/ScoutCreditsContext";
import { useScoutLineup } from "../context/ScoutLineupContext";

type ScoutMode = "lineup" | "matchups";

// ---------------------------------------------------------------------------
// Animated score circle — arc fills clockwise, remainder stays gray
// ---------------------------------------------------------------------------
function ScoreCircle({
  score,
  size = 56,
  color,
  bgColor,
}: {
  score: number;
  size?: number;
  color: string;
  bgColor: string;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const thickness = Math.round(size * 0.1);
  const half = size / 2;

  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: score,
      duration: 800,
      delay: 100,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [score]);

  const rightRot = anim.interpolate({
    inputRange: [0, 50, 100],
    outputRange: ["180deg", "0deg", "0deg"],
  });
  const leftRot = anim.interpolate({
    inputRange: [0, 50, 100],
    outputRange: ["180deg", "180deg", "0deg"],
  });

  return (
    <View style={{ width: size, height: size }}>
      {/* Gray track */}
      <View
        style={{
          position: "absolute",
          width: size,
          height: size,
          borderRadius: half,
          borderWidth: thickness,
          borderColor: "rgba(0,0,0,0.1)",
        }}
      />
      {/* Right fill */}
      <View style={{ position: "absolute", left: half, width: half, height: size, overflow: "hidden" }}>
        <Animated.View
          style={{
            position: "absolute",
            left: -half,
            width: size,
            height: size,
            borderRadius: half,
            borderWidth: thickness,
            borderColor: color,
            transform: [{ rotate: rightRot }],
          }}
        />
      </View>
      {/* Left fill */}
      <View style={{ position: "absolute", left: 0, width: half, height: size, overflow: "hidden" }}>
        <Animated.View
          style={{
            position: "absolute",
            left: 0,
            width: size,
            height: size,
            borderRadius: half,
            borderWidth: thickness,
            borderColor: color,
            transform: [{ rotate: leftRot }],
          }}
        />
      </View>
      {/* Center cutout with score */}
      <View
        style={{
          position: "absolute",
          left: thickness,
          top: thickness,
          width: size - thickness * 2,
          height: size - thickness * 2,
          borderRadius: half,
          backgroundColor: bgColor,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontSize: size * 0.26, fontWeight: "800", color, lineHeight: size * 0.3 }}>
          {score}
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Individual player row — X to remove before analysis, circle after
// ---------------------------------------------------------------------------
function PlayerRow({
  player,
  playerScore,
  analyzed,
  onRemove,
  colors,
  styles,
}: {
  player: TennisPlayer;
  playerScore: PlayerScore | undefined;
  analyzed: boolean;
  onRemove: () => void;
  colors: Palette;
  styles: ReturnType<typeof createStyles>;
}) {
  const firstName = player.display_first_name ?? player.first_name;
  const lastName = player.display_last_name ?? player.last_name;

  return (
    <View>
      <View style={styles.playerRow}>
        {/* Photo */}
        {player.photo ? (
          <Image source={{ uri: player.photo }} style={styles.playerPhoto} cachePolicy="memory-disk" />
        ) : (
          <View style={[styles.playerPhoto, styles.playerPhotoFallback]}>
            <Text style={[styles.playerInitials, { color: colors.textSecondary }]}>
              {firstName[0]}{lastName[0]}
            </Text>
          </View>
        )}

        {/* Name + meta */}
        <View style={{ flex: 1 }}>
          <Text style={[styles.playerName, { color: colors.text }]} numberOfLines={1}>
            {firstName} {lastName}
          </Text>
          <Text style={[styles.playerMeta, { color: colors.textSecondary }]}>
            {player.singles_rank ? `#${player.singles_rank}` : "Unranked"}
            {player.country ? ` · ${player.country}` : ""}
          </Text>
        </View>

        {/* Right action: X before analysis, circle after */}
        {analyzed && playerScore ? (
          <ScoreCircle
            score={playerScore.score}
            size={52}
            color={colors.primary}
            bgColor={colors.surface}
          />
        ) : (
          <TouchableOpacity onPress={onRemove} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close-circle" size={26} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Pros / cons — only shown after analysis */}
      {analyzed && playerScore && (
        <View style={styles.prosConsContainer}>
          {playerScore.pros.map((pro, i) => (
            <View key={`pro-${i}`} style={styles.bulletRow}>
              <Text style={[styles.bulletPlus, { color: colors.primary }]}>+</Text>
              <Text style={[styles.bulletText, { color: colors.text }]}>{pro}</Text>
            </View>
          ))}
          {playerScore.cons.map((con, i) => (
            <View key={`con-${i}`} style={styles.bulletRow}>
              <Text style={[styles.bulletMinus, { color: colors.error }]}>–</Text>
              <Text style={[styles.bulletText, { color: colors.text }]}>{con}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Followed players sheet
// ---------------------------------------------------------------------------
function FollowedSheet({
  visible,
  selected,
  onPick,
  onClose,
  colors,
  styles,
}: {
  visible: boolean;
  selected: TennisPlayer[];
  onPick: (p: TennisPlayer) => void;
  onClose: () => void;
  colors: Palette;
  styles: ReturnType<typeof createStyles>;
}) {
  const { session } = useAuth();
  const { followedIds } = useFollowedPlayers();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [followedPlayers, setFollowedPlayers] = useState<TennisPlayer[]>([]);
  const [loadingFollowed, setLoadingFollowed] = useState(false);
  const prevVisible = useRef(false);

  if (visible && !prevVisible.current) {
    prevVisible.current = true;
    if (followedIds.length > 0 && session?.token) {
      setLoadingFollowed(true);
      Promise.all(followedIds.map((id) => tennis.getPlayer(id).then((r) => r.data)))
        .then(setFollowedPlayers)
        .catch(() => {})
        .finally(() => setLoadingFollowed(false));
    }
    Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }
  if (!visible && prevVisible.current) {
    prevVisible.current = false;
    fadeAnim.setValue(0);
  }

  const available = followedPlayers.filter((p) => !selected.find((s) => s.id === p.id));

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
            },
          ]}
        >
          <View style={styles.sheetHandle} />
          <Text style={[styles.sheetTitle, { color: colors.textSecondary }]}>Followed players</Text>

          {loadingFollowed ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />
          ) : available.length === 0 ? (
            <Text style={[styles.sheetEmpty, { color: colors.textSecondary }]}>
              {followedIds.length === 0
                ? "You haven't followed any players yet."
                : "All your followed players are already in the lineup."}
            </Text>
          ) : (
            <FlatList
              data={available}
              keyExtractor={(p) => p.id}
              style={{ maxHeight: 360 }}
              renderItem={({ item: p }) => {
                const firstName = p.display_first_name ?? p.first_name;
                const lastName = p.display_last_name ?? p.last_name;
                return (
                  <TouchableOpacity
                    style={styles.sheetRow}
                    onPress={() => { onPick(p); if (available.length <= 1) onClose(); }}
                    activeOpacity={0.7}
                  >
                    {p.photo ? (
                      <Image source={{ uri: p.photo }} style={styles.sheetPhoto} cachePolicy="memory-disk" />
                    ) : (
                      <View style={[styles.sheetPhoto, styles.playerPhotoFallback]}>
                        <Text style={{ color: colors.textSecondary, fontWeight: "600" }}>
                          {firstName[0]}{lastName[0]}
                        </Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.sheetPlayerName, { color: colors.text }]}>
                        {firstName} {lastName}
                      </Text>
                      {p.singles_rank && (
                        <Text style={[typography.caption, { color: colors.textSecondary }]}>
                          #{p.singles_rank} · {p.country}
                        </Text>
                      )}
                    </View>
                    <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
                  </TouchableOpacity>
                );
              }}
              ItemSeparatorComponent={() => (
                <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.divider }} />
              )}
            />
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Search / add area
// ---------------------------------------------------------------------------
function PlayerSearch({
  selected,
  onAdd,
  atLimit,
  colors,
  styles,
}: {
  selected: TennisPlayer[];
  onAdd: (p: TennisPlayer) => void;
  atLimit: boolean;
  colors: Palette;
  styles: ReturnType<typeof createStyles>;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TennisPlayer[]>([]);
  const [searching, setSearching] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  async function search(q: string) {
    setQuery(q);
    if (q.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const { data } = await tennis.searchPlayers(q.trim());
      setResults(data.filter((p) => !selected.find((s) => s.id === p.id)));
    } finally {
      setSearching(false);
    }
  }

  function pick(player: TennisPlayer) {
    setQuery("");
    setResults([]);
    onAdd(player);
  }

  return (
    <View style={{ marginBottom: spacing.md }}>
      <View style={styles.searchRow}>
        <TextInput
          style={[styles.input, { flex: 1, opacity: atLimit ? 0.4 : 1 }]}
          placeholder={atLimit ? "Max 5 players reached" : "Search players to add…"}
          placeholderTextColor={colors.textSecondary}
          value={query}
          onChangeText={search}
          editable={!atLimit}
        />
        <TouchableOpacity
          style={[styles.followedBtn, { borderColor: atLimit ? colors.border : colors.primary, opacity: atLimit ? 0.4 : 1 }]}
          onPress={() => !atLimit && setSheetOpen(true)}
          activeOpacity={0.75}
        >
          <Ionicons name="people-outline" size={16} color={atLimit ? colors.textSecondary : colors.primary} />
          <Text style={[styles.followedBtnText, { color: atLimit ? colors.textSecondary : colors.primary }]}>Following</Text>
        </TouchableOpacity>
      </View>
      {atLimit && (
        <Text style={{ ...typography.caption, color: colors.textSecondary, marginTop: 6 }}>
          Remove a player to add another.
        </Text>
      )}

      {searching && <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.sm }} />}

      {results.length > 0 && (
        <View style={[styles.dropdown, { backgroundColor: colors.surface }]}>
          {results.slice(0, 6).map((p) => (
            <TouchableOpacity key={p.id} style={styles.dropdownRow} onPress={() => pick(p)}>
              <Text style={[styles.dropdownName, { color: colors.text }]}>
                {p.display_first_name ?? p.first_name} {p.display_last_name ?? p.last_name}
              </Text>
              {p.singles_rank && (
                <Text style={[typography.caption, { color: colors.textSecondary }]}>
                  #{p.singles_rank}
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      <FollowedSheet
        visible={sheetOpen}
        selected={selected}
        onPick={onAdd}
        onClose={() => setSheetOpen(false)}
        colors={colors}
        styles={styles}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Matchups tab
// ---------------------------------------------------------------------------

function surfaceAccentColor(surface: string | null | undefined): string {
  switch (surface?.toLowerCase()) {
    case "clay":    return "#C17A3A";
    case "grass":   return "#3A8C4A";
    case "hard":    return "#3A6FC1";
    case "carpet":  return "#7C5CBF";
    default:        return "#888888";
  }
}

function formatMatchTime(startsAt: string | null): string {
  if (!startsAt) return "TBD";
  try {
    const d = new Date(startsAt);
    const date = d.toLocaleDateString([], { month: "short", day: "numeric" });
    const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return `${date} · ${time}`;
  } catch {
    return "TBD";
  }
}

type MatchupSection = {
  tournament: string;
  surface: string | null;
  tier: string | null;
  data: UpcomingMatchup[];
};

function groupByTournament(matchups: UpcomingMatchup[]): MatchupSection[] {
  const map = new Map<string, MatchupSection>();
  for (const m of matchups) {
    const key = m.tournament_name ?? "Unknown Tournament";
    if (!map.has(key)) {
      map.set(key, { tournament: key, surface: m.surface, tier: m.tier, data: [] });
    }
    map.get(key)!.data.push(m);
  }
  return Array.from(map.values());
}

function MatchupsTab({ colors, styles }: { colors: Palette; styles: ReturnType<typeof createStyles> }) {
  const router = useRouter();
  const [matchups, setMatchups] = useState<UpcomingMatchup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    tennis.getUpcomingMatchups()
      .then(({ data }) => setMatchups(data))
      .catch(() => setError("Failed to load upcoming matches."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />;
  }

  if (error) {
    return <Text style={[styles.error, { color: colors.error ?? "#E05252", textAlign: "center", marginTop: spacing.lg }]}>{error}</Text>;
  }

  if (matchups.length === 0) {
    return (
      <View style={{ alignItems: "center", paddingTop: spacing.xl }}>
        <Ionicons name="calendar-outline" size={40} color={colors.textSecondary} />
        <Text style={[{ ...typography.body, color: colors.textSecondary, marginTop: spacing.md, textAlign: "center" }]}>
          No upcoming matches scheduled{"\n"}for the next 7 days.
        </Text>
      </View>
    );
  }

  const sections = groupByTournament(matchups);

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ paddingBottom: spacing.xl }}
      stickySectionHeadersEnabled={false}
      renderSectionHeader={({ section }) => {
        const accent = surfaceAccentColor(section.surface);
        return (
          <View style={[styles.matchupSectionHeader, { borderLeftColor: accent }]}>
            <Text style={[styles.matchupTournamentName, { color: colors.text }]} numberOfLines={1}>
              {section.tournament}
            </Text>
            {section.surface && (
              <Text style={[styles.matchupSurface, { color: accent }]}>{section.surface}</Text>
            )}
          </View>
        );
      }}
      renderItem={({ item: m }) => {
        const accent = surfaceAccentColor(m.surface);
        const p1 = m.player1;
        const p2 = m.player2;
        return (
          <TouchableOpacity
            style={[styles.matchupCard, { borderLeftColor: accent }]}
            onPress={() => router.push(`/(app)/match/h2h/${m.id}?from=scout`)}
            activeOpacity={0.75}
          >
            <View style={styles.matchupPlayers}>
              <View style={styles.matchupPlayer}>
                <Text style={[styles.matchupPlayerName, { color: colors.text }]} numberOfLines={1}>
                  {p1?.short_name ?? p1?.name ?? "TBD"}
                </Text>
                {p1?.singles_rank && (
                  <Text style={[styles.matchupRank, { color: colors.textSecondary }]}>#{p1.singles_rank}</Text>
                )}
              </View>
              <Text style={[styles.matchupVs, { color: colors.textSecondary }]}>vs</Text>
              <View style={[styles.matchupPlayer, styles.matchupPlayerRight]}>
                <Text style={[styles.matchupPlayerName, { color: colors.text, textAlign: "right" }]} numberOfLines={1}>
                  {p2?.short_name ?? p2?.name ?? "TBD"}
                </Text>
                {p2?.singles_rank && (
                  <Text style={[styles.matchupRank, { color: colors.textSecondary, textAlign: "right" }]}>#{p2.singles_rank}</Text>
                )}
              </View>
            </View>
            <View style={styles.matchupMeta}>
              <Text style={[styles.matchupTime, { color: colors.textSecondary }]}>{formatMatchTime(m.starts_at)}</Text>
              {m.round && <Text style={[styles.matchupRound, { color: colors.textSecondary }]}>· {m.round}</Text>}
              <View style={{ flex: 1 }} />
              <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>
        );
      }}
      ItemSeparatorComponent={() => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginLeft: spacing.md }} />}
      SectionSeparatorComponent={() => <View style={{ height: spacing.md }} />}
    />
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
export default function TennisScout() {
  const { session } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { credits, setCredits, refreshCredits, openSheet } = useScoutCredits();
  const { pendingPlayer, clearPending } = useScoutLineup();

  const [mode, setMode] = useState<ScoutMode>("matchups");
  const [players, setPlayers] = useState<TennisPlayer[]>([]);
  const [result, setResult] = useState<ScoutResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const MAX_PLAYERS = 5;

  // When a player is queued from the Player screen, add them and switch to Lineup
  useEffect(() => {
    if (!pendingPlayer) return;
    addPlayer(pendingPlayer);
    setMode("lineup");
    clearPending();
  }, [pendingPlayer]);

  function addPlayer(p: TennisPlayer) {
    if (players.find((x) => x.id === p.id)) return;
    if (players.length >= MAX_PLAYERS) return;
    setPlayers((prev) => [...prev, p]);
    setResult(null);
    setError(null);
  }

  function removePlayer(id: string) {
    setPlayers((prev) => prev.filter((p) => p.id !== id));
    setResult(null);
    setError(null);
  }

  async function analyze() {
    if (!session?.token || players.length < 1) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const { data } = await scout.analyze(session.token, "tennis", players.map((p) => p.id));
      setResult(data);
      // Refresh balance so the displayed count decrements
      refreshCredits();
    } catch (e: any) {
      const msg: string = e?.message ?? "Analysis failed. Try again.";
      // 402 means out of credits — update local count to 0 so UI switches immediately
      if (msg.includes("402")) setCredits(0);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  const analyzed = result !== null;
  const outOfCredits = credits !== null && credits <= 0;
  const atLimit = players.length >= MAX_PLAYERS;
  const canAnalyze = players.length >= 1 && !loading && !outOfCredits;

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>

      {/* ── Segmented control ── */}
      <View style={[styles.segmentedControl, { borderColor: colors.divider, backgroundColor: colors.surface }]}>
        {(["matchups", "lineup"] as ScoutMode[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.segmentBtn, mode === tab && { backgroundColor: colors.primary }]}
            onPress={() => setMode(tab)}
            activeOpacity={0.8}
          >
            <Text style={[styles.segmentBtnText, { color: mode === tab ? "#fff" : colors.textSecondary }]}>
              {tab === "matchups" ? "Matchups" : "Lineup"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Matchups tab ── */}
      {mode === "matchups" && <MatchupsTab colors={colors} styles={styles} />}

      {/* ── Lineup tab ── */}
      {mode === "lineup" && (
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        <Text style={styles.heading}>Lineup Analysis</Text>
        <Text style={styles.subheading}>Add players, then let AI score the lineup.</Text>

        {/* Search / add row */}
        {!analyzed && !outOfCredits && (
          <PlayerSearch
            selected={players}
            onAdd={addPlayer}
            atLimit={atLimit}
            colors={colors}
            styles={styles}
          />
        )}

        {/* Player list */}
        {players.length > 0 && (
          <View style={{ marginBottom: spacing.md }}>
            <Text style={[styles.sectionHeading, { color: colors.text }]}>Player Scores</Text>
            <View style={styles.card}>
              {players.map((player, i) => {
                const ps = result?.player_scores?.find((s) => s.player_id === player.id);
                return (
                  <React.Fragment key={player.id}>
                    <PlayerRow
                      player={player}
                      playerScore={ps}
                      analyzed={analyzed}
                      onRemove={() => removePlayer(player.id)}
                      colors={colors}
                      styles={styles}
                    />
                    {i < players.length - 1 && (
                      <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                    )}
                  </React.Fragment>
                );
              })}
            </View>
          </View>
        )}

        {/* Analyze / reset / buy more button */}
        {!analyzed ? (
          outOfCredits ? (
            <TouchableOpacity
              style={[styles.analyzeBtn, { backgroundColor: colors.primary }]}
              onPress={openSheet}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 16, marginRight: 6 }}>🪙</Text>
              <Text style={styles.analyzeBtnText}>Get more credits</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.analyzeBtn, { backgroundColor: colors.primary }, !canAnalyze && styles.analyzeBtnDisabled]}
              onPress={analyze}
              disabled={!canAnalyze}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.analyzeBtnText}>
                  Analyze lineup {credits !== null && credits > 0 ? `· ${credits} credit${credits === 1 ? "" : "s"} left` : ""}
                </Text>
              )}
            </TouchableOpacity>
          )
        ) : (
          <TouchableOpacity
            style={[styles.resetBtn, { borderColor: colors.border }]}
            onPress={() => setResult(null)}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh" size={15} color={colors.textSecondary} />
            <Text style={[styles.resetBtnText, { color: colors.textSecondary }]}>Edit lineup</Text>
          </TouchableOpacity>
        )}

        {error && !outOfCredits && (
          <Text style={[styles.error, { color: colors.error }]}>{error}</Text>
        )}

        {/* Overall lineup */}
        {result && (
          <>
            <Text style={[styles.sectionHeading, { color: colors.text, marginTop: spacing.sm }]}>Overall Lineup</Text>
            <View style={[styles.card, styles.overallCard]}>
              <ScoreCircle
                score={result.overall_score}
                size={120}
                color={colors.primary}
                bgColor={colors.surface}
              />
              <View style={[styles.gradeBadge, { backgroundColor: colors.primary, marginTop: spacing.md }]}>
                <Text style={styles.gradeText}>Grade {result.grade}</Text>
              </View>
              <Text style={[styles.overallSummary, { color: colors.textSecondary }]}>{result.summary}</Text>

              <View style={{ width: "100%", marginTop: spacing.md }}>
                <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Breakdown</Text>
                <BreakdownBar label="Rankings" value={result.breakdown.rankings_strength} colors={colors} />
                <BreakdownBar label="Recent Form" value={result.breakdown.recent_form} colors={colors} />
                <BreakdownBar label="Head-to-Head" value={result.breakdown.head_to_head} colors={colors} />
                <BreakdownBar label="Availability" value={result.breakdown.availability} colors={colors} />
              </View>
            </View>
          </>
        )}
      </ScrollView>
      )}

    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Breakdown bar
// ---------------------------------------------------------------------------
function BreakdownBar({ label, value, colors }: { label: string; value: number; colors: Palette }) {
  return (
    <View style={{ marginBottom: spacing.sm }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
        <Text style={{ ...typography.label, color: colors.textSecondary }}>{label}</Text>
        <Text style={{ ...typography.label, color: colors.text, fontWeight: "700" }}>{value}</Text>
      </View>
      <View style={{ height: 6, backgroundColor: colors.card, borderRadius: radius.full }}>
        <View style={{ height: 6, width: `${value}%`, backgroundColor: colors.primary, borderRadius: radius.full }} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
function createStyles(colors: Palette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { padding: spacing.md, paddingBottom: spacing.xl },
    heading: { ...typography.h2, color: colors.text, marginBottom: 4 },
    subheading: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.md },
    sectionHeading: { ...typography.h3, marginBottom: spacing.sm },
    sectionLabel: {
      ...typography.caption,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginBottom: spacing.sm,
    },

    // Card
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    overallCard: { alignItems: "center", paddingVertical: spacing.lg },
    divider: { height: StyleSheet.hairlineWidth, marginVertical: spacing.md },

    // Player row
    playerRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    playerPhoto: { width: 46, height: 46, borderRadius: radius.full },
    playerPhotoFallback: { backgroundColor: colors.border, alignItems: "center", justifyContent: "center" },
    playerInitials: { fontWeight: "600", fontSize: 15 },
    playerName: { ...typography.body, fontWeight: "600" },
    playerMeta: { ...typography.caption, marginTop: 1 },

    // Pros / cons
    prosConsContainer: { paddingTop: spacing.sm },
    bulletRow: { flexDirection: "row", gap: 6, marginBottom: 5, alignItems: "flex-start" },
    bulletPlus: { fontWeight: "800", fontSize: 13, width: 14, lineHeight: 18 },
    bulletMinus: { fontWeight: "800", fontSize: 13, width: 14, lineHeight: 18 },
    bulletText: { ...typography.caption, flex: 1, lineHeight: 18 },

    // Overall
    gradeBadge: { paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: radius.full },
    gradeText: { color: "#fff", fontWeight: "700", fontSize: 14 },
    overallSummary: { ...typography.body, textAlign: "center", marginTop: spacing.md, lineHeight: 22 },

    // Search
    searchRow: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
    input: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      fontSize: 15,
      color: colors.text,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    followedBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: spacing.sm,
      paddingVertical: 10,
      borderRadius: radius.md,
      borderWidth: 1.5,
    },
    followedBtnText: { ...typography.label, fontWeight: "600" },
    dropdown: {
      borderRadius: radius.md,
      marginTop: 4,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      overflow: "hidden",
    },
    dropdownRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.divider,
    },
    dropdownName: { ...typography.body },

    // Buttons
    analyzeBtn: { flexDirection: "row", borderRadius: radius.md, paddingVertical: 14, alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
    analyzeBtnDisabled: { opacity: 0.45 },
    analyzeBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
    resetBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.xs,
      borderRadius: radius.md,
      paddingVertical: 12,
      marginBottom: spacing.md,
      borderWidth: 1,
    },
    resetBtnText: { ...typography.label },
    error: { ...typography.body, marginBottom: spacing.md },

    // Segmented control
    segmentedControl: {
      flexDirection: "row",
      margin: spacing.md,
      marginBottom: 0,
      borderRadius: radius.md,
      borderWidth: 1,
      overflow: "hidden",
    },
    segmentBtn: {
      flex: 1,
      paddingVertical: 9,
      alignItems: "center",
    },
    segmentBtnText: { ...typography.label, fontWeight: "700" },

    // Matchups list
    matchupSectionHeader: {
      borderLeftWidth: 3,
      paddingLeft: spacing.sm,
      marginHorizontal: spacing.md,
      marginTop: spacing.md,
      marginBottom: spacing.xs,
    },
    matchupTournamentName: { ...typography.label, fontWeight: "700" },
    matchupSurface: { ...typography.caption, fontWeight: "600", marginTop: 1 },
    matchupCard: {
      marginHorizontal: spacing.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderLeftWidth: 3,
      backgroundColor: "transparent",
    },
    matchupPlayers: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      marginBottom: 4,
    },
    matchupPlayer: { flex: 1 },
    matchupPlayerRight: { alignItems: "flex-end" },
    matchupPlayerName: { ...typography.body, fontWeight: "600" },
    matchupRank: { ...typography.caption },
    matchupVs: { ...typography.caption, fontWeight: "700", paddingHorizontal: 4 },
    matchupMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
    matchupTime: { ...typography.caption },
    matchupRound: { ...typography.caption },

    // Sheet
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
    sheet: {
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      paddingBottom: 40,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
    },
    sheetHandle: {
      width: 36, height: 4, borderRadius: radius.full,
      backgroundColor: colors.border, alignSelf: "center", marginBottom: spacing.md,
    },
    sheetTitle: { ...typography.caption, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: spacing.sm },
    sheetRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.md, gap: spacing.md },
    sheetPhoto: { width: 40, height: 40, borderRadius: radius.full },
    sheetPlayerName: { ...typography.body, fontWeight: "600" },
    sheetEmpty: { ...typography.body, textAlign: "center", paddingVertical: spacing.lg },
  });
}
