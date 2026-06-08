import React, { useEffect, useMemo, useState, useCallback } from "react";
import { FlatList, View, Text, TextInput, ActivityIndicator, RefreshControl, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { tennis, TennisPlayer, useAuth } from "@juno/api";
import { PlayerCard, SkeletonCard, useTheme, spacing, radius, typography, type Palette } from "@juno/ui";

const TEAM_ID = process.env.EXPO_PUBLIC_TENNIS_TEAM_ID ?? "00000000-0000-0000-0000-000000000002";

type RankingType = {
  key: string;
  label: string;
  rankOf: (p: TennisPlayer) => number | null;
  rankLabel: string;
};

const RANKING_TYPES: RankingType[] = [
  { key: "singles", label: "Singles", rankOf: (p) => p.singles_rank, rankLabel: "Singles" },
  { key: "doubles", label: "Doubles", rankOf: (p) => p.doubles_rank, rankLabel: "Doubles" },
  { key: "race", label: "Race", rankOf: (p) => p.singles_race_rank, rankLabel: "Race" },
];

export default function RankingsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { session } = useAuth();
  const router = useRouter();
  const [rankingType, setRankingType] = useState(RANKING_TYPES[0]);
  const [players, setPlayers] = useState<TennisPlayer[]>([]);
  const [followedIds, setFollowedIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    return tennis.getTournamentPlayers(TEAM_ID).then(({ data }) => setPlayers(data));
  }, []);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    if (!session) {
      setFollowedIds([]);
      return;
    }
    tennis.getFollowedPlayers(session.token).then(({ data }) => setFollowedIds(data)).catch(() => {});
  }, [session]);

  useEffect(() => {
    if (query.length < 2) return;
    const timer = setTimeout(() => {
      tennis.searchPlayers(query).then(({ data }) => setPlayers(data));
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  function onRefresh() {
    setRefreshing(true);
    load().finally(() => setRefreshing(false));
  }

  async function toggleFollow(playerId: string) {
    if (!session) return;
    const isFollowed = followedIds.includes(playerId);
    setFollowedIds((ids) => (isFollowed ? ids.filter((id) => id !== playerId) : [...ids, playerId]));
    try {
      if (isFollowed) {
        await tennis.unfollowPlayer(playerId, session.token);
      } else {
        await tennis.followPlayer(playerId, session.token);
      }
    } catch {
      setFollowedIds((ids) => (isFollowed ? [...ids, playerId] : ids.filter((id) => id !== playerId)));
    }
  }

  const sorted = [...players].sort((a, b) => {
    const ra = rankingType.rankOf(a);
    const rb = rankingType.rankOf(b);
    if (ra == null) return rb == null ? 0 : 1;
    if (rb == null) return -1;
    return ra - rb;
  });

  const filtered = sorted.filter((p) => {
    if (!query.trim()) return true;
    const name = `${p.display_first_name ?? p.first_name} ${p.display_last_name ?? p.last_name}`.toLowerCase();
    return name.includes(query.trim().toLowerCase());
  });

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.segmented}>
        {RANKING_TYPES.map((type) => (
          <TouchableOpacity
            key={type.key}
            style={[styles.segment, rankingType.key === type.key && styles.segmentActive]}
            onPress={() => setRankingType(type)}
          >
            <Text style={[styles.segmentText, rankingType.key === type.key && styles.segmentTextActive]}>
              {type.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.searchBar}>
        <TextInput
          style={styles.input}
          placeholder="Search players…"
          value={query}
          onChangeText={setQuery}
          placeholderTextColor={colors.textSecondary}
        />
      </View>

      {loading ? (
        <View style={styles.list}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          renderItem={({ item }) => (
            <PlayerCard
              firstName={item.display_first_name ?? item.first_name}
              lastName={item.display_last_name ?? item.last_name}
              country={item.country}
              photo={item.photo}
              rank={rankingType.rankOf(item)}
              rankLabel={rankingType.rankLabel}
              following={session ? followedIds.includes(item.id) : undefined}
              onToggleFollow={session ? () => toggleFollow(item.id) : undefined}
              onPress={() => router.push(`/player/${item.id}`)}
            />
          )}
          ListEmptyComponent={<Text style={styles.empty}>No players found.</Text>}
        />
      )}
    </SafeAreaView>
  );
}

function createStyles(colors: Palette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    segmented: {
      flexDirection: "row",
      margin: spacing.md,
      marginBottom: 0,
      backgroundColor: colors.card,
      borderRadius: radius.full,
      padding: spacing.xs / 2,
    },
    segment: {
      flex: 1,
      paddingVertical: spacing.sm,
      borderRadius: radius.full,
      alignItems: "center",
    },
    segmentActive: { backgroundColor: colors.primary },
    segmentText: { ...typography.label, color: colors.textSecondary },
    segmentTextActive: { color: colors.textOnPrimary, fontWeight: "700" },
    searchBar: { padding: spacing.md },
    input: {
      backgroundColor: colors.card,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      fontSize: 15,
      color: colors.text,
    },
    list: { padding: spacing.md, paddingTop: 0 },
    empty: { ...typography.body, color: colors.textSecondary, textAlign: "center", marginTop: spacing.lg },
  });
}
