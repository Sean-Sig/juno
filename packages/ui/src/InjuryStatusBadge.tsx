import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "./ThemeProvider";
import type { Palette } from "./theme";
import { radius, typography } from "./theme";

type Props = {
  /** Full status string from the injury report, e.g. "Day-To-Day", "Out", "Questionable", "Probable". */
  status: string;
  label?: string;
};

/** "Out" reads as unavailable; everything else on an injury report still means available but limited. */
function severityColor(status: string, colors: Palette): { dot: string; background: string; text: string } {
  const normalized = status.trim().toLowerCase();
  if (normalized === "out") {
    return { dot: colors.error, background: `${colors.error}1A`, text: colors.error };
  }
  return { dot: "#D97706", background: "#D9770626", text: "#D97706" };
}

export function InjuryStatusBadge({ status, label }: Props) {
  const { colors } = useTheme();
  const { dot, background, text } = useMemo(() => severityColor(status, colors), [status, colors]);
  const styles = useMemo(() => createStyles(background, text), [background, text]);

  return (
    <View style={styles.badge}>
      <View style={[styles.dot, { backgroundColor: dot }]} />
      <Text style={styles.text}>{label ?? status}</Text>
    </View>
  );
}

function createStyles(background: string, text: string) {
  return StyleSheet.create({
    badge: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: background,
      borderRadius: radius.full,
      paddingHorizontal: 8,
      paddingVertical: 3,
      alignSelf: "flex-start",
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: radius.full,
      marginRight: 4,
    },
    text: {
      ...typography.caption,
      color: text,
      fontWeight: "700",
    },
  });
}
