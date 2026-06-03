import React, { useEffect, useState } from "react";
import { FlatList, ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { golf, GolfPlayer } from "@juno/api";
import { PlayerCard, colors } from "@juno/ui";

export default function PlayersScreen() {
  const [players, setPlayers] = useState<GolfPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    golf.getPlayers({ sort: "world_rankings" }).then(({ data }) => {
      setPlayers(data);
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
        data={players}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <PlayerCard
            firstName={item.display_first_name ?? item.first_name}
            lastName={item.display_last_name ?? item.last_name}
            country={item.country}
            photo={item.photo}
            rank={item.world_rankings_rank}
            rankLabel="WR"
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
  list: { padding: 16 },
});
