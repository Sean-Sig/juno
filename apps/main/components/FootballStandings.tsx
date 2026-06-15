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
import { football, type FootballTeam, type FootballPlayer } from "@juno/api";
import { PlayerCard, SkeletonCard, useTheme, spacing, typography, radius, type Palette } from "@juno/ui";
import { useFollowedPlayers } from "../context/FollowedPlayersContext";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ViewMode = "teams" | "players";
type Section = { title: string; data: FootballTeam[] };
type PositionFilter = "all" | "QB" | "RB" | "WR" | "TE" | "OL" | "DL" | "LB" | "DB" | "K";

const POSITIONS: { key: PositionFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "QB", label: "QB" },
  { key: "RB", label: "RB" },
  { key: "WR", label: "WR" },
  { key: "TE", label: "TE" },
  { key: "OL", label: "OL" },
  { key: "DL", label: "DL" },
  { key: "LB", label: "LB" },
  { key: "DB", label: "DB" },
  { key: "K", label: "K/P" },
];

const PER_PAGE = 50;

// ---------------------------------------------------------------------------
// Teams view helpers
// ---------------------------------------------------------------------------

function groupByDivision(teams: FootballTeam[]): Section[] {
  const map = new Map<string, FootballTeam[]>();
  for (const t of teams) {
    const key =
      t.conference && t.division
        ? `${t.conference} ${t.division}`
        : t.conference ?? t.division ?? "Other";
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
        return b.wins - a.wins;
      }),
    });
  }
  sections.sort((a, b) => {
    const confOrder = ["AFC", "NFC"];
    const divOrder = ["East", "North", "South", "West"];
    const [aConf = "", aDiv = ""] = a.title.split(" ");
    const [bConf = "", bDiv = ""] = b.title.split(" ");
    const confDiff =
      (confOrder.indexOf(aConf) === -1 ? 99 : confOrder.indexOf(aConf)) -
      (confOrder.indexOf(bConf) === -1 ? 99 : confOrder.indexOf(bConf));
    if (confDiff !== 0) return confDiff;
    return (
      (divOrder.indexOf(aDiv) === -1 ? 99 : divOrder.indexOf(aDiv)) -
      (divOrder.indexOf(bDiv) === -1 ? 99 : divOrder.indexOf(bDiv))
    );
  });
  return sections;
}

function wlt(team: FootballTeam): string {
  if (team.ties != null && team.ties > 0) {
    return `${team.wins}-${team.losses}-${team.ties}`;
  }
  return `${team.wins}-${team.losses}`;
}

function TeamRow({ team, rank }: { team: FootballTeam; rank: number }) {
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
      <Text style={styles.record}>{wlt(team)}</Text>
      {team.points_for != null && <Text style={styles.pts}>{team.points_for}</Text>}
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
      <Text style={[styles.record, styles.headerText]}>W-L</Text>
      <Text style={[styles.pts, styles.headerText]}>PF</Text>
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
    const { data } = await football.getTeams({ league: "NFL" });
    setSections(groupByDivision(data));
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
          <Text style={styles.sectionTitle}>{section.title}</Text>
        </View>
      )}
      renderItem={({ item, index }) => <TeamRow team={item} rank={index + 1} />}
    />
  );
}

// ---------------------------------------------------------------------------
// Players view
// ---------------------------------------------------------------------------

// Position matching for football (handles multi-position codes like "T", "G", "C" → OL)
const OL_POSITIONS = new Set(["T", "G", "C", "OT", "OG", "OL", "LS"]);
const DL_POSITIONS = new Set(["DE", "DT", "NT", "DL"]);
const LB_POSITIONS = new Set(["OLB", "ILB", "MLB", "LB"]);
const DB_POSITIONS = new Set(["CB", "S", "SS", "FS", "DB"]);
const K_POSITIONS = new Set(["K", "P", "KP"]);

function matchesPosition(playerPos: string, filter: PositionFilter): boolean {
  const pos = playerPos.toUpperCase();
  if (filter === "OL") return OL_POSITIONS.has(pos);
  if (filter === "DL") return DL_POSITIONS.has(pos);
  if (filter === "LB") return LB_POSITIONS.has(pos);
  if (filter === "DB") return DB_POSITIONS.has(pos);
  if (filter === "K") return K_POSITIONS.has(pos);
  return pos === filter || pos.startsWith(filter + "/") || pos.endsWith("/" + filter);
}

function PlayersView({ colors }: { colors: Palette }) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { isFollowed, follow, unfollow } = useFollowedPlayers();

  const [players, setPlayers] = useState<FootballPlayer[]>([]);
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState<PositionFilter>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const load = useCallback((searchQuery?: string) => {
    setHasMore(true);
    return football
      .getPlayers({ league: "NFL", q: searchQuery || undefined, page: 1, per_page: PER_PAGE })
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
    football
      .getPlayers({ league: "NFL", page: nextPage, per_page: PER_PAGE })
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
    return players.filter((p) => {
      const pos = p.position ?? "";
      return matchesPosition(pos, position);
    });
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
              firstName={item.display_first_name ?? item.first_name}
              lastName={item.display_last_name ?? item.last_name}
              country={[item.position, item.country].filter(Boolean).join(" · ") || null}
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

export default function FootballStandings() {
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
    nameCol: { flex: 1, paddingHorizontal: spacing.xs },
    teamName: { ...typography.label, color: colors.text, fontWeight: "600" },
    teamAbbrev: { ...typography.caption, color: colors.textSecondary },
    record: { ...typography.label, color: colors.text, width: 52, textAlign: "center" },
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
