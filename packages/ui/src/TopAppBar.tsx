import React, { useMemo } from "react";
import { View, Text, Image, StyleSheet, TouchableOpacity } from "react-native";
import { useTheme } from "./ThemeProvider";
import type { Palette } from "./theme";
import { spacing, radius, typography } from "./theme";

type Props = {
  title: string;
  avatarUri?: string | null;
  avatarInitials?: string;
  onAvatarPress?: () => void;
};

export function TopAppBar({ title, avatarUri, avatarInitials = "?", onAvatarPress }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.avatar}
        onPress={onAvatarPress}
        disabled={!onAvatarPress}
        activeOpacity={0.7}
      >
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
        ) : (
          <Text style={styles.avatarInitials}>{avatarInitials}</Text>
        )}
      </TouchableOpacity>
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
    </View>
  );
}

function createStyles(colors: Palette) {
  return StyleSheet.create({
    container: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.divider,
    },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: radius.full,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      marginRight: spacing.md,
    },
    avatarImage: {
      width: 36,
      height: 36,
      borderRadius: radius.full,
    },
    avatarInitials: {
      ...typography.label,
      color: colors.textOnPrimary,
      fontWeight: "700",
    },
    title: {
      ...typography.h3,
      color: colors.text,
    },
  });
}
