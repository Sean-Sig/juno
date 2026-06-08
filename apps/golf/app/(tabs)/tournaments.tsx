import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { golf, GolfTournament, joinGolfChannel } from "@juno/api";
import { useTheme, spacing, typography, type Palette } from "@juno/ui";

const TEAM_ID = process.env.EXPO_PUBLIC_GOLF_TEAM_ID ?? "00000000-0000-0000-0000-000000000001";

export default function TournamentsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [tournament, setTournament] = useState<GolfTournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    return golf.getTournaments(TEAM_ID).then(({ data }) => {
      // Pick the first tournament that has events (scores), fall back to first
      const active = data.find((t) => t.events?.length > 0) ?? data[0] ?? null;
      setTournament(active);
    }).catch(() => {});
  }, []);

  function onRefresh() {
    setRefreshing(true);
    load().finally(() => setRefreshing(false));
  }

  useEffect(() => {
    load().finally(() => setLoading(false));

    const channel = joinGolfChannel(TEAM_ID, {
      onState: (t) => setTournament(t),
      onDelta: (diff) => {
        setTournament((prev) => (prev ? { ...prev, ...diff } : prev));
      },
    });

    return () => { channel.leave(); };
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!tournament) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.empty}>No active tournament</Text>
      </SafeAreaView>
    );
  }

  const scores = tournament.events?.[0]?.scores ?? [];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{tournament.name}</Text>
        <Text style={styles.subtitle}>{tournament.events?.[0]?.name}</Text>
      </View>
      <FlatList
        data={scores}
        keyExtractor={(s) => s.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.place}>{item.display_place ?? "—"}</Text>
            <View style={styles.playerInfo}>
              <Text style={styles.playerName}>
                {item.player?.first_name} {item.player?.last_name}
              </Text>
              <Text style={styles.country}>{item.player?.country}</Text>
            </View>
            <Text style={[styles.score, item.par < 0 && styles.under]}>
              {item.par === 0 ? "E" : item.par > 0 ? `+${item.par}` : item.par}
            </Text>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </SafeAreaView>
  );
}

function createStyles(colors: Palette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
    header: { padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.card },
    title: { ...typography.h2, color: colors.text },
    subtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
    row: { flexDirection: "row", alignItems: "center", padding: spacing.md, backgroundColor: colors.card },
    place: { width: 36, ...typography.label, color: colors.textSecondary },
    playerInfo: { flex: 1 },
    playerName: { ...typography.body, color: colors.text, fontWeight: "600" },
    country: { ...typography.caption, color: colors.textSecondary },
    score: { ...typography.h3, color: colors.text },
    under: { color: colors.live },
    separator: { height: 1, backgroundColor: colors.border },
    empty: { ...typography.body, color: colors.textSecondary },
  });
}
