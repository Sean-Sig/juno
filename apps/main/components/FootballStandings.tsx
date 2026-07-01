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

type ViewMode = "standings" | "players";
type ScopeMode = "league" | "conference" | "division";
type PositionFilter = "all" | "QB" | "RB" | "WR" | "TE" | "OL" | "DL" | "LB" | "DB" | "K";

const CONFERENCES = ["AFC", "NFC"] as const;
const DIVISIONS = ["East", "North", "South", "West"] as const;

interface DivisionSection {
  title: string;
  conference: string;
  data: FootballTeam[];
}

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

// Position sort priority — lower = listed first (QB first, then skill positions)
const POSITION_SORT_ORDER: Record<string, number> = {
  QB: 0, RB: 1, WR: 2, TE: 3, K: 4, P: 4, OT: 5, OG: 5, C: 5, OL: 5,
  DE: 6, DT: 6, DL: 6, NT: 6, OLB: 7, ILB: 7, MLB: 7, LB: 7,
  CB: 8, S: 8, SS: 8, FS: 8, DB: 8,
};

const PER_PAGE = 50;

// Playoff seeds: top 7 per conference (1 division winner each = seeds 1-4, wild cards = 5-7)
const PLAYOFF_SEED_COUNT = 7;

// ---------------------------------------------------------------------------
// Standings helpers
// ---------------------------------------------------------------------------

function pct(wins: number, losses: number, ties = 0): string {
  const games = wins + losses + ties;
  if (games === 0) return ".000";
  const val = (wins + ties * 0.5) / games;
  return val === 1 ? "1.000" : val.toFixed(3).replace(/^0/, "");
}

function wlt(team: FootballTeam): string {
  if (team.ties != null && team.ties > 0) return `${team.wins}-${team.losses}-${team.ties}`;
  return `${team.wins}-${team.losses}`;
}

function confCode(conference: string | null): string {
  if (!conference) return "";
  const upper = conference.toUpperCase();
  if (upper.includes("AMERICAN")) return "AFC";
  if (upper.includes("NATIONAL")) return "NFC";
  return conference;
}

function sortByRecord(teams: FootballTeam[]): FootballTeam[] {
  return teams.slice().sort((a, b) => {
    const aPct = parseFloat(pct(a.wins, a.losses, a.ties ?? 0));
    const bPct = parseFloat(pct(b.wins, b.losses, b.ties ?? 0));
    if (bPct !== aPct) return bPct - aPct;
    return (b.points_for ?? 0) - (a.points_for ?? 0);
  });
}

function groupByDivision(
  teams: FootballTeam[],
  scope: ScopeMode,
  selectedConf: string,
  selectedDiv: string,
): DivisionSection[] {
  const filtered = teams.filter((t) => {
    if (scope === "conference") return confCode(t.conference) === selectedConf;
    if (scope === "division") return t.division === `${selectedConf} ${selectedDiv}`;
    return true; // league — all teams, but league scope uses FlatList not SectionList
  });

  const map = new Map<string, FootballTeam[]>();
  for (const t of filtered) {
    // division already comes as "AFC North", "NFC East", etc. — use it directly as the key
    const key = t.division ?? confCode(t.conference) ?? "Other";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(t);
  }

  const sections: DivisionSection[] = [];
  for (const [title, data] of map.entries()) {
    const conf = title.split(" ")[0] ?? "";
    sections.push({
      title,
      conference: conf,
      data: data.slice().sort((a, b) => {
        if (a.standing_rank != null && b.standing_rank != null) return a.standing_rank - b.standing_rank;
        const aPct = parseFloat(pct(a.wins, a.losses, a.ties ?? 0));
        const bPct = parseFloat(pct(b.wins, b.losses, b.ties ?? 0));
        return bPct - aPct;
      }),
    });
  }

  const confOrder = ["AFC", "NFC"];
  const divOrder  = ["East", "North", "South", "West"];
  sections.sort((a, b) => {
    const [aConf = "", aDiv = ""] = a.title.split(" ");
    const [bConf = "", bDiv = ""] = b.title.split(" ");
    const cd = (confOrder.indexOf(aConf) === -1 ? 99 : confOrder.indexOf(aConf))
             - (confOrder.indexOf(bConf) === -1 ? 99 : confOrder.indexOf(bConf));
    if (cd !== 0) return cd;
    return (divOrder.indexOf(aDiv) === -1 ? 99 : divOrder.indexOf(aDiv))
         - (divOrder.indexOf(bDiv) === -1 ? 99 : divOrder.indexOf(bDiv));
  });
  return sections;
}


// Determine if a team is in playoff position within their conference
function getPlayoffSeed(
  team: FootballTeam,
  allTeams: FootballTeam[],
): number | null {
  if (team.wins + team.losses + (team.ties ?? 0) === 0) return null;

  const confTeams = allTeams
    .filter((t) => t.conference === team.conference)
    .slice()
    .sort((a, b) => {
      const aPct = parseFloat(pct(a.wins, a.losses, a.ties ?? 0));
      const bPct = parseFloat(pct(b.wins, b.losses, b.ties ?? 0));
      return bPct - aPct;
    });

  // First 4 seeds = top team per division (in standings order)
  const divisionWinners = new Map<string, FootballTeam>();
  for (const t of confTeams) {
    const div = t.conference && t.division ? `${t.conference} ${t.division}` : "";
    if (div && !divisionWinners.has(div)) divisionWinners.set(div, t);
  }

  const winners = Array.from(divisionWinners.values()).sort((a, b) => {
    return parseFloat(pct(b.wins, b.losses, b.ties ?? 0))
         - parseFloat(pct(a.wins, a.losses, a.ties ?? 0));
  });

  const winnerIds = new Set(winners.map((t) => t.id));
  const seed1Idx = winners.findIndex((t) => t.id === team.id);
  if (seed1Idx !== -1) return seed1Idx + 1; // seeds 1–4

  const wildcards = confTeams.filter((t) => !winnerIds.has(t.id));
  const wcIdx = wildcards.findIndex((t) => t.id === team.id);
  if (wcIdx !== -1 && wcIdx < 3) return 5 + wcIdx; // seeds 5–7
  return null;
}

// ---------------------------------------------------------------------------
// Standings row
// ---------------------------------------------------------------------------

function PlayoffBadge({ seed, isDivisionWinner }: { seed: number; isDivisionWinner: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        playoffBadgeStyles.badge,
        isDivisionWinner
          ? { backgroundColor: colors.primary }
          : { borderWidth: 1.5, borderColor: colors.primary, backgroundColor: "transparent" },
      ]}
    >
      <Text
        style={[
          playoffBadgeStyles.text,
          isDivisionWinner ? { color: colors.textOnPrimary } : { color: colors.primary },
        ]}
      >
        {seed}
      </Text>
    </View>
  );
}

const playoffBadgeStyles = StyleSheet.create({
  badge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { fontSize: 10, fontWeight: "700", lineHeight: 12 },
});

function TeamRow({
  team,
  rank,
  playoffSeed,
  allTeams,
}: {
  team: FootballTeam;
  rank: number;
  playoffSeed: number | null;
  allTeams: FootballTeam[];
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isDivisionWinner = playoffSeed != null && playoffSeed <= 4;
  const isInPlayoffs = playoffSeed != null;

  return (
    <View style={[styles.teamRow, rank === 1 && styles.teamRowFirst]}>
      <View style={styles.seedCol}>
        {isInPlayoffs ? (
          <PlayoffBadge seed={playoffSeed!} isDivisionWinner={isDivisionWinner} />
        ) : (
          <Text style={styles.rankText}>{rank}</Text>
        )}
      </View>
      <View style={styles.nameCol}>
        <Text style={styles.teamName} numberOfLines={1}>
          {team.short_name ?? team.name}
        </Text>
        {team.abbreviation && <Text style={styles.teamAbbrev}>{team.abbreviation}</Text>}
      </View>
      <Text style={styles.recordCol}>{wlt(team)}</Text>
      <Text style={[styles.pctCol, isInPlayoffs && { color: colors.primary, fontWeight: "700" }]}>
        {pct(team.wins, team.losses, team.ties ?? 0)}
      </Text>
      <Text style={styles.statCol}>{team.points_for ?? "—"}</Text>
      <Text style={styles.statCol}>{team.points_against ?? "—"}</Text>
      <Text
        style={[
          styles.streakCol,
          team.streak?.startsWith("W") ? { color: colors.primary } : { color: colors.textSecondary },
        ]}
      >
        {team.streak ?? "—"}
      </Text>
    </View>
  );
}

function StandingsTableHeader({ colors }: { colors: Palette }) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={[styles.teamRow, styles.headerRow]}>
      <View style={styles.seedCol}>
        <Text style={styles.headerText}>#</Text>
      </View>
      <View style={styles.nameCol}>
        <Text style={styles.headerText}>TEAM</Text>
      </View>
      <Text style={[styles.recordCol, styles.headerText]}>W-L</Text>
      <Text style={[styles.pctCol, styles.headerText]}>PCT</Text>
      <Text style={[styles.statCol, styles.headerText]}>PF</Text>
      <Text style={[styles.statCol, styles.headerText]}>PA</Text>
      <Text style={[styles.streakCol, styles.headerText]}>STRK</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Standings view
// ---------------------------------------------------------------------------

function StandingsView({
  colors,
  allTeams,
}: {
  colors: Palette;
  allTeams: FootballTeam[];
}) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [scope, setScope] = useState<ScopeMode>("league");
  const [selectedConf, setSelectedConf] = useState("AFC");
  const [selectedDiv, setSelectedDiv] = useState("East");

  const extraData = `${scope}-${selectedConf}-${selectedDiv}`;

  const leagueTeams = useMemo(
    () => scope === "league" ? sortByRecord(allTeams) : [],
    [allTeams, scope],
  );

  const sections = useMemo(
    () => scope !== "league" ? groupByDivision(allTeams, scope, selectedConf, selectedDiv) : [],
    [allTeams, scope, selectedConf, selectedDiv],
  );

  const playoffSeeds = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const t of allTeams) map.set(t.id, getPlayoffSeed(t, allTeams));
    return map;
  }, [allTeams]);

  if (allTeams.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>No standings yet</Text>
        <Text style={styles.emptyText}>Standings will appear once the season is underway.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Scope selector: League / Conference / Division */}
      <View style={styles.scopeRow}>
        {(["league", "conference", "division"] as ScopeMode[]).map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.scopeTab, scope === s && styles.scopeTabActive]}
            onPress={() => setScope(s)}
            activeOpacity={0.7}
          >
            <Text style={[styles.scopeTabText, scope === s && styles.scopeTabTextActive]}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Sub-filter row: conference chips when in Conference or Division scope */}
      {(scope === "conference" || scope === "division") && (
        <View style={styles.subFilterRow}>
          {CONFERENCES.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.subChip, selectedConf === c && styles.subChipActive]}
              onPress={() => setSelectedConf(c)}
              activeOpacity={0.7}
            >
              <Text style={[styles.subChipText, selectedConf === c && styles.subChipTextActive]}>
                {c}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Division chips when in Division scope */}
      {scope === "division" && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.divScrollRow}
          contentContainerStyle={styles.divScrollContent}
        >
          {DIVISIONS.map((d) => (
            <TouchableOpacity
              key={d}
              style={[styles.subChip, selectedDiv === d && styles.subChipActive]}
              onPress={() => setSelectedDiv(d)}
              activeOpacity={0.7}
            >
              <Text style={[styles.subChipText, selectedDiv === d && styles.subChipTextActive]}>
                {selectedConf} {d}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Playoff legend — conference scope only */}
      {scope === "conference" && (
        <View style={styles.legendRow}>
          <View style={[playoffBadgeStyles.badge, { backgroundColor: colors.primary, marginRight: 4 }]}>
            <Text style={[playoffBadgeStyles.text, { color: colors.textOnPrimary }]}>1</Text>
          </View>
          <Text style={styles.legendText}>Division leader</Text>
          <View
            style={[
              playoffBadgeStyles.badge,
              { borderWidth: 1.5, borderColor: colors.primary, marginLeft: 10, marginRight: 4 },
            ]}
          >
            <Text style={[playoffBadgeStyles.text, { color: colors.primary }]}>5</Text>
          </View>
          <Text style={styles.legendText}>Wild card</Text>
        </View>
      )}

      {scope === "league" ? (
        <FlatList
          data={leagueTeams}
          keyExtractor={(t) => t.id}
          extraData={extraData}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={<StandingsTableHeader colors={colors} />}
          renderItem={({ item, index }) => (
            <TeamRow
              team={item}
              rank={index + 1}
              playoffSeed={null}
              allTeams={allTeams}
            />
          )}
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(t) => t.id}
          extraData={extraData}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={scope === "conference"}
          ListHeaderComponent={<StandingsTableHeader colors={colors} />}
          renderSectionHeader={({ section }) =>
            scope === "division" ? null : (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{(section as DivisionSection).title}</Text>
              </View>
            )
          }
          renderItem={({ item, index }) => (
            <TeamRow
              team={item}
              rank={index + 1}
              playoffSeed={playoffSeeds.get(item.id) ?? null}
              allTeams={allTeams}
            />
          )}
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Players view
// ---------------------------------------------------------------------------

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

  const load = useCallback((searchQuery?: string, positionFilter?: PositionFilter) => {
    setHasMore(true);
    return football
      .getPlayers({
        league: "NFL",
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

  useEffect(() => {
    if (!query.trim()) { load(undefined, position); return; }
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
    football
      .getPlayers({
        league: "NFL",
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

  const displayed = useMemo(() => {
    return players.slice().sort((a, b) => {
      const aOrder = POSITION_SORT_ORDER[a.position?.toUpperCase() ?? ""] ?? 99;
      const bOrder = POSITION_SORT_ORDER[b.position?.toUpperCase() ?? ""] ?? 99;
      return aOrder - bOrder;
    });
  }, [players]);

  return (
    <View style={{ flex: 1 }}>
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
            loadingMore
              ? <ActivityIndicator color={colors.primary} style={styles.footerSpinner} />
              : null
          }
          renderItem={({ item }) => (
            <PlayerCard
              firstName={item.first_name}
              lastName={item.last_name}
              country={item.country}
              subtitle={
                [item.position, item.jersey_number ? `#${item.jersey_number}` : null]
                  .filter(Boolean)
                  .join(" · ") || null
              }
              photo={item.photo}
              rank={null}
              following={isFollowed(item.id)}
              onToggleFollow={() => toggleFollow(item.id)}
              onPress={() => router.push(`/(app)/player/${item.id}`)}
            />
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {query.trim() ? `No players matching "${query.trim()}".` : "No players found."}
            </Text>
          }
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
  const [view, setView] = useState<ViewMode>("standings");

  const [allTeams, setAllTeams] = useState<FootballTeam[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [teamsRefreshing, setTeamsRefreshing] = useState(false);

  const loadTeams = useCallback(async () => {
    const { data } = await football.getTeams({ league: "NFL", per_page: "50" });
    setAllTeams(data);
  }, []);

  useEffect(() => {
    setTeamsLoading(true);
    loadTeams().finally(() => setTeamsLoading(false));
  }, [loadTeams]);

  function onRefreshTeams() {
    setTeamsRefreshing(true);
    loadTeams().finally(() => setTeamsRefreshing(false));
  }

  const TABS: { key: ViewMode; label: string }[] = [
    { key: "standings", label: "Standings" },
    { key: "players",   label: "Players" },
  ];

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      {/* Top tab bar */}
      <View style={styles.tabBar}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tabItem, view === t.key && styles.tabItemActive]}
            onPress={() => setView(t.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabLabel, view === t.key && styles.tabLabelActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {view === "players" ? (
        <PlayersView colors={colors} />
      ) : teamsLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <StandingsView colors={colors} allTeams={allTeams} />
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

    // Top tab bar
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

    // Scope selector (League / Conference / Division)
    scopeRow: {
      flexDirection: "row",
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xs,
      gap: spacing.xs,
    },
    scopeTab: {
      flex: 1,
      alignItems: "center",
      paddingVertical: spacing.xs + 2,
      borderRadius: radius.md,
      backgroundColor: colors.card,
    },
    scopeTabActive: { backgroundColor: colors.primary },
    scopeTabText: { ...typography.label, color: colors.textSecondary, fontWeight: "600" },
    scopeTabTextActive: { color: colors.textOnPrimary, fontWeight: "700" },

    // Sub-filter rows (conference + division chips)
    subFilterRow: {
      flexDirection: "row",
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.xs,
      gap: spacing.xs,
    },
    divScrollRow: { flexGrow: 0, flexShrink: 0, marginBottom: spacing.xs },
    divScrollContent: { paddingHorizontal: spacing.md, gap: spacing.xs },
    subChip: {
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    subChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    subChipText: { ...typography.label, color: colors.textSecondary, fontWeight: "600" },
    subChipTextActive: { color: colors.textOnPrimary, fontWeight: "700" },

    // Playoff legend
    legendRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.xs,
    },
    legendText: { ...typography.caption, color: colors.textSecondary },

    // Standings table
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
    teamRowFirst: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    seedCol: { width: 24, alignItems: "center" },
    rankText: { ...typography.caption, color: colors.textSecondary, textAlign: "center" },
    nameCol: { flex: 1, paddingHorizontal: spacing.xs },
    teamName: { ...typography.label, color: colors.text, fontWeight: "600" },
    teamAbbrev: { ...typography.caption, color: colors.textSecondary },
    recordCol: { ...typography.label, color: colors.text, width: 48, textAlign: "center" },
    pctCol: { ...typography.label, color: colors.text, width: 44, textAlign: "center" },
    statCol: { ...typography.caption, color: colors.textSecondary, width: 32, textAlign: "center" },
    streakCol: { ...typography.label, fontWeight: "700", width: 36, textAlign: "center" },

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
    typePicker: { flexGrow: 0, flexShrink: 0, marginHorizontal: spacing.md, marginBottom: spacing.sm },
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
