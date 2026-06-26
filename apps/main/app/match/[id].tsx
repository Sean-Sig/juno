import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { tennis, TennisMatch, TennisPlayer, MatchComment, joinTennisMatchChannel } from "@juno/api";
import { LiveBadge, useTheme, spacing, typography, radius, countryFlag, type Palette } from "@juno/ui";
import { Channel } from "phoenix";
import { useFollowedPlayers } from "../../context/FollowedPlayersContext";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fullName(player: TennisPlayer | null, fallback?: string): string {
  if (player) return player.display_name || `${player.first_name} ${player.last_name}`.trim();
  return fallback ?? "TBD";
}

function shortName(player: TennisPlayer | null, fallback?: string): string {
  if (player) return player.short_name || fullName(player);
  return fallback ?? "TBD";
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]?.[0]?.toUpperCase() ?? "";
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}

function isLiveStatus(status: string): boolean {
  return ["on_court", "warmup", "playing"].includes(status);
}

function surfaceColor(surface: string | null | undefined): string {
  switch (surface?.toLowerCase()) {
    case "clay":   return "#C17A3A";
    case "grass":  return "#3A8C4A";
    case "hard":   return "#3A6FC1";
    case "carpet": return "#7C5CBF";
    case "indoor": return "#5C7A8C";
    default:       return "#888888";
  }
}

function surfaceLabel(surface: string | null | undefined): string | null {
  if (!surface) return null;
  return surface.charAt(0).toUpperCase() + surface.slice(1).toLowerCase();
}

function doublesLabel(type: string | null | undefined): string | null {
  if (!type) return null;
  const t = type.toUpperCase();
  if (t === "XD" || t === "MX") return "Mixed Doubles";
  if (["MD", "LD", "WD", "QD", "RD"].includes(t)) return "Doubles";
  return null;
}

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    const date = d.toLocaleDateString([], { month: "short", day: "numeric" });
    const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return `${date} · ${time}`;
  } catch {
    return "";
  }
}

function formatDuration(minutes: number | null): string | null {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ---------------------------------------------------------------------------
// Player row (header section)
// ---------------------------------------------------------------------------

function PlayerHeaderRow({
  player,
  partner,
  fallbackName,
  isServing,
  isWinner,
  isLoser,
  onPress,
  onPartnerPress,
}: {
  player: TennisPlayer | null;
  partner: TennisPlayer | null;
  fallbackName?: string;
  isServing: boolean;
  isWinner: boolean;
  isLoser: boolean;
  onPress: () => void;
  onPartnerPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { isFollowed, follow, unfollow } = useFollowedPlayers();
  const [busy, setBusy] = useState(false);

  const name = fullName(player, fallbackName);
  const followed = player ? isFollowed(player.id) : false;

  async function toggleFollow() {
    if (!player || busy) return;
    setBusy(true);
    try {
      if (followed) await unfollow(player.id);
      else await follow(player.id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.playerHeaderRow}>
      <TouchableOpacity style={styles.photoWrapper} onPress={onPress} activeOpacity={0.7}>
        {player?.photo ? (
          <Image source={{ uri: player.photo }} style={styles.playerPhoto} cachePolicy="memory-disk" />
        ) : (
          <View style={[styles.playerPhoto, styles.playerPhotoFallback]}>
            <Text style={styles.playerPhotoInitials}>{initials(name)}</Text>
          </View>
        )}
        {isServing && (
          <View style={styles.serveBadge}>
            <Ionicons name="tennisball" size={12} color="#fff" />
          </View>
        )}
        {countryFlag(player?.country) ? (
          <View style={styles.flagBadge}>
            <Text style={styles.flagText}>{countryFlag(player?.country)}</Text>
          </View>
        ) : null}
      </TouchableOpacity>

      <View style={styles.playerHeaderInfo}>
        <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
          <View style={styles.playerHeaderNameRow}>
            <Text
              style={[styles.playerHeaderName, isWinner && styles.winnerText, isLoser && styles.loserText]}
              numberOfLines={1}
            >
              {name}
            </Text>
            {isWinner && <Ionicons name="checkmark-circle" size={16} color={colors.primary} style={{ marginLeft: 4 }} />}
          </View>
        </TouchableOpacity>
        {partner && (
          <TouchableOpacity onPress={onPartnerPress} activeOpacity={0.7}>
            <Text style={styles.playerHeaderPartner} numberOfLines={1}>{fullName(partner)}</Text>
          </TouchableOpacity>
        )}
        {player?.singles_rank != null && (
          <Text style={styles.playerHeaderRank}>WR #{player.singles_rank}</Text>
        )}
      </View>

      {player && (
        <TouchableOpacity
          onPress={toggleFollow}
          disabled={busy}
          activeOpacity={0.75}
          style={[styles.followBtn, followed && styles.followBtnActive]}
        >
          <Text style={[styles.followBtnText, followed && styles.followBtnTextActive]}>
            {followed ? "Following" : "Follow"}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function MatchScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { id, p1Name, p2Name, tournamentName } = useLocalSearchParams<{
    id: string;
    p1Name?: string;
    p2Name?: string;
    tournamentName?: string;
  }>();
  const [match, setMatch] = useState<TennisMatch | null>(null);
  const [player1, setPlayer1] = useState<TennisPlayer | null>(null);
  const [player2, setPlayer2] = useState<TennisPlayer | null>(null);
  const [player1Partner, setPlayer1Partner] = useState<TennisPlayer | null>(null);
  const [player2Partner, setPlayer2Partner] = useState<TennisPlayer | null>(null);
  const [comments, setComments] = useState<MatchComment[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const navigation = useNavigation();

  useEffect(() => {
    navigation.setOptions({
      title: match
        ? `${shortName(player1, p1Name)} vs ${shortName(player2, p2Name)}`
        : p1Name && p2Name
        ? `${p1Name} vs ${p2Name}`
        : "Match",
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.navigate("/(app)/matches"))}
          style={{ paddingRight: spacing.sm }}
        >
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
      ),
      headerRight: () => null,
    });
  }, [match, player1, player2, p1Name, p2Name, colors.text]);

  useEffect(() => {
    if (!id) return;

    tennis.getMatch(id).then(({ data }) => {
      setMatch(data);
      setLoading(false);

      const fetches: Promise<void>[] = [];
      if (data.player1_id) {
        fetches.push(tennis.getPlayerFull(data.player1_id).then(({ data: p }) => setPlayer1(p)));
      }
      if (data.player2_id) {
        fetches.push(tennis.getPlayerFull(data.player2_id).then(({ data: p }) => setPlayer2(p)));
      }
      if (data.player1_partner_id) {
        fetches.push(tennis.getPlayerFull(data.player1_partner_id).then(({ data: p }) => setPlayer1Partner(p)));
      }
      if (data.player2_partner_id) {
        fetches.push(tennis.getPlayerFull(data.player2_partner_id).then(({ data: p }) => setPlayer2Partner(p)));
      }
      Promise.all(fetches).catch((err) => {
        if (__DEV__) console.warn("Player fetch failed:", err);
      });
    });

    tennis.getMatchComments(id).then(({ data }) => setComments(data));

    const channel: Channel = joinTennisMatchChannel(id, {
      onState: (m) => setMatch(m),
      onDelta: (diff) => setMatch((prev) => (prev ? { ...prev, ...diff } : prev)),
      onComment: (c) => setComments((prev) => [c, ...prev]),
    });

    return () => { channel.leave(); };
  }, [id]);

  if (loading || !match) {
    return (
      <SafeAreaView style={styles.center} edges={["bottom"]}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  const live = isLiveStatus(match.status);
  const finished = match.status.startsWith("finished");
  const cancelled = match.status === "cancelled" || match.status === "postponed";
  const accent = surfaceColor(match.surface);
  const isDoubles = doublesLabel(match.type) != null;
  const canCompare = !isDoubles && match.player1_id && match.player2_id;

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Match context card ───────────────────────────────────────── */}
        <View style={[styles.matchInfo, { borderLeftColor: accent }]}>
          <View style={styles.matchInfoTop}>
            <Text style={styles.tournamentName} numberOfLines={1}>
              {tournamentName || "Match"}
            </Text>
            {doublesLabel(match.type) && (
              <View style={styles.doublesBadge}>
                <Text style={styles.doublesBadgeText}>{doublesLabel(match.type)}</Text>
              </View>
            )}
          </View>
          <View style={styles.matchInfoMeta}>
            {match.round ? <Text style={[styles.matchInfoMetaText, { color: accent, fontWeight: "700" }]}>{match.round}</Text> : null}
            {match.round && surfaceLabel(match.surface) ? <Text style={styles.matchInfoDot}>·</Text> : null}
            {surfaceLabel(match.surface) ? <Text style={styles.matchInfoMetaText}>{surfaceLabel(match.surface)}</Text> : null}
            {match.court ? <Text style={styles.matchInfoDot}>·</Text> : null}
            {match.court ? <Text style={styles.matchInfoMetaText}>{match.court}</Text> : null}
          </View>

          {/* Status line */}
          <View style={styles.statusLine}>
            {live ? (
              <LiveBadge />
            ) : finished ? (
              <View style={styles.finalBadge}>
                <Text style={styles.finalBadgeText}>FINAL</Text>
              </View>
            ) : cancelled ? (
              <Text style={styles.cancelledText}>
                {match.status === "postponed" ? "Postponed" : "Cancelled"}
              </Text>
            ) : (
              <Text style={styles.scheduledText}>
                {match.starts_at ? formatDateTime(match.starts_at) : "Scheduled"}
              </Text>
            )}
            {finished && match.finished_at && (
              <Text style={styles.statusDetailText}>· {formatDateTime(match.finished_at)}</Text>
            )}
            {finished && formatDuration(match.duration) && (
              <Text style={styles.statusDetailText}>· {formatDuration(match.duration)}</Text>
            )}
          </View>
        </View>

        {/* ── Players ──────────────────────────────────────────────────── */}
        <View style={styles.playersSection}>
          <PlayerHeaderRow
            player={player1}
            partner={player1Partner}
            fallbackName={p1Name}
            isServing={live && match.live?.server === "1"}
            isWinner={finished && match.winner === 1}
            isLoser={finished && match.winner === 2}
            onPress={() => match.player1_id && router.push({ pathname: `/(app)/player/${match.player1_id}`, params: { teamId: match.tournament_id, from: "match" } })}
            onPartnerPress={() => match.player1_partner_id && router.push({ pathname: `/(app)/player/${match.player1_partner_id}`, params: { teamId: match.tournament_id, from: "match" } })}
          />
          <View style={styles.playerDivider} />
          <PlayerHeaderRow
            player={player2}
            partner={player2Partner}
            fallbackName={p2Name}
            isServing={live && match.live?.server === "2"}
            isWinner={finished && match.winner === 2}
            isLoser={finished && match.winner === 1}
            onPress={() => match.player2_id && router.push({ pathname: `/(app)/player/${match.player2_id}`, params: { teamId: match.tournament_id, from: "match" } })}
            onPartnerPress={() => match.player2_partner_id && router.push({ pathname: `/(app)/player/${match.player2_partner_id}`, params: { teamId: match.tournament_id, from: "match" } })}
          />
        </View>

        {/* ── Scoreboard ───────────────────────────────────────────────── */}
        <View style={styles.scoreboard}>
          {/* Set number header */}
          <View style={styles.scoreboardHeaderRow}>
            <View style={styles.scoreboardNameCol} />
            {(match.sets ?? []).map((_, i) => (
              <Text key={i} style={styles.scoreboardSetLabel}>SET {i + 1}</Text>
            ))}
            {live && match.live && <Text style={styles.scoreboardSetLabel}>NOW</Text>}
          </View>

          {([1, 2] as const).map((team) => {
            const isWinner = finished && match.winner === team;
            const isLoser = finished && match.winner !== null && match.winner !== team;
            const isServing = live && match.live?.server === String(team);
            const opp = team === 1 ? "2" : "1";
            const name = shortName(team === 1 ? player1 : player2, team === 1 ? p1Name : p2Name);
            const partner = team === 1 ? player1Partner : player2Partner;

            return (
              <View key={team} style={styles.scoreboardRow}>
                <View style={styles.scoreboardNameCol}>
                  {live && (isServing
                    ? <View style={styles.servingDot} />
                    : <View style={styles.servingDotPlaceholder} />
                  )}
                  <View style={{ flexShrink: 1 }}>
                    <Text
                      style={[styles.scoreboardName, isWinner && styles.winnerText, isLoser && styles.loserText]}
                      numberOfLines={1}
                    >
                      {name}
                    </Text>
                    {partner && (
                      <Text style={styles.scoreboardPartnerName} numberOfLines={1}>
                        {shortName(partner)}
                      </Text>
                    )}
                  </View>
                </View>

                {(match.sets ?? []).map((set, i) => {
                  const myGames = set[String(team) as "1" | "2"].games ?? 0;
                  const oppGames = set[opp as "1" | "2"].games ?? 0;
                  const myTb = set[String(team) as "1" | "2"].tiebreak;
                  const wonSet = myGames > oppGames;
                  const lostSet = myGames < oppGames;
                  const showTb = lostSet && myTb != null;

                  if (live && myGames === 0 && oppGames === 0) {
                    return <View key={i} style={styles.scoreboardSetCell} />;
                  }

                  return (
                    <View key={i} style={styles.scoreboardSetCell}>
                      <Text style={[styles.scoreboardGames, wonSet && styles.setWon, lostSet && styles.setLost]}>
                        {myGames}
                      </Text>
                      {showTb && <Text style={styles.tiebreakScore}>{myTb}</Text>}
                    </View>
                  );
                })}

                {live && match.live && (() => {
                  const gs1 = match.live.game_score_1;
                  const gs2 = match.live.game_score_2;
                  const myGs = team === 1 ? (gs1 || "0") : (gs2 || "0");
                  return (
                    <View style={styles.scoreboardSetCell}>
                      <Text style={styles.liveGameScore}>{myGs}</Text>
                    </View>
                  );
                })()}
              </View>
            );
          })}
        </View>

        {/* ── Compare button ──────────────────────────────────────────── */}
        {canCompare && (
          <TouchableOpacity
            style={[styles.compareBtn, { borderColor: accent + "55", backgroundColor: accent + "14" }]}
            onPress={() => router.push(`/(app)/match/h2h/${id}?from=matches`)}
            activeOpacity={0.75}
          >
            <Ionicons name="stats-chart" size={16} color={accent} />
            <Text style={[styles.compareBtnText, { color: accent }]}>Head to Head & Scout Report</Text>
            <Ionicons name="chevron-forward" size={16} color={accent} />
          </TouchableOpacity>
        )}

        {/* ── Commentary ───────────────────────────────────────────────── */}
        {comments.length > 0 && (
          <View style={styles.commentsSection}>
            <Text style={styles.sectionTitle}>Commentary</Text>
            {comments.map((c, i) => (
              <View key={c.id} style={[styles.comment, i === 0 && styles.commentFirst]}>
                <Text style={styles.commentBody}>{c.body}</Text>
              </View>
            ))}
          </View>
        )}
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
    center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
    scroll: { padding: spacing.md, paddingBottom: spacing.xl * 2 },

    // Match info card
    matchInfo: {
      borderLeftWidth: 4,
      paddingLeft: spacing.md,
      paddingVertical: spacing.xs,
      marginBottom: spacing.lg,
    },
    matchInfoTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
    tournamentName: { ...typography.h3, color: colors.text, fontWeight: "700", flex: 1 },
    doublesBadge: {
      backgroundColor: colors.card,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    doublesBadgeText: { ...typography.caption, color: colors.textSecondary, fontWeight: "700" },
    matchInfoMeta: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: 3 },
    matchInfoMetaText: { ...typography.caption, color: colors.textSecondary },
    matchInfoDot: { ...typography.caption, color: colors.textSecondary },
    statusLine: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.sm },
    finalBadge: {
      backgroundColor: colors.card,
      borderRadius: radius.full,
      paddingHorizontal: 8,
      paddingVertical: 3,
      alignSelf: "flex-start",
    },
    finalBadgeText: { ...typography.caption, color: colors.textSecondary, fontWeight: "700" },
    cancelledText: { ...typography.caption, color: colors.error ?? "#E05252", fontWeight: "600" },
    scheduledText: { ...typography.caption, color: colors.textSecondary, fontWeight: "600" },
    statusDetailText: { ...typography.caption, color: colors.textSecondary },

    // Players section
    playersSection: {
      backgroundColor: colors.card,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.md,
      borderWidth: 0.5,
      borderColor: colors.divider,
    },
    playerDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.divider,
      marginVertical: spacing.md,
    },
    playerHeaderRow: { flexDirection: "row", alignItems: "center" },
    photoWrapper: { position: "relative", marginRight: spacing.md },
    playerPhoto: { width: 56, height: 56, borderRadius: 28 },
    playerPhotoFallback: { backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
    playerPhotoInitials: { ...typography.label, color: colors.textSecondary, fontWeight: "700" },
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
    flagText: { fontSize: 13, lineHeight: 15 },
    serveBadge: {
      position: "absolute",
      left: -2,
      top: -2,
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: colors.live ?? colors.primary,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1.5,
      borderColor: colors.card,
    },
    playerHeaderInfo: { flex: 1, minWidth: 0 },
    playerHeaderNameRow: { flexDirection: "row", alignItems: "center" },
    playerHeaderName: { ...typography.body, color: colors.text, fontWeight: "700", flexShrink: 1 },
    playerHeaderPartner: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
    playerHeaderRank: { ...typography.caption, color: colors.textSecondary, marginTop: 2, fontWeight: "600" },
    winnerText: { color: colors.primary },
    loserText: { color: colors.textSecondary },
    followBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: radius.full,
      borderWidth: 1.5,
      borderColor: colors.primary,
      backgroundColor: "transparent",
      marginLeft: spacing.sm,
    },
    followBtnActive: { backgroundColor: colors.primary },
    followBtnText: { ...typography.caption, color: colors.primary, fontWeight: "700" },
    followBtnTextActive: { color: colors.background },

    // Scoreboard
    scoreboard: {
      backgroundColor: colors.card,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.md,
      borderWidth: 0.5,
      borderColor: colors.divider,
    },
    scoreboardHeaderRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.sm },
    scoreboardNameCol: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm, minWidth: 0 },
    scoreboardSetLabel: {
      ...typography.caption,
      color: colors.textSecondary,
      fontWeight: "700",
      width: 36,
      textAlign: "center",
    },
    scoreboardRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm },
    scoreboardName: { ...typography.body, color: colors.text, fontWeight: "600" },
    scoreboardPartnerName: { ...typography.caption, color: colors.textSecondary, marginTop: 1 },
    servingDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.live ?? colors.primary },
    servingDotPlaceholder: { width: 7, height: 7 },
    scoreboardSetCell: { width: 36, alignItems: "center", justifyContent: "center" },
    scoreboardGames: { ...typography.h3, color: colors.text, fontWeight: "700" },
    setWon: { color: colors.primary },
    setLost: { color: colors.textSecondary },
    tiebreakScore: { ...typography.caption, color: colors.textSecondary, fontSize: 10, marginTop: -2 },
    liveGameScore: { ...typography.h3, color: colors.live ?? colors.primary, fontWeight: "800" },

    // Compare button
    compareBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.xs,
      borderRadius: radius.md,
      borderWidth: 1,
      paddingVertical: spacing.md,
      marginBottom: spacing.md,
    },
    compareBtnText: { ...typography.label, fontWeight: "700" },

    // Commentary
    commentsSection: {
      backgroundColor: colors.card,
      borderRadius: radius.md,
      padding: spacing.md,
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
    comment: { paddingVertical: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider },
    commentFirst: { borderTopWidth: 0 },
    commentBody: { ...typography.body, color: colors.text },
  });
}
