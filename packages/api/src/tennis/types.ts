export type TennisPlayer = {
  id: string;
  first_name: string;
  last_name: string;
  display_first_name: string | null;
  display_last_name: string | null;
  country: string | null;
  photo: string | null;
  gender: string | null;
  tour: { id: string; name: string } | null;
  singles_rank: number | null;
  doubles_rank: number | null;
  singles_points: number | null;
  singles_race_rank: number | null;
  singles_rank_movement: number | null;
  retired: boolean;
  injured: boolean;
};

export type TennisSetScore = {
  set_index: number;
  "1": { games: number; tiebreak?: number };
  "2": { games: number; tiebreak?: number };
};

export type TennisLiveScore = {
  server: string | null;
  game_score_1: string | null;
  game_score_2: string | null;
  current_set: number | null;
};

export type TennisMatch = {
  id: string;
  tournament_id: string;
  player1_id: string | null;
  player1: TennisPlayer | null;
  player2_id: string | null;
  player2: TennisPlayer | null;
  player1_partner_id: string | null;
  player1_partner: TennisPlayer | null;
  player2_partner_id: string | null;
  player2_partner: TennisPlayer | null;
  type: string | null;
  round: string | null;
  court: string | null;
  order: number | null;
  status: string;
  winner: 1 | 2 | null;
  starts_at: string | null;
  finished_at: string | null;
  sets: TennisSetScore[];
  live: TennisLiveScore | null;
  duration: number | null;
  chat_enabled: boolean;
  has_live_video: boolean;
  live_video_url: string | null;
};

export type TennisTournament = {
  id: string;
  team_id: string;
  name: string;
  year: number | null;
  tour: { id: string; name: string } | null;
  surface: string | null;
  start_date: string | null;
  end_date: string | null;
  courts: Record<string, unknown> | null;
  rounds: Record<string, unknown> | null;
  show_match_details: boolean;
  chat_enabled: boolean;
};

export type TennisScheduleEntry = {
  id: string;
  name: string;
  image_url: string | null;
  start_date: string | null;
  end_date: string | null;
  partnership_level: string;
  theme: Record<string, string> | null;
  gender: string | null;
  priority: number;
};

export type MatchComment = {
  id: string;
  match_id: string;
  body: string;
  priority: number;
  locale: string;
  inserted_at: string;
};

export type MatchScoreDelta = Partial<TennisMatch>;
