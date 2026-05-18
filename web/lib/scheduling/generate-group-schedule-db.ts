import type { SupabaseClient } from "@supabase/supabase-js";
import { applyMatchDatesDivisionFilter } from "@/lib/competition/match-dates-query";
import {
  assignTeamSlots,
  buildMatchRows,
  type GeneratedMatch,
  type RoundDate,
} from "./generate-group-schedule";
import { buildRoundRobinSchedule } from "./round-robin-schedule";

type LeagueInfo = {
  season_id: string;
  scope: string;
  region_id: string | null;
};

async function fetchMatchDates(
  supabase: SupabaseClient,
  league: LeagueInfo,
  groupId: string,
  roundCount: number,
): Promise<RoundDate[]> {
  const { data: datesDivisionId, error: resolveError } = await supabase.rpc(
    "resolve_group_match_dates_division_id",
    { p_group_id: groupId },
  );
  if (resolveError) throw new Error(resolveError.message);

  let datesQuery = supabase
    .from("competition_match_dates")
    .select("round, datetime")
    .eq("season_id", league.season_id)
    .eq("scope", league.scope)
    .order("round");

  datesQuery =
    league.scope === "national"
      ? datesQuery.is("region_id", null)
      : datesQuery.eq("region_id", league.region_id!);

  datesQuery = applyMatchDatesDivisionFilter(datesQuery, datesDivisionId);

  const { data: dates, error: datesError } = await datesQuery;
  if (datesError) throw new Error(datesError.message);
  if (!dates || dates.length < roundCount) {
    throw new Error(`Missing competition match dates (need ${roundCount})`);
  }

  return dates.map((d) => ({ round: d.round, datetime: d.datetime }));
}

function buildRbbfMatches(
  groupId: string,
  teamIds: string[],
  roundDates: RoundDate[],
  boardCount: number,
  roundCount: number,
): GeneratedMatch[] {
  const teams = assignTeamSlots(teamIds);
  return buildMatchRows(groupId, teams, roundDates, boardCount, roundCount);
}

function buildRegionalGenericMatches(
  groupId: string,
  teamIds: string[],
  roundDates: RoundDate[],
  boardCount: number,
  roundRobinCount: number,
): { matches: GeneratedMatch[]; byes: { round: number; team_id: string }[] } {
  const dateByRound = new Map(roundDates.map((d) => [d.round, d.datetime]));
  const plans = buildRoundRobinSchedule(teamIds, roundRobinCount);
  const matches: GeneratedMatch[] = [];
  const byes: { round: number; team_id: string }[] = [];

  for (const plan of plans) {
    const datetime = dateByRound.get(plan.round);
    if (!datetime) {
      throw new Error(`Missing datetime for round ${plan.round}`);
    }
    for (const p of plan.pairings) {
      matches.push({
        group_id: groupId,
        round: plan.round,
        datetime,
        home_team_id: p.homeTeamId,
        away_team_id: p.awayTeamId,
        board_count: boardCount,
      });
    }
    if (plan.byeTeamId) {
      byes.push({ round: plan.round, team_id: plan.byeTeamId });
    }
  }

  return { matches, byes };
}

export async function generateGroupScheduleInDb(
  supabase: SupabaseClient,
  groupId: string,
  boardCount = 24,
): Promise<{ matchesCreated: number; rounds: number; byesCreated: number }> {
  const { error: validateError } = await supabase.rpc(
    "validate_group_schedule_generation",
    { p_group_id: groupId },
  );
  if (validateError) throw new Error(validateError.message);

  const { data: groupRow, error: groupError } = await supabase
    .from("groups")
    .select(
      `
      round_count,
      round_robin_count,
      division:divisions (
        league:leagues (season_id, scope, region_id)
      )
    `,
    )
    .eq("id", groupId)
    .single();

  if (groupError) throw new Error(groupError.message);

  const division = Array.isArray(groupRow.division)
    ? groupRow.division[0]
    : groupRow.division;
  const leagueRow = division?.league;
  const league = (Array.isArray(leagueRow) ? leagueRow[0] : leagueRow) as
    | LeagueInfo
    | undefined;
  if (!league) throw new Error("Group league not found");

  const { data: teamRows, error: teamsError } = await supabase
    .from("teams")
    .select("id")
    .eq("group_id", groupId)
    .order("created_at");
  if (teamsError) throw new Error(teamsError.message);
  if (!teamRows || teamRows.length < 2) {
    throw new Error("Group must have at least 2 teams");
  }

  const teamIds = teamRows.map((t) => t.id);
  const teamCount = teamIds.length;
  const roundCount = groupRow.round_count ?? 14;
  const roundRobinCount = groupRow.round_robin_count ?? 2;
  const roundDates = await fetchMatchDates(
    supabase,
    league,
    groupId,
    roundCount,
  );

  let matchRows: GeneratedMatch[];
  let byeRows: { round: number; team_id: string }[] = [];

  if (league.scope === "national") {
    if (teamCount !== 8) {
      throw new Error("National group must have exactly 8 teams");
    }
    matchRows = buildRbbfMatches(
      groupId,
      teamIds,
      roundDates,
      boardCount,
      roundCount,
    );
  } else if (teamCount === 8) {
    matchRows = buildRbbfMatches(
      groupId,
      teamIds,
      roundDates,
      boardCount,
      roundCount,
    );
  } else {
    const result = buildRegionalGenericMatches(
      groupId,
      teamIds,
      roundDates,
      boardCount,
      roundRobinCount,
    );
    matchRows = result.matches;
    byeRows = result.byes;
  }

  const { error: insertError } = await supabase.from("matches").insert(matchRows);
  if (insertError) throw new Error(insertError.message);

  if (byeRows.length > 0) {
    const { error: byeError } = await supabase.from("group_bye_rounds").insert(
      byeRows.map((b) => ({
        group_id: groupId,
        round: b.round,
        team_id: b.team_id,
        vp: 12,
      })),
    );
    if (byeError) throw new Error(byeError.message);
  }

  return {
    matchesCreated: matchRows.length,
    rounds: roundCount,
    byesCreated: byeRows.length,
  };
}
