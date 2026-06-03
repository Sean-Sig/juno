export type GolfPlayer = {
  id: string;
  first_name: string;
  last_name: string;
  display_first_name: string | null;
  display_last_name: string | null;
  country: string | null;
  photo: string | null;
  world_rankings_rank: number | null;
  rolex_world_rankings_rank: number | null;
  tour: Record<string, string> | null;
};

export type GolfScore = {
  id: string;
  player_id: string;
  player: GolfPlayer | null;
  strokes: number;
  par: number;
  place: number | null;
  display_place: string | null;
  sort_order: number;
  pair_id: string | null;
  made_cut: boolean;
  dq: boolean;
  wd: boolean;
  is_playing: boolean;
  hole_by_hole: Record<string, unknown> | null;
  mp_result: string | null;
  mp_score: string | null;
  details: Record<string, unknown> | null;
  stats: Record<string, unknown> | null;
};

export type GolfEvent = {
  id: string;
  name: string;
  type: string;
  game_type: string | null;
  status: string;
  live: boolean;
  start_date: string | null;
  number_of_rounds: number | null;
  most_recently_scored_round: string | null;
  is_primary_team_event: boolean;
  team_score: number | null;
  scores: GolfScore[];
};

export type GolfCourse = {
  id: string;
  name: string;
  enet_id: string | null;
  primary_course: boolean;
  city: string | null;
  course_abbreviation: string | null;
  in_par: number | null;
  out_par: number | null;
  total_par: number | null;
  total_yards: number | null;
  total_meters: number | null;
  holes: Record<string, unknown> | null;
};

export type GolfTournament = {
  id: string;
  team_id: string;
  name: string;
  year: number | null;
  tour: Record<string, string> | null;
  tournament_type: string;
  prize_money: number | null;
  prize_currency: string | null;
  cut: number | null;
  projected_cut: number | null;
  start_date: string | null;
  end_date: string | null;
  courses: GolfCourse[];
  events: GolfEvent[];
};

export type GolfScheduleEntry = {
  id: string;
  team_id: string;
  name: string;
  image_url: string | null;
  start_date: string | null;
  end_date: string | null;
  partnership_level: string;
  hidden: boolean;
  priority: number;
  winners_name: string | null;
  winners_score: string | null;
  winners_name_loc_key: string | null;
  theme: Record<string, string> | null;
};
