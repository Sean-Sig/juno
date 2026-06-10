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
} from "react-native";
import { useSport, ALL_SPORTS, type Sport } from "@juno/api";
import { useTheme, spacing, radius, typography, type Palette } from "@juno/ui";

const SPORT_META: Record<Sport, { label: string; emoji: string }> = {
  golf: { label: "Golf", emoji: "⛳" },
  tennis: { label: "Tennis", emoji: "🎾" },
};

/** The pill in the top-left that opens the sport switcher sheet */
function SportSwitcherButton() {
  const { activeSport, followedSports, setActiveSport } = useSport();
  const { colors } = useTheme();
  const styles = useMemo(() => createSwitcherStyles(colors), [colors]);
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
    // Navigate to home tab of the newly selected sport
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
              style={styles.manageRow}
              onPress={() => { closeSheet(); router.push("/(app)/sport-settings"); }}
            >
              <Ionicons name="settings-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.manageText}>Manage followed sports</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </Modal>
    </>
  );
}

export default function AppLayout() {
  const { activeSport } = useSport();
  const { colors } = useTheme();

  return (
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

      <Tabs.Screen
        name="rankings"
        options={{
          title: "Rankings",
          tabBarIcon: ({ color, size }) => <Ionicons name="podium" color={color} size={size} />,
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-circle" color={color} size={size} />
          ),
        }}
      />

      {/* Detail screens — hidden from tab bar */}
      <Tabs.Screen name="player/[id]" options={{ href: null }} />
      <Tabs.Screen name="tournament/[id]" options={{ href: null }} />
      <Tabs.Screen name="match/[id]" options={{ href: null }} />
      <Tabs.Screen name="sport-settings" options={{ href: null, title: "Followed Sports" }} />
    </Tabs>
  );
}

function createSwitcherStyles(colors: Palette) {
  return StyleSheet.create({
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
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.45)",
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      paddingBottom: 34, // safe-area bottom
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
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
    sheetLabel: { ...typography.body, color: colors.text, flex: 1 },
    sheetLabelActive: { fontWeight: "700", color: colors.primary },
    manageRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: spacing.md,
      marginTop: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    manageText: { ...typography.label, color: colors.textSecondary },
  });
}
