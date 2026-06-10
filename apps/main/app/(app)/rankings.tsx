/**
 * Rankings tab — renders the golf or tennis rankings screen
 * based on the active sport in SportContext.
 */
import React from "react";
import { useSport } from "@juno/api";
import GolfRankings from "../../components/GolfRankings";
import TennisRankings from "../../components/TennisRankings";

export default function RankingsScreen() {
  const { activeSport } = useSport();
  return activeSport === "golf" ? <GolfRankings /> : <TennisRankings />;
}
