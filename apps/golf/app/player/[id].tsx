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
import { useLocalSearchParams, useRouter } from "expo-router";
import { golf, GolfPlayer, useAuth } from "@juno/api";
import { useTheme, spacing, typography, radius, type Palette } from "@juno/ui";

export default function GolfPlayerScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const [player, setPlayer] = useState<GolfPlayer | null>(null);
  const [loading, setLoading] = useState(true);
  const [followed, setFollowed] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const { session } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!id) return;
    golf.getPlayer(id).then(({ data }) => {
      setPlayer(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!session || !id) return;
    golf.getFollowedPlayers(session.token).then(({ data }) => {
      setFollowed(data.includes(id));
    }).catch(() => {});
  }, [session, id]);

  async function toggleFollow() {
    if (!session || !id) return;
    setFollowLoading(true);
    try {
      if (followed) {
        await golf.unfollowPlayer(id, session.token);
        setFollowed(false);
      } else {
        await golf.followPlayer(id, session.token);
        setFollowed(true);
      }
    } finally {
      setFollowLoading(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!player) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.empty}>Player not found</Text>
      </SafeAreaView>
    );
  }

  const displayName = `${player.display_first_name ?? player.first_name} ${player.display_last_name ?? player.last_name}`;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
      </View>
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

        <View style={styles.statsRow}>
          {player.world_rankings_rank != null && (
            <View style={styles.statBox}>
              <Text style={styles.statValue}>#{player.world_rankings_rank}</Text>
              <Text style={styles.statLabel}>World Ranking</Text>
            </View>
          )}
          {player.rolex_world_rankings_rank != null && (
            <View style={styles.statBox}>
              <Text style={styles.statValue}>#{player.rolex_world_rankings_rank}</Text>
              <Text style={styles.statLabel}>Rolex Ranking</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: Palette) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  back: { marginRight: spacing.sm },
  backText: { ...typography.body, color: colors.primary },
  scroll: { padding: spacing.md },
  profile: { alignItems: "center", paddingVertical: spacing.xl },
  photo: {
    width: 100,
    height: 100,
    borderRadius: radius.full,
    marginBottom: spacing.md,
  },
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
  followButtonText: { ...typography.label, color: colors.card, fontWeight: "700" },
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
