import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  SectionList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { hockey, type HockeyTeam } from "@juno/api";
import { useTheme, spacing, typography, radius, type Palette } from "@juno/ui";

type LeagueTab = "NHL" | "AHL";

const LEAGUE_TABS: LeagueTab[] = ["NHL", "AHL"];

type Section = { title: string; data: HockeyTeam[] };

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
      <View style={styles.nameCol}>
        <Text style={styles.teamName} numberOfLines={1}>
          {team.name}
        </Text>
        {team.abbreviation && (
          <Text style={styles.teamAbbrev}>{team.abbreviation}</Text>
        )}
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

export default function HockeyStandings() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [activeLeague, setActiveLeague] = useState<LeagueTab>("NHL");
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (league: LeagueTab) => {
    const { data } = await hockey.getTeams({ league });
    setSections(groupByConference(data));
  }, []);

  useEffect(() => {
    setLoading(true);
    load(activeLeague).finally(() => setLoading(false));
  }, [activeLeague, load]);

  function onRefresh() {
    setRefreshing(true);
    load(activeLeague).finally(() => setRefreshing(false));
  }

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      <View style={styles.tabBar}>
        {LEAGUE_TABS.map((league) => (
          <TouchableOpacity
            key={league}
            style={[styles.tabItem, activeLeague === league && styles.tabItemActive]}
            onPress={() => setActiveLeague(league)}
          >
            <Text style={[styles.tabLabel, activeLeague === league && styles.tabLabelActive]}>
              {league}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : sections.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>No standings yet</Text>
          <Text style={styles.emptyText}>
            Standings will appear once the season is underway.
          </Text>
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
          ListHeaderComponent={<TableHeader />}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{section.title} Conference</Text>
            </View>
          )}
          renderItem={({ item, index }) => <TeamRow team={item} rank={index + 1} />}
        />
      )}
    </SafeAreaView>
  );
}

function createStyles(colors: Palette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
    tabBar: {
      flexDirection: "row",
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.divider,
    },
    tabItem: { flex: 1, paddingVertical: spacing.sm + 2, alignItems: "center" },
    tabItemActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
    tabLabel: { ...typography.label, color: colors.textSecondary },
    tabLabelActive: { color: colors.primary, fontWeight: "700" },
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
    wlotl: { ...typography.label, color: colors.text, width: 60, textAlign: "center" },
    pts: { ...typography.label, color: colors.primary, width: 36, textAlign: "center", fontWeight: "700" },
    split: { ...typography.caption, color: colors.textSecondary, width: 44, textAlign: "center" },
  });
}
