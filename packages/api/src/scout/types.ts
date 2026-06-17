export type ScoutBreakdown = {
  rankings_strength: number;
  recent_form: number;
  head_to_head: number;
  availability: number;
};

export type PlayerScore = {
  player_id: string;
  score: number;
  pros: string[];
  cons: string[];
};

export type ScoutResult = {
  overall_score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  summary: string;
  player_scores: PlayerScore[];
  breakdown: ScoutBreakdown;
  key_factors: string[];
  risks: string[];
};
