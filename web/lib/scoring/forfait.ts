import type { SupabaseClient } from "@supabase/supabase-js";

export type ForfaitSide = "home" | "away";

export const FORFAIT_MIN_VP = 12;

export type ScoredMatchForAverage = {
  id: string;
  home_team_id: string;
  away_team_id: string;
  vp_home: number | null;
  vp_away: number | null;
  played_at: string | null;
  forfait_side: ForfaitSide | null;
};

export type ForfaitMatchRow = ScoredMatchForAverage & {
  forfait_side: ForfaitSide;
};

export function isForfaitSide(value: unknown): value is ForfaitSide {
  return value === "home" || value === "away";
}

/** Mean of finite numbers; empty list → null (caller uses FORFAIT_MIN_VP). */
export function meanVp(values: number[]): number | null {
  if (values.length === 0) return null;
  const sum = values.reduce((a, b) => a + b, 0);
  return sum / values.length;
}

/**
 * Round to `decimals` places with half-up (.5 and above rounds away from zero).
 * e.g. 12.345 → 12.35, 12.344 → 12.34.
 */
export function roundVpHalfUp(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  // Scale, then push half-cases across the midpoint before Math.round.
  const scaled = value * factor;
  const rounded =
    scaled >= 0 ? Math.floor(scaled + 0.5) : Math.ceil(scaled - 0.5);
  return rounded / factor;
}

/**
 * Mean VP from a team's other actually played matches.
 * Skips the excluded match, unplayed rows, and any forfait (including other forfaits).
 */
export function teamPlayedAverageVp(
  teamId: string,
  groupMatches: ScoredMatchForAverage[],
  excludeMatchId: string,
): number | null {
  const vps: number[] = [];
  for (const m of groupMatches) {
    if (m.id === excludeMatchId) continue;
    if (m.played_at == null) continue;
    if (m.forfait_side != null) continue;

    if (m.home_team_id === teamId && m.vp_home != null) {
      vps.push(Number(m.vp_home));
    } else if (m.away_team_id === teamId && m.vp_away != null) {
      vps.push(Number(m.vp_away));
    }
  }
  return meanVp(vps);
}

/**
 * Winner VP = max(12, winnerAvg, 20 − forfeiterAvg), rounded to 2 decimals (half-up).
 * Averages use only actually played non-forfait matches; missing averages are omitted.
 */
export function forfaitWinnerVp(
  winnerTeamId: string,
  forfeiterTeamId: string,
  groupMatches: ScoredMatchForAverage[],
  excludeMatchId: string,
): number {
  const candidates: number[] = [FORFAIT_MIN_VP];
  const winnerAvg = teamPlayedAverageVp(
    winnerTeamId,
    groupMatches,
    excludeMatchId,
  );
  if (winnerAvg != null) candidates.push(winnerAvg);

  const forfeiterAvg = teamPlayedAverageVp(
    forfeiterTeamId,
    groupMatches,
    excludeMatchId,
  );
  if (forfeiterAvg != null) candidates.push(20 - forfeiterAvg);

  return roundVpHalfUp(Math.max(...candidates));
}

export function forfaitVpPair(
  forfaitSide: ForfaitSide,
  winnerVp: number,
): { vpHome: number; vpAway: number } {
  if (forfaitSide === "home") {
    return { vpHome: 0, vpAway: winnerVp };
  }
  return { vpHome: winnerVp, vpAway: 0 };
}

export function computeForfaitScores(
  forfaitSide: ForfaitSide,
  homeTeamId: string,
  awayTeamId: string,
  groupMatches: ScoredMatchForAverage[],
  matchId: string,
): { vpHome: number; vpAway: number; winnerVp: number } {
  const winnerTeamId = forfaitSide === "home" ? awayTeamId : homeTeamId;
  const forfeiterTeamId = forfaitSide === "home" ? homeTeamId : awayTeamId;
  const winnerVp = forfaitWinnerVp(
    winnerTeamId,
    forfeiterTeamId,
    groupMatches,
    matchId,
  );
  const { vpHome, vpAway } = forfaitVpPair(forfaitSide, winnerVp);
  return { vpHome, vpAway, winnerVp };
}

async function loadGroupMatchesForForfait(
  supabase: SupabaseClient,
  groupId: string,
): Promise<ScoredMatchForAverage[]> {
  const { data, error } = await supabase
    .from("matches")
    .select(
      "id, home_team_id, away_team_id, vp_home, vp_away, played_at, forfait_side",
    )
    .eq("group_id", groupId);

  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    home_team_id: row.home_team_id,
    away_team_id: row.away_team_id,
    vp_home: row.vp_home,
    vp_away: row.vp_away,
    played_at: row.played_at,
    forfait_side: isForfaitSide(row.forfait_side) ? row.forfait_side : null,
  }));
}

/**
 * Recompute VP for every forfait match in the group from current non-forfait results.
 * Returns the number of forfait rows updated.
 */
export async function recalculateGroupForfaits(
  supabase: SupabaseClient,
  groupId: string,
): Promise<number> {
  const matches = await loadGroupMatchesForForfait(supabase, groupId);
  const forfaits = matches.filter(
    (m): m is ForfaitMatchRow => m.forfait_side != null,
  );
  if (forfaits.length === 0) return 0;

  let updated = 0;
  for (const match of forfaits) {
    const { vpHome, vpAway } = computeForfaitScores(
      match.forfait_side,
      match.home_team_id,
      match.away_team_id,
      matches,
      match.id,
    );

    if (
      Number(match.vp_home) === vpHome &&
      Number(match.vp_away) === vpAway
    ) {
      continue;
    }

    const { error } = await supabase
      .from("matches")
      .update({
        vp_home: vpHome,
        vp_away: vpAway,
        imps_home: null,
        imps_away: null,
      })
      .eq("id", match.id);

    if (error) throw error;

    // Keep in-memory copy current for subsequent forfaits in the same pass
    match.vp_home = vpHome;
    match.vp_away = vpAway;
    updated++;
  }

  return updated;
}

export async function applyForfait(
  supabase: SupabaseClient,
  match: {
    id: string;
    group_id: string;
    home_team_id: string;
    away_team_id: string;
    forfait_side?: ForfaitSide | null;
  },
  side: ForfaitSide,
  userId: string,
): Promise<{ vpHome: number; vpAway: number }> {
  const matches = await loadGroupMatchesForForfait(supabase, match.group_id);
  const { vpHome, vpAway } = computeForfaitScores(
    side,
    match.home_team_id,
    match.away_team_id,
    matches,
    match.id,
  );

  const playedAt = new Date().toISOString();
  const { error } = await supabase
    .from("matches")
    .update({
      forfait_side: side,
      vp_home: vpHome,
      vp_away: vpAway,
      imps_home: null,
      imps_away: null,
      played_at: playedAt,
      mis_seating: false,
      selected_board_count: null,
    })
    .eq("id", match.id);

  if (error) throw error;

  await supabase.from("match_logs").insert({
    match_id: match.id,
    action: `forfait_applied:${JSON.stringify({
      side,
      vp_home: vpHome,
      vp_away: vpAway,
    })}`,
    user_id: userId,
  });

  await recalculateGroupForfaits(supabase, match.group_id);

  return { vpHome, vpAway };
}

export async function clearForfait(
  supabase: SupabaseClient,
  match: { id: string; group_id: string },
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from("matches")
    .update({
      forfait_side: null,
      vp_home: null,
      vp_away: null,
      imps_home: null,
      imps_away: null,
      played_at: null,
      vp_board_count: null,
      mis_seating: false,
      selected_board_count: null,
    })
    .eq("id", match.id);

  if (error) throw error;

  await supabase.from("match_logs").insert({
    match_id: match.id,
    action: "forfait_cleared",
    user_id: userId,
  });

  await recalculateGroupForfaits(supabase, match.group_id);
}
