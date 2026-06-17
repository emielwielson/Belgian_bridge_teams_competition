import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath, revalidateTag } from "next/cache";
import {
  standingsGroupTag,
  standingsLeagueTag,
} from "./standings-cache";

export async function revalidateStandingsForGroup(
  supabase: SupabaseClient,
  groupId: string,
): Promise<void> {
  revalidateTag(standingsGroupTag(groupId), "max");
  revalidatePath(`/standings/group/${groupId}`);

  const { data: group } = await supabase
    .from("groups")
    .select(
      `
      id,
      division:divisions (
        id,
        league:leagues (id)
      )
    `,
    )
    .eq("id", groupId)
    .maybeSingle();

  const rawDivision = group?.division as unknown;
  const division = (Array.isArray(rawDivision) ? rawDivision[0] : rawDivision) as
    | { league: { id: string } | { id: string }[] }
    | undefined;
  const league = division?.league;
  const leagueId = Array.isArray(league) ? league[0]?.id : league?.id;

  if (leagueId) {
    revalidateTag(standingsLeagueTag(leagueId), "max");
    revalidatePath(`/standings/league/${leagueId}`);
  }
}

export async function revalidateStandingsForTeam(
  supabase: SupabaseClient,
  teamId: string,
): Promise<void> {
  const { data: team } = await supabase
    .from("teams")
    .select("group_id")
    .eq("id", teamId)
    .maybeSingle();

  if (team?.group_id) {
    await revalidateStandingsForGroup(supabase, team.group_id);
  }
}

export async function revalidatePlayersForMatch(
  supabase: SupabaseClient,
  matchId: string,
): Promise<void> {
  const { data: rows, error } = await supabase
    .from("match_players")
    .select("player_id")
    .eq("match_id", matchId);

  if (error) throw error;

  const playerIds = new Set((rows ?? []).map((row) => row.player_id));
  for (const playerId of playerIds) {
    revalidatePath(`/players/${playerId}`);
  }
}
