import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  SectionList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { football, type FootballTeam } from "@juno/api";
import { useTheme, spacing, typography, radius, type Palette } from "@juno/ui";


type Section = { title: string; data: FootballTeam[] };

function groupByDivision(teams: FootballTeam[]): Section[] {
  const map = new Map<string, FootballTeam[]>();
  for (const t of teams) {
    // Group by "Conference Division" e.g. "AFC East", "NFC West"
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
  // Sort sections: AFC before NFC, then alphabetically within each
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
        {team.abbreviation && (
          <Text style={styles.teamAbbrev}>{team.abbreviation}</Text>
        )}
      </View>
      <Text style={styles.record}>{wlt(team)}</Text>
      {team.points_for != null && (
        <Text style={styles.pts}>{team.points_for}</Text>
      )}
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

export default function FootballStandings() {
  const { colors } = useTheme();
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

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>

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
              <Text style={styles.sectionTitle}>{section.title}</Text>
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
  });
}
