import type { SupabaseClient } from "@supabase/supabase-js";
import { applyMatchDatesDivisionFilter } from "@/lib/competition/match-dates-query";
import {
  assignTeamSlots,
  buildMatchRows,
  type RoundDate,
} from "./generate-group-schedule";

export async function generateGroupScheduleInDb(
  supabase: SupabaseClient,
  groupId: string,
  boardCount = 24,
): Promise<{ matchesCreated: number; rounds: number }> {
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
      division:divisions (
        league:leagues (season_id, scope, region_id)
      )
    `,
    )
    .eq("id", groupId)
    .single();

  if (groupError) throw new Error(groupError.message);

  const roundCount = groupRow.round_count ?? 14;
  const division = Array.isArray(groupRow.division)
    ? groupRow.division[0]
    : groupRow.division;
  const leagueRow = division?.league;
  const league = (Array.isArray(leagueRow) ? leagueRow[0] : leagueRow) as
    | { season_id: string; scope: string; region_id: string | null }
    | undefined;
  if (!league) throw new Error("Group league not found");

  const { data: teamRows, error: teamsError } = await supabase
    .from("teams")
    .select("id")
    .eq("group_id", groupId)
    .order("created_at");
  if (teamsError) throw new Error(teamsError.message);
  if (!teamRows || teamRows.length !== 8) {
    throw new Error("Group must have exactly 8 teams");
  }

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

  const teams = assignTeamSlots(teamRows.map((t) => t.id));
  const roundDates: RoundDate[] = dates.map((d) => ({
    round: d.round,
    datetime: d.datetime,
  }));
  const matchRows = buildMatchRows(
    groupId,
    teams,
    roundDates,
    boardCount,
    roundCount,
  );

  const { error: insertError } = await supabase.from("matches").insert(matchRows);
  if (insertError) throw new Error(insertError.message);

  return { matchesCreated: matchRows.length, rounds: roundCount };
}
