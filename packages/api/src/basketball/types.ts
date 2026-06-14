export type BasketballTeam = {
  id: string;
  name: string;
  short_name: string | null;
  abbreviation: string | null;
  logo: string | null;
  league: string | null;
  conference: string | null;
  division: string | null;
  wins: number;
  losses: number;
  wins_home: number | null;
  losses_home: number | null;
  wins_away: number | null;
  losses_away: number | null;
  standing_rank: number | null;
  streak: string | null;
};

export type BasketballPlayer = {
  id: string;
  first_name: string;
  last_name: string;
  display_first_name: string | null;
  display_last_name: string | null;
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

export type BasketballScheduleEntry = {
  id: string;
  name: string;
  league: string | null;
  season_year: number | null;
  start_date: string | null;  // "YYYY-MM-DD"
  end_date: string | null;    // "YYYY-MM-DD"
  image_url: string | null;
  description: string | null;
  priority: number;
};

export type BasketballGame = {
  id: string;
  league: string | null;
  status: "scheduled" | "live" | "finished";
  status_detail: string | null;
  period: number | null;
  period_time: string | null;
  scheduled_at: string | null;
  home_score: number | null;
  away_score: number | null;
  home_score_q1: number | null;
  home_score_q2: number | null;
  home_score_q3: number | null;
  home_score_q4: number | null;
  away_score_q1: number | null;
  away_score_q2: number | null;
  away_score_q3: number | null;
  away_score_q4: number | null;
  home_team: BasketballTeam | null;
  away_team: BasketballTeam | null;
  enet_event_id: string | null;
  venue_name: string | null;
  venue_city: string | null;
  venue_country: string | null;
  venue_capacity: number | null;
  venue_latitude: string | null;
  venue_longitude: string | null;
  series_round: string | null;
  series_game_num: number | null;
  series_best_of: number | null;
  attendance: number | null;
  home_timeouts_remaining: number | null;
  away_timeouts_remaining: number | null;
};
