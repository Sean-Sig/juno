import React from "react";
import { useSport } from "@juno/api";
import GolfRankings from "../../components/GolfRankings";
import TennisRankings from "../../components/TennisRankings";
import BasketballStandings from "../../components/BasketballStandings";
import HockeyStandings from "../../components/HockeyStandings";
import FootballStandings from "../../components/FootballStandings";

export default function RankingsScreen() {
  const { activeSport } = useSport();
  if (activeSport === "golf") return <GolfRankings />;
  if (activeSport === "tennis") return <TennisRankings />;
  if (activeSport === "hockey") return <HockeyStandings />;
  if (activeSport === "football") return <FootballStandings />;
  return <BasketballStandings />;
}
