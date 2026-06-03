import React from "react";
import { View, Text, Image, StyleSheet, TouchableOpacity } from "react-native";
import { colors, spacing, radius, typography } from "./theme";

type Props = {
  firstName: string;
  lastName: string;
  country?: string | null;
  photo?: string | null;
  rank?: number | null;
  rankLabel?: string;
  onPress?: () => void;
};

export function PlayerCard({ firstName, lastName, country, photo, rank, rankLabel = "Rank", onPress }: Props) {
  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      {photo ? (
        <Image source={{ uri: photo }} style={styles.photo} />
      ) : (
        <View style={styles.photoPlaceholder}>
          <Text style={styles.initials}>
            {firstName[0]}{lastName[0]}
          </Text>
        </View>
      )}
      <View style={styles.info}>
        <Text style={styles.name}>{firstName} {lastName}</Text>
        {country && <Text style={styles.country}>{country}</Text>}
      </View>
      {rank != null && (
        <View style={styles.rankBadge}>
          <Text style={styles.rankLabel}>{rankLabel}</Text>
          <Text style={styles.rankValue}>#{rank}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  photo: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    marginRight: spacing.md,
  },
  photoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  initials: {
    ...typography.label,
    color: colors.textSecondary,
  },
  info: {
    flex: 1,
  },
  name: {
    ...typography.h3,
    color: colors.text,
  },
  country: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  rankBadge: {
    alignItems: "center",
  },
  rankLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  rankValue: {
    ...typography.label,
    color: colors.primary,
  },
});
