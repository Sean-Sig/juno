import React, { useEffect, useState } from "react";
import {
  FlatList, View, TextInput,
  ActivityIndicator, StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { tennis, TennisPlayer } from "@juno/api";
import { PlayerCard, colors, spacing } from "@juno/ui";

const TEAM_ID = process.env.EXPO_PUBLIC_TENNIS_TEAM_ID ?? "00000000-0000-0000-0000-000000000002";

export default function PlayersScreen() {
  const [players, setPlayers] = useState<TennisPlayer[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    tennis.getTournamentPlayers(TEAM_ID).then(({ data }) => {
      setPlayers(data);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (query.length < 2) return;
    const timer = setTimeout(() => {
      tennis.searchPlayers(query).then(({ data }) => setPlayers(data));
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.searchBar}>
        <TextInput
          style={styles.input}
          placeholder="Search players…"
          value={query}
          onChangeText={setQuery}
          placeholderTextColor={colors.textSecondary}
        />
      </View>
      <FlatList
        data={players}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <PlayerCard
            firstName={item.display_first_name ?? item.first_name}
            lastName={item.display_last_name ?? item.last_name}
            country={item.country}
            photo={item.photo}
            rank={item.singles_rank}
            rankLabel="ATP/WTA"
            onPress={() => router.push(`/player/${item.id}`)}
          />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  searchBar: { padding: spacing.md, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  input: {
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
  },
  list: { padding: spacing.md },
});
