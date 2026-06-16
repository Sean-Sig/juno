import React from "react";
import { useSport } from "@juno/api";
import TennisScout from "../../components/TennisScout";
import { View, Text, StyleSheet } from "react-native";
import { useTheme, spacing, typography } from "@juno/ui";

export default function ScoutScreen() {
  const { activeSport } = useSport();
  const { colors } = useTheme();

  if (activeSport === "tennis") return <TennisScout />;

  return (
    <View style={styles.placeholder}>
      <Text style={[styles.emoji]}>🔭</Text>
      <Text style={[styles.title, { color: colors.text }]}>Scout</Text>
      <Text style={[styles.body, { color: colors.textSecondary }]}>
        Scout analysis is currently available for tennis.{"\n"}Switch sport to try it.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  emoji: { fontSize: 48, marginBottom: spacing.md },
  title: { ...typography.h2, marginBottom: spacing.sm },
  body: { ...typography.body, textAlign: "center" },
});
