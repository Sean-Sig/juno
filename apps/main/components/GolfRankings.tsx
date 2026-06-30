import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { FlatList, View, Text, TextInput, ActivityIndicator, RefreshControl, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { golf, type GolfPlayer } from "@juno/api";
import { PlayerCard, SkeletonCard, useTheme, spacing, radius, typography, type Palette } from "@juno/ui";
import { useFollowedPlayers } from "../context/FollowedPlayersContext";

type RankingType = {
  key: string;
  label: string;
  sort: string;
  rankOf: (p: GolfPlayer) => number | null;
  rankLabel: string;
};

const RANKING_TYPES: RankingType[] = [
  { key: "world", label: "World", sort: "world_rankings", rankOf: (p) => p.world_rankings_rank, rankLabel: "WR" },
  { key: "rolex", label: "Rolex", sort: "rolex_world_rankings", rankOf: (p) => p.rolex_world_rankings_rank, rankLabel: "Rolex" },
];

const PER_PAGE = 50;

export default function RankingsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { followedIds, follow, unfollow, isFollowed } = useFollowedPlayers();
  const router = useRouter();
  const [rankingType, setRankingType] = useState(RANKING_TYPES[0]);
  const [players, setPlayers] = useState<GolfPlayer[]>([]);
  const [searchResults, setSearchResults] = useState<GolfPlayer[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(() => {
    setHasMore(true);
    return golf.getPlayers({ sort: rankingType.sort, page: 1, per_page: PER_PAGE }).then(({ data }) => {
      setPlayers(data);
      setHasMore(data.length === PER_PAGE);
    });
  }, [rankingType]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  // Debounced server-side search — fires 500 ms after the user stops typing,
  // and only when there are at least 2 characters.
  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      setSearching(false); // reset spinner if user clears the field
      return;
    }

    setSearching(true);
    searchDebounce.current = setTimeout(() => {
      golf
        .getPlayers({ name: trimmed, sort: rankingType.sort, per_page: PER_PAGE })
        .then(({ data }) => setSearchResults(data))
        .finally(() => setSearching(false));
    }, 500);

    return () => {
      if (searchDebounce.current) clearTimeout(searchDebounce.current);
    };
  }, [query, rankingType]);

  function loadMore() {
    if (loadingMore || !hasMore || loading || query.trim()) return;
    setLoadingMore(true);
    const nextPage = Math.floor(players.length / PER_PAGE) + 1;

    golf
      .getPlayers({ sort: rankingType.sort, page: nextPage, per_page: PER_PAGE })
      .then(({ data }) => {
        setPlayers((prev) => [...prev, ...data]);
        setHasMore(data.length === PER_PAGE);
      })
      .finally(() => setLoadingMore(false));
  }

  function onRefresh() {
    setRefreshing(true);
    load().finally(() => setRefreshing(false));
  }

  async function toggleFollow(playerId: string) {
    if (isFollowed(playerId)) {
      await unfollow(playerId);
    } else {
      await follow(playerId);
    }
  }

  // When searching, show server results; otherwise show the paginated ranked list
  const isSearching = query.trim().length >= 2;
  const filtered = isSearching ? searchResults : players;

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      <View style={styles.searchBar}>
        <TextInput
          style={styles.input}
          placeholder="Search players…"
          value={query}
          onChangeText={setQuery}
          placeholderTextColor={colors.textSecondary}
        />
      </View>

      <FlatList
        horizontal
        data={RANKING_TYPES}
        keyExtractor={(t) => t.key}
        showsHorizontalScrollIndicator={false}
        style={styles.typePicker}
        contentContainerStyle={styles.typePickerContent}
        renderItem={({ item: type }) => (
          <TouchableOpacity
            style={[styles.typeChip, rankingType.key === type.key && styles.typeChipActive]}
            onPress={() => setRankingType(type)}
          >
            <Text style={[styles.typeChipText, rankingType.key === type.key && styles.typeChipTextActive]}>
              {type.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      {loading ? (
        <View style={styles.list}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : searching ? (
        <View style={styles.searchingWrap}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.list}
          refreshControl={
            isSearching ? undefined : (
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
            )
          }
          onEndReached={isSearching ? undefined : loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primary} style={styles.footerSpinner} /> : null}
          renderItem={({ item }) => (
            <PlayerCard
              firstName={item.first_name}
              lastName={item.last_name}
              country={item.country}
              photo={item.photo}
              rank={rankingType.rankOf(item)}
              rankLabel={rankingType.rankLabel}
              following={isFollowed(item.id)}
              onToggleFollow={() => toggleFollow(item.id)}
              onPress={() => router.push(`/player/${item.id}`)}
            />
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {isSearching ? `No players matching "${query.trim()}".` : "No players found."}
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

function createStyles(colors: Palette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    typePicker: {
      marginHorizontal: spacing.md,
      marginTop: 0,
      marginBottom: spacing.sm,
      flexGrow: 0,
      flexShrink: 0,
    },
    typePickerContent: {
      gap: spacing.xs,
    },
    typeChip: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.full,
      backgroundColor: colors.card,
    },
    typeChipActive: { backgroundColor: colors.primary },
    typeChipText: { ...typography.label, color: colors.textSecondary },
    typeChipTextActive: { color: colors.textOnPrimary, fontWeight: "700" },
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
    footerSpinner: { marginVertical: spacing.md },
    searchingWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: spacing.xl },
    empty: { ...typography.body, color: colors.textSecondary, textAlign: "center", marginTop: spacing.lg },
  });
}
