import React, { useEffect, useRef } from "react";
import { View, Text, Modal, Pressable, Animated, StyleSheet } from "react-native";
import { useTheme, spacing, radius, typography } from "@juno/ui";
import { useScoutCredits } from "../context/ScoutCreditsContext";

function GoldCoin({ size }: { size: number }) {
  return (
    <View style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: "#FFD700",
      borderWidth: size * 0.12,
      borderColor: "#B8860B",
      shadowColor: "#FFD700",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.55,
      shadowRadius: 3,
    }} />
  );
}

const BUNDLES = [
  { id: "starter", label: "Starter",      credits: 5,  price: "$0.99", tag: null },
  { id: "pro",     label: "Pro",          credits: 20, price: "$2.99", tag: "Best value" },
  { id: "power",   label: "Power",        credits: 50, price: "$5.99", tag: "Most popular" },
] as const;

export function CreditSheet() {
  const { credits, showSheet, closeSheet } = useScoutCredits();
  const { colors } = useTheme();
  const slideAnim = useRef(new Animated.Value(400)).current;

  useEffect(() => {
    if (showSheet) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
    } else {
      slideAnim.setValue(400);
    }
  }, [showSheet]);

  if (!showSheet) return null;

  return (
    <Modal transparent animationType="none" onRequestClose={closeSheet}>
      <Pressable style={styles.backdrop} onPress={closeSheet}>
        <Animated.View
          style={[
            styles.sheet,
            { backgroundColor: colors.surface, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          {/* Title */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: 4 }}>
            <GoldCoin size={28} />
            <Text style={{ ...typography.h3, color: colors.text }}>Scout Credits</Text>
          </View>
          <Text style={{ ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg }}>
            Each analysis costs 1 credit.{credits !== null ? ` You have ${credits} remaining.` : ""}
          </Text>

          {/* Bundles */}
          {BUNDLES.map((bundle) => (
            <Pressable
              key={bundle.id}
              style={({ pressed }) => [
                styles.bundleRow,
                {
                  backgroundColor: pressed ? colors.card : colors.background,
                  borderColor: bundle.id === "pro" ? colors.primary : colors.border,
                },
              ]}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <GoldCoin size={22} />
                <View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={{ ...typography.body, fontWeight: "700", color: colors.text }}>
                      {bundle.credits} credits
                    </Text>
                    {bundle.tag && (
                      <View style={[styles.tag, { backgroundColor: colors.primary }]}>
                        <Text style={styles.tagText}>{bundle.tag}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ ...typography.caption, color: colors.textSecondary }}>{bundle.label} pack</Text>
                </View>
              </View>
              <Text style={{ ...typography.body, fontWeight: "700", color: colors.text }}>{bundle.price}</Text>
            </Pressable>
          ))}

          <Text style={{ ...typography.caption, color: colors.textSecondary, textAlign: "center", marginTop: spacing.md }}>
            Payment coming soon — stay tuned!
          </Text>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 48,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: spacing.md },
  bundleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: radius.md,
    borderWidth: 1.5,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  tag: { borderRadius: radius.full, paddingHorizontal: 7, paddingVertical: 2 },
  tagText: { color: "#fff", fontSize: 10, fontWeight: "700" },
});
