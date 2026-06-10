import { Stack, Redirect } from "expo-router";
import { useAuth } from "@juno/api";

export default function AuthLayout() {
  const { session, isLoading } = useAuth();

  if (!isLoading && session) {
    return <Redirect href="/(app)/" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
