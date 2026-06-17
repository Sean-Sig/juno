import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  Animated,
  PanResponder,
  StyleSheet,
  Easing,
} from "react-native";
import { useTheme, spacing, radius, typography } from "@juno/ui";
import { useScoutCredits } from "../context/ScoutCreditsContext";

const SHEET_HEIGHT = 420;
const OPEN_DURATION = 320;
const CLOSE_DURATION = 220;
// Drag distance or velocity required to dismiss
const DISMISS_THRESHOLD = 120;
const DISMISS_VELOCITY  = 0.5;

function GoldCoin({ size }: { size: number }) {
  return (
    <View
      style={{
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
      }}
    />
  );
}

const BUNDLES = [
  { id: "starter", label: "Starter", credits: 5,  price: "$0.99", tag: null },
  { id: "pro",     label: "Pro",     credits: 20, price: "$2.99", tag: "Best value" },
  { id: "power",   label: "Power",   credits: 50, price: "$5.99", tag: "Most popular" },
] as const;

export function CreditSheet() {
  const { credits, showSheet, closeSheet } = useScoutCredits();
  const { colors } = useTheme();

  const [mounted, setMounted] = useState(false);
  const slideAnim    = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const dragY        = useRef(new Animated.Value(0)).current;
  const closingRef   = useRef(false);

  // Combined translateY = sheet slide-in + live drag offset
  const translateY = useMemo(
    () => Animated.add(slideAnim, dragY),
    [slideAnim, dragY]
  );

  const open = useCallback(() => {
    closingRef.current = false;
    dragY.setValue(0);
    setMounted(true);
    slideAnim.setValue(SHEET_HEIGHT);
    backdropAnim.setValue(0);
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: OPEN_DURATION,
        easing: Easing.out(Easing.bezier(0.25, 0.46, 0.45, 0.94)),
        useNativeDriver: true,
      }),
      Animated.timing(backdropAnim, {
        toValue: 1,
        duration: OPEN_DURATION,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [slideAnim, backdropAnim, dragY]);

  const animateClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: SHEET_HEIGHT,
        duration: CLOSE_DURATION,
        easing: Easing.in(Easing.bezier(0.25, 0.46, 0.45, 0.94)),
        useNativeDriver: true,
      }),
      Animated.timing(backdropAnim, {
        toValue: 0,
        duration: CLOSE_DURATION,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        dragY.setValue(0);
        setMounted(false);
        closeSheet();
      }
    });
  }, [slideAnim, backdropAnim, dragY, closeSheet]);

  // Snap back to open position
  const snapBack = useCallback(() => {
    Animated.spring(dragY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 120,
      friction: 14,
    }).start();
  }, [dragY]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, { dy }) => Math.abs(dy) > 4,
        onPanResponderMove: (_, { dy }) => {
          // Only allow downward drag; clamp upward to a gentle rubber-band
          if (dy < 0) {
            dragY.setValue(dy * 0.15); // rubber-band upward
          } else {
            dragY.setValue(dy);
          }
          // Fade backdrop as user drags down
          const ratio = Math.max(0, 1 - dy / SHEET_HEIGHT);
          backdropAnim.setValue(ratio);
        },
        onPanResponderRelease: (_, { dy, vy }) => {
          if (dy > DISMISS_THRESHOLD || vy > DISMISS_VELOCITY) {
            animateClose();
          } else {
            // Restore backdrop opacity then snap sheet back
            Animated.timing(backdropAnim, {
              toValue: 1,
              duration: 160,
              useNativeDriver: true,
            }).start();
            snapBack();
          }
        },
        onPanResponderTerminate: () => snapBack(),
      }),
    [dragY, backdropAnim, animateClose, snapBack]
  );

  useEffect(() => {
    if (showSheet) {
      open();
    } else if (mounted) {
      animateClose();
    }
  }, [showSheet]);

  if (!mounted) return null;

  return (
    <Modal transparent animationType="none" onRequestClose={animateClose} visible={mounted}>
      {/* Animated backdrop */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { opacity: backdropAnim }]}
        pointerEvents="none"
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }} />
      </Animated.View>

      {/* Tap-outside to dismiss */}
      <Pressable style={StyleSheet.absoluteFill} onPress={animateClose} />

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          { backgroundColor: colors.surface, transform: [{ translateY }] },
        ]}
      >
        {/* Draggable handle area */}
        <View style={styles.handleArea} {...panResponder.panHandlers}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
        </View>

        {/* Content — separate from pan responder so scrolling/tapping works */}
        <View style={styles.content}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: 4 }}>
            <GoldCoin size={28} />
            <Text style={{ ...typography.h3, color: colors.text }}>Scout Credits</Text>
          </View>
          <Text style={{ ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg }}>
            Each analysis costs 1 credit.
            {credits !== null ? ` You have ${credits} remaining.` : ""}
          </Text>

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
                  <Text style={{ ...typography.caption, color: colors.textSecondary }}>
                    {bundle.label} pack
                  </Text>
                </View>
              </View>
              <Text style={{ ...typography.body, fontWeight: "700", color: colors.text }}>
                {bundle.price}
              </Text>
            </Pressable>
          ))}

          <Text style={{ ...typography.caption, color: colors.textSecondary, textAlign: "center", marginTop: spacing.md }}>
            Payment coming soon — stay tuned!
          </Text>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 48,
    overflow: "hidden",
  },
  handleArea: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    alignItems: "center",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  content: {
    paddingHorizontal: spacing.lg,
  },
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
