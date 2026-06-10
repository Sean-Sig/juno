import React, { useCallback, useMemo, useRef, useState } from "react";
import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
  StyleSheet,
  Animated,
  Switch,
  ScrollView,
} from "react-native";
import { useSport, useAuth, ALL_SPORTS, type Sport } from "@juno/api";
import { useTheme, spacing, radius, typography, type Palette, type ThemePreference } from "@juno/ui";
import { FollowedPlayersProvider } from "../../context/FollowedPlayersContext";

const SPORT_META: Record<Sport, { label: string; emoji: string }> = {
  golf: { label: "Golf", emoji: "⛳" },
  tennis: { label: "Tennis", emoji: "🎾" },
  basketball: { label: "Basketball", emoji: "🏀" },
  hockey: { label: "Hockey", emoji: "🏒" },
  football: { label: "Football", emoji: "🏈" },
};

// ---------------------------------------------------------------------------
// Sport switcher (top-left pill)
// ---------------------------------------------------------------------------
function SportSwitcherButton() {
  const { activeSport, followedSports, setActiveSport } = useSport();
  const { colors } = useTheme();
  const styles = useMemo(() => createSheetStyles(colors), [colors]);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const openSheet = useCallback(() => {
    setOpen(true);
    Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
  }, [fadeAnim]);

  const closeSheet = useCallback(() => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 140, useNativeDriver: true }).start(() =>
      setOpen(false)
    );
  }, [fadeAnim]);

  function handleSelect(sport: Sport) {
    setActiveSport(sport);
    closeSheet();
    router.replace("/(app)/");
  }

const meta = SPORT_META[activeSport];

  return (
    <>
      <TouchableOpacity style={styles.pill} onPress={openSheet} activeOpacity={0.75}>
        <Text style={styles.pillEmoji}>{meta.emoji}</Text>
        <Text style={styles.pillLabel}>{meta.label}</Text>
        <Ionicons name="chevron-down" size={13} color={colors.textSecondary} style={styles.chevron} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="none" onRequestClose={closeSheet}>
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet} />
          <Animated.View
            style={[
              styles.sheet,
              {
                transform: [
                  {
                    translateY: fadeAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [30, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Switch sport</Text>

            {followedSports.map((sport) => {
              const sm = SPORT_META[sport];
              const isActive = sport === activeSport;
              return (
                <TouchableOpacity
                  key={sport}
                  style={[styles.sheetRow, isActive && styles.sheetRowActive]}
                  onPress={() => handleSelect(sport)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.sheetEmoji}>{sm.emoji}</Text>
                  <Text style={[styles.sheetLabel, isActive && styles.sheetLabelActive]}>
                    {sm.label}
                  </Text>
                  {isActive && (
                    <Ionicons name="checkmark" size={18} color={colors.primary} />
                  )}
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => { closeSheet(); router.push("/(app)/sport-settings"); }}
            >
              <Ionicons name="settings-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.actionText}>Manage followed sports</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </Modal>
    </>
  );
}

// ---------------------------------------------------------------------------
// Profile sheet (top-right icon)
// ---------------------------------------------------------------------------
function ProfileSheetButton() {
  const { colors, preference, setPreference } = useTheme();
  const styles = useMemo(() => createSheetStyles(colors), [colors]);
  const { session, logout } = useAuth();
  const { followedSports, defaultSport } = useSport();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const openSheet = useCallback(() => {
    setOpen(true);
    Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
  }, [fadeAnim]);

  const closeSheet = useCallback(() => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 140, useNativeDriver: true }).start(() =>
      setOpen(false)
    );
  }, [fadeAnim]);

  function cycleAppearance() {
    const order: ThemePreference[] = ["system", "light", "dark"];
    setPreference(order[(order.indexOf(preference) + 1) % order.length]);
  }

  const themeLabel =
    preference === "system" ? "Match system" : preference === "dark" ? "Dark" : "Light";

  return (
    <>
      <TouchableOpacity onPress={openSheet} activeOpacity={0.7} style={styles.profileBtn}>
        <Ionicons name="person-circle-outline" size={28} color={colors.text} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="none" onRequestClose={closeSheet}>
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet} />
          <Animated.View
            style={[
              styles.sheet,
              {
                transform: [
                  {
                    translateY: fadeAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [30, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.sheetHandle} />

            {!session ? (
              <>
                <Text style={styles.sheetTitle}>Account</Text>
                <Text style={[styles.sheetLabel, { marginBottom: spacing.md }]}>
                  Sign in to manage your profile.
                </Text>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => { closeSheet(); router.push("/(auth)/login"); }}
                >
                  <Text style={styles.primaryButtonText}>Sign In</Text>
                </TouchableOpacity>
              </>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Avatar */}
                <View style={styles.avatarRow}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarInitials}>
                      {session.fan_id[0]?.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.accountId}>Fan #{session.fan_id.slice(0, 8)}</Text>
                </View>

                {/* Followed sports */}
                <Text style={styles.sectionTitle}>Followed Sports</Text>
                {followedSports.map((sport) => (
                  <View key={sport} style={styles.sheetRow}>
                    <Text style={styles.sheetEmoji}>{SPORT_META[sport].emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sheetLabel}>{SPORT_META[sport].label}</Text>
                      {defaultSport === sport && (
                        <Text style={styles.subLabel}>Default</Text>
                      )}
                    </View>
                  </View>
                ))}
                <TouchableOpacity
                  style={styles.actionRow}
                  onPress={() => { closeSheet(); router.push("/(app)/sport-settings"); }}
                >
                  <Ionicons name="settings-outline" size={16} color={colors.textSecondary} />
                  <Text style={styles.actionText}>Manage sports</Text>
                </TouchableOpacity>

                {/* Appearance */}
                <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>Appearance</Text>
                <View style={[styles.sheetRow, { justifyContent: "space-between" }]}>
                  <View>
                    <Text style={styles.sheetLabel}>Theme</Text>
                    <Text style={styles.subLabel}>{themeLabel}</Text>
                  </View>
                  <Switch
                    value={
                      preference === "dark" ||
                      (preference === "system" && colors.background === "#121212")
                    }
                    onValueChange={cycleAppearance}
                    trackColor={{ true: colors.primary, false: colors.border }}
                  />
                </View>

                {/* Logout */}
                <TouchableOpacity style={styles.logoutButton} onPress={() => { closeSheet(); logout(); }}>
                  <Text style={styles.logoutText}>Log Out</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </Animated.View>
        </Animated.View>
      </Modal>
    </>
  );
}

// ---------------------------------------------------------------------------
// Tab layout
// ---------------------------------------------------------------------------
export default function AppLayout() {
  const { activeSport } = useSport();
  const { colors } = useTheme();

  return (
    <FollowedPlayersProvider>
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.divider },
        headerShown: true,
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { ...(typography.h3 as object) },
        headerLeft: () => <SportSwitcherButton />,
        headerLeftContainerStyle: { paddingLeft: spacing.sm },
        headerRight: () => <ProfileSheetButton />,
        headerRightContainerStyle: { paddingRight: spacing.sm },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} />,
        }}
      />

      {/* Golf-only tabs */}
      <Tabs.Screen
        name="tournaments"
        options={{
          title: "Tournaments",
          href: activeSport === "golf" ? undefined : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="golf" color={color} size={size} />,
        }}
      />

      {/* Tennis-only tabs */}
      <Tabs.Screen
        name="matches"
        options={{
          title: "Matches",
          href: activeSport === "tennis" ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="tennisball" color={color} size={size} />
          ),
        }}
      />

      {/* Basketball + Hockey + Football tabs */}
      <Tabs.Screen
        name="games"
        options={{
          title: "Games",
          href: activeSport === "basketball" || activeSport === "hockey" || activeSport === "football" ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="basketball" color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="rankings"
        options={{
          title: "Rankings",
          tabBarIcon: ({ color, size }) => <Ionicons name="podium" color={color} size={size} />,
        }}
      />

      {/* Hidden from tab bar */}
      <Tabs.Screen name="profile" options={{ href: null }} />
      <Tabs.Screen name="player/[id]" options={{ href: null, title: "Player" }} />
      <Tabs.Screen name="tournament/[id]" options={{ href: null }} />
      <Tabs.Screen name="match/[id]" options={{ href: null, title: "Match" }} />
      <Tabs.Screen name="game/[id]" options={{ href: null, title: "Game" }} />
      <Tabs.Screen name="sport-settings" options={{ href: null, title: "Followed Sports" }} />
    </Tabs>
    </FollowedPlayersProvider>
  );
}

// ---------------------------------------------------------------------------
// Styles (shared between both sheets)
// ---------------------------------------------------------------------------
function createSheetStyles(colors: Palette) {
  return StyleSheet.create({
    // Sport switcher pill
    pill: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: radius.full,
      paddingVertical: 6,
      paddingLeft: spacing.sm,
      paddingRight: 10,
      gap: 4,
    },
    pillEmoji: { fontSize: 15 },
    pillLabel: { ...typography.label, color: colors.text, fontWeight: "600" },
    chevron: { marginTop: 1 },

    // Profile icon button
    profileBtn: { padding: 4 },

    // Shared sheet chrome
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.45)",
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      paddingBottom: 34,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      maxHeight: "85%",
    },
    sheetHandle: {
      width: 36,
      height: 4,
      borderRadius: radius.full,
      backgroundColor: colors.border,
      alignSelf: "center",
      marginBottom: spacing.md,
    },
    sheetTitle: {
      ...typography.caption,
      color: colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginBottom: spacing.sm,
    },
    sectionTitle: {
      ...typography.caption,
      color: colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginBottom: spacing.sm,
      marginTop: spacing.xs,
    },
    sheetRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.md,
      gap: spacing.md,
      borderRadius: radius.md,
      paddingHorizontal: spacing.sm,
    },
    sheetRowActive: { backgroundColor: colors.card },
    sheetEmoji: { fontSize: 22 },
    sheetLabel: { ...typography.body, color: colors.text },
    sheetLabelActive: { fontWeight: "700", color: colors.primary },
    subLabel: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
    actionRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: spacing.md,
      marginTop: spacing.xs,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    actionText: { ...typography.label, color: colors.textSecondary },

    // Profile sheet specifics
    avatarRow: { alignItems: "center", paddingVertical: spacing.md, gap: spacing.sm },
    avatar: {
      width: 64,
      height: 64,
      borderRadius: radius.full,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarInitials: { ...typography.h2, color: colors.textOnPrimary, fontWeight: "700" },
    accountId: { ...typography.body, color: colors.textSecondary },
    primaryButton: {
      backgroundColor: colors.primary,
      borderRadius: radius.full,
      paddingVertical: spacing.sm,
      alignItems: "center",
    },
    primaryButtonText: { ...typography.label, color: colors.textOnPrimary, fontWeight: "700" },
    logoutButton: {
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.error ?? "#ef4444",
      paddingVertical: spacing.sm,
      alignItems: "center",
    },
    logoutText: { ...typography.label, color: colors.error ?? "#ef4444", fontWeight: "700" },
  });
}
