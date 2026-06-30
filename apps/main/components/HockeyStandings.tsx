import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  SectionList,
  FlatList,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { hockey, type HockeyTeam, type HockeyPlayer } from "@juno/api";
import { PlayerCard, SkeletonCard, useTheme, spacing, typography, radius, type Palette } from "@juno/ui";
import { useFollowedPlayers } from "../context/FollowedPlayersContext";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ViewMode = "teams" | "players";
type Section = { title: string; data: HockeyTeam[] };
type PositionFilter = "all" | "F" | "D" | "G";

const POSITIONS: { key: PositionFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "F", label: "Forward" },
  { key: "D", label: "Defense" },
  { key: "G", label: "Goalie" },
];

const PER_PAGE = 50;

// ---------------------------------------------------------------------------
// Teams view helpers
// ---------------------------------------------------------------------------

function groupByConference(teams: HockeyTeam[]): Section[] {
  const map = new Map<string, HockeyTeam[]>();
  for (const t of teams) {
    const key = t.conference ?? "Other";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(t);
  }
  const sections: Section[] = [];
  for (const [title, data] of map.entries()) {
    sections.push({
      title,
      data: data.sort((a, b) => {
        if (a.standing_rank != null && b.standing_rank != null) {
          return a.standing_rank - b.standing_rank;
        }
        return (b.points ?? 0) - (a.points ?? 0);
      }),
    });
  }
  sections.sort((a, b) => {
    const order = ["Eastern", "Western", "East", "West"];
    const ai = order.findIndex((o) => a.title.includes(o));
    const bi = order.findIndex((o) => b.title.includes(o));
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  return sections;
}

function TeamRow({ team, rank }: { team: HockeyTeam; rank: number }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const wlotl = `${team.wins}-${team.losses}${team.overtime_losses != null ? `-${team.overtime_losses}` : ""}`;

  return (
    <View style={styles.teamRow}>
      <Text style={styles.rank}>{rank}</Text>
      {team.logo ? (
        <Image source={{ uri: team.logo }} style={styles.teamLogo} cachePolicy="memory-disk" contentFit="contain" />
      ) : null}
      <View style={styles.nameCol}>
        <Text style={styles.teamName} numberOfLines={1}>
          {team.name}
        </Text>
        {team.abbreviation && <Text style={styles.teamAbbrev}>{team.abbreviation}</Text>}
      </View>
      <Text style={styles.wlotl}>{wlotl}</Text>
      <Text style={styles.pts}>{team.points ?? "-"}</Text>
      {team.wins_home != null && team.losses_home != null && (
        <Text style={styles.split}>
          {team.wins_home}-{team.losses_home}
        </Text>
      )}
      {team.wins_away != null && team.losses_away != null && (
        <Text style={styles.split}>
          {team.wins_away}-{team.losses_away}
        </Text>
      )}
    </View>
  );
}

function TableHeader() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={[styles.teamRow, styles.headerRow]}>
      <Text style={[styles.rank, styles.headerText]}>#</Text>
      <View style={styles.nameCol}>
        <Text style={styles.headerText}>Team</Text>
      </View>
      <Text style={[styles.wlotl, styles.headerText]}>W-L-OTL</Text>
      <Text style={[styles.pts, styles.headerText]}>PTS</Text>
      <Text style={[styles.split, styles.headerText]}>HOME</Text>
      <Text style={[styles.split, styles.headerText]}>AWAY</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Teams view
// ---------------------------------------------------------------------------

function TeamsView({ colors }: { colors: Palette }) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data } = await hockey.getTeams({ league: "NHL" });
    setSections(groupByConference(data));
  }, []);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  function onRefresh() {
    setRefreshing(true);
    load().finally(() => setRefreshing(false));
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (sections.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>No standings yet</Text>
        <Text style={styles.emptyText}>Standings will appear once the season is underway.</Text>
      </View>
    );
  }

  return (
    <SectionList
      sections={sections}
      keyExtractor={(t) => t.id}
      contentContainerStyle={styles.listContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
      stickySectionHeadersEnabled
      ListHeaderComponent={<TableHeader />}
      renderSectionHeader={({ section }) => (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{section.title} Conference</Text>
        </View>
      )}
      renderItem={({ item, index }) => <TeamRow team={item} rank={index + 1} />}
    />
  );
}

// ---------------------------------------------------------------------------
// Players view
// ---------------------------------------------------------------------------

function PlayersView({ colors }: { colors: Palette }) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { isFollowed, follow, unfollow } = useFollowedPlayers();

  const [players, setPlayers] = useState<HockeyPlayer[]>([]);
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState<PositionFilter>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const load = useCallback((searchQuery?: string, positionFilter?: PositionFilter) => {
    setHasMore(true);
    return hockey
      .getPlayers({
        league: "NHL",
        q: searchQuery || undefined,
        position: positionFilter && positionFilter !== "all" ? positionFilter : undefined,
        page: 1,
        per_page: PER_PAGE,
      })
      .then(({ data }) => {
        setPlayers(data);
        setHasMore(data.length === PER_PAGE);
      });
  }, []);

  useEffect(() => {
    setLoading(true);
    load(undefined, position).finally(() => setLoading(false));
  }, [position]);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      load(undefined, position);
      return;
    }
    const timer = setTimeout(() => {
      setLoading(true);
      load(query.trim(), position).finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  function onRefresh() {
    setRefreshing(true);
    load(query.trim() || undefined, position).finally(() => setRefreshing(false));
  }

  function loadMore() {
    if (loadingMore || !hasMore || loading || query.trim()) return;
    setLoadingMore(true);
    const nextPage = Math.floor(players.length / PER_PAGE) + 1;
    hockey
      .getPlayers({
        league: "NHL",
        position: position !== "all" ? position : undefined,
        page: nextPage,
        per_page: PER_PAGE,
      })
      .then(({ data }) => {
        setPlayers((prev) => [...prev, ...data]);
        setHasMore(data.length === PER_PAGE);
      })
      .finally(() => setLoadingMore(false));
  }

  async function toggleFollow(playerId: string) {
    if (isFollowed(playerId)) await unfollow(playerId);
    else await follow(playerId);
  }

  const displayed = players;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      {/* Search bar */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.input}
          placeholder="Search players…"
          value={query}
          onChangeText={setQuery}
          placeholderTextColor={colors.textSecondary}
          returnKeyType="search"
        />
      </View>

      {/* Position filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.typePicker}
        contentContainerStyle={styles.typePickerContent}
      >
        {POSITIONS.map((pos) => (
          <TouchableOpacity
            key={pos.key}
            style={[styles.typeChip, position === pos.key && styles.typeChipActive]}
            onPress={() => setPosition(pos.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.typeChipText, position === pos.key && styles.typeChipTextActive]}>
              {pos.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.playerList}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : (
        <FlatList
          data={displayed}
          keyExtractor={(p) => p.id}
          contentContainerStyle={[styles.playerList, displayed.length === 0 && styles.playerListEmpty]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          onEndReached={query.trim() ? undefined : loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator color={colors.primary} style={styles.footerSpinner} /> : null
          }
          renderItem={({ item }) => (
            <PlayerCard
              firstName={item.first_name}
              lastName={item.last_name}
              country={item.country}
              subtitle={item.position}
              photo={item.photo}
              rank={item.jersey_number != null ? parseInt(item.jersey_number, 10) || null : null}
              rankLabel="No."
              following={isFollowed(item.id)}
              onToggleFollow={() => toggleFollow(item.id)}
              onPress={() => router.push(`/(app)/player/${item.id}`)}
            />
          )}
          ListEmptyComponent={<Text style={styles.empty}>No players found.</Text>}
        />
      )}
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------
// Root export
// ---------------------------------------------------------------------------

export default function HockeyStandings() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [view, setView] = useState<ViewMode>("players");

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      {/* Players / Rankings toggle */}
      <View style={styles.tabBar}>
        {(["players", "teams"] as ViewMode[]).map((v) => (
          <TouchableOpacity
            key={v}
            style={[styles.tabItem, view === v && styles.tabItemActive]}
            onPress={() => setView(v)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabLabel, view === v && styles.tabLabelActive]}>
              {v === "players" ? "Players" : "Rankings"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {view === "teams" ? (
        <TeamsView colors={colors} />
      ) : (
        <PlayersView colors={colors} />
      )}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

function createStyles(colors: Palette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },

    // Toggle tab bar
    tabBar: {
      flexDirection: "row",
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.divider,
    },
    tabItem: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: spacing.sm + 2,
    },
    tabItemActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
    tabLabel: { ...typography.label, color: colors.textSecondary },
    tabLabelActive: { color: colors.primary, fontWeight: "700" },

    // Teams view
    listContent: { paddingBottom: spacing.lg },
    emptyTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.xs },
    emptyText: { ...typography.body, color: colors.textSecondary, textAlign: "center" },
    sectionHeader: {
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    sectionTitle: {
      ...typography.label,
      color: colors.textSecondary,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    headerRow: {
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.divider,
    },
    headerText: {
      ...typography.caption,
      color: colors.textSecondary,
      fontWeight: "700",
      textTransform: "uppercase",
    },
    teamRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
    },
    rank: { ...typography.caption, color: colors.textSecondary, width: 22, textAlign: "center" },
    teamLogo: { width: 24, height: 24, marginLeft: spacing.xs },
    nameCol: { flex: 1, paddingHorizontal: spacing.xs },
    teamName: { ...typography.label, color: colors.text, fontWeight: "600" },
    teamAbbrev: { ...typography.caption, color: colors.textSecondary },
    wlotl: { ...typography.label, color: colors.text, width: 60, textAlign: "center" },
    pts: { ...typography.label, color: colors.primary, width: 36, textAlign: "center", fontWeight: "700" },
    split: { ...typography.caption, color: colors.textSecondary, width: 44, textAlign: "center" },

    // Players view
    searchBar: { padding: spacing.md, paddingBottom: spacing.sm },
    input: {
      backgroundColor: colors.card,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      fontSize: 15,
      color: colors.text,
    },
    typePicker: {
      flexGrow: 0,
      flexShrink: 0,
      marginHorizontal: spacing.md,
      marginBottom: spacing.sm,
    },
    typePickerContent: { gap: spacing.xs },
    typeChip: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.full,
      backgroundColor: colors.card,
    },
    typeChipActive: { backgroundColor: colors.primary },
    typeChipText: { ...typography.label, color: colors.textSecondary },
    typeChipTextActive: { color: colors.textOnPrimary, fontWeight: "700" },
    playerList: { padding: spacing.md, paddingTop: 0 },
    playerListEmpty: { flexGrow: 1, justifyContent: "center" },
    footerSpinner: { marginVertical: spacing.md },
    empty: { ...typography.body, color: colors.textSecondary, textAlign: "center" },
  });
}
