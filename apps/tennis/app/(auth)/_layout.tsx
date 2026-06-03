import { Stack, Redirect } from "expo-router";
import { useAuth } from "@juno/api";

export default function AuthLayout() {
  const { session, isLoading } = useAuth();

  if (!isLoading && session) {
    return <Redirect href="/(tabs)/" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
