import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  View,
  Text,
  Image,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  golf,
  tennis,
  basketball,
  hockey,
  football,
  GolfScheduleEntry,
  GolfTournament,
  TennisScheduleEntry,
  TennisMatch,
  BasketballGame,
  HockeyGame,
  FootballGame,
  useSport,
} from "@juno/api";
import { SkeletonCard, useTheme, spacing, typography, radius, type Palette } from "@juno/ui";

const GOLF_TEAM_ID = process.env.EXPO_PUBLIC_GOLF_TEAM_ID ?? "00000000-0000-0000-0000-000000000001";

// ---------------------------------------------------------------------------
// Golf home
// ---------------------------------------------------------------------------
function GolfHome() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [entries, setEntries] = useState<GolfScheduleEntry[]>([]);
  const [liveTournament, setLiveTournament] = useState<GolfTournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    return Promise.all([
      golf.getScheduleEntries(),
      golf.getTournaments(GOLF_TEAM_ID),
    ]).then(([{ data: scheduleData }, { data: tournaments }]) => {
      setEntries(scheduleData);
      setLiveTournament(
        tournaments.find((t) => t.events?.some((e) => e.live)) ?? null
      );
    });
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  function onRefresh() {
    setRefreshing(true);
    load().finally(() => setRefreshing(false));
  }

  if (loading) {
    return (
      <View style={styles.list}>
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </View>
    );
  }

  return (
    <FlatList
      data={entries}
      keyExtractor={(e) => e.id}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
      ListHeaderComponent={
        liveTournament ? (
          <TouchableOpacity
            style={styles.liveCard}
            activeOpacity={0.8}
            onPress={() => router.push("/(app)/tournaments")}
          >
            <View style={styles.liveDot} />
            <View style={styles.liveInfo}>
              <Text style={styles.liveLabel}>Live now</Text>
              <Text style={styles.liveName}>{liveTournament.name}</Text>
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
            {item.winners_name && (
              <Text style={styles.meta}>
                {item.winners_name} · {item.winners_score}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// Tennis home
// ---------------------------------------------------------------------------
function TennisHome() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [entries, setEntries] = useState<TennisScheduleEntry[]>([]);
  const [liveMatches, setLiveMatches] = useState<TennisMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    return Promise.all([tennis.getScheduleEntries(), tennis.getTicker()]).then(
      ([{ data: scheduleData }, { data: ticker }]) => {
        setEntries(scheduleData);
        setLiveMatches(
          ticker.filter((m) =>
            ["on_court", "warmup", "playing"].includes(m.status)
          )
        );
      }
    );
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  function onRefresh() {
    setRefreshing(true);
    load().finally(() => setRefreshing(false));
  }

  if (loading) {
    return (
      <View style={styles.list}>
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </View>
    );
  }

  return (
    <FlatList
      data={entries}
      keyExtractor={(e) => e.id}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
      ListHeaderComponent={
        liveMatches.length > 0 ? (
          <TouchableOpacity
            style={styles.liveCard}
            activeOpacity={0.8}
            onPress={() => router.push("/(app)/matches")}
          >
            <View style={styles.liveDot} />
            <View style={styles.liveInfo}>
              <Text style={styles.liveLabel}>Live now</Text>
              <Text style={styles.liveName}>
                {liveMatches.length}{" "}
                {liveMatches.length === 1 ? "match" : "matches"} in progress
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
            {(item as any).partnership_level && (
              <Text style={[styles.meta, { color: colors.primary }]}>
                {(item as any).partnership_level.toUpperCase()}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// Basketball home
// ---------------------------------------------------------------------------
function BasketballHome() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [games, setGames] = useState<BasketballGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const todayStr = new Date().toISOString().slice(0, 10);

  const load = useCallback(() => {
    return basketball.getGames({ date: todayStr }).then(({ data }) => setGames(data));
  }, [todayStr]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  function onRefresh() {
    setRefreshing(true);
    load().finally(() => setRefreshing(false));
  }

  const liveGames = games.filter((g) => g.status === "live");

  if (loading) {
    return (
      <View style={styles.list}>
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </View>
    );
  }

  return (
    <FlatList
      data={games}
      keyExtractor={(g) => g.id}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
      ListHeaderComponent={
        liveGames.length > 0 ? (
          <TouchableOpacity
            style={styles.liveCard}
            activeOpacity={0.8}
            onPress={() => router.push("/(app)/games")}
          >
            <View style={styles.liveDot} />
            <View style={styles.liveInfo}>
              <Text style={styles.liveLabel}>Live now</Text>
              <Text style={styles.liveName}>
                {liveGames.length} {liveGames.length === 1 ? "game" : "games"} in progress
              </Text>
            </View>
            <Text style={styles.liveCta}>View scores →</Text>
          </TouchableOpacity>
        ) : null
      }
      ListHeaderComponentStyle={styles.listHeader}
      ListEmptyComponent={
        <View style={{ alignItems: "center", paddingTop: 40 }}>
          <Text style={[styles.name, { color: colors.textSecondary }]}>No games today</Text>
        </View>
      }
      renderItem={({ item }) => {
        const isLive = item.status === "live";
        const isFinished = item.status === "finished";
        const away = item.away_team;
        const home = item.home_team;
        return (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push("/(app)/games")}
          >
            {item.league && (
              <Text style={[styles.dates, { marginBottom: 4, fontWeight: "600" }]}>
                {item.league.toUpperCase()}
              </Text>
            )}
            <Text style={styles.name}>
              {away?.abbreviation ?? away?.name ?? "TBD"} @ {home?.abbreviation ?? home?.name ?? "TBD"}
            </Text>
            {(isLive || isFinished) && item.home_score != null && item.away_score != null ? (
              <Text style={[styles.meta, { color: isLive ? "#ef4444" : colors.textSecondary }]}>
                {isLive ? "🔴 LIVE · " : "Final · "}
                {item.away_score} – {item.home_score}
              </Text>
            ) : (
              item.scheduled_at && (
                <Text style={styles.dates}>
                  {new Date(item.scheduled_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              )
            )}
          </TouchableOpacity>
        );
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Hockey home
// ---------------------------------------------------------------------------
function HockeyHome() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [games, setGames] = useState<HockeyGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const todayStr = new Date().toISOString().slice(0, 10);

  const load = useCallback(() => {
    return hockey.getGames({ date: todayStr }).then(({ data }) => setGames(data));
  }, [todayStr]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  function onRefresh() {
    setRefreshing(true);
    load().finally(() => setRefreshing(false));
  }

  const liveGames = games.filter((g) => g.status === "live");

  if (loading) {
    return (
      <View style={styles.list}>
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </View>
    );
  }

  return (
    <FlatList
      data={games}
      keyExtractor={(g) => g.id}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
      ListHeaderComponent={
        liveGames.length > 0 ? (
          <TouchableOpacity
            style={styles.liveCard}
            activeOpacity={0.8}
            onPress={() => router.push("/(app)/games")}
          >
            <View style={styles.liveDot} />
            <View style={styles.liveInfo}>
              <Text style={styles.liveLabel}>Live now</Text>
              <Text style={styles.liveName}>
                {liveGames.length} {liveGames.length === 1 ? "game" : "games"} in progress
              </Text>
            </View>
            <Text style={styles.liveCta}>View scores →</Text>
          </TouchableOpacity>
        ) : null
      }
      ListHeaderComponentStyle={styles.listHeader}
      ListEmptyComponent={
        <View style={{ alignItems: "center", paddingTop: 40 }}>
          <Text style={[styles.name, { color: colors.textSecondary }]}>No games today</Text>
        </View>
      }
      renderItem={({ item }) => {
        const isLive = item.status === "live";
        const isFinished = item.status === "finished";
        const away = item.away_team;
        const home = item.home_team;
        return (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push("/(app)/games")}
          >
            {item.league && (
              <Text style={[styles.dates, { marginBottom: 4, fontWeight: "600" }]}>
                {item.league.toUpperCase()}
              </Text>
            )}
            <Text style={styles.name}>
              {away?.abbreviation ?? away?.name ?? "TBD"} @ {home?.abbreviation ?? home?.name ?? "TBD"}
            </Text>
            {(isLive || isFinished) && item.home_score != null && item.away_score != null ? (
              <Text style={[styles.meta, { color: isLive ? "#ef4444" : colors.textSecondary }]}>
                {isLive ? "🔴 LIVE · " : "Final · "}
                {item.away_score} – {item.home_score}
              </Text>
            ) : (
              item.scheduled_at && (
                <Text style={styles.dates}>
                  {new Date(item.scheduled_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              )
            )}
          </TouchableOpacity>
        );
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Football home
// ---------------------------------------------------------------------------
function FootballHome() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [games, setGames] = useState<FootballGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const todayStr = new Date().toISOString().slice(0, 10);

  const load = useCallback(() => {
    return football.getGames({ date: todayStr }).then(({ data }) => setGames(data));
  }, [todayStr]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  function onRefresh() {
    setRefreshing(true);
    load().finally(() => setRefreshing(false));
  }

  const liveGames = games.filter((g) => g.status === "live");

  if (loading) {
    return (
      <View style={styles.list}>
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </View>
    );
  }

  return (
    <FlatList
      data={games}
      keyExtractor={(g) => g.id}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
      ListHeaderComponent={
        liveGames.length > 0 ? (
          <TouchableOpacity
            style={styles.liveCard}
            onPress={() => router.push("/(app)/games")}
          >
            <View style={styles.liveDot} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[styles.name, { color: "#fff", fontWeight: "700" }]}>
                {liveGames.length} game{liveGames.length > 1 ? "s" : ""} live
              </Text>
            </View>
            <Text style={styles.liveCta}>View scores →</Text>
          </TouchableOpacity>
        ) : null
      }
      ListHeaderComponentStyle={styles.listHeader}
      ListEmptyComponent={
        <View style={{ alignItems: "center", paddingTop: 40 }}>
          <Text style={[styles.name, { color: colors.textSecondary }]}>No games today</Text>
        </View>
      }
      renderItem={({ item }) => {
        const isLive = item.status === "live";
        const isFinished = item.status === "finished";
        const away = item.away_team;
        const home = item.home_team;
        return (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push("/(app)/games")}
          >
            {item.league && (
              <Text style={[styles.dates, { marginBottom: 4, fontWeight: "600" }]}>
                {item.league.toUpperCase()}
              </Text>
            )}
            <Text style={styles.name}>
              {away?.abbreviation ?? away?.name ?? "TBD"} @ {home?.abbreviation ?? home?.name ?? "TBD"}
            </Text>
            {(isLive || isFinished) && item.home_score != null && item.away_score != null ? (
              <Text style={[styles.meta, { color: isLive ? "#ef4444" : colors.textSecondary }]}>
                {isLive ? "🔴 LIVE · " : "Final · "}
                {item.away_score} – {item.home_score}
              </Text>
            ) : (
              item.scheduled_at && (
                <Text style={styles.dates}>
                  {new Date(item.scheduled_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              )
            )}
          </TouchableOpacity>
        );
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Root export — picks the right home based on activeSport
// ---------------------------------------------------------------------------
export default function HomeScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { activeSport } = useSport();

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      {activeSport === "golf" ? (
        <GolfHome />
      ) : activeSport === "tennis" ? (
        <TennisHome />
      ) : activeSport === "hockey" ? (
        <HockeyHome />
      ) : activeSport === "football" ? (
        <FootballHome />
      ) : (
        <BasketballHome />
      )}
    </SafeAreaView>
  );
}

function createStyles(colors: Palette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
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
    meta: { ...typography.caption, color: colors.textSecondary, marginTop: 4 },
  });
}
