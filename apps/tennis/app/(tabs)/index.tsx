import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList, View, Text, Image,
  ActivityIndicator, StyleSheet, TouchableOpacity, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { tennis, TennisScheduleEntry, TennisMatch, useAuth } from "@juno/api";
import { TopAppBar, SkeletonCard, useTheme, spacing, typography, radius, type Palette } from "@juno/ui";

export default function HomeScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [entries, setEntries] = useState<TennisScheduleEntry[]>([]);
  const [liveMatches, setLiveMatches] = useState<TennisMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  const { session } = useAuth();

  const load = useCallback(() => {
    return Promise.all([
      tennis.getScheduleEntries(),
      tennis.getTicker(),
    ]).then(([{ data: scheduleData }, { data: ticker }]) => {
      setEntries(scheduleData);
      setLiveMatches(ticker.filter((m) => ["on_court", "warmup", "playing"].includes(m.status)));
    });
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  function onRefresh() {
    setRefreshing(true);
    load().finally(() => setRefreshing(false));
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <TopAppBar
        title="Home"
        avatarUri={null}
        avatarInitials={session?.fan_id?.[0]?.toUpperCase() ?? "?"}
        onAvatarPress={() => router.push("/profile")}
      />
      {loading ? (
        <View style={styles.list}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(e) => e.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListHeaderComponent={
            liveMatches.length > 0 ? (
              <TouchableOpacity
                style={styles.liveCard}
                activeOpacity={0.8}
                onPress={() => router.push("/(tabs)/matches")}
              >
                <View style={styles.liveDot} />
                <View style={styles.liveInfo}>
                  <Text style={styles.liveLabel}>Live now</Text>
                  <Text style={styles.liveName}>
                    {liveMatches.length} {liveMatches.length === 1 ? "match" : "matches"} in progress
                  </Text>
                </View>
                <Text style={styles.liveCta}>View scores →</Text>
              </TouchableOpacity>
            ) : null
          }
          ListHeaderComponentStyle={styles.listHeader}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/tournament/${item.id}`)}
            >
              {item.image_url && (
                <Image source={{ uri: item.image_url }} style={styles.image} />
              )}
              <View style={styles.info}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.dates}>
                  {item.start_date?.slice(0, 10)} – {item.end_date?.slice(0, 10)}
                </Text>
                <Text style={styles.level}>{item.partnership_level.toUpperCase()}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function createStyles(colors: Palette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
    list: { padding: spacing.md },
    listHeader: { marginBottom: spacing.sm },
    liveCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.primary,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    liveDot: {
      width: 10,
      height: 10,
      borderRadius: radius.full,
      backgroundColor: colors.secondary,
      marginRight: spacing.sm,
    },
    liveInfo: { flex: 1 },
    liveLabel: { ...typography.caption, color: colors.textOnPrimary, opacity: 0.8 },
    liveName: { ...typography.h3, color: colors.textOnPrimary, marginTop: 2 },
    liveCta: { ...typography.label, color: colors.textOnPrimary, fontWeight: "700" },
    card: {
      backgroundColor: colors.card,
      borderRadius: radius.md,
      marginBottom: spacing.sm,
      overflow: "hidden",
      shadowColor: "#000",
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    image: { width: "100%", height: 140 },
    info: { padding: spacing.md },
    name: { ...typography.h3, color: colors.text },
    dates: { ...typography.caption, color: colors.textSecondary, marginTop: 4 },
    level: { ...typography.caption, color: colors.primary, marginTop: 4, fontWeight: "600" },
  });
}
