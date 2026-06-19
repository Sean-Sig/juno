export type HockeyTeam = {
  id: string;
  name: string;        // short name e.g. "Hurricanes"
  full_name: string | null;  // full name e.g. "Carolina Hurricanes"
  short_name: string | null;
  abbreviation: string | null;
  logo: string | null;
  league: string | null;
  conference: string | null;
  division: string | null;
  wins: number;
  losses: number;
  overtime_losses: number | null;
  points: number | null;
  goals_for: number | null;
  goals_against: number | null;
  wins_home: number | null;
  losses_home: number | null;
  wins_away: number | null;
  losses_away: number | null;
  standing_rank: number | null;
  streak: string | null;
};

export type HockeyPlayer = {
  id: string;
  first_name: string;
  last_name: string;
  display_name: string;
  country: string | null;
  photo: string | null;
  position: string | null;
  jersey_number: string | null;
  height: string | null;
  weight: string | null;
  league: string | null;
  team_id: string | null;
  enet_id: string | null;
};

export type HockeyGame = {
  id: string;
  league: string | null;
  status: "scheduled" | "live" | "finished";
  status_detail: string | null;
  period: number | null;
  period_time: string | null;
  scheduled_at: string | null;
  home_score: number | null;
  away_score: number | null;
  home_score_p1: number | null;
  home_score_p2: number | null;
  home_score_p3: number | null;
  away_score_p1: number | null;
  away_score_p2: number | null;
  away_score_p3: number | null;
  home_score_ot: number | null;
  away_score_ot: number | null;
  shootout: boolean | null;
  home_team: HockeyTeam | null;
  away_team: HockeyTeam | null;
  enet_event_id: string | null;
  venue_name: string | null;
  venue_city: string | null;
  venue_country: string | null;
  venue_capacity: number | null;
  series_round: string | null;
  series_game_num: number | null;
  series_best_of: number | null;
};
