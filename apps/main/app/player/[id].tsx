import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Image,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { golf, tennis, basketball, hockey, GolfPlayer, TennisPlayer, BasketballPlayer, HockeyPlayer, useAuth, useSport, type Sport } from "@juno/api";
import { useTheme, spacing, typography, radius, type Palette } from "@juno/ui";
import { useFollowedPlayers } from "../../context/FollowedPlayersContext";

type Player = GolfPlayer | TennisPlayer | BasketballPlayer | HockeyPlayer;

function getDisplayName(player: Player) {
  return `${(player as GolfPlayer).display_first_name ?? player.first_name} ${(player as GolfPlayer).display_last_name ?? player.last_name}`;
}

function getRankStats(player: Player, sport: Sport) {
  if (sport === "golf") {
    const p = player as GolfPlayer;
    return [
      p.world_rankings_rank != null && { label: "World Ranking", value: `#${p.world_rankings_rank}` },
      p.rolex_world_rankings_rank != null && { label: "Rolex Ranking", value: `#${p.rolex_world_rankings_rank}` },
    ].filter(Boolean) as { label: string; value: string }[];
  } else if (sport === "tennis") {
    const p = player as TennisPlayer;
    return [
      p.singles_rank != null && { label: "Singles Rank", value: `#${p.singles_rank}` },
      p.doubles_rank != null && { label: "Doubles Rank", value: `#${p.doubles_rank}` },
      p.singles_race_rank != null && { label: "Race Rank", value: `#${p.singles_race_rank}` },
    ].filter(Boolean) as { label: string; value: string }[];
  } else if (sport === "hockey") {
    const p = player as HockeyPlayer;
    return [
      p.position != null && { label: "Position", value: p.position },
      p.jersey_number != null && { label: "Jersey", value: `#${p.jersey_number}` },
      p.league != null && { label: "League", value: p.league },
    ].filter(Boolean) as { label: string; value: string }[];
  } else {
    const p = player as BasketballPlayer;
    return [
      p.position != null && { label: "Position", value: p.position },
      p.jersey_number != null && { label: "Jersey", value: `#${p.jersey_number}` },
      p.league != null && { label: "League", value: p.league },
    ].filter(Boolean) as { label: string; value: string }[];
  }
}

export default function PlayerScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activeSport } = useSport();
  const { session } = useAuth();
  const { isFollowed, follow, unfollow } = useFollowedPlayers();
  const router = useRouter();
  const navigation = useNavigation();

  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);

  const api = activeSport === "golf" ? golf : activeSport === "tennis" ? tennis : activeSport === "hockey" ? hockey : basketball;
  const followed = id ? isFollowed(id) : false;

  // Update header title + override back button to return to Rankings
  useEffect(() => {
    const title = player ? getDisplayName(player) : "Player";
    navigation.setOptions({
      title,
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => router.navigate("/(app)/rankings")}
          style={{ paddingRight: spacing.sm }}
        >
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
      ),
      headerRight: () => null,
    });
  }, [player, colors.text]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.getPlayer(id)
      .then(({ data }) => setPlayer(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id, activeSport]);

  async function toggleFollow() {
    if (!session || !id) return;
    setFollowLoading(true);
    try {
      if (followed) {
        await unfollow(id);
      } else {
        await follow(id);
      }
    } finally {
      setFollowLoading(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center} edges={["bottom"]}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!player) {
    return (
      <SafeAreaView style={styles.center} edges={["bottom"]}>
        <Text style={styles.empty}>Player not found</Text>
      </SafeAreaView>
    );
  }

  const displayName = getDisplayName(player);
  const stats = getRankStats(player, activeSport as Sport);

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.profile}>
          {player.photo ? (
            <Image source={{ uri: player.photo }} style={styles.photo} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Text style={styles.initials}>
                {player.first_name[0]}{player.last_name[0]}
              </Text>
            </View>
          )}
          <Text style={styles.name}>{displayName}</Text>
          {player.country && <Text style={styles.country}>{player.country}</Text>}

          {session ? (
            <TouchableOpacity
              style={[styles.followButton, followed && styles.followingButton]}
              onPress={toggleFollow}
              disabled={followLoading}
            >
              {followLoading ? (
                <ActivityIndicator color={followed ? colors.primary : "#fff"} size="small" />
              ) : (
                <Text style={[styles.followButtonText, followed && styles.followingButtonText]}>
                  {followed ? "Following" : "Follow"}
                </Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.signInButton}
              onPress={() => router.push("/(auth)/login")}
            >
              <Text style={styles.signInButtonText}>Sign in to follow</Text>
            </TouchableOpacity>
          )}
        </View>

        {stats.length > 0 && (
          <View style={styles.statsRow}>
            {stats.map((s) => (
              <View key={s.label} style={styles.statBox}>
                <Text style={styles.statValue}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: Palette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
    scroll: { padding: spacing.md },
    profile: { alignItems: "center", paddingVertical: spacing.xl },
    photo: { width: 100, height: 100, borderRadius: radius.full, marginBottom: spacing.md },
    photoPlaceholder: {
      width: 100,
      height: 100,
      borderRadius: radius.full,
      backgroundColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.md,
    },
    initials: { ...typography.h2, color: colors.textSecondary },
    name: { ...typography.h2, color: colors.text, textAlign: "center" },
    country: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs },
    followButton: {
      backgroundColor: colors.primary,
      borderRadius: radius.full,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      marginTop: spacing.md,
      minWidth: 120,
      alignItems: "center",
    },
    followingButton: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    followButtonText: { ...typography.label, color: "#fff", fontWeight: "700" },
    followingButtonText: { color: colors.primary },
    signInButton: {
      borderRadius: radius.full,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      marginTop: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    signInButtonText: { ...typography.label, color: colors.textSecondary },
    statsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: spacing.md,
      marginTop: spacing.md,
    },
    statBox: {
      backgroundColor: colors.card,
      borderRadius: radius.md,
      padding: spacing.md,
      alignItems: "center",
      minWidth: 110,
      shadowColor: "#000",
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    statValue: { ...typography.h2, color: colors.primary },
    statLabel: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
    empty: { ...typography.body, color: colors.textSecondary },
  });
}
