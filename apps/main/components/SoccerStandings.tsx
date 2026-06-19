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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { soccer, type SoccerTeam, type SoccerPlayer } from "@juno/api";
import { PlayerCard, SkeletonCard, useTheme, spacing, typography, radius, type Palette } from "@juno/ui";
import { useFollowedPlayers } from "../context/FollowedPlayersContext";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ViewMode = "teams" | "players";
type Section = { title: string; data: SoccerTeam[] };
type PositionFilter = "all" | "GK" | "DF" | "MF" | "FW";

const POSITIONS: { key: PositionFilter; label: string; match: (pos: string) => boolean }[] = [
  { key: "all", label: "All", match: () => true },
  { key: "GK", label: "Goalkeepers", match: (p) => p.includes("keeper") || p === "gk" },
  { key: "DF", label: "Defenders", match: (p) => p.includes("defen") || p === "df" },
  { key: "MF", label: "Midfielders", match: (p) => p.includes("mid") || p === "mf" },
  { key: "FW", label: "Forwards", match: (p) => p.includes("forward") || p.includes("striker") || p.includes("attack") || p === "fw" },
];

const LEAGUES = ["EPL", "LaLiga", "SerieA", "Bundesliga", "Ligue1", "MLS", "UCL", "UEL", "WorldCup"];
const LEAGUE_LABELS: Record<string, string> = {
  EPL: "EPL",
  LaLiga: "La Liga",
  SerieA: "Serie A",
  Bundesliga: "Bundesliga",
  Ligue1: "Ligue 1",
  MLS: "MLS",
  UCL: "Champions League",
  UEL: "Europa League",
  WorldCup: "World Cup",
};

const PER_PAGE = 50;

// ---------------------------------------------------------------------------
// Teams view helpers
// ---------------------------------------------------------------------------

function groupByLeague(teams: SoccerTeam[]): Section[] {
  const map = new Map<string, SoccerTeam[]>();
  for (const t of teams) {
    const key = t.league ?? "Other";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(t);
  }
  const sections: Section[] = [];
  for (const [key, data] of map.entries()) {
    sections.push({
      title: LEAGUE_LABELS[key] ?? key,
      data: data.sort((a, b) => {
        if (a.standing_rank != null && b.standing_rank != null) {
          return a.standing_rank - b.standing_rank;
        }
        if ((b.points ?? 0) !== (a.points ?? 0)) return (b.points ?? 0) - (a.points ?? 0);
        return (b.goal_difference ?? 0) - (a.goal_difference ?? 0);
      }),
    });
  }
  sections.sort((a, b) => {
    const order = Object.values(LEAGUE_LABELS);
    return order.indexOf(a.title) - order.indexOf(b.title);
  });
  return sections;
}

function TeamRow({ team, rank }: { team: SoccerTeam; rank: number }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.teamRow}>
      <Text style={styles.rank}>{rank}</Text>
      <View style={styles.nameCol}>
        <Text style={styles.teamName} numberOfLines={1}>
          {team.name}
        </Text>
        {team.abbreviation && <Text style={styles.teamAbbrev}>{team.abbreviation}</Text>}
      </View>
      <Text style={styles.wdl}>{team.wins}-{team.draws}-{team.losses}</Text>
      <Text style={styles.split}>{team.goal_difference != null ? (team.goal_difference > 0 ? `+${team.goal_difference}` : team.goal_difference) : "-"}</Text>
      <Text style={styles.pts}>{team.points ?? "-"}</Text>
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
      <Text style={[styles.wdl, styles.headerText]}>W-D-L</Text>
      <Text style={[styles.split, styles.headerText]}>GD</Text>
      <Text style={[styles.pts, styles.headerText]}>PTS</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Teams view
// ---------------------------------------------------------------------------

type LeagueFilter = "all" | (typeof LEAGUES)[number];

function TeamsView({ colors }: { colors: Palette }) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [leagueFilter, setLeagueFilter] = useState<LeagueFilter>("all");
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (league: LeagueFilter) => {
    const { data } = await soccer.getTeams(league !== "all" ? { league } : undefined);
    setSections(groupByLeague(data));
  }, []);

  useEffect(() => {
    setLoading(true);
    load(leagueFilter).finally(() => setLoading(false));
  }, [leagueFilter, load]);

  function onRefresh() {
    setRefreshing(true);
    load(leagueFilter).finally(() => setRefreshing(false));
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.typePicker}
        contentContainerStyle={styles.typePickerContent}
      >
        {(["all", ...LEAGUES] as LeagueFilter[]).map((key) => (
          <TouchableOpacity
            key={key}
            style={[styles.typeChip, leagueFilter === key && styles.typeChipActive]}
            onPress={() => setLeagueFilter(key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.typeChipText, leagueFilter === key && styles.typeChipTextActive]}>
              {key === "all" ? "All" : LEAGUE_LABELS[key] ?? key}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : sections.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>No standings yet</Text>
          <Text style={styles.emptyText}>Standings will appear once the season is underway.</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(t) => t.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          stickySectionHeadersEnabled
          ListHeaderComponent={sections.length === 1 ? <TableHeader /> : undefined}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
          )}
          renderItem={({ item, index }) => <TeamRow team={item} rank={index + 1} />}
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Players view
// ---------------------------------------------------------------------------

function PlayersView({ colors }: { colors: Palette }) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { isFollowed, follow, unfollow } = useFollowedPlayers();

  const [players, setPlayers] = useState<SoccerPlayer[]>([]);
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState<PositionFilter>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const load = useCallback((searchQuery?: string) => {
    setHasMore(true);
    return soccer
      .getPlayers({ q: searchQuery || undefined, page: 1, per_page: PER_PAGE })
      .then(({ data }) => {
        setPlayers(data);
        setHasMore(data.length === PER_PAGE);
      });
  }, []);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      load();
      return;
    }
    const timer = setTimeout(() => {
      setLoading(true);
      load(query.trim()).finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  function onRefresh() {
    setRefreshing(true);
    load(query.trim() || undefined).finally(() => setRefreshing(false));
  }

  function loadMore() {
    if (loadingMore || !hasMore || loading || query.trim()) return;
    setLoadingMore(true);
    const nextPage = Math.floor(players.length / PER_PAGE) + 1;
    soccer
      .getPlayers({ page: nextPage, per_page: PER_PAGE })
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

  const displayed = useMemo(() => {
    if (position === "all") return players;
    const filter = POSITIONS.find((p) => p.key === position)!;
    return players.filter((p) => filter.match((p.position ?? "").toLowerCase()));
  }, [players, position]);

  return (
    <View style={{ flex: 1 }}>
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
          contentContainerStyle={styles.playerList}
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
    </View>
  );
}

// ---------------------------------------------------------------------------
// Root export
// ---------------------------------------------------------------------------

export default function SoccerStandings() {
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
              {v === "players" ? "Players" : "Standings"}
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
    nameCol: { flex: 1, paddingHorizontal: spacing.xs },
    teamName: { ...typography.label, color: colors.text, fontWeight: "600" },
    teamAbbrev: { ...typography.caption, color: colors.textSecondary },
    wdl: { ...typography.label, color: colors.text, width: 60, textAlign: "center" },
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
    footerSpinner: { marginVertical: spacing.md },
    empty: { ...typography.body, color: colors.textSecondary, textAlign: "center", marginTop: spacing.lg },
  });
}
