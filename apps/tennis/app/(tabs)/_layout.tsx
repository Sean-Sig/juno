import { Tabs } from "expo-router";
import { colors } from "@juno/ui";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        headerShown: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Scores" }} />
      <Tabs.Screen name="players" options={{ title: "Players" }} />
      <Tabs.Screen name="schedule" options={{ title: "Schedule" }} />
    </Tabs>
  );
}
