import React, { useMemo } from "react";
import { View, Text, Image, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "./ThemeProvider";
import type { Palette } from "./theme";
import { spacing, radius, typography } from "./theme";
import { countryFlag } from "./countryFlag";

type Props = {
  firstName: string;
  lastName: string;
  country?: string | null;
  photo?: string | null;
  rank?: number | null;
  rankLabel?: string;
  following?: boolean;
  onToggleFollow?: () => void;
  onPress?: () => void;
};

export function PlayerCard({
  firstName,
  lastName,
  country,
  photo,
  rank,
  rankLabel = "Rank",
  following,
  onToggleFollow,
  onPress,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const flag = countryFlag(country);

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.photoWrapper}>
        {photo ? (
          <Image source={{ uri: photo }} style={styles.photo} />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Text style={styles.initials}>
              {firstName[0]}{lastName[0]}
            </Text>
          </View>
        )}
        {flag && (
          <Text style={styles.flagBadge}>{flag}</Text>
        )}
      </View>
      <View style={styles.info}>
        <Text style={styles.name}>{firstName} {lastName}</Text>
        {rank != null && (
          <Text style={styles.rankLabel}>{rankLabel} <Text style={styles.rankValue}>#{rank}</Text></Text>
        )}
      </View>
      {onToggleFollow && (
        <TouchableOpacity
          style={styles.followButton}
          onPress={(e) => {
            e.stopPropagation();
            onToggleFollow();
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name={following ? "checkmark-circle" : "add-circle-outline"}
            size={26}
            color={colors.primary}
          />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

function createStyles(colors: Palette) {
  return StyleSheet.create({
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
    photoWrapper: {
      width: 48,
      height: 48,
      marginRight: spacing.md,
    },
    photo: {
      width: 48,
      height: 48,
      borderRadius: radius.full,
    },
    photoPlaceholder: {
      width: 48,
      height: 48,
      borderRadius: radius.full,
      backgroundColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    flagBadge: {
      position: "absolute",
      bottom: -2,
      right: -4,
      fontSize: 14,
      lineHeight: 16,
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
    rankLabel: {
      ...typography.caption,
      color: colors.textSecondary,
      marginTop: 2,
    },
    rankValue: {
      ...typography.caption,
      color: colors.primary,
      fontWeight: "600",
    },
    followButton: {
      marginLeft: spacing.sm,
      padding: spacing.xs,
    },
  });
}
