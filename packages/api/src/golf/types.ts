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

/** Per-round detail block stored in GolfScore.details */
export type GolfRoundDetail = {
  strokes: number | null;
  /** Hole number (1–18) → strokes taken on that hole */
  scores: Record<string, number> | null;
  /** Hole number (1–18) → par for that hole */
  course_pars: Record<string, number> | null;
  /** Hole number (1–18) → score relative to par */
  to_pars: Record<string, number> | null;
  /** Total score relative to par for this round */
  par: number | null;
  /** "F" = finished, "15" = through 15 holes, null = not started */
  thru: string | null;
  tee_time: string | null;
  course_id: string;
  mp_list: unknown[];
  extra_mp_list: unknown[];
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
  /** Boolean flag — true when hole-by-hole data is available in details */
  hole_by_hole: boolean;
  mp_result: string | null;
  mp_score: string | null;
  /** Keys: "round_1" … "round_4". Each contains per-hole scores and pars. */
  details: Record<string, GolfRoundDetail> | null;
  stats: Record<string, unknown> | null;
};

/** Score returned by GET /api/v4/golf/players/:id/scores — includes the event (round) it belongs to */
export type GolfPlayerScore = {
  id: string;
  event_id: string;
  player_id: string;
  strokes: number;
  par: number;
  place: number | null;
  display_place: string | null;
  sort_order: number;
  made_cut: boolean;
  dq: boolean;
  wd: boolean;
  is_playing: boolean;
  hole_by_hole: boolean;
  mp_result: string | null;
  mp_score: string | null;
  stats: Record<string, unknown> | null;
  details: Record<string, unknown> | null;
  event: {
    id: string;
    name: string;
    type: string;
    game_type: string | null;
    status: string;
    live: boolean;
    start_date: string | null;
    number_of_rounds: number | null;
    most_recently_scored_round: string | null;
  } | null;
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
  tier: string | null;
  prize_money: number | null;
  prize_currency: string | null;
  cut: number | null;
  projected_cut: number | null;
  start_date: string | null;
  end_date: string | null;
  enet_tournament_stage_id: string | null;
  courses: GolfCourse[];
  events: GolfEvent[];
};

export type PlayerSeasonRank = {
  id: string;
  player_id: string;
  year: number;
  standing_name: string;
  standing_type: string;
  rank: number | null;
  value: string | null;
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
  enet_stage_id: string | null;
};
