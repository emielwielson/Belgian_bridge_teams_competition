import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchGroupFixtureRoundDates } from "@/lib/competition/group-match-rounds";
import {
  loadSlotAssignmentsForGeneration,
  seedGroupScheduleSlotsIfEmpty,
  usesRbbfTemplate,
} from "@/lib/competition/group-schedule-slots";
import {
  assignTeamSlots,
  buildRbbfSchedule,
  type GeneratedMatch,
  type RoundDate,
} from "./generate-group-schedule";
import { buildRoundRobinSchedule } from "./round-robin-schedule";

type LeagueInfo = {
  season_id: string;
  scope: string;
  region_id: string | null;
};

function buildRegionalGenericMatches(
  groupId: string,
  teamIds: string[],
  roundDates: RoundDate[],
  boardCount: number,
  roundRobinCount: number,
): { matches: GeneratedMatch[]; byes: { round: number; team_id: string }[] } {
  const plans = buildRoundRobinSchedule(teamIds, roundRobinCount);
  const matches: GeneratedMatch[] = [];
  const byes: { round: number; team_id: string }[] = [];

  for (const plan of plans) {
    const fixtureDate = roundDates[plan.round - 1];
    if (!fixtureDate) {
      throw new Error(`Missing datetime for fixture round ${plan.round}`);
    }
    const calendarRound = fixtureDate.round;
    const datetime = fixtureDate.datetime;

    for (const p of plan.pairings) {
      matches.push({
        group_id: groupId,
        round: calendarRound,
        datetime,
        home_team_id: p.homeTeamId,
        away_team_id: p.awayTeamId,
        board_count: boardCount,
      });
    }
    if (plan.byeTeamId) {
      byes.push({ round: calendarRound, team_id: plan.byeTeamId });
    }
  }

  return { matches, byes };
}

export async function generateGroupScheduleInDb(
  supabase: SupabaseClient,
  groupId: string,
  boardCount = 24,
): Promise<{ matchesCreated: number; rounds: number; byesCreated: number }> {
  await seedGroupScheduleSlotsIfEmpty(supabase, groupId);

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
  const roundDates = await fetchGroupFixtureRoundDates(
    supabase,
    groupId,
    league,
    roundCount,
  );

  const slotAssignments = await loadSlotAssignmentsForGeneration(
    supabase,
    groupId,
    teamIds,
  );

  const onRbbfPath =
    slotAssignments !== null &&
    usesRbbfTemplate(league.scope, teamCount, slotAssignments);

  let matchRows: GeneratedMatch[];
  let byeRows: { round: number; team_id: string }[] = [];

  if (onRbbfPath && slotAssignments) {
    const result = buildRbbfSchedule(
      groupId,
      slotAssignments,
      roundDates,
      boardCount,
      roundCount,
    );
    matchRows = result.matches;
    byeRows = result.byes;
  } else if (league.scope === "national") {
    throw new Error(
      "National group requires complete schedule slot assignments (7 teams + bye, or 8 teams)",
    );
  } else if (teamCount === 8) {
    const teams = assignTeamSlots(teamIds);
    const result = buildRbbfSchedule(
      groupId,
      teams,
      roundDates,
      boardCount,
      roundCount,
    );
    matchRows = result.matches;
    byeRows = result.byes;
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
