import { Redirect } from "expo-router";
import { useSport } from "@juno/api";

export default function IndexRedirect() {
  const { activeSport } = useSport();
  if (activeSport === "golf") return <Redirect href="/(app)/tournaments" />;
  if (activeSport === "tennis") return <Redirect href="/(app)/matches" />;
  return <Redirect href="/(app)/games" />;
}
