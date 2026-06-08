import React, { useEffect, useMemo, useRef } from "react";
import { Animated, View, StyleSheet, type ViewStyle, type StyleProp } from "react-native";
import { useTheme } from "./ThemeProvider";
import type { Palette } from "./theme";
import { spacing, radius } from "./theme";

type SkeletonProps = {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
};

export function Skeleton({ width = "100%", height = 16, borderRadius: cornerRadius = radius.sm, style }: SkeletonProps) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: cornerRadius, backgroundColor: colors.border, opacity },
        style,
      ]}
    />
  );
}

export function SkeletonCard() {
  const { colors } = useTheme();
  const styles = useMemo(() => createCardStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <Skeleton width={48} height={48} borderRadius={radius.full} />
      <View style={styles.info}>
        <Skeleton width="60%" height={16} />
        <Skeleton width="35%" height={12} style={styles.secondLine} />
      </View>
    </View>
  );
}

function createCardStyles(colors: Palette) {
  return StyleSheet.create({
    container: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    info: {
      flex: 1,
      marginLeft: spacing.md,
    },
    secondLine: {
      marginTop: spacing.xs,
    },
  });
}
