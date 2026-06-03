import React, { useEffect, useState } from "react";
import {
  FlatList, View, Text, Image,
  ActivityIndicator, StyleSheet, TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { tennis, TennisScheduleEntry } from "@juno/api";
import { colors, spacing, typography, radius } from "@juno/ui";

export default function ScheduleScreen() {
  const [entries, setEntries] = useState<TennisScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    tennis.getScheduleEntries().then(({ data }) => {
      setEntries(data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={entries}
        keyExtractor={(e) => e.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} activeOpacity={0.7}>
            {item.image_url && (
              <Image source={{ uri: item.image_url }} style={styles.image} />
            )}
            <View style={styles.info}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.dates}>
                {item.start_date?.slice(0, 10)} – {item.end_date?.slice(0, 10)}
              </Text>
              <Text style={styles.level}>{item.partnership_level.toUpperCase()}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  list: { padding: spacing.md },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  image: { width: "100%", height: 140 },
  info: { padding: spacing.md },
  name: { ...typography.h3, color: colors.text },
  dates: { ...typography.caption, color: colors.textSecondary, marginTop: 4 },
  level: { ...typography.caption, color: colors.primary, marginTop: 4, fontWeight: "600" },
});
