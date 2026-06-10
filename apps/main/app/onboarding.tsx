import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
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
};

export default function OnboardingScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { session } = useAuth();
  const { finishOnboarding } = useSport();
  const router = useRouter();

  const [selected, setSelected] = useState<Set<Sport>>(new Set());
  const [defaultSport, setDefaultSport] = useState<Sport | null>(null);
  const [saving, setSaving] = useState(false);

  function toggleSport(sport: Sport) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(sport)) {
        next.delete(sport);
        // If this was the default, clear it
        if (defaultSport === sport) setDefaultSport(null);
      } else {
        next.add(sport);
        // Auto-set default if none chosen yet
        if (!defaultSport) setDefaultSport(sport);
      }
      return next;
    });
  }

  async function handleStart() {
    if (selected.size === 0) {
      Alert.alert("Choose at least one sport", "Select the sports you want to follow.");
      return;
    }
    const followed = Array.from(selected);
    const def = defaultSport ?? followed[0];

    setSaving(true);
    try {
      await finishOnboarding(followed, def, session!.token);
      router.replace("/(app)/");
    } catch {
      Alert.alert("Something went wrong", "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} bounces={false}>
        <Text style={styles.heading}>What sports do{"\n"}you follow?</Text>
        <Text style={styles.subheading}>Choose one or more. You can change this any time.</Text>

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
                const isDefault = defaultSport === sport;
                return (
                  <TouchableOpacity
                    key={sport}
                    style={[styles.defaultChip, isDefault && styles.defaultChipActive]}
                    onPress={() => setDefaultSport(sport)}
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
        <TouchableOpacity
          style={[styles.startBtn, selected.size === 0 && styles.startBtnDisabled]}
          onPress={handleStart}
          disabled={saving || selected.size === 0}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.startBtnText}>Get Started</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function createStyles(colors: Palette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { padding: spacing.lg, paddingBottom: spacing.xl },
    heading: {
      ...typography.h1,
      color: colors.text,
      marginTop: spacing.xl,
      marginBottom: spacing.sm,
    },
    subheading: {
      ...typography.body,
      color: colors.textSecondary,
      marginBottom: spacing.xl,
    },
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
    startBtn: {
      backgroundColor: colors.primary,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      alignItems: "center",
    },
    startBtnDisabled: { opacity: 0.4 },
    startBtnText: { ...typography.h3, color: colors.textOnPrimary, fontWeight: "700" },
  });
}
