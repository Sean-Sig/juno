import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth, useSport, ALL_SPORTS, type Sport } from "@juno/api";
import { useTheme, spacing, radius, typography, type Palette } from "@juno/ui";

const SPORT_META: Record<Sport, { label: string; emoji: string; description: string }> = {
  golf: {
    label: "Golf",
    emoji: "⛳",
    description: "PGA Tour rankings, live leaderboards & tournament schedules",
  },
  tennis: {
    label: "Tennis",
    emoji: "🎾",
    description: "ATP & WTA rankings, live match scores & draw brackets",
  },
  basketball: {
    label: "Basketball",
    emoji: "🏀",
    description: "NBA live scores, standings & schedules",
  },
  hockey: {
    label: "Hockey",
    emoji: "🏒",
    description: "NHL live scores, standings & schedules",
  },
  football: {
    label: "Football",
    emoji: "🏈",
    description: "NFL live scores, standings & schedules",
  },
};

export default function SportSettingsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { session } = useAuth();
  const { followedSports, defaultSport, finishOnboarding } = useSport();
  const router = useRouter();
  const navigation = useNavigation();
  const { from } = useLocalSearchParams<{ from?: string }>();

  const [selected, setSelected] = useState<Set<Sport>>(new Set(followedSports));
  const [newDefault, setNewDefault] = useState<Sport>(defaultSport);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => from === "profile" ? router.navigate("/(app)/profile") : router.back()}
          style={{ paddingRight: spacing.sm }}
        >
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
      ),
    });
  }, [colors.text]);

  function toggleSport(sport: Sport) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(sport)) {
        if (next.size === 1) {
          Alert.alert("At least one sport required", "You must follow at least one sport.");
          return prev;
        }
        next.delete(sport);
        if (newDefault === sport) {
          const remaining = Array.from(next);
          setNewDefault(remaining[0]);
        }
      } else {
        next.add(sport);
      }
      return next;
    });
  }

  async function handleSave() {
    const followed = Array.from(selected);
    setSaving(true);
    try {
      await finishOnboarding(followed, newDefault, session!.token);
      router.back();
    } catch {
      Alert.alert("Something went wrong", "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.heading}>Followed Sports</Text>

        <View style={styles.sportList}>
          {ALL_SPORTS.map((sport) => {
            const meta = SPORT_META[sport];
            const isSelected = selected.has(sport);
            return (
              <TouchableOpacity
                key={sport}
                style={[styles.sportCard, isSelected && styles.sportCardSelected]}
                onPress={() => toggleSport(sport)}
                activeOpacity={0.8}
              >
                <Text style={styles.sportEmoji}>{meta.emoji}</Text>
                <View style={styles.sportInfo}>
                  <Text style={[styles.sportLabel, isSelected && styles.sportLabelSelected]}>
                    {meta.label}
                  </Text>
                  <Text style={styles.sportDesc}>{meta.description}</Text>
                </View>
                <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                  {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {selected.size > 1 && (
          <View style={styles.defaultSection}>
            <Text style={styles.defaultLabel}>Default sport</Text>
            <Text style={styles.defaultHint}>Opens first when you launch the app</Text>
            <View style={styles.defaultRow}>
              {Array.from(selected).map((sport) => {
                const meta = SPORT_META[sport];
                const isDefault = newDefault === sport;
                return (
                  <TouchableOpacity
                    key={sport}
                    style={[styles.defaultChip, isDefault && styles.defaultChipActive]}
                    onPress={() => setNewDefault(sport)}
                  >
                    <Text style={[styles.defaultChipText, isDefault && styles.defaultChipTextActive]}>
                      {meta.emoji} {meta.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>Save Changes</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function createStyles(colors: Palette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { padding: spacing.lg },
    heading: { ...typography.h2, color: colors.text, marginBottom: spacing.lg },
    sportList: { gap: spacing.md },
    sportCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      padding: spacing.md,
      borderWidth: 2,
      borderColor: "transparent",
      gap: spacing.md,
    },
    sportCardSelected: { borderColor: colors.primary },
    sportEmoji: { fontSize: 32 },
    sportInfo: { flex: 1 },
    sportLabel: { ...typography.h3, color: colors.text },
    sportLabelSelected: { color: colors.primary },
    sportDesc: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: radius.full,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    checkboxSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
    defaultSection: { marginTop: spacing.xl },
    defaultLabel: { ...typography.h3, color: colors.text, marginBottom: 4 },
    defaultHint: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.md },
    defaultRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
    defaultChip: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.full,
      backgroundColor: colors.card,
      borderWidth: 1.5,
      borderColor: "transparent",
    },
    defaultChipActive: { borderColor: colors.primary, backgroundColor: colors.background },
    defaultChipText: { ...typography.label, color: colors.textSecondary },
    defaultChipTextActive: { color: colors.primary, fontWeight: "700" },
    footer: {
      padding: spacing.lg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
    },
    saveBtn: {
      backgroundColor: colors.primary,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      alignItems: "center",
    },
    saveBtnText: { ...typography.h3, color: colors.textOnPrimary, fontWeight: "700" },
  });
}
