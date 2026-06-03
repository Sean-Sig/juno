import React, { useEffect, useState } from "react";
import {
  FlatList, View, Text, Image,
  ActivityIndicator, StyleSheet, TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { golf, GolfScheduleEntry } from "@juno/api";
import { colors, spacing, typography, radius } from "@juno/ui";

export default function ScheduleScreen() {
  const [entries, setEntries] = useState<GolfScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    golf.getScheduleEntries().then(({ data }) => {
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
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/tournament/${item.id}`)}
          >
            {item.image_url && (
              <Image source={{ uri: item.image_url }} style={styles.image} />
            )}
            <View style={styles.info}>
              <Text style={styles.name}>{item.name}</Text>
              {item.winners_name && (
                <Text style={styles.winner}>
                  {item.winners_name} · {item.winners_score}
                </Text>
              )}
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
  winner: { ...typography.caption, color: colors.textSecondary, marginTop: 4 },
});
