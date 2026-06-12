export type MatchStatus = "scheduled" | "played";

export function matchStatus(playedAt: string | null): MatchStatus {
  return playedAt ? "played" : "scheduled";
}

export function matchResponseFields(match: {
  id: string;
  group_id?: string;
  round?: number;
  datetime?: string;
  board_count?: number;
  vp_board_count?: number | null;
  mis_seating?: boolean;
  selected_board_count?: number | null;
  played_at: string | null;
  imps_home?: number | null;
  imps_away?: number | null;
  vp_home?: number | null;
  vp_away?: number | null;
  home_team?: { id: string; name: string; club_id?: string };
  away_team?: { id: string; name: string; club_id?: string };
}) {
  return {
    ...match,
    status: matchStatus(match.played_at),
  };
}
