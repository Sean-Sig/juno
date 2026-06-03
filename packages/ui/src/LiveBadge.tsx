import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, radius, typography } from "./theme";

type Props = {
  label?: string;
};

export function LiveBadge({ label = "LIVE" }: Props) {
  return (
    <View style={styles.badge}>
      <View style={styles.dot} />
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.liveBackground,
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.live,
    marginRight: 4,
  },
  text: {
    ...typography.caption,
    color: colors.live,
    fontWeight: "700",
  },
});
