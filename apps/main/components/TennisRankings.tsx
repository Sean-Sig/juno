import React, { useEffect, useMemo, useState, useCallback } from "react";
import { FlatList, View, Text, TextInput, ActivityIndicator, RefreshControl, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { tennis, type TennisPlayer } from "@juno/api";
import { PlayerCard, SkeletonCard, useTheme, spacing, radius, typography, type Palette } from "@juno/ui";
import { useFollowedPlayers } from "../context/FollowedPlayersContext";

type Gender = "male" | "female";

type RankingType = {
  key: string;
  label: string;
  sort: string;
  rankOf: (p: TennisPlayer) => number | null;
  rankLabel: string;
};

const RANKING_TYPES: RankingType[] = [
  { key: "singles", label: "Singles", sort: "singles_rank", rankOf: (p) => p.singles_rank, rankLabel: "Singles" },
  { key: "doubles", label: "Doubles", sort: "doubles_rank", rankOf: (p) => p.doubles_rank, rankLabel: "Doubles" },
  { key: "race", label: "Race", sort: "singles_rank", rankOf: (p) => p.singles_race_rank, rankLabel: "Race" },
];

const GENDERS: { key: Gender; label: string }[] = [
  { key: "male", label: "Men" },
  { key: "female", label: "Women" },
];

const PER_PAGE = 50;

export default function RankingsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { followedIds, follow, unfollow, isFollowed } = useFollowedPlayers();
  const router = useRouter();
  const [rankingType, setRankingType] = useState(RANKING_TYPES[0]);
  const [gender, setGender] = useState<Gender>("male");
  const [players, setPlayers] = useState<TennisPlayer[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const load = useCallback(() => {
    setHasMore(true);
    return tennis
      .getPlayers({ sort: rankingType.sort, gender, page: 1, per_page: PER_PAGE })
      .then(({ data }) => {
        setPlayers(data);
        setHasMore(data.length === PER_PAGE);
      });
  }, [rankingType, gender]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  function loadMore() {
    if (loadingMore || !hasMore || loading || query.trim()) return;
    setLoadingMore(true);
    const nextPage = Math.floor(players.length / PER_PAGE) + 1;

    tennis
      .getPlayers({ sort: rankingType.sort, gender, page: nextPage, per_page: PER_PAGE })
      .then(({ data }) => {
        setPlayers((prev) => [...prev, ...data]);
        setHasMore(data.length === PER_PAGE);
      })
      .finally(() => setLoadingMore(false));
  }


  // Debounced search — switches to search endpoint while query is active
  useEffect(() => {
    if (!query.trim()) {
      load();
      return;
    }
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
    if (isFollowed(playerId)) {
      await unfollow(playerId);
    } else {
      await follow(playerId);
    }
  }

  // When viewing the race tab, sort client-side on the loaded page (server returns singles_rank order)
  const displayed = query.trim()
    ? players.filter((p) => {
        const name = `${p.display_first_name ?? p.first_name} ${p.display_last_name ?? p.last_name}`.toLowerCase();
        return name.includes(query.trim().toLowerCase());
      })
    : rankingType.key === "race"
    ? [...players].sort((a, b) => {
        const ra = a.singles_race_rank;
        const rb = b.singles_race_rank;
        if (ra == null) return rb == null ? 0 : 1;
        if (rb == null) return -1;
        return ra - rb;
      })
    : players;

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      {/* Men / Women toggle */}
      <View style={styles.genderRow}>
        {GENDERS.map((g) => (
          <TouchableOpacity
            key={g.key}
            style={[styles.genderBtn, gender === g.key && styles.genderBtnActive]}
            onPress={() => { setQuery(""); setGender(g.key); }}
          >
            <Text style={[styles.genderText, gender === g.key && styles.genderTextActive]}>
              {g.label}
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

      {/* Singles / Doubles / Race — horizontal scrolling chips */}
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
      ) : (
        <FlatList
          data={displayed}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          onEndReached={query.trim() ? undefined : loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primary} style={styles.footerSpinner} /> : null}
          renderItem={({ item }) => (
            <PlayerCard
              firstName={item.display_first_name ?? item.first_name}
              lastName={item.display_last_name ?? item.last_name}
              country={item.country}
              photo={item.photo}
              rank={rankingType.rankOf(item)}
              rankLabel={rankingType.rankLabel}
              following={isFollowed(item.id)}
              onToggleFollow={() => toggleFollow(item.id)}
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
    genderRow: {
      flexDirection: "row",
      marginHorizontal: spacing.md,
      marginTop: spacing.md,
      gap: spacing.sm,
    },
    genderBtn: {
      flex: 1,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      alignItems: "center",
      backgroundColor: colors.card,
      borderWidth: 1.5,
      borderColor: "transparent",
    },
    genderBtnActive: {
      borderColor: colors.primary,
      backgroundColor: colors.background,
    },
    genderText: { ...typography.label, color: colors.textSecondary },
    genderTextActive: { color: colors.primary, fontWeight: "700" },
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
    empty: { ...typography.body, color: colors.textSecondary, textAlign: "center", marginTop: spacing.lg },
  });
}
