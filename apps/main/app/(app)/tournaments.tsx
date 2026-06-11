import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { golf, GolfTournament, GolfScore, GolfRoundDetail, joinGolfChannel } from "@juno/api";
import { useTheme, spacing, radius, typography, type Palette } from "@juno/ui";

const TEAM_ID = process.env.EXPO_PUBLIC_GOLF_TEAM_ID ?? "00000000-0000-0000-0000-000000000001";

export default function TournamentsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [tournaments, setTournaments] = useState<GolfTournament[]>([]);
  const [selected, setSelected] = useState<GolfTournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const channelRef = useRef<ReturnType<typeof joinGolfChannel> | null>(null);
  const router = useRouter();

  const load = useCallback(() => {
    return golf.getTournaments(TEAM_ID).then(({ data }) => {
      setTournaments(data);
      // Default to the live tournament, then first with events, then first overall
      const active =
        data.find((t) => t.events?.some((e) => e.live)) ??
        data.find((t) => t.events?.length > 0) ??
        data[0] ??
        null;
      setSelected((prev) => prev ?? active);
    }).catch(() => {});
  }, []);

  function onRefresh() {
    setRefreshing(true);
    load().finally(() => setRefreshing(false));
  }

  useEffect(() => {
    load().finally(() => setLoading(false));

    const channel = joinGolfChannel(TEAM_ID, {
      onState: (t) => {
        setTournaments((prev) =>
          prev.map((existing) => (existing.id === t.id ? t : existing))
        );
        setSelected((prev) => (prev?.id === t.id ? t : prev));
      },
      onDelta: (diff) => {
        setSelected((prev) => (prev ? { ...prev, ...diff } : prev));
      },
    });

    channelRef.current = channel;
    return () => { channel.leave(); };
  }, []);

  const scores = useMemo(() => {
    const raw = selected?.events?.[0]?.scores ?? [];
    return [...raw].sort((a, b) => {
      // Group priority: active players first, then missed cut, then DQ/WD
      const group = (s: GolfScore) => s.dq || s.wd ? 2 : s.made_cut ? 0 : 1;
      const ga = group(a);
      const gb = group(b);
      if (ga !== gb) return ga - gb;
      // Within each group: sort by par numerically — negative → E (0) → positive
      if (a.par !== b.par) return a.par - b.par;
      // Tiebreaker: use Enet's official sort_order
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });
  }, [selected]);
  const isLive = selected?.events?.some((e) => e.live) ?? false;

  if (loading) {
    return (
      <SafeAreaView style={styles.center} edges={["left", "right"]}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (tournaments.length === 0) {
    return (
      <SafeAreaView style={styles.center} edges={["left", "right"]}>
        <Text style={styles.empty}>No tournaments available</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      {/* Tournament picker — horizontal chips */}
      {tournaments.length > 1 && (
        <FlatList
          horizontal
          data={tournaments}
          keyExtractor={(t) => t.id}
          showsHorizontalScrollIndicator={false}
          style={styles.picker}
          contentContainerStyle={styles.pickerContent}
          renderItem={({ item }) => {
            const active = selected?.id === item.id;
            const live = item.events?.some((e) => e.live) ?? false;
            return (
              <TouchableOpacity
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setSelected(item)}
              >
                {live && <View style={styles.liveDot} />}
                <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Selected tournament header */}
      {selected && (
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>{selected.name}</Text>
            {isLive && <View style={styles.liveBadge}><Text style={styles.liveBadgeText}>LIVE</Text></View>}
          </View>
          {selected.events?.[0]?.name ? (
            <Text style={styles.subtitle}>{selected.events[0].name}</Text>
          ) : null}
        </View>
      )}

      {/* Leaderboard */}
      {scores.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.empty}>No scores yet</Text>
        </View>
      ) : (
        <FlatList
          data={scores}
          keyExtractor={(s) => s.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          renderItem={({ item }) => (
            <LeaderboardRow
              score={item}
              onPress={() => {
                const firstName = item.player?.display_first_name ?? item.player?.first_name ?? "";
                const lastName = item.player?.display_last_name ?? item.player?.last_name ?? "";
                router.push({
                  pathname: "/(app)/scorecard",
                  params: {
                    playerName: `${firstName} ${lastName}`.trim(),
                    tournamentName: selected?.name ?? "",
                    mostRecentRound: selected?.events?.[0]?.most_recently_scored_round ?? "",
                    details: JSON.stringify(item.details ?? {}),
                    totalPar: item.par,
                    totalStrokes: item.strokes,
                    displayPlace: item.display_place ?? "",
                    courses: JSON.stringify(selected?.courses ?? []),
                  },
                });
              }}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </SafeAreaView>
  );
}

function LeaderboardRow({ score, onPress }: { score: GolfScore; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Show a status badge for non-standard outcomes
  const badge = score.dq ? "DQ" : score.wd ? "WD" : !score.made_cut && score.par !== 0 ? "MC" : null;

  // Only tappable if at least one round has stroke data
  const hasRoundData = Object.values(score.details ?? {}).some(
    (r) => (r as GolfRoundDetail)?.strokes != null && (r as GolfRoundDetail).strokes! > 0
  );

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={hasRoundData ? onPress : undefined}
      activeOpacity={hasRoundData ? 0.7 : 1}
    >
      <Text style={styles.place}>{score.display_place ?? "—"}</Text>
      <View style={styles.playerInfo}>
        <Text style={styles.playerName}>
          {score.player?.display_first_name ?? score.player?.first_name}{" "}
          {score.player?.display_last_name ?? score.player?.last_name}
        </Text>
        <Text style={styles.country}>{score.player?.country}</Text>
      </View>
      <View style={styles.scoreRight}>
        {badge ? (
          <Text style={styles.badge}>{badge}</Text>
        ) : hasRoundData ? (
          <Text style={[styles.score, score.par < 0 && styles.under]}>
            {score.par === 0 ? "E" : score.par > 0 ? `+${score.par}` : score.par}
          </Text>
        ) : null}
        {hasRoundData && <Text style={styles.chevron}>›</Text>}
      </View>
    </TouchableOpacity>
  );
}

function createStyles(colors: Palette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
    picker: {
      flexGrow: 0,
      flexShrink: 0,
      marginHorizontal: spacing.md,
      marginTop: spacing.md,
    },
    pickerContent: {
      gap: spacing.xs,
    },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.full,
      backgroundColor: colors.card,
      gap: spacing.xs,
    },
    chipActive: { backgroundColor: colors.primary },
    chipText: { ...typography.label, color: colors.textSecondary },
    chipTextActive: { color: colors.textOnPrimary, fontWeight: "700" },
    liveDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: colors.live ?? "#ef4444",
    },
    header: {
      padding: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.card,
      marginTop: spacing.sm,
    },
    headerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    title: { ...typography.h2, color: colors.text, flex: 1 },
    subtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
    liveBadge: {
      backgroundColor: colors.live ?? "#ef4444",
      borderRadius: radius.sm,
      paddingHorizontal: spacing.xs,
      paddingVertical: 2,
    },
    liveBadgeText: { ...typography.caption, color: "#fff", fontWeight: "700", fontSize: 10 },
    row: { flexDirection: "row", alignItems: "center", padding: spacing.md, backgroundColor: colors.card },
    place: { width: 36, ...typography.label, color: colors.textSecondary },
    playerInfo: { flex: 1 },
    playerName: { ...typography.body, color: colors.text, fontWeight: "600" },
    country: { ...typography.caption, color: colors.textSecondary },
    scoreRight: { flexDirection: "row", alignItems: "center", gap: 4 },
    score: { ...typography.h3, color: colors.text },
    under: { color: colors.primary },
    badge: { ...typography.caption, color: colors.textSecondary, fontWeight: "700" },
    chevron: { ...typography.h2, color: colors.textSecondary, lineHeight: 24 },
    separator: { height: 1, backgroundColor: colors.border },
    empty: { ...typography.body, color: colors.textSecondary },
  });
}
